package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/migrations"
	"github.com/rs/zerolog/log"
)

// IRRDatabase handles persistent storage of IRR exchange rates using PostgreSQL
type IRRDatabase struct {
	pool *pgxpool.Pool
	mu   sync.RWMutex
}

// IRRRateRecord represents a stored exchange rate record
type IRRRateRecord struct {
	ID        int64     `json:"id"`
	Currency  string    `json:"currency"`
	Rate      float64   `json:"rate"`
	Source    string    `json:"source"`
	FetchedAt time.Time `json:"fetched_at"`
	CreatedAt time.Time `json:"created_at"`
}

// NewIRRDatabase creates a new database connection for IRR rates
// databaseURL should be in the format: postgresql://user:password@host:port/dbname?sslmode=require
func NewIRRDatabase(databaseURL string) (*IRRDatabase, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create connection pool
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	irrDB := &IRRDatabase{pool: pool}

	// Initialize tables
	if err := migrations.ApplyIRR(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("applying migrations: %w", err)
	}

	log.Info().Msg("Connected to PostgreSQL database for IRR rates")
	return irrDB, nil
}

// SaveRates stores the current exchange rates in the database
func (d *IRRDatabase) SaveRates(ctx context.Context, rates *IRRRates, source string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Save historical records
	insertQuery := `INSERT INTO irr_rates (currency, rate, source, fetched_at) VALUES ($1, $2, $3, $4)`

	currencies := map[string]float64{
		"USD": rates.USD,
		"EUR": rates.EUR,
		"GBP": rates.GBP,
	}

	for currency, rate := range currencies {
		if rate > 0 {
			_, err = tx.Exec(ctx, insertQuery, currency, rate, source, now)
			if err != nil {
				return fmt.Errorf("inserting rate for %s: %w", currency, err)
			}
		}
	}

	// Update latest rates table (upsert)
	upsertQuery := `
		INSERT INTO irr_latest_rates (currency, rate, source, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (currency) DO UPDATE SET
			rate = EXCLUDED.rate,
			source = EXCLUDED.source,
			updated_at = EXCLUDED.updated_at
	`

	for currency, rate := range currencies {
		if rate > 0 {
			_, err = tx.Exec(ctx, upsertQuery, currency, rate, source, now)
			if err != nil {
				return fmt.Errorf("upserting latest rate for %s: %w", currency, err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	log.Debug().
		Float64("USD", rates.USD).
		Float64("EUR", rates.EUR).
		Float64("GBP", rates.GBP).
		Str("source", source).
		Msg("Saved IRR rates to database")

	return nil
}

// GetLatestRates retrieves the most recent rates from the database
func (d *IRRDatabase) GetLatestRates(ctx context.Context) (*IRRRates, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	query := `SELECT currency, rate, updated_at FROM irr_latest_rates`

	rows, err := d.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying latest rates: %w", err)
	}
	defer rows.Close()

	rates := &IRRRates{}
	var latestUpdate time.Time
	found := false

	for rows.Next() {
		var currency string
		var rate float64
		var updatedAt time.Time

		if err := rows.Scan(&currency, &rate, &updatedAt); err != nil {
			return nil, fmt.Errorf("scanning row: %w", err)
		}

		switch currency {
		case "USD":
			rates.USD = rate
		case "EUR":
			rates.EUR = rate
		case "GBP":
			rates.GBP = rate
		}

		if updatedAt.After(latestUpdate) {
			latestUpdate = updatedAt
		}
		found = true
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating rows: %w", err)
	}

	if !found {
		return nil, fmt.Errorf("no rates found in database")
	}

	rates.UpdatedAt = latestUpdate
	return rates, nil
}

// GetRateHistory retrieves historical rates for a specific currency
func (d *IRRDatabase) GetRateHistory(ctx context.Context, currency string, limit int) ([]IRRRateRecord, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT id, currency, rate, source, fetched_at, created_at
		FROM irr_rates
		WHERE currency = $1
		ORDER BY fetched_at DESC
		LIMIT $2
	`

	rows, err := d.pool.Query(ctx, query, currency, limit)
	if err != nil {
		return nil, fmt.Errorf("querying rate history: %w", err)
	}
	defer rows.Close()

	records, err := pgx.CollectRows(rows, pgx.RowToStructByPos[IRRRateRecord])
	if err != nil {
		return nil, fmt.Errorf("collecting rows: %w", err)
	}

	return records, nil
}

// Close closes the database connection pool
func (d *IRRDatabase) Close() error {
	d.pool.Close()
	return nil
}

// CleanupOldRecords removes records older than the specified duration
func (d *IRRDatabase) CleanupOldRecords(ctx context.Context, olderThan time.Duration) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)

	result, err := d.pool.Exec(ctx, "DELETE FROM irr_rates WHERE fetched_at < $1", cutoff)
	if err != nil {
		return 0, fmt.Errorf("deleting old records: %w", err)
	}

	return result.RowsAffected(), nil
}
