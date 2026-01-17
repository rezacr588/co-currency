package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
)

func setupTestHandler() *Handler {
	cfg := &config.Config{
		Port:            "8080",
		Environment:     "test",
		CacheTTL:        5 * time.Minute,
		RateLimitPerMin: 100,
		FrankfurterURL:  "https://api.frankfurter.app",
	}
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	client := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	exchangeService := service.NewExchangeService(cfg, client, cache, nil)
	return New(exchangeService)
}

func TestHealth(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	h.Health(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Health() status = %v, want %v", rec.Code, http.StatusOK)
	}

	var resp HealthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if resp.Status != "ok" {
		t.Errorf("Health().Status = %v, want ok", resp.Status)
	}
}

func TestGetCurrencies(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/currencies", nil)
	rec := httptest.NewRecorder()

	h.GetCurrencies(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("GetCurrencies() status = %v, want %v", rec.Code, http.StatusOK)
	}

	var currencies []model.Currency
	if err := json.NewDecoder(rec.Body).Decode(&currencies); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(currencies) == 0 {
		t.Error("GetCurrencies() returned empty list")
	}

	// Check USD is present
	found := false
	for _, c := range currencies {
		if c.Code == "USD" {
			found = true
			break
		}
	}
	if !found {
		t.Error("GetCurrencies() missing USD")
	}
}

func TestConvert_MissingParams(t *testing.T) {
	h := setupTestHandler()

	tests := []struct {
		name  string
		query string
	}{
		{"missing from", "?to=EUR&amount=100"},
		{"missing to", "?from=USD&amount=100"},
		{"missing amount", "?from=USD&to=EUR"},
		{"empty params", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/convert"+tt.query, nil)
			rec := httptest.NewRecorder()

			h.Convert(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("Convert() status = %v, want %v", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestConvert_InvalidAmount(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/convert?from=USD&to=EUR&amount=invalid", nil)
	rec := httptest.NewRecorder()

	h.Convert(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Convert() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}
}

func TestGetHistorical_InvalidDate(t *testing.T) {
	h := setupTestHandler()

	// Create a chi router context with the date parameter
	req := httptest.NewRequest(http.MethodGet, "/api/v1/historical/invalid-date", nil)
	rec := httptest.NewRecorder()

	// Add chi URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("date", "invalid-date")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.GetHistorical(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("GetHistorical() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}
}

func TestGetRates_DefaultBase(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/rates/", nil)
	rec := httptest.NewRecorder()

	// Add chi URL params with empty base
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("base", "")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.GetRates(rec, req)

	// Should use USD as default and make API call
	// We're not mocking the API, so this might succeed or fail
	// Just check it doesn't panic
	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
		t.Errorf("GetRates() unexpected status = %v", rec.Code)
	}
}

func TestGetRates_WithBase(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/rates/EUR", nil)
	rec := httptest.NewRecorder()

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("base", "EUR")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.GetRates(rec, req)

	// Should work with EUR as base
	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
		t.Errorf("GetRates() unexpected status = %v", rec.Code)
	}
}

func TestGetHistorical_ValidDate(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/historical/2024-01-15?base=EUR", nil)
	rec := httptest.NewRecorder()

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("date", "2024-01-15")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.GetHistorical(rec, req)

	// Should make API call
	if rec.Code != http.StatusOK && rec.Code != http.StatusInternalServerError {
		t.Errorf("GetHistorical() unexpected status = %v", rec.Code)
	}
}

func TestGetHistorical_EmptyDate(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/historical/", nil)
	rec := httptest.NewRecorder()

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("date", "")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.GetHistorical(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("GetHistorical() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}
}

func TestConvert_NegativeAmount(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/convert?from=USD&to=EUR&amount=-100", nil)
	rec := httptest.NewRecorder()

	h.Convert(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Convert() status = %v, want %v for negative amount", rec.Code, http.StatusBadRequest)
	}
}

func TestNew(t *testing.T) {
	cfg := &config.Config{
		Port:            "8080",
		Environment:     "test",
		CacheTTL:        5 * time.Minute,
		RateLimitPerMin: 100,
		FrankfurterURL:  "https://api.frankfurter.app",
	}
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	client := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	exchangeService := service.NewExchangeService(cfg, client, cache, nil)

	h := New(exchangeService)

	if h == nil {
		t.Fatal("Expected handler to be created")
	}

	if h.exchangeService == nil {
		t.Error("Expected exchange service to be set")
	}
}

func TestHealth_Response(t *testing.T) {
	h := setupTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	h.Health(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Health() status = %v, want %v", rec.Code, http.StatusOK)
	}

	var resp HealthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if resp.Status != "ok" {
		t.Errorf("Health().Status = %v, want ok", resp.Status)
	}
}

func TestDateRegex(t *testing.T) {
	validDates := []string{
		"2024-01-01",
		"2023-12-31",
		"2000-06-15",
	}

	invalidDates := []string{
		"2024-1-1",
		"24-01-01",
		"2024/01/01",
		"01-01-2024",
		"invalid",
		"",
	}

	for _, date := range validDates {
		if !dateRegex.MatchString(date) {
			t.Errorf("Expected %s to be valid date", date)
		}
	}

	for _, date := range invalidDates {
		if dateRegex.MatchString(date) {
			t.Errorf("Expected %s to be invalid date", date)
		}
	}
}
