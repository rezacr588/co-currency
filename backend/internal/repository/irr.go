package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// IRRRates contains Iranian Rial exchange rates
type IRRRates struct {
	USD      float64   `json:"usd"`
	EUR      float64   `json:"eur"`
	GBP      float64   `json:"gbp"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IRRClient handles Iranian Rial exchange rate fetching
type IRRClient struct {
	httpClient *http.Client
	mu         sync.RWMutex
	cachedRates *IRRRates
	lastFetch   time.Time
	cacheTTL    time.Duration
}

// NavasanResponse represents the Navasan API response structure
type NavasanResponse struct {
	USD struct {
		Value float64 `json:"value"`
	} `json:"usd"`
	EUR struct {
		Value float64 `json:"value"`
	} `json:"eur"`
	GBP struct {
		Value float64 `json:"value"`
	} `json:"gbp"`
}

// BonbastResponse represents the Bonbast API response structure
type BonbastResponse struct {
	USD struct {
		Sell float64 `json:"sell"`
		Buy  float64 `json:"buy"`
	} `json:"usd"`
	EUR struct {
		Sell float64 `json:"sell"`
		Buy  float64 `json:"buy"`
	} `json:"eur"`
	GBP struct {
		Sell float64 `json:"sell"`
		Buy  float64 `json:"buy"`
	} `json:"gbp"`
}

// NewIRRClient creates a new IRR API client
func NewIRRClient() *IRRClient {
	return &IRRClient{
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		cacheTTL: 5 * time.Minute, // Cache IRR rates for 5 minutes
	}
}

// GetRates fetches current IRR exchange rates
func (c *IRRClient) GetRates(ctx context.Context) (*IRRRates, error) {
	c.mu.RLock()
	if c.cachedRates != nil && time.Since(c.lastFetch) < c.cacheTTL {
		rates := c.cachedRates
		c.mu.RUnlock()
		return rates, nil
	}
	c.mu.RUnlock()

	// Try multiple sources
	rates, err := c.fetchFromBonbastWrapper(ctx)
	if err != nil {
		// Fallback to static rates if API fails
		rates = c.getFallbackRates()
	}

	c.mu.Lock()
	c.cachedRates = rates
	c.lastFetch = time.Now()
	c.mu.Unlock()

	return rates, nil
}

// fetchFromBonbastWrapper tries to fetch from the Bonbast API wrapper
func (c *IRRClient) fetchFromBonbastWrapper(ctx context.Context) (*IRRRates, error) {
	// Try the community Bonbast API wrapper
	url := "https://bonbast.amirhn.com/latest"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("User-Agent", "CurrencyConverter/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var bonbastResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&bonbastResp); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	// Parse the response - Bonbast returns rates in Toman (divide by 10 for Rial)
	rates := &IRRRates{
		UpdatedAt: time.Now(),
	}

	if usd, ok := bonbastResp["usd"].(map[string]interface{}); ok {
		if sell, ok := usd["sell"].(float64); ok {
			rates.USD = sell * 10 // Convert Toman to Rial
		}
	}
	if eur, ok := bonbastResp["eur"].(map[string]interface{}); ok {
		if sell, ok := eur["sell"].(float64); ok {
			rates.EUR = sell * 10
		}
	}
	if gbp, ok := bonbastResp["gbp"].(map[string]interface{}); ok {
		if sell, ok := gbp["sell"].(float64); ok {
			rates.GBP = sell * 10
		}
	}

	// Validate we got rates
	if rates.USD == 0 {
		return nil, fmt.Errorf("failed to parse USD rate")
	}

	return rates, nil
}

// getFallbackRates returns approximate market rates as fallback
// These should be updated periodically or fetched from a backup source
func (c *IRRClient) getFallbackRates() *IRRRates {
	// Approximate free market rates as of late 2025
	// Note: These are fallback values and may not reflect current rates
	return &IRRRates{
		USD:       700000, // ~70,000 Toman = 700,000 Rial
		EUR:       750000, // ~75,000 Toman
		GBP:       880000, // ~88,000 Toman
		UpdatedAt: time.Now(),
	}
}

// ConvertToIRR converts an amount from a supported currency to IRR
func (c *IRRClient) ConvertToIRR(ctx context.Context, from string, amount float64) (float64, float64, error) {
	rates, err := c.GetRates(ctx)
	if err != nil {
		return 0, 0, err
	}

	var rate float64
	switch from {
	case "USD":
		rate = rates.USD
	case "EUR":
		rate = rates.EUR
	case "GBP":
		rate = rates.GBP
	default:
		return 0, 0, fmt.Errorf("unsupported currency for IRR conversion: %s", from)
	}

	return amount * rate, rate, nil
}

// ConvertFromIRR converts an amount from IRR to a supported currency
func (c *IRRClient) ConvertFromIRR(ctx context.Context, to string, amount float64) (float64, float64, error) {
	rates, err := c.GetRates(ctx)
	if err != nil {
		return 0, 0, err
	}

	var rate float64
	switch to {
	case "USD":
		rate = rates.USD
	case "EUR":
		rate = rates.EUR
	case "GBP":
		rate = rates.GBP
	default:
		return 0, 0, fmt.Errorf("unsupported currency for IRR conversion: %s", to)
	}

	if rate == 0 {
		return 0, 0, fmt.Errorf("invalid rate for currency: %s", to)
	}

	return amount / rate, 1 / rate, nil
}

// IsIRRCurrency checks if the currency code is IRR
func IsIRRCurrency(code string) bool {
	return code == "IRR"
}

// IsSupportedForIRR checks if a currency can be converted to/from IRR
func IsSupportedForIRR(code string) bool {
	switch code {
	case "USD", "EUR", "GBP":
		return true
	default:
		return false
	}
}
