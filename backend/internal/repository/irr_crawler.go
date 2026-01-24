package repository

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// IRRCrawler runs in the background to fetch and store IRR exchange rates
type IRRCrawler struct {
	client     *IRRClient
	db         *IRRDatabase
	interval   time.Duration
	stopCh     chan struct{}
	wg         sync.WaitGroup
	running    bool
	mu         sync.Mutex
}

// NewIRRCrawler creates a new background crawler for IRR rates
func NewIRRCrawler(client *IRRClient, db *IRRDatabase, interval time.Duration) *IRRCrawler {
	if interval < time.Minute {
		interval = 5 * time.Minute // Minimum 5 minutes to avoid rate limiting
	}

	return &IRRCrawler{
		client:   client,
		db:       db,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the background crawling process
func (c *IRRCrawler) Start() {
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
		Msg("IRR crawler started")
}

// Stop gracefully stops the crawler
func (c *IRRCrawler) Stop() {
	c.mu.Lock()
	if !c.running {
		c.mu.Unlock()
		return
	}
	c.running = false
	c.mu.Unlock()

	close(c.stopCh)
	c.wg.Wait()

	log.Info().Msg("IRR crawler stopped")
}

// run is the main crawling loop
func (c *IRRCrawler) run() {
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

// fetchAndStore fetches rates from multiple sources and stores them
func (c *IRRCrawler) fetchAndStore() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Try primary source (PriceDB)
	rates, err := c.client.fetchFromPriceDB(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to fetch from PriceDB, trying alternative sources")

		// Try alternative sources
		rates, err = c.fetchFromAlternativeSources(ctx)
		if err != nil {
			log.Error().Err(err).Msg("All IRR rate sources failed")
			return
		}
	}

	// Store in database
	if err := c.db.SaveRates(ctx, rates, "pricedb"); err != nil {
		log.Error().Err(err).Msg("Failed to save rates to database")
		return
	}

	// Update the client's cache
	c.client.mu.Lock()
	c.client.cachedRates = rates
	c.client.lastFetch = time.Now()
	c.client.mu.Unlock()

	log.Info().
		Float64("USD", rates.USD).
		Float64("EUR", rates.EUR).
		Float64("GBP", rates.GBP).
		Msg("Successfully fetched and stored IRR rates")
}

// fetchFromAlternativeSources tries alternative rate sources
func (c *IRRCrawler) fetchFromAlternativeSources(ctx context.Context) (*IRRRates, error) {
	// Try TGJU alternative endpoints
	sources := []struct {
		name    string
		usdURL  string
		eurURL  string
		gbpURL  string
	}{
		{
			name:   "tgju_main",
			usdURL: "https://raw.githubusercontent.com/margani/pricedb/main/tgju/current/price_dollar_rl/latest.json",
			eurURL: "https://raw.githubusercontent.com/margani/pricedb/main/tgju/current/price_eur/latest.json",
			gbpURL: "https://raw.githubusercontent.com/margani/pricedb/main/tgju/current/price_gbp/latest.json",
		},
	}

	for _, src := range sources {
		rates := &IRRRates{UpdatedAt: time.Now()}

		usdRate, err := c.client.fetchPriceDBRate(ctx, src.usdURL)
		if err != nil {
			continue
		}
		rates.USD = usdRate

		eurRate, err := c.client.fetchPriceDBRate(ctx, src.eurURL)
		if err != nil {
			continue
		}
		rates.EUR = eurRate

		gbpRate, err := c.client.fetchPriceDBRate(ctx, src.gbpURL)
		if err != nil {
			continue
		}
		rates.GBP = gbpRate

		return rates, nil
	}

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	return nil, errors.New("all alternative sources failed")
}

// cleanup removes old rate records
func (c *IRRCrawler) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Keep 30 days of history
	deleted, err := c.db.CleanupOldRecords(ctx, 30*24*time.Hour)
	if err != nil {
		log.Error().Err(err).Msg("Failed to cleanup old IRR rate records")
		return
	}

	if deleted > 0 {
		log.Info().Int64("deleted", deleted).Msg("Cleaned up old IRR rate records")
	}
}

// ForceFetch triggers an immediate fetch (useful for testing or manual refresh)
func (c *IRRCrawler) ForceFetch() {
	go c.fetchAndStore()
}

// IsRunning returns whether the crawler is currently running
func (c *IRRCrawler) IsRunning() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.running
}
