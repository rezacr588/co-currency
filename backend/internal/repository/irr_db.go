package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

// IRRDatabase handles persistent storage of IRR exchange rates using PostgreSQL
type IRRDatabase struct {
	db *sql.DB
	mu sync.RWMutex
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
// databaseURL should be in the format: postgres://user:password@host:port/dbname?sslmode=disable
func NewIRRDatabase(databaseURL string) (*IRRDatabase, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	irrDB := &IRRDatabase{db: db}

	// Initialize tables
	if err := irrDB.initTables(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("initializing tables: %w", err)
	}

	log.Info().Msg("Connected to PostgreSQL database for IRR rates")
	return irrDB, nil
}

// initTables creates the required database tables
func (d *IRRDatabase) initTables(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS irr_rates (
			id SERIAL PRIMARY KEY,
			currency VARCHAR(10) NOT NULL,
			rate DOUBLE PRECISION NOT NULL,
			source VARCHAR(50) NOT NULL,
			fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_irr_rates_currency ON irr_rates(currency)`,
		`CREATE INDEX IF NOT EXISTS idx_irr_rates_fetched_at ON irr_rates(fetched_at)`,
		`CREATE TABLE IF NOT EXISTS irr_latest_rates (
			currency VARCHAR(10) PRIMARY KEY,
			rate DOUBLE PRECISION NOT NULL,
			source VARCHAR(50) NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL
		)`,
	}

	for _, query := range queries {
		if _, err := d.db.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("executing query: %w", err)
		}
	}

	return nil
}

// SaveRates stores the current exchange rates in the database
func (d *IRRDatabase) SaveRates(ctx context.Context, rates *IRRRates, source string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

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
			_, err = tx.ExecContext(ctx, insertQuery, currency, rate, source, now)
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
			_, err = tx.ExecContext(ctx, upsertQuery, currency, rate, source, now)
			if err != nil {
				return fmt.Errorf("upserting latest rate for %s: %w", currency, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
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

	rows, err := d.db.QueryContext(ctx, query)
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

	rows, err := d.db.QueryContext(ctx, query, currency, limit)
	if err != nil {
		return nil, fmt.Errorf("querying rate history: %w", err)
	}
	defer rows.Close()

	var records []IRRRateRecord
	for rows.Next() {
		var r IRRRateRecord
		if err := rows.Scan(&r.ID, &r.Currency, &r.Rate, &r.Source, &r.FetchedAt, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning row: %w", err)
		}
		records = append(records, r)
	}

	return records, nil
}

// Close closes the database connection
func (d *IRRDatabase) Close() error {
	return d.db.Close()
}

// CleanupOldRecords removes records older than the specified duration
func (d *IRRDatabase) CleanupOldRecords(ctx context.Context, olderThan time.Duration) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)

	result, err := d.db.ExecContext(ctx,
		"DELETE FROM irr_rates WHERE fetched_at < $1",
		cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("deleting old records: %w", err)
	}

	deleted, _ := result.RowsAffected()
	return deleted, nil
}
