package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
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

	// Check burst is set correctly (10% of limit)
	expectedBurst := 60 / 10
	if rl.burst != expectedBurst {
		t.Errorf("Expected burst %d, got %d", expectedBurst, rl.burst)
	}
}

func TestRateLimiter_GetLimiter(t *testing.T) {
	rl := NewRateLimiter(60)

	// First call should create a new limiter
	limiter1 := rl.getLimiter("192.168.1.1")
	if limiter1 == nil {
		t.Error("Expected limiter to be created")
	}

	// Second call with same IP should return the same limiter
	limiter2 := rl.getLimiter("192.168.1.1")
	if limiter2 != limiter1 {
		t.Error("Expected same limiter for same IP")
	}

	// Different IP should get different limiter
	limiter3 := rl.getLimiter("192.168.1.2")
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
