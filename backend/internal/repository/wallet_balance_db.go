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

func (r *WalletRepository) lockBalanceForUpdate(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string) (float64, bool, error) {
	var balance float64
	err := tx.QueryRow(ctx, `
		SELECT balance FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
		FOR UPDATE
	`, userID, currency).Scan(&balance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return balance, true, nil
}

func (r *WalletRepository) applyBalanceDelta(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string, delta float64, now time.Time, allowInsert bool) error {
	var err error
	if allowInsert {
		_, err = tx.Exec(ctx, `
			INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, currency) DO UPDATE SET
				balance = wallet_balances.balance + EXCLUDED.balance,
				updated_at = EXCLUDED.updated_at
		`, uuid.New(), userID, currency, delta, now)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE wallet_balances
			SET balance = balance + $1, updated_at = $2
			WHERE user_id = $3 AND currency = $4
		`, delta, now, userID, currency)
	}

	if err != nil {
		if isBalanceConstraintError(err) {
			return ErrInsufficientBalance
		}
		return fmt.Errorf("updating balance: %w", err)
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
	query := `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
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
	// Use upsert with returning
	query := `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = wallet_balances.balance + EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, currency, balance, updated_at
	`

	now := time.Now()
	b := &model.WalletBalance{}

	err := r.pool.QueryRow(ctx, query,
		uuid.New(),
		userID,
		currency,
		delta,
		now,
	).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	// Check if balance went negative (shouldn't happen for debits)
	if b.Balance < 0 {
		// Rollback by reversing the delta
		_, err := r.pool.Exec(ctx, `
			UPDATE wallet_balances
			SET balance = balance - $1, updated_at = $2
			WHERE user_id = $3 AND currency = $4
		`, delta, now, userID, currency)
		if err != nil {
			return nil, fmt.Errorf("rolling back negative balance: %w", err)
		}
		return nil, ErrInsufficientBalance
	}

	return b, nil
}

// SetBalance sets an absolute balance for a user (used for corrections)
func (r *WalletRepository) SetBalance(ctx context.Context, userID uuid.UUID, currency string, balance float64) (*model.WalletBalance, error) {
	query := `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, currency, balance, updated_at
	`

	now := time.Now()
	b := &model.WalletBalance{}

	err := r.pool.QueryRow(ctx, query,
		uuid.New(),
		userID,
		currency,
		balance,
		now,
	).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("setting balance: %w", err)
	}

	return b, nil
}
