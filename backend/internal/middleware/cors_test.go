package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS_AllowedOrigin(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	// Check CORS headers reflect the allowed origin
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Expected Access-Control-Allow-Origin to be http://localhost:5173, got %q", got)
	}

	if rr.Header().Get("Vary") != "Origin" {
		t.Error("Expected Vary: Origin header")
	}

	if rr.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("Expected Access-Control-Allow-Methods header")
	}

	if rr.Header().Get("Access-Control-Allow-Headers") != "Content-Type, Authorization, X-Query-Params, X-Trace-Id" {
		t.Error("Expected Access-Control-Allow-Headers header")
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.example.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	// No CORS header should be set for disallowed origin
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Expected no Access-Control-Allow-Origin header, got %q", got)
	}
}

func TestCORS_NoOriginHeader(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	// No CORS header should be set when there is no Origin header
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Expected no Access-Control-Allow-Origin header, got %q", got)
	}
}

func TestCORS_OptionsRequest(t *testing.T) {
	handlerCalled := false
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	if handlerCalled {
		t.Error("Expected next handler NOT to be called for OPTIONS request")
	}

	// Check CORS headers are still set for allowed origin
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Expected Access-Control-Allow-Origin to be http://localhost:5173, got %q", got)
	}
}

func TestCORS_PostRequest(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest("POST", "/test", nil)
	req.Header.Set("Origin", "http://localhost:8080")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", rr.Code)
	}
}
