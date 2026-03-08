package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

type walletRepoDBFixture struct {
	adminPool *pgxpool.Pool
	pool      *pgxpool.Pool
	repo      *WalletRepository
	schema    string
}

func newWalletRepoDBFixture(t *testing.T) *walletRepoDBFixture {
	t.Helper()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping database-backed repository test")
	}

	ctx := context.Background()
	adminPool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("database not reachable, skipping database-backed repository test: %v", err)
	}
	if err := adminPool.Ping(ctx); err != nil {
		adminPool.Close()
		t.Skipf("database not reachable, skipping database-backed repository test: %v", err)
	}

	schema := fmt.Sprintf("wallet_repo_test_%d", time.Now().UnixNano())
	if _, err := adminPool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA %s", schema)); err != nil {
		adminPool.Close()
		t.Fatalf("create schema: %v", err)
	}

	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		adminPool.Close()
		t.Fatalf("parse database url: %v", err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.MaxConns = 2
	cfg.MinConns = 1

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		_, _ = adminPool.Exec(ctx, fmt.Sprintf("DROP SCHEMA %s CASCADE", schema))
		adminPool.Close()
		t.Skipf("database not reachable, skipping database-backed repository test: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		_, _ = adminPool.Exec(ctx, fmt.Sprintf("DROP SCHEMA %s CASCADE", schema))
		adminPool.Close()
		t.Skipf("database not reachable, skipping database-backed repository test: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		CREATE TABLE wallet_balances (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			currency TEXT NOT NULL,
			balance DOUBLE PRECISION NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			CONSTRAINT wallet_balances_user_currency_key UNIQUE (user_id, currency),
			CONSTRAINT wallet_balances_non_negative CHECK (balance >= 0)
		)
	`); err != nil {
		pool.Close()
		_, _ = adminPool.Exec(ctx, fmt.Sprintf("DROP SCHEMA %s CASCADE", schema))
		adminPool.Close()
		t.Fatalf("create wallet_balances table: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		CREATE TABLE transactions (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			type TEXT NOT NULL,
			amount DOUBLE PRECISION NOT NULL,
			currency TEXT NOT NULL,
			to_amount DOUBLE PRECISION,
			to_currency TEXT,
			rate DOUBLE PRECISION,
			source TEXT NOT NULL,
			category TEXT,
			icon TEXT,
			ai_extracted_data JSONB,
			description TEXT,
			created_at TIMESTAMPTZ NOT NULL
		)
	`); err != nil {
		pool.Close()
		_, _ = adminPool.Exec(ctx, fmt.Sprintf("DROP SCHEMA %s CASCADE", schema))
		adminPool.Close()
		t.Fatalf("create transactions table: %v", err)
	}

	fixture := &walletRepoDBFixture{
		adminPool: adminPool,
		pool:      pool,
		repo:      &WalletRepository{pool: pool},
		schema:    schema,
	}

	t.Cleanup(func() {
		pool.Close()
		_, _ = adminPool.Exec(ctx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schema))
		adminPool.Close()
	})

	return fixture
}

func TestExecuteConversion_NormalizesLegacySourceBalanceRows(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()
	userID := uuid.New()
	now := time.Now()

	_, err := fixture.pool.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES
			($1, $2, $3, $4, $5),
			($6, $2, $7, $8, $9)
	`, uuid.New(), userID, " usd ", 70.0, now, uuid.New(), "USD", 50.0, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("seed wallet balances: %v", err)
	}

	transaction, err := fixture.repo.ExecuteConversion(ctx, userID, "USD", "EUR", 60, 54, 0.9)
	if err != nil {
		t.Fatalf("execute conversion: %v", err)
	}

	if transaction.Currency != "USD" {
		t.Fatalf("expected source currency USD, got %s", transaction.Currency)
	}
	if transaction.ToCurrency == nil || *transaction.ToCurrency != "EUR" {
		t.Fatalf("expected target currency EUR, got %v", transaction.ToCurrency)
	}

	usdBalance, err := fixture.repo.GetBalance(ctx, userID, "USD")
	if err != nil {
		t.Fatalf("get usd balance: %v", err)
	}
	if usdBalance.Balance != 60 {
		t.Fatalf("expected usd balance 60, got %.2f", usdBalance.Balance)
	}

	eurBalance, err := fixture.repo.GetBalance(ctx, userID, "EUR")
	if err != nil {
		t.Fatalf("get eur balance: %v", err)
	}
	if eurBalance.Balance != 54 {
		t.Fatalf("expected eur balance 54, got %.2f", eurBalance.Balance)
	}

	var rawRowCount int
	if err := fixture.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM wallet_balances
		WHERE user_id = $1
	`, userID).Scan(&rawRowCount); err != nil {
		t.Fatalf("count wallet rows: %v", err)
	}
	if rawRowCount != 2 {
		t.Fatalf("expected 2 raw balance rows after conversion, got %d", rawRowCount)
	}

	var storedUSDCurrency string
	if err := fixture.pool.QueryRow(ctx, `
		SELECT currency
		FROM wallet_balances
		WHERE user_id = $1 AND UPPER(TRIM(currency)) = 'USD'
	`, userID).Scan(&storedUSDCurrency); err != nil {
		t.Fatalf("read stored usd currency: %v", err)
	}
	if storedUSDCurrency != "USD" {
		t.Fatalf("expected stored usd currency to be canonical, got %q", storedUSDCurrency)
	}
}

func TestAddCrossCurrencyTransactionAtomic_DebitsCanonicalSourceWallet(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()
	userID := uuid.New()
	now := time.Now()

	_, err := fixture.pool.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES
			($1, $2, $3, $4, $5),
			($6, $2, $7, $8, $9)
	`, uuid.New(), userID, "usd", 4.0, now, uuid.New(), " USD ", 6.0, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("seed wallet balances: %v", err)
	}

	transaction, err := fixture.repo.AddCrossCurrencyTransactionAtomic(
		ctx,
		userID,
		model.TransactionTypeDebit,
		100,
		"TRY",
		3,
		"USD",
		0.03,
		"manual",
		"coffee",
		"food",
		"",
		json.RawMessage(`{"source":"test"}`),
	)
	if err != nil {
		t.Fatalf("add cross-currency transaction: %v", err)
	}

	if transaction.Currency != "TRY" {
		t.Fatalf("expected transaction currency TRY, got %s", transaction.Currency)
	}
	if transaction.ToCurrency == nil || *transaction.ToCurrency != "USD" {
		t.Fatalf("expected wallet currency USD, got %v", transaction.ToCurrency)
	}

	usdBalance, err := fixture.repo.GetBalance(ctx, userID, "USD")
	if err != nil {
		t.Fatalf("get usd balance: %v", err)
	}
	if usdBalance.Balance != 7 {
		t.Fatalf("expected usd balance 7, got %.2f", usdBalance.Balance)
	}

	var usdRowCount int
	if err := fixture.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM wallet_balances
		WHERE user_id = $1 AND UPPER(TRIM(currency)) = 'USD'
	`, userID).Scan(&usdRowCount); err != nil {
		t.Fatalf("count usd rows: %v", err)
	}
	if usdRowCount != 1 {
		t.Fatalf("expected a single canonical usd row, got %d", usdRowCount)
	}
}

func TestUpdateBalance_DebitMissingBalanceReturnsInsufficientBalance(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()

	_, err := fixture.repo.UpdateBalance(ctx, uuid.New(), "USD", -10)
	if !errors.Is(err, ErrInsufficientBalance) {
		t.Fatalf("expected ErrInsufficientBalance, got %v", err)
	}
}
