package migrations

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigration0017_NormalizesWalletCurrenciesAndAddsGuards(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping migration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("database not reachable, skipping migration test: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("database not reachable, skipping migration test: %v", err)
	}

	schema := fmt.Sprintf("migration_0017_test_%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA %s", schema)); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schema))
	}()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s", schema)); err != nil {
		t.Fatalf("set search_path: %v", err)
	}

	if _, err := conn.Exec(ctx, `
		CREATE TABLE wallet_balances (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			currency TEXT NOT NULL,
			balance DOUBLE PRECISION NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)
	`); err != nil {
		t.Fatalf("create wallet_balances table: %v", err)
	}
	if _, err := conn.Exec(ctx, `
		CREATE TABLE transactions (
			id UUID PRIMARY KEY,
			currency TEXT NOT NULL,
			to_currency TEXT
		)
	`); err != nil {
		t.Fatalf("create transactions table: %v", err)
	}

	userID := uuid.New()
	now := time.Now().UTC()
	_, err = conn.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES
			($1, $2, $3, $4, $5),
			($6, $2, $7, $8, $9),
			($10, $2, $11, $12, $13)
	`,
		uuid.New(), userID, "USD", 10.0, now,
		uuid.New(), " usd ", 20.0, now.Add(time.Minute),
		uuid.New(), "usd", 30.0, now.Add(2*time.Minute),
	)
	if err != nil {
		t.Fatalf("seed wallet balances: %v", err)
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO transactions (id, currency, to_currency)
		VALUES
			($1, $2, $3),
			($4, $5, NULL)
	`,
		uuid.New(), " usd ", " eur ",
		uuid.New(), "try",
	)
	if err != nil {
		t.Fatalf("seed transactions: %v", err)
	}

	sqlBytes, err := migrationsFS.ReadFile("sql/main/0017_normalize_wallet_currencies.sql")
	if err != nil {
		t.Fatalf("read migration sql: %v", err)
	}

	suffix := fmt.Sprintf("_t%d", time.Now().UnixNano()%1000000)
	migrationSQL := string(sqlBytes)
	migrationSQL = strings.ReplaceAll(migrationSQL, "wallet_balances_currency_canonical", "wallet_balances_currency_canonical"+suffix)
	migrationSQL = strings.ReplaceAll(migrationSQL, "transactions_currency_canonical", "transactions_currency_canonical"+suffix)
	migrationSQL = strings.ReplaceAll(migrationSQL, "transactions_to_currency_canonical", "transactions_to_currency_canonical"+suffix)

	if _, err := conn.Exec(ctx, migrationSQL); err != nil {
		t.Fatalf("execute migration: %v", err)
	}

	var balanceRowCount int
	if err := conn.QueryRow(ctx, `SELECT COUNT(*) FROM wallet_balances WHERE user_id = $1`, userID).Scan(&balanceRowCount); err != nil {
		t.Fatalf("count normalized wallet rows: %v", err)
	}
	if balanceRowCount != 1 {
		t.Fatalf("expected one merged wallet balance row, got %d", balanceRowCount)
	}

	var currency string
	var balance float64
	if err := conn.QueryRow(ctx, `
		SELECT currency, balance
		FROM wallet_balances
		WHERE user_id = $1
	`, userID).Scan(&currency, &balance); err != nil {
		t.Fatalf("read normalized wallet row: %v", err)
	}
	if currency != "USD" {
		t.Fatalf("expected canonical wallet currency USD, got %q", currency)
	}
	if balance != 60 {
		t.Fatalf("expected merged wallet balance 60, got %.2f", balance)
	}

	rows, err := conn.Query(ctx, `SELECT currency, COALESCE(to_currency, '') FROM transactions ORDER BY currency`)
	if err != nil {
		t.Fatalf("query normalized transactions: %v", err)
	}
	defer rows.Close()

	transactionCurrencies := make(map[string]string)
	for rows.Next() {
		var txCurrency string
		var txToCurrency string
		if err := rows.Scan(&txCurrency, &txToCurrency); err != nil {
			t.Fatalf("scan normalized transaction: %v", err)
		}
		transactionCurrencies[txCurrency] = txToCurrency
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate normalized transactions: %v", err)
	}

	if transactionCurrencies["TRY"] != "" {
		t.Fatalf("expected TRY transaction to keep empty to_currency, got %q", transactionCurrencies["TRY"])
	}
	if transactionCurrencies["USD"] != "EUR" {
		t.Fatalf("expected USD transaction to normalize to_currency EUR, got %q", transactionCurrencies["USD"])
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, uuid.New(), uuid.New(), " usd ", 5.0, now)
	if err == nil {
		t.Fatal("expected canonical wallet balance constraint to reject non-canonical currency")
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO transactions (id, currency, to_currency)
		VALUES ($1, $2, $3)
	`, uuid.New(), "usd", " eur ")
	if err == nil {
		t.Fatal("expected canonical transaction constraints to reject non-canonical currencies")
	}
}
