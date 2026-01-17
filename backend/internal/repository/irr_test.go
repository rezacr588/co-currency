package repository

import (
	"context"
	"testing"
	"time"
)

func TestNewIRRClient(t *testing.T) {
	client := NewIRRClient(nil)

	if client == nil {
		t.Fatal("Expected client to be created")
	}

	if client.httpClient == nil {
		t.Error("Expected http client to be initialized")
	}

	if client.cacheTTL != 5*time.Minute {
		t.Errorf("Expected cache TTL to be 5 minutes, got %v", client.cacheTTL)
	}
}

func TestSetDatabase(t *testing.T) {
	client := NewIRRClient(nil)

	if client.db != nil {
		t.Error("Expected db to be nil initially")
	}

	// SetDatabase is typically called with a real database
	// We just verify it doesn't panic with nil
	client.SetDatabase(nil)

	if client.db != nil {
		t.Error("Expected db to still be nil after SetDatabase(nil)")
	}
}

func TestIsIRRCurrency(t *testing.T) {
	testCases := []struct {
		code     string
		expected bool
	}{
		{"IRR", true},
		{"USD", false},
		{"EUR", false},
		{"GBP", false},
		{"irr", false}, // Case sensitive
		{"", false},
	}

	for _, tc := range testCases {
		result := IsIRRCurrency(tc.code)
		if result != tc.expected {
			t.Errorf("IsIRRCurrency(%s) = %v, expected %v", tc.code, result, tc.expected)
		}
	}
}

func TestIsSupportedForIRR(t *testing.T) {
	testCases := []struct {
		code     string
		expected bool
	}{
		{"USD", true},
		{"EUR", true},
		{"GBP", true},
		{"IRR", false},
		{"JPY", false},
		{"CAD", false},
		{"usd", false}, // Case sensitive
		{"", false},
	}

	for _, tc := range testCases {
		result := IsSupportedForIRR(tc.code)
		if result != tc.expected {
			t.Errorf("IsSupportedForIRR(%s) = %v, expected %v", tc.code, result, tc.expected)
		}
	}
}

// Test GetRates with cached values
func TestGetRates_Cached(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates
	client.cachedRates = &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()
	rates, err := client.GetRates(ctx)

	if err != nil {
		t.Fatalf("GetRates with cached values failed: %v", err)
	}

	if rates.USD != 50000 {
		t.Errorf("Expected USD rate 50000, got %f", rates.USD)
	}

	if rates.EUR != 55000 {
		t.Errorf("Expected EUR rate 55000, got %f", rates.EUR)
	}

	if rates.GBP != 65000 {
		t.Errorf("Expected GBP rate 65000, got %f", rates.GBP)
	}
}

// Test ConvertToIRR with cached rates
func TestConvertToIRR_WithCachedRates(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates
	client.cachedRates = &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()

	testCases := []struct {
		from     string
		amount   float64
		expected float64
		rate     float64
	}{
		{"USD", 100, 5000000, 50000},
		{"EUR", 100, 5500000, 55000},
		{"GBP", 100, 6500000, 65000},
	}

	for _, tc := range testCases {
		result, rate, err := client.ConvertToIRR(ctx, tc.from, tc.amount)
		if err != nil {
			t.Errorf("ConvertToIRR(%s, %f) failed: %v", tc.from, tc.amount, err)
			continue
		}

		if result != tc.expected {
			t.Errorf("ConvertToIRR(%s, %f) result = %f, expected %f", tc.from, tc.amount, result, tc.expected)
		}

		if rate != tc.rate {
			t.Errorf("ConvertToIRR(%s, %f) rate = %f, expected %f", tc.from, tc.amount, rate, tc.rate)
		}
	}
}

func TestConvertToIRR_UnsupportedCurrency(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates
	client.cachedRates = &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()

	_, _, err := client.ConvertToIRR(ctx, "JPY", 100)
	if err == nil {
		t.Error("Expected error for unsupported currency")
	}
}

// Test ConvertFromIRR with cached rates
func TestConvertFromIRR_WithCachedRates(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates
	client.cachedRates = &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()

	testCases := []struct {
		to       string
		amount   float64
		expected float64
	}{
		{"USD", 5000000, 100},
		{"EUR", 5500000, 100},
		{"GBP", 6500000, 100},
	}

	for _, tc := range testCases {
		result, _, err := client.ConvertFromIRR(ctx, tc.to, tc.amount)
		if err != nil {
			t.Errorf("ConvertFromIRR(%s, %f) failed: %v", tc.to, tc.amount, err)
			continue
		}

		if result != tc.expected {
			t.Errorf("ConvertFromIRR(%s, %f) result = %f, expected %f", tc.to, tc.amount, result, tc.expected)
		}
	}
}

func TestConvertFromIRR_UnsupportedCurrency(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates
	client.cachedRates = &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()

	_, _, err := client.ConvertFromIRR(ctx, "JPY", 100)
	if err == nil {
		t.Error("Expected error for unsupported currency")
	}
}

func TestConvertFromIRR_ZeroRate(t *testing.T) {
	client := NewIRRClient(nil)

	// Manually set cached rates with zero USD rate
	client.cachedRates = &IRRRates{
		USD:       0,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}
	client.lastFetch = time.Now()

	ctx := context.Background()

	_, _, err := client.ConvertFromIRR(ctx, "USD", 100)
	if err == nil {
		t.Error("Expected error for zero rate")
	}
}

// Test IRRRates structure
func TestIRRRates_Structure(t *testing.T) {
	rates := &IRRRates{
		USD:       50000,
		EUR:       55000,
		GBP:       65000,
		UpdatedAt: time.Now(),
	}

	if rates.USD != 50000 {
		t.Errorf("Expected USD 50000, got %f", rates.USD)
	}

	if rates.EUR != 55000 {
		t.Errorf("Expected EUR 55000, got %f", rates.EUR)
	}

	if rates.GBP != 65000 {
		t.Errorf("Expected GBP 65000, got %f", rates.GBP)
	}

	if rates.UpdatedAt.IsZero() {
		t.Error("Expected UpdatedAt to be set")
	}
}
