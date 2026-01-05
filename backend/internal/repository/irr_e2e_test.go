package repository

import (
	"context"
	"os"
	"testing"
	"time"
)

// TestIRRClient_FetchFromPriceDB tests fetching rates from the PriceDB API
func TestIRRClient_FetchFromPriceDB(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	client := NewIRRClient(nil)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rates, err := client.fetchFromPriceDB(ctx)
	if err != nil {
		t.Fatalf("fetchFromPriceDB() error = %v", err)
	}

	// Validate USD rate (should be > 1,000,000 IRR as of 2025-2026)
	if rates.USD < 1000000 {
		t.Errorf("USD rate = %v, expected > 1,000,000 IRR", rates.USD)
	}
	if rates.USD > 5000000 {
		t.Errorf("USD rate = %v, seems unreasonably high (> 5,000,000 IRR)", rates.USD)
	}

	// Validate EUR rate (should be higher than USD)
	if rates.EUR < rates.USD {
		t.Errorf("EUR rate = %v, expected > USD rate (%v)", rates.EUR, rates.USD)
	}
	if rates.EUR > 6000000 {
		t.Errorf("EUR rate = %v, seems unreasonably high (> 6,000,000 IRR)", rates.EUR)
	}

	// Validate GBP rate (should be higher than EUR)
	if rates.GBP < rates.EUR {
		t.Errorf("GBP rate = %v, expected > EUR rate (%v)", rates.GBP, rates.EUR)
	}
	if rates.GBP > 7000000 {
		t.Errorf("GBP rate = %v, seems unreasonably high (> 7,000,000 IRR)", rates.GBP)
	}

	t.Logf("Fetched rates: USD=%v, EUR=%v, GBP=%v", rates.USD, rates.EUR, rates.GBP)
}

// TestIRRClient_GetRates tests the full GetRates flow with caching
func TestIRRClient_GetRates(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	client := NewIRRClient(nil)
	ctx := context.Background()

	// First call - should fetch from API
	start := time.Now()
	rates1, err := client.GetRates(ctx)
	if err != nil {
		t.Fatalf("GetRates() first call error = %v", err)
	}
	firstCallDuration := time.Since(start)

	// Second call - should be cached (faster)
	start = time.Now()
	rates2, err := client.GetRates(ctx)
	if err != nil {
		t.Fatalf("GetRates() second call error = %v", err)
	}
	secondCallDuration := time.Since(start)

	// Cache hit should be much faster
	if secondCallDuration > firstCallDuration/2 {
		t.Logf("Cache performance: first=%v, second=%v", firstCallDuration, secondCallDuration)
	}

	// Rates should be the same
	if rates1.USD != rates2.USD || rates1.EUR != rates2.EUR || rates1.GBP != rates2.GBP {
		t.Errorf("Cached rates differ from original")
	}

	t.Logf("First call: %v, Second call (cached): %v", firstCallDuration, secondCallDuration)
}

// TestIRRClient_ConvertToIRR tests currency conversion to IRR
func TestIRRClient_ConvertToIRR(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	client := NewIRRClient(nil)
	ctx := context.Background()

	tests := []struct {
		name     string
		from     string
		amount   float64
		minIRR   float64
		maxIRR   float64
	}{
		{"100 USD to IRR", "USD", 100, 100000000, 500000000},
		{"100 EUR to IRR", "EUR", 100, 120000000, 600000000},
		{"100 GBP to IRR", "GBP", 100, 150000000, 700000000},
		{"1 USD to IRR", "USD", 1, 1000000, 5000000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, rate, err := client.ConvertToIRR(ctx, tt.from, tt.amount)
			if err != nil {
				t.Fatalf("ConvertToIRR() error = %v", err)
			}

			if result < tt.minIRR || result > tt.maxIRR {
				t.Errorf("ConvertToIRR() = %v IRR, expected between %v and %v", result, tt.minIRR, tt.maxIRR)
			}

			if rate <= 0 {
				t.Errorf("ConvertToIRR() rate = %v, expected > 0", rate)
			}

			t.Logf("%s = %v IRR (rate: %v)", tt.name, result, rate)
		})
	}
}

// TestIRRClient_ConvertFromIRR tests currency conversion from IRR
func TestIRRClient_ConvertFromIRR(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	client := NewIRRClient(nil)
	ctx := context.Background()

	// Convert 100 million IRR to USD (should be roughly 70-100 USD based on current rates)
	result, rate, err := client.ConvertFromIRR(ctx, "USD", 100000000)
	if err != nil {
		t.Fatalf("ConvertFromIRR() error = %v", err)
	}

	if result < 20 || result > 200 {
		t.Errorf("ConvertFromIRR() = %v USD, expected between 20 and 200", result)
	}

	if rate <= 0 || rate >= 1 {
		t.Errorf("ConvertFromIRR() rate = %v, expected between 0 and 1", rate)
	}

	t.Logf("100,000,000 IRR = %v USD (rate: %v)", result, rate)
}

// TestIRRDatabase_Integration tests database operations
func TestIRRDatabase_Integration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping database integration test")
	}

	ctx := context.Background()

	// Connect to database
	db, err := NewIRRDatabase(dbURL)
	if err != nil {
		t.Fatalf("NewIRRDatabase() error = %v", err)
	}
	defer db.Close()

	// Create test rates
	testRates := &IRRRates{
		USD:       1380000,
		EUR:       1620000,
		GBP:       1860000,
		UpdatedAt: time.Now(),
	}

	// Save rates
	err = db.SaveRates(ctx, testRates, "test")
	if err != nil {
		t.Fatalf("SaveRates() error = %v", err)
	}

	// Retrieve rates
	retrievedRates, err := db.GetLatestRates(ctx)
	if err != nil {
		t.Fatalf("GetLatestRates() error = %v", err)
	}

	// Validate
	if retrievedRates.USD != testRates.USD {
		t.Errorf("USD rate = %v, want %v", retrievedRates.USD, testRates.USD)
	}
	if retrievedRates.EUR != testRates.EUR {
		t.Errorf("EUR rate = %v, want %v", retrievedRates.EUR, testRates.EUR)
	}
	if retrievedRates.GBP != testRates.GBP {
		t.Errorf("GBP rate = %v, want %v", retrievedRates.GBP, testRates.GBP)
	}

	// Get history
	history, err := db.GetRateHistory(ctx, "USD", 10)
	if err != nil {
		t.Fatalf("GetRateHistory() error = %v", err)
	}

	if len(history) == 0 {
		t.Error("GetRateHistory() returned empty list")
	}

	t.Logf("Database integration test passed. Retrieved rates: USD=%v, EUR=%v, GBP=%v",
		retrievedRates.USD, retrievedRates.EUR, retrievedRates.GBP)
}

// TestIRRCrawler_Integration tests the full crawler flow
func TestIRRCrawler_Integration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping crawler integration test")
	}

	ctx := context.Background()

	// Connect to database
	db, err := NewIRRDatabase(dbURL)
	if err != nil {
		t.Fatalf("NewIRRDatabase() error = %v", err)
	}
	defer db.Close()

	// Create IRR client with database
	client := NewIRRClient(db)

	// Create crawler with short interval for testing
	crawler := NewIRRCrawler(client, db, 1*time.Minute)

	// Start crawler
	crawler.Start()

	// Wait for initial fetch
	time.Sleep(5 * time.Second)

	// Verify rates were fetched and stored
	rates, err := db.GetLatestRates(ctx)
	if err != nil {
		t.Fatalf("GetLatestRates() after crawler start error = %v", err)
	}

	if rates.USD == 0 || rates.EUR == 0 || rates.GBP == 0 {
		t.Errorf("Crawler did not fetch rates: USD=%v, EUR=%v, GBP=%v",
			rates.USD, rates.EUR, rates.GBP)
	}

	// Stop crawler
	crawler.Stop()

	if crawler.IsRunning() {
		t.Error("Crawler still running after Stop()")
	}

	t.Logf("Crawler integration test passed. Fetched rates: USD=%v, EUR=%v, GBP=%v",
		rates.USD, rates.EUR, rates.GBP)
}

// TestIRRRates_Accuracy tests that rates are within expected ranges
func TestIRRRates_Accuracy(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E accuracy test in short mode")
	}

	client := NewIRRClient(nil)
	ctx := context.Background()

	rates, err := client.GetRates(ctx)
	if err != nil {
		t.Fatalf("GetRates() error = %v", err)
	}

	// As of January 2026, expected ranges:
	// USD: ~1,300,000 - 1,500,000 IRR
	// EUR: ~1,500,000 - 1,800,000 IRR
	// GBP: ~1,700,000 - 2,000,000 IRR

	tests := []struct {
		name    string
		rate    float64
		min     float64
		max     float64
	}{
		{"USD", rates.USD, 1000000, 2000000},
		{"EUR", rates.EUR, 1200000, 2500000},
		{"GBP", rates.GBP, 1400000, 2800000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.rate < tt.min || tt.rate > tt.max {
				t.Errorf("%s rate = %v, expected between %v and %v", tt.name, tt.rate, tt.min, tt.max)
			}
		})
	}

	// Verify rate relationships
	if rates.EUR <= rates.USD {
		t.Errorf("EUR (%v) should be higher than USD (%v)", rates.EUR, rates.USD)
	}
	if rates.GBP <= rates.EUR {
		t.Errorf("GBP (%v) should be higher than EUR (%v)", rates.GBP, rates.EUR)
	}

	t.Logf("Rate accuracy test passed. USD=%v, EUR=%v, GBP=%v", rates.USD, rates.EUR, rates.GBP)
}

// TestPriceDBSource_Reliability tests that the PriceDB source is responsive
func TestPriceDBSource_Reliability(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping reliability test in short mode")
	}

	client := NewIRRClient(nil)
	ctx := context.Background()

	// Make multiple requests to test reliability
	successCount := 0
	totalRequests := 5

	for i := 0; i < totalRequests; i++ {
		rates, err := client.fetchFromPriceDB(ctx)
		if err == nil && rates.USD > 0 {
			successCount++
		}
		time.Sleep(500 * time.Millisecond) // Small delay between requests
	}

	successRate := float64(successCount) / float64(totalRequests) * 100
	if successRate < 80 {
		t.Errorf("PriceDB reliability = %.1f%%, expected >= 80%%", successRate)
	}

	t.Logf("PriceDB reliability: %d/%d requests successful (%.1f%%)",
		successCount, totalRequests, successRate)
}
