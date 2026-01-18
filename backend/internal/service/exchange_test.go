package service

import (
	"context"
	"testing"
	"time"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/repository"
)

func setupTestService() *ExchangeService {
	cfg := &config.Config{
		Port:            "8080",
		Environment:     "test",
		CacheTTL:        5 * time.Minute,
		RateLimitPerMin: 100,
		FrankfurterURL:  "https://api.frankfurter.app",
	}
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	client := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	return NewExchangeService(cfg, client, cache, nil)
}

func TestGetCurrencies(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	currencies, err := svc.GetCurrencies(ctx)
	if err != nil {
		t.Fatalf("GetCurrencies() error = %v", err)
	}

	if len(currencies) == 0 {
		t.Error("GetCurrencies() returned empty list")
	}

	// Check currencies are sorted by priority
	for i := 1; i < len(currencies); i++ {
		if currencies[i-1].Priority > currencies[i].Priority {
			t.Errorf("Currencies not sorted: priority %d > %d",
				currencies[i-1].Priority, currencies[i].Priority)
		}
	}
}

func TestGetCurrencies_Cached(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	// First call
	currencies1, err := svc.GetCurrencies(ctx)
	if err != nil {
		t.Fatalf("GetCurrencies() first call error = %v", err)
	}

	// Second call should be cached
	currencies2, err := svc.GetCurrencies(ctx)
	if err != nil {
		t.Fatalf("GetCurrencies() second call error = %v", err)
	}

	if len(currencies1) != len(currencies2) {
		t.Errorf("Cached result differs: got %d, want %d", len(currencies2), len(currencies1))
	}
}

// Integration tests - these require network access
func TestGetLatestRates_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	rates, err := svc.GetLatestRates(ctx, "USD")
	if err != nil {
		t.Fatalf("GetLatestRates() error = %v", err)
	}

	if rates.Base != "USD" {
		t.Errorf("Base = %v, want USD", rates.Base)
	}

	if len(rates.Rates) == 0 {
		t.Error("GetLatestRates() returned no rates")
	}
}

func TestConvert_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	result, err := svc.Convert(ctx, "USD", "EUR", 100)
	if err != nil {
		t.Fatalf("Convert() error = %v", err)
	}

	if result.From != "USD" {
		t.Errorf("From = %v, want USD", result.From)
	}
	if result.To != "EUR" {
		t.Errorf("To = %v, want EUR", result.To)
	}
	if result.Amount != 100 {
		t.Errorf("Amount = %v, want 100", result.Amount)
	}
	if result.Result <= 0 {
		t.Errorf("Result = %v, want > 0", result.Result)
	}
	if result.Rate <= 0 {
		t.Errorf("Rate = %v, want > 0", result.Rate)
	}
}

func TestGetHistoricalRates_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	// Use a date that definitely has data
	rates, err := svc.GetHistoricalRates(ctx, "2024-01-15", "USD")
	if err != nil {
		t.Fatalf("GetHistoricalRates() error = %v", err)
	}

	if rates.Base != "USD" {
		t.Errorf("Base = %v, want USD", rates.Base)
	}

	if rates.Date != "2024-01-15" {
		t.Errorf("Date = %v, want 2024-01-15", rates.Date)
	}

	if len(rates.Rates) == 0 {
		t.Error("GetHistoricalRates() returned no rates")
	}
}

func TestNewExchangeService(t *testing.T) {
	cfg := &config.Config{
		Port:            "8080",
		Environment:     "test",
		CacheTTL:        5 * time.Minute,
		RateLimitPerMin: 100,
		FrankfurterURL:  "https://api.frankfurter.app",
	}
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	client := repository.NewFrankfurterClient(cfg.FrankfurterURL)

	svc := NewExchangeService(cfg, client, cache, nil)

	if svc == nil {
		t.Fatal("Expected service to be created")
	}

	if svc.client == nil {
		t.Error("Expected client to be set")
	}

	if svc.cache == nil {
		t.Error("Expected cache to be set")
	}

	if svc.config == nil {
		t.Error("Expected config to be set")
	}

	// IRR client should be auto-created when nil
	if svc.irrClient == nil {
		t.Error("Expected IRR client to be auto-created")
	}
}

func TestGetLatestRates_Cached(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	// First call - will fetch from API
	rates1, err := svc.GetLatestRates(ctx, "USD")
	if err != nil {
		t.Fatalf("GetLatestRates() first call error = %v", err)
	}

	// Second call - should be cached
	rates2, err := svc.GetLatestRates(ctx, "USD")
	if err != nil {
		t.Fatalf("GetLatestRates() second call error = %v", err)
	}

	// Check cache worked (rates should be the same)
	if rates1.Base != rates2.Base {
		t.Error("Cached result differs in base")
	}
}

func TestGetHistoricalRates_Cached(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	// First call
	rates1, err := svc.GetHistoricalRates(ctx, "2024-01-15", "USD")
	if err != nil {
		t.Fatalf("GetHistoricalRates() first call error = %v", err)
	}

	// Second call - should be cached
	rates2, err := svc.GetHistoricalRates(ctx, "2024-01-15", "USD")
	if err != nil {
		t.Fatalf("GetHistoricalRates() second call error = %v", err)
	}

	if rates1.Base != rates2.Base {
		t.Error("Cached result differs in base")
	}
}

func TestConvert_RateNotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	svc := setupTestService()
	ctx := context.Background()

	// Try to convert to a non-existent currency
	_, err := svc.Convert(ctx, "USD", "INVALID", 100)
	if err == nil {
		t.Error("Expected error for invalid currency")
	}
}
