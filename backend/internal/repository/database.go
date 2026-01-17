package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// Database handles the main PostgreSQL connection for user/wallet data
type Database struct {
	pool *pgxpool.Pool
}

// NewDatabase creates a new database connection pool
func NewDatabase(databaseURL string) (*Database, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	db := &Database{pool: pool}

	if err := db.initTables(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("initializing tables: %w", err)
	}

	log.Info().Msg("Connected to PostgreSQL database for user/wallet data")
	return db, nil
}

// Pool returns the underlying connection pool
func (d *Database) Pool() *pgxpool.Pool {
	return d.pool
}

// initTables creates the required database tables for users, wallets, and transactions
func (d *Database) initTables(ctx context.Context) error {
	queries := []string{
		// Enable UUID extension
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			name VARCHAR(255),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

		// Wallet balances (one row per user per currency)
		`CREATE TABLE IF NOT EXISTS wallet_balances (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			currency VARCHAR(10) NOT NULL,
			balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, currency)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_wallet_balances_user_id ON wallet_balances(user_id)`,

		// Transaction history
		`CREATE TABLE IF NOT EXISTS transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			type VARCHAR(20) NOT NULL,
			amount DECIMAL(20, 8) NOT NULL,
			currency VARCHAR(10) NOT NULL,
			to_amount DECIMAL(20, 8),
			to_currency VARCHAR(10),
			rate DECIMAL(20, 8),
			source VARCHAR(50),
			ai_extracted_data JSONB,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`,
	}

	for _, query := range queries {
		if _, err := d.pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("executing query: %w", err)
		}
	}

	log.Debug().Msg("Database tables initialized")
	return nil
}

// Close closes the database connection pool
func (d *Database) Close() error {
	d.pool.Close()
	return nil
}
