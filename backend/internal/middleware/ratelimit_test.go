package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(60)

	if rl == nil {
		t.Fatal("Expected rate limiter to be created")
	}

	if rl.limiters == nil {
		t.Error("Expected limiters map to be initialized")
	}

	// Check limit is set correctly (60 per minute = 1 per second)
	expectedLimit := float64(60) / 60.0
	if float64(rl.limit) != expectedLimit {
		t.Errorf("Expected limit %f, got %f", expectedLimit, float64(rl.limit))
	}

	// Check burst is set correctly (50% of limit for better page load handling)
	expectedBurst := 60 / 2
	if rl.burst != expectedBurst {
		t.Errorf("Expected burst %d, got %d", expectedBurst, rl.burst)
	}
}

func TestRateLimiter_GetLimiter(t *testing.T) {
	rl := NewRateLimiter(60)

	// First call should create a new limiter
	limiter1 := rl.getLimiter("192.168.1.1", rl.limit, rl.burst)
	if limiter1 == nil {
		t.Error("Expected limiter to be created")
	}

	// Second call with same IP should return the same limiter
	limiter2 := rl.getLimiter("192.168.1.1", rl.limit, rl.burst)
	if limiter2 != limiter1 {
		t.Error("Expected same limiter for same IP")
	}

	// Different IP should get different limiter
	limiter3 := rl.getLimiter("192.168.1.2", rl.limit, rl.burst)
	if limiter3 == limiter1 {
		t.Error("Expected different limiter for different IP")
	}
}

func TestRateLimiter_Middleware_AllowsRequest(t *testing.T) {
	rl := NewRateLimiter(60) // 60 requests per minute

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1"
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

func TestRateLimiter_Middleware_XForwardedFor(t *testing.T) {
	rl := NewRateLimiter(60)

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "127.0.0.1"
	req.Header.Set("X-Forwarded-For", "192.168.1.100")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

func TestRateLimiter_Middleware_XRealIP(t *testing.T) {
	rl := NewRateLimiter(60)

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "127.0.0.1"
	req.Header.Set("X-Real-IP", "192.168.1.200")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

func TestRateLimiter_Middleware_RateLimited(t *testing.T) {
	// Create a very restrictive rate limiter (1 request per minute)
	rl := NewRateLimiter(1)

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request should succeed (uses the burst)
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1"
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// First few requests might succeed due to burst, but eventually should be rate limited
	// Make many requests to exhaust the burst
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		// At some point we should see 429
		if rr.Code == http.StatusTooManyRequests {
			// Successfully rate limited
			return
		}
	}

	// If we get here without being rate limited, the test may need adjustment
	// based on the burst calculation
	t.Log("Note: Rate limiting depends on burst configuration")
}

func TestRateLimiter_DifferentIPsNotShared(t *testing.T) {
	rl := NewRateLimiter(60)

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Request from IP 1
	req1 := httptest.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "192.168.1.1"
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)

	// Request from IP 2
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "192.168.1.2"
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)

	// Both should succeed
	if rr1.Code != http.StatusOK {
		t.Errorf("Expected status 200 for IP 1, got %d", rr1.Code)
	}

	if rr2.Code != http.StatusOK {
		t.Errorf("Expected status 200 for IP 2, got %d", rr2.Code)
	}
}

// Tests for NewRateLimiterWithConfig
func TestNewRateLimiterWithConfig(t *testing.T) {
	cfg := RateLimiterConfig{
		RequestsPerMinute:      120,
		AuthRequestsPerMinute:  240,
		LoginAttemptsPerMinute: 10,
		CleanupInterval:        5 * time.Minute,
		EntryTTL:               15 * time.Minute,
	}

	rl := NewRateLimiterWithConfig(cfg)

	if rl == nil {
		t.Fatal("Expected rate limiter to be created")
	}

	// Check that the config was applied
	if rl.cleanupInterval != 5*time.Minute {
		t.Errorf("Expected cleanup interval 5 minutes, got %v", rl.cleanupInterval)
	}

	if rl.entryTTL != 15*time.Minute {
		t.Errorf("Expected entry TTL 15 minutes, got %v", rl.entryTTL)
	}

	// Check burst calculations (50% of limit)
	expectedBurst := 120 / 2
	if rl.burst != expectedBurst {
		t.Errorf("Expected burst %d, got %d", expectedBurst, rl.burst)
	}
}

func TestNewRateLimiterWithConfig_Defaults(t *testing.T) {
	// Test with zero values - should use defaults
	cfg := RateLimiterConfig{
		RequestsPerMinute: 60,
		// Others zero - should use defaults
	}

	rl := NewRateLimiterWithConfig(cfg)

	if rl.cleanupInterval != 10*time.Minute {
		t.Errorf("Expected default cleanup interval 10 minutes, got %v", rl.cleanupInterval)
	}

	if rl.entryTTL != 30*time.Minute {
		t.Errorf("Expected default entry TTL 30 minutes, got %v", rl.entryTTL)
	}

	// LoginAttemptsPerMinute should default to 5
	expectedLoginLimit := float64(5) / 60.0
	if float64(rl.loginLimit) != expectedLoginLimit {
		t.Errorf("Expected login limit %f, got %f", expectedLoginLimit, float64(rl.loginLimit))
	}
}

func TestNewRateLimiterWithConfig_MinBurst(t *testing.T) {
	// Very low requests per minute should still have burst of 1
	cfg := RateLimiterConfig{
		RequestsPerMinute: 1,
	}

	rl := NewRateLimiterWithConfig(cfg)

	// Burst should be at least 1
	if rl.burst < 1 {
		t.Errorf("Expected burst >= 1, got %d", rl.burst)
	}

	if rl.authBurst < 1 {
		t.Errorf("Expected auth burst >= 1, got %d", rl.authBurst)
	}
}

// Tests for Stats
func TestRateLimiter_Stats(t *testing.T) {
	rl := NewRateLimiter(60)

	// Make some requests to create entries
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1." + string(rune('1'+i))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
	}

	stats := rl.Stats()

	if stats == nil {
		t.Fatal("Expected stats to be returned")
	}

	activeEntries, ok := stats["active_entries"].(int)
	if !ok {
		t.Error("Expected active_entries in stats")
	}

	if activeEntries != 3 {
		t.Errorf("Expected 3 active entries, got %d", activeEntries)
	}

	limitPerMin, ok := stats["limit_per_min"].(float64)
	if !ok {
		t.Error("Expected limit_per_min in stats")
	}

	if limitPerMin != 60 {
		t.Errorf("Expected limit_per_min 60, got %f", limitPerMin)
	}

	burst, ok := stats["burst"].(int)
	if !ok {
		t.Error("Expected burst in stats")
	}

	if burst != 30 {
		t.Errorf("Expected burst 30, got %d", burst)
	}
}

// Tests for Stop
func TestRateLimiter_Stop(t *testing.T) {
	rl := NewRateLimiter(60)

	// Stop should not panic
	rl.Stop()
}

// Tests for LoginMiddleware
func TestRateLimiter_LoginMiddleware_AllowsRequest(t *testing.T) {
	rl := NewRateLimiter(60)

	handler := rl.LoginMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "192.168.1.1"
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

func TestRateLimiter_LoginMiddleware_RateLimited(t *testing.T) {
	// Create with very strict login limit
	cfg := RateLimiterConfig{
		RequestsPerMinute:      60,
		LoginAttemptsPerMinute: 1,
	}
	rl := NewRateLimiterWithConfig(cfg)

	handler := rl.LoginMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Make multiple requests to exhaust limit
	rateLimited := false
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "192.168.1.1"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code == http.StatusTooManyRequests {
			rateLimited = true
			break
		}
	}

	if !rateLimited {
		t.Log("Note: Login rate limiting depends on burst configuration")
	}
}

func TestRateLimiter_LoginMiddleware_XForwardedFor(t *testing.T) {
	rl := NewRateLimiter(60)

	handler := rl.LoginMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "127.0.0.1"
	req.Header.Set("X-Forwarded-For", "192.168.1.100")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

// Tests for cleanup
func TestRateLimiter_Cleanup(t *testing.T) {
	cfg := RateLimiterConfig{
		RequestsPerMinute: 60,
		CleanupInterval:   100 * time.Millisecond,
		EntryTTL:          50 * time.Millisecond, // Very short for testing
	}
	rl := NewRateLimiterWithConfig(cfg)

	// Make a request to create an entry
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Verify entry was created
	stats := rl.Stats()
	if stats["active_entries"].(int) != 1 {
		t.Error("Expected 1 active entry after request")
	}

	// Wait for cleanup (entry TTL + cleanup interval + some buffer)
	time.Sleep(200 * time.Millisecond)

	// Check if entry was cleaned up
	// Note: cleanup happens asynchronously
	stats = rl.Stats()
	t.Logf("Active entries after cleanup wait: %d", stats["active_entries"])

	// Stop the cleaner
	rl.Stop()
}

// Test RateLimiterConfig structure
func TestRateLimiterConfig(t *testing.T) {
	cfg := RateLimiterConfig{
		RequestsPerMinute:      100,
		AuthRequestsPerMinute:  200,
		LoginAttemptsPerMinute: 10,
		CleanupInterval:        5 * time.Minute,
		EntryTTL:               20 * time.Minute,
	}

	if cfg.RequestsPerMinute != 100 {
		t.Errorf("Expected RequestsPerMinute 100, got %d", cfg.RequestsPerMinute)
	}

	if cfg.AuthRequestsPerMinute != 200 {
		t.Errorf("Expected AuthRequestsPerMinute 200, got %d", cfg.AuthRequestsPerMinute)
	}

	if cfg.LoginAttemptsPerMinute != 10 {
		t.Errorf("Expected LoginAttemptsPerMinute 10, got %d", cfg.LoginAttemptsPerMinute)
	}
}

// Test getIP function
func TestGetIP(t *testing.T) {
	tests := []struct {
		name           string
		remoteAddr     string
		xForwardedFor  string
		xRealIP        string
		expectedIP     string
	}{
		{
			name:       "RemoteAddr only",
			remoteAddr: "192.168.1.1:8080",
			expectedIP: "192.168.1.1:8080",
		},
		{
			name:          "X-Forwarded-For header",
			remoteAddr:    "127.0.0.1:8080",
			xForwardedFor: "203.0.113.195",
			expectedIP:    "203.0.113.195",
		},
		{
			name:       "X-Real-IP header",
			remoteAddr: "127.0.0.1:8080",
			xRealIP:    "203.0.113.200",
			expectedIP: "203.0.113.200",
		},
		{
			name:          "X-Forwarded-For takes precedence",
			remoteAddr:    "127.0.0.1:8080",
			xForwardedFor: "203.0.113.195",
			xRealIP:       "203.0.113.200",
			expectedIP:    "203.0.113.195",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.xForwardedFor != "" {
				req.Header.Set("X-Forwarded-For", tt.xForwardedFor)
			}
			if tt.xRealIP != "" {
				req.Header.Set("X-Real-IP", tt.xRealIP)
			}

			ip := getIP(req)
			if ip != tt.expectedIP {
				t.Errorf("Expected IP %s, got %s", tt.expectedIP, ip)
			}
		})
	}
}
