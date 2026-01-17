package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

// rateLimiterEntry holds a limiter and its last access time for cleanup
type rateLimiterEntry struct {
	limiter    *rate.Limiter
	lastAccess time.Time
}

// RateLimiter implements per-IP rate limiting with automatic cleanup
type RateLimiter struct {
	limiters         map[string]*rateLimiterEntry
	mu               sync.RWMutex
	limit            rate.Limit
	burst            int
	cleanupInterval  time.Duration
	entryTTL         time.Duration
	stopCleanup      chan struct{}
	authLimit        rate.Limit // Higher limit for authenticated users
	authBurst        int
	loginLimit       rate.Limit // Stricter limit for login attempts
	loginBurst       int
}

// RateLimiterConfig holds configuration for the rate limiter
type RateLimiterConfig struct {
	RequestsPerMinute     int           // Default limit for anonymous users
	AuthRequestsPerMinute int           // Limit for authenticated users (0 = use default)
	LoginAttemptsPerMinute int          // Limit for login endpoint (0 = use 5)
	CleanupInterval       time.Duration // How often to clean up stale entries (0 = 10 minutes)
	EntryTTL              time.Duration // How long to keep inactive entries (0 = 30 minutes)
}

// NewRateLimiter creates a new rate limiter with cleanup goroutine
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	return NewRateLimiterWithConfig(RateLimiterConfig{
		RequestsPerMinute: requestsPerMinute,
	})
}

// NewRateLimiterWithConfig creates a new rate limiter with full configuration
func NewRateLimiterWithConfig(cfg RateLimiterConfig) *RateLimiter {
	if cfg.CleanupInterval == 0 {
		cfg.CleanupInterval = 10 * time.Minute
	}
	if cfg.EntryTTL == 0 {
		cfg.EntryTTL = 30 * time.Minute
	}
	if cfg.AuthRequestsPerMinute == 0 {
		cfg.AuthRequestsPerMinute = cfg.RequestsPerMinute // Same as anonymous by default
	}
	if cfg.LoginAttemptsPerMinute == 0 {
		cfg.LoginAttemptsPerMinute = 5 // 5 login attempts per minute
	}

	rl := &RateLimiter{
		limiters:        make(map[string]*rateLimiterEntry),
		limit:           rate.Limit(float64(cfg.RequestsPerMinute) / 60.0),
		burst:           cfg.RequestsPerMinute / 10,
		cleanupInterval: cfg.CleanupInterval,
		entryTTL:        cfg.EntryTTL,
		stopCleanup:     make(chan struct{}),
		authLimit:       rate.Limit(float64(cfg.AuthRequestsPerMinute) / 60.0),
		authBurst:       cfg.AuthRequestsPerMinute / 10,
		loginLimit:      rate.Limit(float64(cfg.LoginAttemptsPerMinute) / 60.0),
		loginBurst:      2, // Allow small burst for login
	}

	// Ensure burst is at least 1
	if rl.burst < 1 {
		rl.burst = 1
	}
	if rl.authBurst < 1 {
		rl.authBurst = 1
	}

	// Start cleanup goroutine
	go rl.cleanupLoop()

	return rl
}

// cleanupLoop periodically removes stale rate limiter entries
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.cleanup()
		case <-rl.stopCleanup:
			return
		}
	}
}

// cleanup removes entries that haven't been accessed recently
func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	staleCount := 0

	for ip, entry := range rl.limiters {
		if now.Sub(entry.lastAccess) > rl.entryTTL {
			delete(rl.limiters, ip)
			staleCount++
		}
	}

	if staleCount > 0 {
		log.Debug().Int("removed", staleCount).Int("remaining", len(rl.limiters)).Msg("Rate limiter cleanup completed")
	}
}

// Stop stops the cleanup goroutine
func (rl *RateLimiter) Stop() {
	close(rl.stopCleanup)
}

// Stats returns current rate limiter statistics
func (rl *RateLimiter) Stats() map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	return map[string]interface{}{
		"active_entries": len(rl.limiters),
		"limit_per_min":  float64(rl.limit) * 60,
		"burst":          rl.burst,
	}
}

// getLimiter returns the rate limiter for a given key with specified limits
func (rl *RateLimiter) getLimiter(key string, limit rate.Limit, burst int) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.limiters[key]
	if !exists {
		entry = &rateLimiterEntry{
			limiter:    rate.NewLimiter(limit, burst),
			lastAccess: time.Now(),
		}
		rl.limiters[key] = entry
	} else {
		entry.lastAccess = time.Now()
	}

	return entry.limiter
}

// getIP extracts the client IP from request headers
func getIP(r *http.Request) string {
	// Try to get real IP from headers (for proxies)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return forwarded
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}
	return r.RemoteAddr
}

// Middleware returns the rate limiting middleware with per-user limits
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)

		// Check if user is authenticated (user ID in context)
		// Note: This uses the UserIDKey from auth.go
		userID, authenticated := r.Context().Value(UserIDKey).(uuid.UUID)

		var limiter *rate.Limiter
		var key string

		if authenticated && userID != uuid.Nil {
			// Use user-specific rate limit (higher limits for authenticated users)
			key = "user:" + userID.String()
			limiter = rl.getLimiter(key, rl.authLimit, rl.authBurst)
		} else {
			// Use IP-based rate limit for anonymous users
			key = "ip:" + ip
			limiter = rl.getLimiter(key, rl.limit, rl.burst)
		}

		if !limiter.Allow() {
			httputil.TooManyRequests(w, "Rate limit exceeded. Please try again later.")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// LoginMiddleware returns a stricter rate limiting middleware for login endpoints
func (rl *RateLimiter) LoginMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)
		key := "login:" + ip

		limiter := rl.getLimiter(key, rl.loginLimit, rl.loginBurst)

		if !limiter.Allow() {
			httputil.TooManyRequests(w, "Too many login attempts. Please try again later.")
			return
		}

		next.ServeHTTP(w, r)
	})
}
