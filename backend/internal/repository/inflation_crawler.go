package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// InflationCrawler runs in the background to fetch and store inflation data
type InflationCrawler struct {
	repo     *InflationRepository
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
	running  bool
	mu       sync.Mutex
}

// NewInflationCrawler creates a new background crawler for inflation data
func NewInflationCrawler(repo *InflationRepository, interval time.Duration) *InflationCrawler {
	if interval < time.Hour {
		interval = 24 * time.Hour
	}
	return &InflationCrawler{
		repo:     repo,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the background crawling process
func (c *InflationCrawler) Start() {
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		return
	}
	c.running = true
	c.mu.Unlock()

	c.wg.Add(1)
	go c.run()

	log.Info().
		Dur("interval", c.interval).
		Msg("Inflation crawler started")
}

// Stop gracefully stops the crawler
func (c *InflationCrawler) Stop() {
	c.mu.Lock()
	if !c.running {
		c.mu.Unlock()
		return
	}
	c.running = false
	c.mu.Unlock()

	close(c.stopCh)
	c.wg.Wait()

	log.Info().Msg("Inflation crawler stopped")
}

// run is the main crawling loop
func (c *InflationCrawler) run() {
	defer c.wg.Done()

	// Fetch immediately on start
	c.fetchAndStore()

	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Cleanup old records once a day
	cleanupTicker := time.NewTicker(24 * time.Hour)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.fetchAndStore()
		case <-cleanupTicker.C:
			c.cleanup()
		}
	}
}

// worldBankResponse represents the World Bank API response structure
type worldBankResponse struct {
	Indicator struct {
		ID string `json:"id"`
	} `json:"indicator"`
	Country struct {
		ID string `json:"id"`
	} `json:"country"`
	Date  string  `json:"date"`
	Value *float64 `json:"value"`
}

// fetchJob represents a single currency fetch task
type fetchJob struct {
	currencyCode string
	countryCode  string
}

// fetchResult represents the result of a fetch job
type fetchResult struct {
	currencyCode string
	countryCode  string
	rate         float64
	isFallback   bool
	skipped      bool
	err          error
}

// fetchAndStore fetches inflation rates from World Bank using a worker pool pattern
func (c *InflationCrawler) fetchAndStore() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Create job and result channels
	jobs := make(chan fetchJob, len(model.CurrencyCountryMap))
	results := make(chan fetchResult, len(model.CurrencyCountryMap))

	// Start worker pool (3 concurrent workers to avoid rate limiting)
	const numWorkers = 3
	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				select {
				case <-ctx.Done():
					results <- fetchResult{currencyCode: job.currencyCode, skipped: true}
					continue
				default:
				}

				rate, err := c.fetchFromWorldBank(ctx, job.countryCode)
				result := fetchResult{
					currencyCode: job.currencyCode,
					countryCode:  job.countryCode,
				}

				if err != nil {
					// Use fallback rate
					if defaultRate, ok := model.DefaultInflationRates[job.currencyCode]; ok {
						result.rate = defaultRate
						result.isFallback = true
					} else {
						result.skipped = true
					}
				} else {
					result.rate = rate
				}
				results <- result

				// Small delay per worker to avoid rate limiting
				time.Sleep(100 * time.Millisecond)
			}
		}()
	}

	// Send all jobs
	for currencyCode, countryCode := range model.CurrencyCountryMap {
		jobs <- fetchJob{currencyCode: currencyCode, countryCode: countryCode}
	}
	close(jobs)

	// Wait for workers and close results
	go func() {
		wg.Wait()
		close(results)
	}()

	// Process results
	successCount := 0
	failCount := 0
	skippedCount := 0

	for result := range results {
		if result.skipped {
			skippedCount++
			continue
		}

		if result.isFallback {
			failCount++
		} else {
			successCount++
		}

		// Determine source label
		source := "worldbank"
		if result.isFallback {
			source = "fallback"
		}

		// Save historical rate
		now := time.Now()
		inflationRate := model.InflationRate{
			CountryCode:  result.countryCode,
			CurrencyCode: result.currencyCode,
			Year:         now.Year(),
			Month:        int(now.Month()),
			AnnualRate:   result.rate,
			Source:       source,
		}
		if err := c.repo.SaveRate(ctx, inflationRate); err != nil {
			log.Warn().Err(err).Str("currency", result.currencyCode).Msg("Failed to save inflation rate")
		}

		// Update latest
		monthlyRate := result.rate / 12.0
		latest := model.InflationLatest{
			CurrencyCode: result.currencyCode,
			CountryCode:  result.countryCode,
			AnnualRate:   result.rate,
			MonthlyRate:  &monthlyRate,
			Source:       source,
			DataDate:     now,
		}
		if err := c.repo.UpsertLatest(ctx, latest); err != nil {
			log.Warn().Err(err).Str("currency", result.currencyCode).Msg("Failed to upsert latest inflation")
		}
	}

	log.Info().
		Int("success", successCount).
		Int("fallback", failCount).
		Int("total", len(model.CurrencyCountryMap)).
		Msg("Inflation data fetch complete")
}

// fetchFromWorldBank fetches annual inflation rate from World Bank API
func (c *InflationCrawler) fetchFromWorldBank(ctx context.Context, countryCode string) (float64, error) {
	currentYear := time.Now().Year()
	url := fmt.Sprintf(
		"https://api.worldbank.org/v2/country/%s/indicator/FP.CPI.TOTL.ZG?format=json&date=%d:%d&per_page=10",
		countryCode, currentYear-3, currentYear,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("creating request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return 0, fmt.Errorf("reading response: %w", err)
	}

	// World Bank returns [metadata, data[]] — we need the second element
	var raw []json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return 0, fmt.Errorf("parsing response: %w", err)
	}

	if len(raw) < 2 {
		return 0, fmt.Errorf("unexpected response format")
	}

	var data []worldBankResponse
	if err := json.Unmarshal(raw[1], &data); err != nil {
		return 0, fmt.Errorf("parsing data: %w", err)
	}

	// Find most recent non-null value
	for _, d := range data {
		if d.Value != nil {
			return *d.Value, nil
		}
	}

	return 0, fmt.Errorf("no inflation data available for %s", countryCode)
}

// cleanup removes old inflation rate records
func (c *InflationCrawler) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Keep 5 years of history
	deleted, err := c.repo.CleanupOldRates(ctx, 5*365*24*time.Hour)
	if err != nil {
		log.Error().Err(err).Msg("Failed to cleanup old inflation rate records")
		return
	}

	if deleted > 0 {
		log.Info().Int64("deleted", deleted).Msg("Cleaned up old inflation rate records")
	}
}

// IsRunning returns whether the crawler is currently running
func (c *InflationCrawler) IsRunning() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.running
}
