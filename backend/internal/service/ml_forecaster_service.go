package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/patrickmn/go-cache"
	"github.com/rs/zerolog/log"
)

// MLForecasterService handles communication with the ML forecasting microservice
type MLForecasterService struct {
	client         *http.Client
	baseURL        string
	cache          *cache.Cache
	enabled        bool
	cacheTTL       time.Duration
	requestTimeout time.Duration
}

// ForecastRequest represents the request to the ML service
type ForecastRequest struct {
	Transactions []ForecastTransaction `json:"transactions"`
	Days         int                   `json:"days"`
	Currency     string                `json:"currency"`
}

// ForecastTransaction represents a single transaction for forecasting
type ForecastTransaction struct {
	Date     string  `json:"date"`
	Amount   float64 `json:"amount"`
	Type     string  `json:"type"` // "credit" or "debit"
	Category string  `json:"category"`
}

// ForecastResponse represents the response from the ML service
type ForecastResponse struct {
	Predictions     []ForecastPrediction `json:"predictions"`
	ConfidenceScore float64              `json:"confidence_score"`
	Currency        string               `json:"currency"`
	Metadata        ForecastMetadata     `json:"metadata"`
}

// ForecastPrediction represents a single day's prediction
type ForecastPrediction struct {
	Date        string             `json:"date"`
	Income      float64            `json:"income"`
	Expenses    float64            `json:"expenses"`
	NetCashFlow float64            `json:"net_cash_flow"`
	Balance     float64            `json:"balance"`
	Confidence  ConfidenceInterval `json:"confidence"`
}

// ConfidenceInterval represents prediction confidence bounds
type ConfidenceInterval struct {
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
}

// ForecastMetadata contains metadata about the forecast
type ForecastMetadata struct {
	TotalHistoricalDays int     `json:"total_historical_days"`
	AvgDailyIncome      float64 `json:"avg_daily_income"`
	AvgDailyExpenses    float64 `json:"avg_daily_expenses"`
	IncomeVolatility    float64 `json:"income_volatility"`
	ExpenseVolatility   float64 `json:"expense_volatility"`
	ModelType           string  `json:"model_type"`
}

// NewMLForecasterService creates a new ML forecaster service
func NewMLForecasterService(baseURL string) *MLForecasterService {
	enabled := baseURL != ""

	if !enabled {
		log.Warn().Msg("ML forecaster service disabled (no ML_SERVICE_URL configured)")
	} else {
		log.Info().Str("url", baseURL).Msg("ML forecaster service enabled")
	}

	return &MLForecasterService{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 5,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		baseURL:        baseURL,
		cache:          cache.New(1*time.Hour, 10*time.Minute),
		enabled:        enabled,
		cacheTTL:       1 * time.Hour,
		requestTimeout: 25 * time.Second,
	}
}

// IsEnabled returns whether the ML service is available
func (s *MLForecasterService) IsEnabled() bool {
	return s.enabled
}

// GetForecast generates a cash flow forecast using ML
func (s *MLForecasterService) GetForecast(ctx context.Context, transactions []ForecastTransaction, days int, currency string) (*ForecastResponse, error) {
	if !s.enabled {
		return nil, fmt.Errorf("ML forecaster service not configured")
	}

	// Check cache first
	cacheKey := s.buildCacheKey(transactions, days, currency)
	if cached, found := s.cache.Get(cacheKey); found {
		log.Debug().Str("cache_key", cacheKey).Msg("Returning cached forecast")
		return cached.(*ForecastResponse), nil
	}

	// Build request
	reqBody := ForecastRequest{
		Transactions: transactions,
		Days:         days,
		Currency:     currency,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request with timeout
	reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
	defer cancel()

	url := fmt.Sprintf("%s/forecast", s.baseURL)
	req, err := http.NewRequestWithContext(reqCtx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Execute request with retry logic
	var resp *http.Response
	var lastErr error
	maxRetries := 2

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 500ms, 1s
			backoff := time.Duration(attempt) * 500 * time.Millisecond
			log.Debug().Int("attempt", attempt).Dur("backoff", backoff).Msg("Retrying ML forecast request")
			time.Sleep(backoff)
		}

		resp, lastErr = s.client.Do(req)
		if lastErr == nil && resp.StatusCode < 500 {
			break // Success or client error (don't retry)
		}

		if resp != nil {
			resp.Body.Close()
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to call ML service after %d retries: %w", maxRetries, lastErr)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for errors
	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error != "" {
			return nil, fmt.Errorf("ML service error (%d): %s", resp.StatusCode, errResp.Error)
		}
		return nil, fmt.Errorf("ML service returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var forecast ForecastResponse
	if err := json.Unmarshal(body, &forecast); err != nil {
		return nil, fmt.Errorf("failed to parse forecast response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, &forecast, s.cacheTTL)

	log.Info().
		Int("predictions", len(forecast.Predictions)).
		Float64("confidence", forecast.ConfidenceScore).
		Str("currency", currency).
		Msg("Successfully generated forecast")

	return &forecast, nil
}

// HealthCheck verifies the ML service is reachable
func (s *MLForecasterService) HealthCheck(ctx context.Context) error {
	if !s.enabled {
		return fmt.Errorf("ML service not configured")
	}

	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/health", s.baseURL)
	req, err := http.NewRequestWithContext(reqCtx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			body = []byte("(read error)")
		}
		return fmt.Errorf("health check returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ClearCache clears the forecast cache
func (s *MLForecasterService) ClearCache() {
	s.cache.Flush()
	log.Info().Msg("Cleared ML forecaster cache")
}

// buildCacheKey creates a cache key from request parameters
func (s *MLForecasterService) buildCacheKey(transactions []ForecastTransaction, days int, currency string) string {
	// Simple cache key based on transaction count, days, and currency
	// In production, might want to hash transaction data for more precision
	return fmt.Sprintf("forecast:%d:%d:%s", len(transactions), days, currency)
}
