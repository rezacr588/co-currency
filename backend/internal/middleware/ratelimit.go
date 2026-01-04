package middleware

import (
	"net/http"
	"sync"

	"github.com/rezacr588/currency-converter/pkg/httputil"
	"golang.org/x/time/rate"
)

// RateLimiter implements per-IP rate limiting
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	limit    rate.Limit
	burst    int
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		limit:    rate.Limit(float64(requestsPerMinute) / 60.0),
		burst:    requestsPerMinute / 10, // Allow burst of 10% of limit
	}
}

// getLimiter returns the rate limiter for a given IP
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(rl.limit, rl.burst)
		rl.limiters[ip] = limiter
	}

	return limiter
}

// Middleware returns the rate limiting middleware
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr

		// Try to get real IP from headers (for proxies)
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = forwarded
		} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
			ip = realIP
		}

		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			httputil.TooManyRequests(w, "Rate limit exceeded. Please try again later.")
			return
		}

		next.ServeHTTP(w, r)
	})
}
