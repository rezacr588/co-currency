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

// DBPoolConfig holds connection pool tuning parameters.
type DBPoolConfig struct {
	MaxConns          int32
	MinConns          int32
	MaxConnLifetime   time.Duration
	MaxConnIdleTime   time.Duration
	HealthCheckPeriod time.Duration
}

// DefaultDBPoolConfig returns production-safe defaults.
func DefaultDBPoolConfig() DBPoolConfig {
	return DBPoolConfig{
		MaxConns:          50,
		MinConns:          10,
		MaxConnLifetime:   30 * time.Minute,
		MaxConnIdleTime:   5 * time.Minute,
		HealthCheckPeriod: 30 * time.Second,
	}
}

// NewDatabase creates a new database connection pool with robust configuration.
// Pass nil for poolCfg to use defaults (for backward compatibility).
func NewDatabase(databaseURL string, poolCfg *DBPoolConfig) (*Database, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	defaults := DefaultDBPoolConfig()
	if poolCfg == nil {
		poolCfg = &defaults
	}

	// Parse the connection string and apply robust pool configuration
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	// Connection pool settings
	config.MaxConns = poolCfg.MaxConns
	config.MinConns = poolCfg.MinConns
	config.MaxConnLifetime = poolCfg.MaxConnLifetime
	config.MaxConnIdleTime = poolCfg.MaxConnIdleTime
	config.HealthCheckPeriod = poolCfg.HealthCheckPeriod

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
