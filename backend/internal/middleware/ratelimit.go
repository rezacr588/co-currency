package middleware

import (
	"math"
	"net/http"
	"strings"
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
	limiters        map[string]*rateLimiterEntry
	mu              sync.RWMutex
	limit           rate.Limit
	burst           int
	cleanupInterval time.Duration
	entryTTL        time.Duration
	stopCleanup     chan struct{}
	authLimit       rate.Limit // Higher limit for authenticated users
	authBurst       int
	loginLimit      rate.Limit // Stricter limit for login attempts
	loginBurst      int
	aiLimit         rate.Limit // Stricter limit for AI endpoints
	aiBurst         int
}

// RateLimiterConfig holds configuration for the rate limiter
type RateLimiterConfig struct {
	RequestsPerMinute      int           // Default limit for anonymous users
	AuthRequestsPerMinute  int           // Limit for authenticated users (0 = use default)
	LoginAttemptsPerMinute int           // Limit for login endpoint (0 = use 5)
	AIRequestsPerMinute    int           // Limit for AI endpoints per user (0 = use 20)
	CleanupInterval        time.Duration // How often to clean up stale entries (0 = 5 minutes)
	EntryTTL               time.Duration // How long to keep inactive entries (0 = 15 minutes)
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
		cfg.CleanupInterval = 5 * time.Minute
	}
	if cfg.EntryTTL == 0 {
		cfg.EntryTTL = 15 * time.Minute
	}
	if cfg.AuthRequestsPerMinute == 0 {
		cfg.AuthRequestsPerMinute = cfg.RequestsPerMinute // Same as anonymous by default
	}
	if cfg.LoginAttemptsPerMinute == 0 {
		cfg.LoginAttemptsPerMinute = 5 // 5 login attempts per minute
	}
	if cfg.AIRequestsPerMinute == 0 {
		cfg.AIRequestsPerMinute = 20 // 20 AI requests per minute
	}

	rl := &RateLimiter{
		limiters:        make(map[string]*rateLimiterEntry),
		limit:           rate.Limit(float64(cfg.RequestsPerMinute) / 60.0),
		burst:           cfg.RequestsPerMinute / 2, // Allow larger burst for page loads
		cleanupInterval: cfg.CleanupInterval,
		entryTTL:        cfg.EntryTTL,
		stopCleanup:     make(chan struct{}),
		authLimit:       rate.Limit(float64(cfg.AuthRequestsPerMinute) / 60.0),
		authBurst:       cfg.AuthRequestsPerMinute / 2, // Allow larger burst for authenticated users
		loginLimit:      rate.Limit(float64(cfg.LoginAttemptsPerMinute) / 60.0),
		loginBurst:      2, // Allow small burst for login
		aiLimit:         rate.Limit(float64(cfg.AIRequestsPerMinute) / 60.0),
		aiBurst:         5, // Allow small burst for AI
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

// AISettings returns the configured AI endpoint rate limit and burst values.
func (rl *RateLimiter) AISettings() (requestsPerMinute int, burst int) {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	perMin := int(math.Round(float64(rl.aiLimit) * 60))
	if perMin < 1 {
		perMin = 1
	}

	return perMin, rl.aiBurst
}

// getLimiter returns the rate limiter for a given key with specified limits
func (rl *RateLimiter) getLimiter(key string, limit rate.Limit, burst int) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.limiters[key]
	if !exists {
		// Emergency guard: if the map grows beyond 100k entries, skip adding
		// new ones to prevent unbounded memory growth from a DDoS or scan.
		if len(rl.limiters) > 50000 {
			log.Warn().Int("size", len(rl.limiters)).Msg("Rate limiter map exceeded 50k entries, rejecting new entry")
			return rate.NewLimiter(limit, burst)
		}
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

// getIP extracts the client IP from request headers.
//
// SECURITY NOTE: X-Forwarded-For and X-Real-IP headers can be spoofed by
// the client. These headers should only be trusted when the request comes
// through a known reverse proxy (e.g., Koyeb, Cloudflare). Currently this
// app runs behind Koyeb's reverse proxy which sets these headers reliably.
//
// TODO: For stricter environments, implement a TrustedProxies list and only
// trust forwarding headers when r.RemoteAddr matches a trusted proxy CIDR.
// When no trusted proxy is configured, prefer r.RemoteAddr directly.
func getIP(r *http.Request) string {
	// Try to get real IP from headers (for proxies)
	// X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
	// Always use the first IP (the original client)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// Split by comma and take the first IP to prevent rate limit bypass
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
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
			httputil.TooManyRequestsWithContext(r.Context(), w, "rate limit exceeded", nil)
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
			httputil.TooManyRequestsWithContext(r.Context(), w, "too many login attempts", nil)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// AllowPerKey consumes a token from the login-tier limiter keyed by the given
// prefix and identifier. Returns true if allowed, false if the caller should
// reject the request. Use for secondary limits beyond IP (e.g. per-email on
// password reset to prevent targeted account spam).
func (rl *RateLimiter) AllowPerKey(prefix, id string) bool {
	if id == "" {
		return true
	}
	limiter := rl.getLimiter(prefix+":"+strings.ToLower(id), rl.loginLimit, rl.loginBurst)
	return limiter.Allow()
}

// AIMiddleware returns a stricter rate limiting middleware for AI endpoints (per user)
func (rl *RateLimiter) AIMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// AI endpoints are always authenticated, use user ID if available
		userID, authenticated := r.Context().Value(UserIDKey).(uuid.UUID)
		var key string
		if authenticated && userID != uuid.Nil {
			key = "ai:user:" + userID.String()
		} else {
			key = "ai:ip:" + getIP(r)
		}

		limiter := rl.getLimiter(key, rl.aiLimit, rl.aiBurst)

		if !limiter.Allow() {
			httputil.TooManyRequestsWithContext(r.Context(), w, "too many AI requests, please slow down", nil)
			return
		}

		next.ServeHTTP(w, r)
	})
}
