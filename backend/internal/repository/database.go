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

	db := &Database{pool: pool}

	// Initialize tables with separate timeout
	initCtx, initCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer initCancel()

	if err := db.initTables(initCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("initializing tables: %w", err)
	}

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
			failed_login_attempts INTEGER DEFAULT 0,
			locked_until TIMESTAMP WITH TIME ZONE,
			password_reset_token VARCHAR(255),
			password_reset_expires TIMESTAMP WITH TIME ZONE,
			onboarding_completed BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

		// Add new columns if they don't exist (for existing databases)
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE`,

		// Create index after column is ensured to exist
		`CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token)`,

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

		// Transaction history with category
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
			category VARCHAR(50),
			ai_extracted_data JSONB,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`,

		// Add category column if it doesn't exist (for existing databases)
		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category VARCHAR(50)`,

		// Add icon column if it doesn't exist (for existing databases)
		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS icon VARCHAR(10)`,

		// Create index after column is ensured to exist
		`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`,

		// Categories table
		`CREATE TABLE IF NOT EXISTS categories (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(50) NOT NULL,
			icon VARCHAR(50),
			color VARCHAR(20),
			is_default BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)`,

		// Refresh tokens table
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`,

		// Goals table
		`CREATE TABLE IF NOT EXISTS goals (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			target_amount DECIMAL(20, 8) NOT NULL,
			current_amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
			currency VARCHAR(10) NOT NULL,
			category VARCHAR(50),
			deadline DATE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)`,

		// Tags table
		`CREATE TABLE IF NOT EXISTS tags (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(50) NOT NULL,
			color VARCHAR(20),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, name)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id)`,

		// Transaction tags junction table
		`CREATE TABLE IF NOT EXISTS transaction_tags (
			transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
			tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (transaction_id, tag_id)
		)`,

		// Add notes column to transactions if not exists
		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT`,

		// Budgets table
		`CREATE TABLE IF NOT EXISTS budgets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			category VARCHAR(50) NOT NULL,
			amount DECIMAL(20, 8) NOT NULL,
			currency VARCHAR(10) NOT NULL,
			period VARCHAR(20) NOT NULL DEFAULT 'monthly',
			spent DECIMAL(20, 8) NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, category, period)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)`,

		// Recurring transactions table
		`CREATE TABLE IF NOT EXISTS recurring_transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			type VARCHAR(20) NOT NULL,
			amount DECIMAL(20, 8) NOT NULL,
			currency VARCHAR(10) NOT NULL,
			category VARCHAR(50),
			description TEXT,
			frequency VARCHAR(20) NOT NULL,
			next_execution DATE NOT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON recurring_transactions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_execution ON recurring_transactions(next_execution)`,

		// Subscriptions table
		`CREATE TABLE IF NOT EXISTS subscriptions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			amount DECIMAL(20, 8) NOT NULL,
			currency VARCHAR(10) NOT NULL,
			billing_cycle VARCHAR(20) NOT NULL,
			category VARCHAR(50),
			next_billing_date DATE NOT NULL,
			status VARCHAR(20) DEFAULT 'active',
			reminder_days INTEGER DEFAULT 3,
			notes TEXT,
			logo_url TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,

		// Badges table (system badges)
		`CREATE TABLE IF NOT EXISTS badges (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL UNIQUE,
			description TEXT,
			icon VARCHAR(50),
			category VARCHAR(50),
			requirement_type VARCHAR(50) NOT NULL,
			requirement_value DECIMAL(20, 8),
			rarity VARCHAR(20) DEFAULT 'common',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category)`,

		// User badges table (earned badges)
		`CREATE TABLE IF NOT EXISTS user_badges (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
			earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, badge_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id)`,

		// Chat conversations table
		`CREATE TABLE IF NOT EXISTS chat_conversations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			title VARCHAR(200),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id)`,

		// Chat messages table
		`CREATE TABLE IF NOT EXISTS chat_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
			role VARCHAR(20) NOT NULL,
			content TEXT NOT NULL,
			tokens_used INTEGER,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)`,

		// Add CHECK constraints to prevent invalid data (using DO blocks for idempotency)
		// Prevent negative wallet balances
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balances_balance_non_negative') THEN
				ALTER TABLE wallet_balances ADD CONSTRAINT wallet_balances_balance_non_negative CHECK (balance >= 0);
			END IF;
		END $$`,

		// Prevent negative/zero transaction amounts
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive') THEN
				ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
			END IF;
		END $$`,

		// Prevent negative budget spent
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_spent_non_negative') THEN
				ALTER TABLE budgets ADD CONSTRAINT budgets_spent_non_negative CHECK (spent >= 0);
			END IF;
		END $$`,

		// Prevent negative budget amount
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_amount_positive') THEN
				ALTER TABLE budgets ADD CONSTRAINT budgets_amount_positive CHECK (amount > 0);
			END IF;
		END $$`,

		// Prevent negative goal amounts
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_target_positive') THEN
				ALTER TABLE goals ADD CONSTRAINT goals_target_positive CHECK (target_amount > 0);
			END IF;
		END $$`,
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_current_non_negative') THEN
				ALTER TABLE goals ADD CONSTRAINT goals_current_non_negative CHECK (current_amount >= 0);
			END IF;
		END $$`,

		// Prevent negative recurring transaction amounts
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_amount_positive') THEN
				ALTER TABLE recurring_transactions ADD CONSTRAINT recurring_amount_positive CHECK (amount > 0);
			END IF;
		END $$`,

		// Add index on transaction_tags.tag_id for faster joins
		`CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id)`,
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
