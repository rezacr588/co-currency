package repository

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewFrankfurterClient(t *testing.T) {
	baseURL := "https://api.frankfurter.app"
	client := NewFrankfurterClient(baseURL)

	if client == nil {
		t.Fatal("Expected client to be created")
	}

	if client.baseURL != baseURL {
		t.Errorf("Expected base URL %s, got %s", baseURL, client.baseURL)
	}

	if client.httpClient == nil {
		t.Error("Expected http client to be initialized")
	}

	if client.httpClient.Timeout != 10*time.Second {
		t.Errorf("Expected timeout 10s, got %v", client.httpClient.Timeout)
	}
}

func TestGetLatestRates_MockServer(t *testing.T) {
	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/latest" {
			t.Errorf("Expected path /latest, got %s", r.URL.Path)
		}

		from := r.URL.Query().Get("from")
		if from != "USD" {
			t.Errorf("Expected from=USD, got from=%s", from)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"base": "USD",
			"date": "2024-01-15",
			"rates": {
				"EUR": 0.85,
				"GBP": 0.75
			}
		}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	rates, err := client.GetLatestRates(ctx, "USD")
	if err != nil {
		t.Fatalf("GetLatestRates failed: %v", err)
	}

	if rates.Base != "USD" {
		t.Errorf("Expected base USD, got %s", rates.Base)
	}

	if rates.Date != "2024-01-15" {
		t.Errorf("Expected date 2024-01-15, got %s", rates.Date)
	}

	if len(rates.Rates) != 2 {
		t.Errorf("Expected 2 rates, got %d", len(rates.Rates))
	}

	eurRate, ok := rates.Rates["EUR"]
	if !ok || eurRate != 0.85 {
		t.Errorf("Expected EUR rate 0.85, got %v", eurRate)
	}
}

func TestGetHistoricalRates_MockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/2024-01-01" {
			t.Errorf("Expected path /2024-01-01, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"base": "USD",
			"date": "2024-01-01",
			"rates": {
				"EUR": 0.90,
				"GBP": 0.80
			}
		}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	rates, err := client.GetHistoricalRates(ctx, "2024-01-01", "USD")
	if err != nil {
		t.Fatalf("GetHistoricalRates failed: %v", err)
	}

	if rates.Date != "2024-01-01" {
		t.Errorf("Expected date 2024-01-01, got %s", rates.Date)
	}
}

func TestConvert_MockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")

		if from != "USD" {
			t.Errorf("Expected from=USD, got from=%s", from)
		}
		if to != "EUR" {
			t.Errorf("Expected to=EUR, got to=%s", to)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"base": "USD",
			"date": "2024-01-15",
			"rates": {
				"EUR": 85.0
			}
		}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	rates, err := client.Convert(ctx, "USD", "EUR", 100)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if rates.Base != "USD" {
		t.Errorf("Expected base USD, got %s", rates.Base)
	}
}

func TestGetCurrencies_MockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/currencies" {
			t.Errorf("Expected path /currencies, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"USD": "United States Dollar",
			"EUR": "Euro",
			"GBP": "British Pound"
		}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	currencies, err := client.GetCurrencies(ctx)
	if err != nil {
		t.Fatalf("GetCurrencies failed: %v", err)
	}

	if len(currencies) != 3 {
		t.Errorf("Expected 3 currencies, got %d", len(currencies))
	}

	if currencies["USD"] != "United States Dollar" {
		t.Errorf("Expected USD name 'United States Dollar', got %s", currencies["USD"])
	}
}

func TestFetchRates_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	_, err := client.GetLatestRates(ctx, "USD")
	if err == nil {
		t.Error("Expected error for server error response")
	}
}

func TestFetchRates_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{invalid json}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	_, err := client.GetLatestRates(ctx, "USD")
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestGetCurrencies_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	_, err := client.GetCurrencies(ctx)
	if err == nil {
		t.Error("Expected error for server error response")
	}
}

func TestGetCurrencies_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{invalid json}`))
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx := context.Background()

	_, err := client.GetCurrencies(ctx)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestFetchRates_NetworkError(t *testing.T) {
	// Use a non-existent server URL
	client := NewFrankfurterClient("http://localhost:0")
	ctx := context.Background()

	_, err := client.GetLatestRates(ctx, "USD")
	if err == nil {
		t.Error("Expected error for network failure")
	}
}

func TestFetchRates_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewFrankfurterClient(server.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := client.GetLatestRates(ctx, "USD")
	if err == nil {
		t.Error("Expected error for context timeout")
	}
}
