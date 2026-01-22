package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// IRRRates contains Iranian Rial exchange rates
type IRRRates struct {
	USD       float64   `json:"usd"`
	EUR       float64   `json:"eur"`
	GBP       float64   `json:"gbp"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IRRClient handles Iranian Rial exchange rate fetching
type IRRClient struct {
	httpClient  *http.Client
	mu          sync.RWMutex
	cachedRates *IRRRates
	lastFetch   time.Time
	cacheTTL    time.Duration
	db          *IRRDatabase // Database for persistent storage
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
func NewIRRClient(db *IRRDatabase) *IRRClient {
	return &IRRClient{
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		cacheTTL: 5 * time.Minute, // Cache IRR rates for 5 minutes
		db:       db,
	}
}

// SetDatabase sets the database for the client (for delayed initialization)
func (c *IRRClient) SetDatabase(db *IRRDatabase) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.db = db
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

	// Try to fetch from API
	rates, err := c.fetchFromPriceDB(ctx)
	if err != nil {
		// Try to get from database (last known real rates)
		if c.db != nil {
			dbRates, dbErr := c.db.GetLatestRates(ctx)
			if dbErr == nil && dbRates != nil {
				c.mu.Lock()
				c.cachedRates = dbRates
				c.lastFetch = time.Now()
				c.mu.Unlock()
				return dbRates, nil
			}
		}
		// No cached rates available - return error
		return nil, fmt.Errorf("failed to get IRR rates: %w (no cached rates available)", err)
	}

	// Save to database for future fallback
	if c.db != nil {
		go func() {
			saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := c.db.SaveRates(saveCtx, rates, "pricedb"); err != nil {
				log.Error().Err(err).Msg("Failed to save IRR rates to database in background")
			}
		}()
	}

	c.mu.Lock()
	c.cachedRates = rates
	c.lastFetch = time.Now()
	c.mu.Unlock()

	return rates, nil
}

// PriceDBResponse represents the margani/pricedb API response structure
type PriceDBResponse struct {
	Price string `json:"p"`
	High  string `json:"h"`
	Low   string `json:"l"`
	Time  string `json:"ts"`
}

// fetchFromPriceDB fetches rates from the margani/pricedb GitHub repository
// This is a free, auto-updated source for Iranian Rial exchange rates
func (c *IRRClient) fetchFromPriceDB(ctx context.Context) (*IRRRates, error) {
	baseURL := "https://raw.githubusercontent.com/margani/pricedb/main/tgju/current"

	rates := &IRRRates{
		UpdatedAt: time.Now(),
	}

	// Fetch USD rate
	usdRate, err := c.fetchPriceDBRate(ctx, baseURL+"/price_dollar_rl/latest.json")
	if err != nil {
		return nil, fmt.Errorf("fetching USD rate: %w", err)
	}
	rates.USD = usdRate

	// Fetch EUR rate
	eurRate, err := c.fetchPriceDBRate(ctx, baseURL+"/price_eur/latest.json")
	if err != nil {
		return nil, fmt.Errorf("fetching EUR rate: %w", err)
	}
	rates.EUR = eurRate

	// Fetch GBP rate
	gbpRate, err := c.fetchPriceDBRate(ctx, baseURL+"/price_gbp/latest.json")
	if err != nil {
		return nil, fmt.Errorf("fetching GBP rate: %w", err)
	}
	rates.GBP = gbpRate

	return rates, nil
}

// fetchPriceDBRate fetches a single rate from the pricedb API
func (c *IRRClient) fetchPriceDBRate(ctx context.Context, url string) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("User-Agent", "CurrencyConverter/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var priceResp PriceDBResponse
	if err := json.NewDecoder(resp.Body).Decode(&priceResp); err != nil {
		return 0, fmt.Errorf("decoding response: %w", err)
	}

	// Parse the price string (remove commas and convert to float)
	cleanPrice := strings.ReplaceAll(priceResp.Price, ",", "")

	var rate float64
	if _, err := fmt.Sscanf(cleanPrice, "%f", &rate); err != nil {
		return 0, fmt.Errorf("parsing price '%s': %w", priceResp.Price, err)
	}

	return rate, nil
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