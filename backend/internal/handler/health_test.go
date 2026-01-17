package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandler_Health(t *testing.T) {
	handler := New(nil)

	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()

	handler.Health(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	// Check response body contains "ok"
	if rr.Body.String() == "" {
		t.Error("Expected non-empty response body")
	}
}

func TestHandler_HealthDetailed_NoDatabase(t *testing.T) {
	handler := New(nil)

	req := httptest.NewRequest("GET", "/health/detailed", nil)
	rr := httptest.NewRecorder()

	handler.HealthDetailed(rr, req)

	// Without a database, the health check should return unhealthy
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503 when database not configured, got %d", rr.Code)
	}
}

func TestHandler_HealthDetailed_WithConfig(t *testing.T) {
	handler := NewWithConfig(nil, &HandlerConfig{
		DB:          nil,
		Cache:       nil,
		RateLimiter: nil,
	})

	req := httptest.NewRequest("GET", "/health/detailed", nil)
	rr := httptest.NewRecorder()

	handler.HealthDetailed(rr, req)

	// Without a database, the health check should return unhealthy
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503 when database not configured, got %d", rr.Code)
	}
}

func TestNew_NilExchangeService(t *testing.T) {
	handler := New(nil)
	if handler == nil {
		t.Error("Expected handler to be created")
	}
}

func TestNewWithConfig(t *testing.T) {
	handler := NewWithConfig(nil, nil)
	if handler == nil {
		t.Error("Expected handler to be created with nil config")
	}

	handler = NewWithConfig(nil, &HandlerConfig{})
	if handler == nil {
		t.Error("Expected handler to be created with empty config")
	}
}

// Test checkDatabase helper when db is nil
func TestHandler_checkDatabase_nil(t *testing.T) {
	handler := New(nil)

	health := handler.checkDatabase(nil)

	if health.Status != "unhealthy" {
		t.Errorf("Expected status 'unhealthy', got %s", health.Status)
	}

	if health.Message != "database not configured" {
		t.Errorf("Expected message 'database not configured', got %s", health.Message)
	}
}

// Test checkCache helper when cache is nil
func TestHandler_checkCache_nil(t *testing.T) {
	handler := New(nil)

	health := handler.checkCache()

	if health.Status != "degraded" {
		t.Errorf("Expected status 'degraded', got %s", health.Status)
	}

	if health.Message != "cache not configured" {
		t.Errorf("Expected message 'cache not configured', got %s", health.Message)
	}
}

// Test checkExternalAPI helper when exchangeService is nil
func TestHandler_checkExternalAPI_nil(t *testing.T) {
	handler := New(nil)

	health := handler.checkExternalAPI(nil)

	if health.Status != "degraded" {
		t.Errorf("Expected status 'degraded', got %s", health.Status)
	}

	if health.Message != "exchange service not configured" {
		t.Errorf("Expected message 'exchange service not configured', got %s", health.Message)
	}
}

// Test checkRateLimiter helper when rateLimiter is nil
func TestHandler_checkRateLimiter_nil(t *testing.T) {
	handler := New(nil)

	health := handler.checkRateLimiter()

	if health.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got %s", health.Status)
	}

	if health.Message != "not configured" {
		t.Errorf("Expected message 'not configured', got %s", health.Message)
	}
}

// Test HealthResponse structure
func TestHealthResponse(t *testing.T) {
	response := HealthResponse{Status: "ok"}

	if response.Status != "ok" {
		t.Errorf("Expected status 'ok', got %s", response.Status)
	}
}

// Test DetailedHealthResponse structure
func TestDetailedHealthResponse(t *testing.T) {
	response := DetailedHealthResponse{
		Status:    "healthy",
		Timestamp: "2024-01-01T00:00:00Z",
		Version:   "1.0.0",
		Checks:    make(map[string]ComponentHealth),
	}

	if response.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got %s", response.Status)
	}

	if response.Version != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got %s", response.Version)
	}
}

// Test ComponentHealth structure
func TestComponentHealth(t *testing.T) {
	health := ComponentHealth{
		Status:  "healthy",
		Message: "connected",
		Latency: "10ms",
	}

	if health.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got %s", health.Status)
	}

	if health.Message != "connected" {
		t.Errorf("Expected message 'connected', got %s", health.Message)
	}

	if health.Latency != "10ms" {
		t.Errorf("Expected latency '10ms', got %s", health.Latency)
	}
}
