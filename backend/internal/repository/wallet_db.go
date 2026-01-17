package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrBalanceNotFound     = errors.New("balance not found")
)

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

// CreateTransaction records a new transaction
func (r *WalletRepository) CreateTransaction(ctx context.Context, tx *model.Transaction) error {
	query := `
		INSERT INTO transactions (id, user_id, type, amount, currency, to_amount, to_currency, rate, source, ai_extracted_data, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	tx.ID = uuid.New()
	tx.CreatedAt = time.Now()

	_, err := r.pool.Exec(ctx, query,
		tx.ID,
		tx.UserID,
		tx.Type,
		tx.Amount,
		tx.Currency,
		tx.ToAmount,
		tx.ToCurrency,
		tx.Rate,
		tx.Source,
		tx.AIExtractedData,
		tx.Description,
		tx.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("creating transaction: %w", err)
	}

	return nil
}

// GetTransactions retrieves transactions for a user with pagination
func (r *WalletRepository) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, rate, source, ai_extracted_data, description, created_at
		FROM transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("querying transactions: %w", err)
	}
	defer rows.Close()

	var transactions []model.Transaction
	for rows.Next() {
		var t model.Transaction
		var aiData []byte
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Currency,
			&t.ToAmount, &t.ToCurrency, &t.Rate, &t.Source, &aiData, &t.Description, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning transaction: %w", err)
		}
		if aiData != nil {
			t.AIExtractedData = json.RawMessage(aiData)
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating transactions: %w", err)
	}

	return transactions, nil
}

// GetTransaction retrieves a single transaction by ID
func (r *WalletRepository) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error) {
	query := `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, rate, source, ai_extracted_data, description, created_at
		FROM transactions
		WHERE id = $1 AND user_id = $2
	`

	t := &model.Transaction{}
	var aiData []byte

	err := r.pool.QueryRow(ctx, query, txID, userID).Scan(
		&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Currency,
		&t.ToAmount, &t.ToCurrency, &t.Rate, &t.Source, &aiData, &t.Description, &t.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("transaction not found")
		}
		return nil, fmt.Errorf("getting transaction: %w", err)
	}

	if aiData != nil {
		t.AIExtractedData = json.RawMessage(aiData)
	}

	return t, nil
}

// ExecuteConversion performs an atomic currency conversion
func (r *WalletRepository) ExecuteConversion(ctx context.Context, userID uuid.UUID, fromCurrency, toCurrency string, fromAmount, toAmount, rate float64) (*model.Transaction, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Check if user has sufficient balance
	var currentBalance float64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(balance, 0) FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
	`, userID, fromCurrency).Scan(&currentBalance)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("checking balance: %w", err)
	}

	if currentBalance < fromAmount {
		return nil, ErrInsufficientBalance
	}

	// Debit from source currency
	_, err = tx.Exec(ctx, `
		UPDATE wallet_balances
		SET balance = balance - $1, updated_at = $2
		WHERE user_id = $3 AND currency = $4
	`, fromAmount, now, userID, fromCurrency)
	if err != nil {
		return nil, fmt.Errorf("debiting source currency: %w", err)
	}

	// Credit to target currency (upsert)
	_, err = tx.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = wallet_balances.balance + EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
	`, uuid.New(), userID, toCurrency, toAmount, now)
	if err != nil {
		return nil, fmt.Errorf("crediting target currency: %w", err)
	}

	// Record the transaction
	transaction := &model.Transaction{
		ID:         uuid.New(),
		UserID:     userID,
		Type:       "convert",
		Amount:     fromAmount,
		Currency:   fromCurrency,
		ToAmount:   &toAmount,
		ToCurrency: &toCurrency,
		Rate:       &rate,
		Source:     "manual",
		CreatedAt:  now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, to_amount, to_currency, rate, source, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.ToAmount, transaction.ToCurrency, transaction.Rate, transaction.Source, transaction.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("recording transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return transaction, nil
}
