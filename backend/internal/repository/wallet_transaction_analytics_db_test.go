package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
)

func insertAnalyticsTransaction(
	t *testing.T,
	fixture *walletRepoDBFixture,
	userID uuid.UUID,
	txType string,
	amount float64,
	currency string,
	category *string,
	description *string,
	createdAt time.Time,
) {
	t.Helper()

	_, err := fixture.pool.Exec(context.Background(), `
		INSERT INTO transactions (
			id,
			user_id,
			type,
			amount,
			currency,
			source,
			category,
			description,
			created_at
		)
		VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7, $8)
	`, uuid.New(), userID, txType, amount, currency, category, description, createdAt)
	if err != nil {
		t.Fatalf("insert transaction: %v", err)
	}
}

func strPtr(value string) *string {
	return &value
}

func TestWalletRepository_GetWeekdayTypeTotalsByCurrency(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()
	userID := uuid.New()
	otherUserID := uuid.New()

	from := time.Date(2026, time.March, 2, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, time.March, 3, 23, 59, 59, 0, time.UTC)

	insertAnalyticsTransaction(t, fixture, userID, "debit", 10, " usd ", strPtr("food"), strPtr("Lunch"), time.Date(2026, time.March, 2, 9, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, userID, "credit", 7, " eur ", strPtr("salary"), strPtr("Bonus"), time.Date(2026, time.March, 2, 14, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, userID, "debit", 5, "USD", strPtr("transport"), strPtr("Metro"), time.Date(2026, time.March, 3, 11, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, otherUserID, "debit", 999, "USD", strPtr("food"), strPtr("Ignore"), time.Date(2026, time.March, 2, 10, 0, 0, 0, time.UTC))

	rows, err := fixture.repo.GetWeekdayTypeTotalsByCurrency(ctx, userID, from, to, "UTC")
	if err != nil {
		t.Fatalf("GetWeekdayTypeTotalsByCurrency: %v", err)
	}

	got := make(map[string]float64, len(rows))
	for _, row := range rows {
		got[fmt.Sprintf("%d:%s:%s", row.Weekday, row.Type, row.Currency)] = row.Total
	}

	want := map[string]float64{
		"1:debit:USD":  10,
		"1:credit:EUR": 7,
		"2:debit:USD":  5,
	}

	if len(got) != len(want) {
		t.Fatalf("expected %d aggregate rows, got %d (%v)", len(want), len(got), got)
	}
	for key, expected := range want {
		if got[key] != expected {
			t.Fatalf("expected %s total %.2f, got %.2f", key, expected, got[key])
		}
	}
}

func TestWalletRepository_GetCategorySpendingStatsByCurrency(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()
	userID := uuid.New()

	from := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, time.January, 31, 23, 59, 59, 0, time.UTC)

	insertAnalyticsTransaction(t, fixture, userID, "debit", 10, "usd", strPtr("food"), strPtr("Coffee"), time.Date(2026, time.January, 5, 9, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, userID, "debit", 20, " USD ", strPtr("food"), strPtr("Groceries"), time.Date(2026, time.January, 8, 18, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, userID, "debit", 5, "eur", strPtr(""), nil, time.Date(2026, time.January, 12, 12, 0, 0, 0, time.UTC))
	insertAnalyticsTransaction(t, fixture, userID, "credit", 99, "USD", strPtr("food"), strPtr("Refund"), time.Date(2026, time.January, 15, 12, 0, 0, 0, time.UTC))

	rows, err := fixture.repo.GetCategorySpendingStatsByCurrency(ctx, userID, from, to)
	if err != nil {
		t.Fatalf("GetCategorySpendingStatsByCurrency: %v", err)
	}

	type stat struct {
		count      int
		sum        float64
		sumSquares float64
	}

	got := make(map[string]stat, len(rows))
	for _, row := range rows {
		got[fmt.Sprintf("%s:%s", row.Category, row.Currency)] = stat{
			count:      row.Count,
			sum:        row.Sum,
			sumSquares: row.SumSquares,
		}
	}

	want := map[string]stat{
		"food:USD":  {count: 2, sum: 30, sumSquares: 500},
		"other:EUR": {count: 1, sum: 5, sumSquares: 25},
	}

	if len(got) != len(want) {
		t.Fatalf("expected %d category stats, got %d (%v)", len(want), len(got), got)
	}
	for key, expected := range want {
		actual, ok := got[key]
		if !ok {
			t.Fatalf("missing stat for %s", key)
		}
		if actual != expected {
			t.Fatalf("expected %s to be %+v, got %+v", key, expected, actual)
		}
	}
}

func TestWalletRepository_GetRecentDebitTransactions(t *testing.T) {
	fixture := newWalletRepoDBFixture(t)
	ctx := context.Background()
	userID := uuid.New()

	from := time.Date(2026, time.February, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, time.February, 28, 23, 59, 59, 0, time.UTC)

	olderAt := time.Date(2026, time.February, 10, 8, 0, 0, 0, time.UTC)
	newerAt := time.Date(2026, time.February, 11, 9, 30, 0, 0, time.UTC)

	insertAnalyticsTransaction(t, fixture, userID, "debit", 18, " usd ", strPtr(""), nil, olderAt)
	insertAnalyticsTransaction(t, fixture, userID, "debit", 42, "eur", strPtr("travel"), strPtr("Train"), newerAt)
	insertAnalyticsTransaction(t, fixture, userID, "credit", 100, "USD", strPtr("salary"), strPtr("Ignore"), newerAt.Add(time.Hour))

	rows, err := fixture.repo.GetRecentDebitTransactions(ctx, userID, from, to)
	if err != nil {
		t.Fatalf("GetRecentDebitTransactions: %v", err)
	}

	if len(rows) != 2 {
		t.Fatalf("expected 2 debit transactions, got %d", len(rows))
	}
	if rows[0].CreatedAt != newerAt {
		t.Fatalf("expected newest transaction first, got %s then %s", rows[0].CreatedAt, rows[1].CreatedAt)
	}
	if rows[0].Currency != "EUR" || rows[0].Category != "travel" || rows[0].Description != "Train" {
		t.Fatalf("expected normalized latest row, got %+v", rows[0])
	}
	if rows[1].Currency != "USD" || rows[1].Category != "other" || rows[1].Description != "" {
		t.Fatalf("expected normalized fallback row, got %+v", rows[1])
	}
}
