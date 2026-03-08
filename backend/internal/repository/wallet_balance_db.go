package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

type transactionScanner interface {
	Scan(dest ...interface{}) error
}

type lockedBalanceRow struct {
	ID       uuid.UUID
	Currency string
	Balance  float64
}

func scanTransaction(scanner transactionScanner) (*model.Transaction, error) {
	var t model.Transaction
	var aiData []byte
	var category *string
	var icon *string
	var description *string

	if err := scanner.Scan(
		&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Currency,
		&t.ToAmount, &t.ToCurrency, &t.Rate, &t.Source, &category, &icon, &aiData, &description, &t.CreatedAt,
	); err != nil {
		return nil, err
	}

	if aiData != nil {
		t.AIExtractedData = json.RawMessage(aiData)
	}
	if category != nil {
		t.Category = *category
	}
	if icon != nil {
		t.Icon = *icon
	}
	if description != nil {
		t.Description = *description
	}
	t.Currency = normalizeWalletCurrencyCode(t.Currency)
	if t.ToCurrency != nil {
		normalizedToCurrency := normalizeWalletCurrencyCode(*t.ToCurrency)
		t.ToCurrency = &normalizedToCurrency
	}

	return &t, nil
}

// isBalanceConstraintError checks if the error is a CHECK constraint violation for non-negative balance
func isBalanceConstraintError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// PostgreSQL error code 23514 is check_violation
		if pgErr.Code == "23514" && strings.Contains(pgErr.ConstraintName, "non_negative") {
			return true
		}
	}
	return false
}

func normalizeWalletCurrencyCode(currency string) string {
	return strings.ToUpper(strings.TrimSpace(currency))
}

func (r *WalletRepository) loadLockedBalanceRows(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string) ([]lockedBalanceRow, error) {
	normalizedCurrency := normalizeWalletCurrencyCode(currency)

	rows, err := tx.Query(ctx, `
		SELECT id, currency, balance
		FROM wallet_balances
		WHERE user_id = $1 AND UPPER(TRIM(currency)) = $2
		ORDER BY CASE WHEN currency = $2 THEN 0 ELSE 1 END, updated_at DESC, id
		FOR UPDATE
	`, userID, normalizedCurrency)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []lockedBalanceRow
	for rows.Next() {
		var row lockedBalanceRow
		if err := rows.Scan(&row.ID, &row.Currency, &row.Balance); err != nil {
			return nil, err
		}
		matches = append(matches, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}

func (r *WalletRepository) lockBalanceForUpdate(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string) (float64, bool, error) {
	rows, err := r.loadLockedBalanceRows(ctx, tx, userID, currency)
	if err != nil {
		return 0, false, err
	}

	var balance float64
	for _, row := range rows {
		balance += row.Balance
	}

	return balance, len(rows) > 0, nil
}

func (r *WalletRepository) applyBalanceDelta(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string, delta float64, now time.Time, allowInsert bool) error {
	normalizedCurrency := normalizeWalletCurrencyCode(currency)
	rows, err := r.loadLockedBalanceRows(ctx, tx, userID, normalizedCurrency)
	if err != nil {
		return fmt.Errorf("locking balances: %w", err)
	}

	if len(rows) == 0 {
		if !allowInsert || delta < 0 {
			if delta < 0 {
				return ErrInsufficientBalance
			}
			return ErrBalanceNotFound
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, currency) DO UPDATE SET
				balance = wallet_balances.balance + EXCLUDED.balance,
				updated_at = EXCLUDED.updated_at
		`, uuid.New(), userID, normalizedCurrency, delta, now)
		if err != nil {
			if isBalanceConstraintError(err) {
				return ErrInsufficientBalance
			}
			return fmt.Errorf("updating balance: %w", err)
		}
		return nil
	}

	keepRow := rows[0]
	var currentBalance float64
	deleteIDs := make([]uuid.UUID, 0, len(rows)-1)
	for _, row := range rows {
		currentBalance += row.Balance
		if row.Currency == normalizedCurrency {
			keepRow = row
		}
	}

	newBalance := currentBalance + delta
	if newBalance < 0 {
		return ErrInsufficientBalance
	}

	for _, row := range rows {
		if row.ID != keepRow.ID {
			deleteIDs = append(deleteIDs, row.ID)
		}
	}
	if len(deleteIDs) > 0 {
		if _, err := tx.Exec(ctx, `
			DELETE FROM wallet_balances
			WHERE id = ANY($1)
		`, deleteIDs); err != nil {
			return fmt.Errorf("deduplicating balances: %w", err)
		}
	}

	result, err := tx.Exec(ctx, `
		UPDATE wallet_balances
		SET currency = $1, balance = $2, updated_at = $3
		WHERE id = $4
	`, normalizedCurrency, newBalance, now, keepRow.ID)
	if err != nil {
		if isBalanceConstraintError(err) {
			return ErrInsufficientBalance
		}
		return fmt.Errorf("updating balance: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrBalanceNotFound
	}
	return nil
}

// WalletRepository handles database operations for wallet balances and transactions
type WalletRepository struct {
	pool *pgxpool.Pool
}

// NewWalletRepository creates a new WalletRepository
func NewWalletRepository(db *Database) *WalletRepository {
	return &WalletRepository{pool: db.Pool()}
}

// GetBalances retrieves all balances for a user
func (r *WalletRepository) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	query := `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1
		ORDER BY currency
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying balances: %w", err)
	}
	defer rows.Close()

	var balances []model.WalletBalance
	for rows.Next() {
		var b model.WalletBalance
		if err := rows.Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning balance: %w", err)
		}
		balances = append(balances, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating balances: %w", err)
	}

	return balances, nil
}

// GetBalance retrieves a specific currency balance for a user
func (r *WalletRepository) GetBalance(ctx context.Context, userID uuid.UUID, currency string) (*model.WalletBalance, error) {
	currency = normalizeWalletCurrencyCode(currency)
	query := `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1 AND UPPER(TRIM(currency)) = $2
	`

	b := &model.WalletBalance{}
	err := r.pool.QueryRow(ctx, query, userID, currency).Scan(
		&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBalanceNotFound
		}
		return nil, fmt.Errorf("getting balance: %w", err)
	}

	return b, nil
}

// UpdateBalance updates or creates a balance for a user
func (r *WalletRepository) UpdateBalance(ctx context.Context, userID uuid.UUID, currency string, delta float64) (*model.WalletBalance, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning balance update: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	if err := r.applyBalanceDelta(ctx, tx, userID, currency, delta, now, delta > 0); err != nil {
		return nil, err
	}

	currency = normalizeWalletCurrencyCode(currency)
	balance := &model.WalletBalance{}
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1 AND UPPER(TRIM(currency)) = $2
	`, userID, currency).Scan(&balance.ID, &balance.UserID, &balance.Currency, &balance.Balance, &balance.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBalanceNotFound
		}
		return nil, fmt.Errorf("reading updated balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing balance update: %w", err)
	}

	return balance, nil
}

// SetBalance sets an absolute balance for a user (used for corrections)
func (r *WalletRepository) SetBalance(ctx context.Context, userID uuid.UUID, currency string, balance float64) (*model.WalletBalance, error) {
	currency = normalizeWalletCurrencyCode(currency)
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning balance set: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := r.loadLockedBalanceRows(ctx, tx, userID, currency)
	if err != nil {
		return nil, fmt.Errorf("locking balances: %w", err)
	}

	now := time.Now()
	b := &model.WalletBalance{}
	if len(rows) == 0 {
		err = tx.QueryRow(ctx, `
			INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, user_id, currency, balance, updated_at
		`, uuid.New(), userID, currency, balance, now).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("setting balance: %w", err)
		}
	} else {
		keepRow := rows[0]
		deleteIDs := make([]uuid.UUID, 0, len(rows)-1)
		for _, row := range rows {
			if row.Currency == currency {
				keepRow = row
			}
		}
		for _, row := range rows {
			if row.ID != keepRow.ID {
				deleteIDs = append(deleteIDs, row.ID)
			}
		}
		if len(deleteIDs) > 0 {
			if _, err := tx.Exec(ctx, `
				DELETE FROM wallet_balances
				WHERE id = ANY($1)
			`, deleteIDs); err != nil {
				return nil, fmt.Errorf("deduplicating balances: %w", err)
			}
		}

		err = tx.QueryRow(ctx, `
			UPDATE wallet_balances
			SET currency = $1, balance = $2, updated_at = $3
			WHERE id = $4
			RETURNING id, user_id, currency, balance, updated_at
		`, currency, balance, now, keepRow.ID).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("setting balance: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing balance set: %w", err)
	}

	return b, nil
}
