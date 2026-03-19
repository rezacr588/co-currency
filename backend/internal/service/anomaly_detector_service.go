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

// AnomalyDetectorService handles communication with the ML anomaly detection microservice
type AnomalyDetectorService struct {
	client         *http.Client
	baseURL        string
	cache          *cache.Cache
	enabled        bool
	cacheTTL       time.Duration
	requestTimeout time.Duration
}

// AnomalyDetectionRequest represents the request to detect anomalies
type AnomalyDetectionRequest struct {
	Transactions []AnomalyTransaction `json:"transactions"`
	Threshold    float64              `json:"threshold"` // Z-score threshold (default 2.5)
}

// AnomalyTransaction represents a transaction for anomaly detection
type AnomalyTransaction struct {
	Date     string  `json:"date"`
	Amount   float64 `json:"amount"`
	Type     string  `json:"type"` // "credit" or "debit"
	Category string  `json:"category"`
}

// AnomalyDetectionResponse represents the response from anomaly detection
type AnomalyDetectionResponse struct {
	Anomalies []Anomaly       `json:"anomalies"`
	Summary   AnomalySummary  `json:"summary"`
}

// Anomaly represents a detected anomalous transaction
type Anomaly struct {
	Date           string    `json:"date"`
	Category       string    `json:"category"`
	Amount         float64   `json:"amount"`
	ExpectedRange  []float64 `json:"expected_range"` // [min, max]
	ZScore         float64   `json:"z_score"`
	Severity       string    `json:"severity"` // "low", "medium", "high", "critical"
	Message        string    `json:"message"`
}

// AnomalySummary contains summary statistics about anomalies
type AnomalySummary struct {
	TotalTransactions  int      `json:"total_transactions"`
	AnomalyCount       int      `json:"anomaly_count"`
	CategoriesAffected []string `json:"categories_affected"`
	ThresholdUsed      float64  `json:"threshold_used"`
}

// NewAnomalyDetectorService creates a new anomaly detector service
func NewAnomalyDetectorService(baseURL string) *AnomalyDetectorService {
	enabled := baseURL != ""
	
	if !enabled {
		log.Warn().Msg("ML anomaly detector service disabled (no ML_SERVICE_URL configured)")
	} else {
		log.Info().Str("url", baseURL).Msg("ML anomaly detector service enabled")
	}

	return &AnomalyDetectorService{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 5,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		baseURL:        baseURL,
		cache:          cache.New(30*time.Minute, 10*time.Minute), // Shorter cache for anomalies
		enabled:        enabled,
		cacheTTL:       30 * time.Minute,
		requestTimeout: 20 * time.Second,
	}
}

// IsEnabled returns whether the ML service is available
func (s *AnomalyDetectorService) IsEnabled() bool {
	return s.enabled
}

// DetectAnomalies identifies anomalous spending patterns
func (s *AnomalyDetectorService) DetectAnomalies(ctx context.Context, transactions []AnomalyTransaction, threshold float64) (*AnomalyDetectionResponse, error) {
	if !s.enabled {
		return nil, fmt.Errorf("ML anomaly detector service not configured")
	}

	// Use default threshold if not specified
	if threshold <= 0 {
		threshold = 2.5
	}

	// Check cache first
	cacheKey := s.buildCacheKey(len(transactions), threshold)
	if cached, found := s.cache.Get(cacheKey); found {
		log.Debug().Str("cache_key", cacheKey).Msg("Returning cached anomaly detection")
		return cached.(*AnomalyDetectionResponse), nil
	}

	// Build request
	reqBody := AnomalyDetectionRequest{
		Transactions: transactions,
		Threshold:    threshold,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request with timeout
	reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
	defer cancel()

	url := fmt.Sprintf("%s/detect-anomalies", s.baseURL)
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
			log.Debug().Int("attempt", attempt).Dur("backoff", backoff).Msg("Retrying ML anomaly detection request")
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
	var result AnomalyDetectionResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse anomaly detection response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, &result, s.cacheTTL)

	log.Info().
		Int("anomalies", result.Summary.AnomalyCount).
		Int("total_transactions", result.Summary.TotalTransactions).
		Float64("threshold", threshold).
		Msg("Successfully detected anomalies")

	return &result, nil
}

// ClearCache clears the anomaly detection cache
func (s *AnomalyDetectorService) ClearCache() {
	s.cache.Flush()
	log.Info().Msg("Cleared ML anomaly detector cache")
}

// buildCacheKey creates a cache key from request parameters
func (s *AnomalyDetectorService) buildCacheKey(transactionCount int, threshold float64) string {
	return fmt.Sprintf("anomalies:%d:%.2f", transactionCount, threshold)
}
