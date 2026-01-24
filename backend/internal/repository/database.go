package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/migrations"
	"github.com/rs/zerolog/log"
)

// Database handles the main PostgreSQL connection for user/wallet data
type Database struct {
	pool *pgxpool.Pool
}

// NewDatabase creates a new database connection pool with robust configuration
func NewDatabase(databaseURL string) (*Database, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	// Parse the connection string and apply robust pool configuration
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	// Connection pool settings for production robustness
	config.MaxConns = 10                        // Maximum connections in pool
	config.MinConns = 2                         // Keep minimum connections alive
	config.MaxConnLifetime = 30 * time.Minute   // Max lifetime of a connection
	config.MaxConnIdleTime = 5 * time.Minute    // Close idle connections after this
	config.HealthCheckPeriod = 30 * time.Second // Periodic health checks

	// Connection timeouts
	config.ConnConfig.ConnectTimeout = 10 * time.Second

	// Create pool with retry logic
	var pool *pgxpool.Pool
	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			// Test the connection
			if pingErr := pool.Ping(ctx); pingErr == nil {
				cancel()
				break
			} else {
				err = pingErr
				pool.Close()
			}
		}
		cancel()

		if attempt < maxRetries {
			log.Warn().
				Err(err).
				Int("attempt", attempt).
				Int("max_retries", maxRetries).
				Msg("Database connection failed, retrying...")
			time.Sleep(time.Duration(attempt) * 2 * time.Second) // Exponential backoff
		}
	}

	if err != nil {
		return nil, fmt.Errorf("connecting to database after %d attempts: %w", maxRetries, err)
	}

	// Initialize tables with separate timeout
	initCtx, initCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer initCancel()

	if err := migrations.ApplyMain(initCtx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("applying migrations: %w", err)
	}

	db := &Database{pool: pool}

	log.Info().
		Int32("max_conns", config.MaxConns).
		Int32("min_conns", config.MinConns).
		Msg("Connected to PostgreSQL database for user/wallet data")
	return db, nil
}

// Pool returns the underlying connection pool
func (d *Database) Pool() *pgxpool.Pool {
	return d.pool
}

// Close closes the database connection pool
func (d *Database) Close() error {
	d.pool.Close()
	return nil
}

// IsHealthy checks if the database connection is healthy
func (d *Database) IsHealthy(ctx context.Context) error {
	if d.pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	// Use a short timeout for health checks
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return d.pool.Ping(checkCtx)
}

// Stats returns connection pool statistics
func (d *Database) Stats() *pgxpool.Stat {
	if d.pool == nil {
		return nil
	}
	return d.pool.Stat()
}
