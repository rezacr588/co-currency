package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestSecurity_SetsAllHeaders(t *testing.T) {
	// Ensure we are not in development mode for this test
	os.Setenv("ENVIRONMENT", "production")
	defer os.Unsetenv("ENVIRONMENT")

	handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":       "DENY",
		"X-XSS-Protection":      "1; mode=block",
		"Referrer-Policy":       "strict-origin-when-cross-origin",
		"Permissions-Policy":    "camera=(), microphone=(), geolocation=()",
	}

	for header, expectedValue := range expectedHeaders {
		got := rr.Header().Get(header)
		if got != expectedValue {
			t.Errorf("Expected %s = %q, got %q", header, expectedValue, got)
		}
	}
}

func TestSecurity_NoHSTS_InDevelopment(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	defer os.Unsetenv("ENVIRONMENT")

	handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	hsts := rr.Header().Get("Strict-Transport-Security")
	if hsts != "" {
		t.Errorf("Expected no HSTS header in development, got %q", hsts)
	}
}

func TestSecurity_HSTS_InProduction(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	defer os.Unsetenv("ENVIRONMENT")

	handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	hsts := rr.Header().Get("Strict-Transport-Security")
	expectedHSTS := "max-age=31536000; includeSubDomains"
	if hsts != expectedHSTS {
		t.Errorf("Expected HSTS header %q in production, got %q", expectedHSTS, hsts)
	}
}

func TestSecurity_HSTS_WhenEnvironmentNotSet(t *testing.T) {
	// When ENVIRONMENT is not set (empty), isDev is false, so HSTS should be set
	os.Unsetenv("ENVIRONMENT")

	handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	hsts := rr.Header().Get("Strict-Transport-Security")
	if hsts == "" {
		t.Error("Expected HSTS header when ENVIRONMENT is not 'development'")
	}
}

func TestSecurity_CallsNextHandler(t *testing.T) {
	os.Unsetenv("ENVIRONMENT")

	handlerCalled := false
	handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if !handlerCalled {
		t.Error("Expected next handler to be called")
	}

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status 201 from next handler, got %d", rr.Code)
	}
}

func TestSecurity_HeadersSetOnAllMethods(t *testing.T) {
	os.Unsetenv("ENVIRONMENT")

	methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			handler := Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(method, "/test", nil)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Errorf("Expected X-Content-Type-Options header for %s method", method)
			}
			if rr.Header().Get("X-Frame-Options") != "DENY" {
				t.Errorf("Expected X-Frame-Options header for %s method", method)
			}
			if rr.Header().Get("X-XSS-Protection") != "1; mode=block" {
				t.Errorf("Expected X-XSS-Protection header for %s method", method)
			}
			if rr.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
				t.Errorf("Expected Referrer-Policy header for %s method", method)
			}
			if rr.Header().Get("Permissions-Policy") != "camera=(), microphone=(), geolocation=()" {
				t.Errorf("Expected Permissions-Policy header for %s method", method)
			}
		})
	}
}
