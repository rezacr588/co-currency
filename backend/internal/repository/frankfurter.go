package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
)

// FrankfurterClient is the client for the Frankfurter API
type FrankfurterClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewFrankfurterClient creates a new Frankfurter API client
func NewFrankfurterClient(baseURL string) *FrankfurterClient {
	return &FrankfurterClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetLatestRates fetches the latest exchange rates for a base currency
func (c *FrankfurterClient) GetLatestRates(ctx context.Context, base string) (*model.FrankfurterRatesResponse, error) {
	url := fmt.Sprintf("%s/latest?from=%s", c.baseURL, base)
	return c.fetchRates(ctx, url)
}

// GetHistoricalRates fetches historical exchange rates for a specific date
func (c *FrankfurterClient) GetHistoricalRates(ctx context.Context, date, base string) (*model.FrankfurterRatesResponse, error) {
	url := fmt.Sprintf("%s/%s?from=%s", c.baseURL, date, base)
	return c.fetchRates(ctx, url)
}

// Convert performs a currency conversion
func (c *FrankfurterClient) Convert(ctx context.Context, from, to string, amount float64) (*model.FrankfurterRatesResponse, error) {
	url := fmt.Sprintf("%s/latest?amount=%f&from=%s&to=%s", c.baseURL, amount, from, to)
	return c.fetchRates(ctx, url)
}

// GetCurrencies fetches available currencies from the API
func (c *FrankfurterClient) GetCurrencies(ctx context.Context) (map[string]string, error) {
	url := fmt.Sprintf("%s/currencies", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var currencies map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&currencies); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return currencies, nil
}

func (c *FrankfurterClient) fetchRates(ctx context.Context, url string) (*model.FrankfurterRatesResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var rates model.FrankfurterRatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&rates); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return &rates, nil
}
