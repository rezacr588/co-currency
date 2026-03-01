package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// RecurringRepository handles database operations for recurring transactions
type RecurringRepository struct {
	pool *pgxpool.Pool
}

// NewRecurringRepository creates a new RecurringRepository
func NewRecurringRepository(db *Database) *RecurringRepository {
	return &RecurringRepository{pool: db.Pool()}
}

// Create creates a new recurring transaction
func (r *RecurringRepository) Create(ctx context.Context, recurring *model.RecurringTransaction) error {
	query := `
		INSERT INTO recurring_transactions (id, user_id, type, amount, currency, category, description, frequency, next_execution, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	recurring.ID = uuid.New()
	now := time.Now()
	recurring.CreatedAt = now
	recurring.UpdatedAt = now
	recurring.IsActive = true

	_, err := r.pool.Exec(ctx, query,
		recurring.ID,
		recurring.UserID,
		recurring.Type,
		recurring.Amount,
		recurring.Currency,
		recurring.Category,
		recurring.Description,
		recurring.Frequency,
		recurring.NextExecution,
		recurring.IsActive,
		recurring.CreatedAt,
		recurring.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("creating recurring transaction: %w", err)
	}

	return nil
}

// GetByID retrieves a recurring transaction by ID
func (r *RecurringRepository) GetByID(ctx context.Context, userID, recurringID uuid.UUID) (*model.RecurringTransaction, error) {
	query := `
		SELECT id, user_id, type, amount, currency, category, description, frequency, next_execution, is_active, created_at, updated_at
		FROM recurring_transactions
		WHERE id = $1 AND user_id = $2
	`

	rt := &model.RecurringTransaction{}
	var category, description *string

	err := r.pool.QueryRow(ctx, query, recurringID, userID).Scan(
		&rt.ID,
		&rt.UserID,
		&rt.Type,
		&rt.Amount,
		&rt.Currency,
		&category,
		&description,
		&rt.Frequency,
		&rt.NextExecution,
		&rt.IsActive,
		&rt.CreatedAt,
		&rt.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecurringNotFound
		}
		return nil, fmt.Errorf("getting recurring transaction: %w", err)
	}

	if category != nil {
		rt.Category = *category
	}
	if description != nil {
		rt.Description = *description
	}

	return rt, nil
}

// GetByUser retrieves all recurring transactions for a user
func (r *RecurringRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.RecurringTransaction, error) {
	query := `
		SELECT id, user_id, type, amount, currency, category, description, frequency, next_execution, is_active, created_at, updated_at
		FROM recurring_transactions
		WHERE user_id = $1
		ORDER BY next_execution
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying recurring transactions: %w", err)
	}
	defer rows.Close()

	var transactions []model.RecurringTransaction
	for rows.Next() {
		var rt model.RecurringTransaction
		var category, description *string

		if err := rows.Scan(
			&rt.ID,
			&rt.UserID,
			&rt.Type,
			&rt.Amount,
			&rt.Currency,
			&category,
			&description,
			&rt.Frequency,
			&rt.NextExecution,
			&rt.IsActive,
			&rt.CreatedAt,
			&rt.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning recurring transaction: %w", err)
		}

		if category != nil {
			rt.Category = *category
		}
		if description != nil {
			rt.Description = *description
		}

		transactions = append(transactions, rt)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating recurring transactions: %w", err)
	}

	return transactions, nil
}

// GetDueTransactions retrieves all active recurring transactions that are due
func (r *RecurringRepository) GetDueTransactions(ctx context.Context) ([]model.RecurringTransaction, error) {
	query := `
		SELECT id, user_id, type, amount, currency, category, description, frequency, next_execution, is_active, created_at, updated_at
		FROM recurring_transactions
		WHERE is_active = true AND next_execution <= $1
		ORDER BY next_execution
	`

	rows, err := r.pool.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("querying due transactions: %w", err)
	}
	defer rows.Close()

	var transactions []model.RecurringTransaction
	for rows.Next() {
		var rt model.RecurringTransaction
		var category, description *string

		if err := rows.Scan(
			&rt.ID,
			&rt.UserID,
			&rt.Type,
			&rt.Amount,
			&rt.Currency,
			&category,
			&description,
			&rt.Frequency,
			&rt.NextExecution,
			&rt.IsActive,
			&rt.CreatedAt,
			&rt.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning recurring transaction: %w", err)
		}

		if category != nil {
			rt.Category = *category
		}
		if description != nil {
			rt.Description = *description
		}

		transactions = append(transactions, rt)
	}

	return transactions, nil
}

// Update updates a recurring transaction
func (r *RecurringRepository) Update(ctx context.Context, recurring *model.RecurringTransaction) error {
	query := `
		UPDATE recurring_transactions
		SET type = $1, amount = $2, category = $3, description = $4, frequency = $5, next_execution = $6, is_active = $7, updated_at = $8
		WHERE id = $9 AND user_id = $10
	`

	recurring.UpdatedAt = time.Now()

	result, err := r.pool.Exec(ctx, query,
		recurring.Type,
		recurring.Amount,
		recurring.Category,
		recurring.Description,
		recurring.Frequency,
		recurring.NextExecution,
		recurring.IsActive,
		recurring.UpdatedAt,
		recurring.ID,
		recurring.UserID,
	)

	if err != nil {
		return fmt.Errorf("updating recurring transaction: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrRecurringNotFound
	}

	return nil
}

// Delete deletes a recurring transaction
func (r *RecurringRepository) Delete(ctx context.Context, userID, recurringID uuid.UUID) error {
	query := `DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, recurringID, userID)
	if err != nil {
		return fmt.Errorf("deleting recurring transaction: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrRecurringNotFound
	}

	return nil
}

// ExecuteAndScheduleNext executes a recurring transaction and schedules the next one
func (r *RecurringRepository) ExecuteAndScheduleNext(ctx context.Context, recurring *model.RecurringTransaction) (*model.Transaction, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Calculate delta for balance update
	delta := recurring.Amount
	if recurring.Type == "debit" {
		delta = -recurring.Amount
	}

	// Check balance for debits
	if recurring.Type == "debit" {
		var currentBalance float64
		err = tx.QueryRow(ctx, `
			SELECT COALESCE(balance, 0) FROM wallet_balances
			WHERE user_id = $1 AND currency = $2
			FOR UPDATE
		`, recurring.UserID, recurring.Currency).Scan(&currentBalance)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("checking balance: %w", err)
		}
		if currentBalance < recurring.Amount {
			return nil, ErrInsufficientBalance
		}
	}

	// Update wallet balance
	_, err = tx.Exec(ctx, `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = wallet_balances.balance + EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
	`, uuid.New(), recurring.UserID, recurring.Currency, delta, now)
	if err != nil {
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	// Create transaction record
	transaction := &model.Transaction{
		ID:          uuid.New(),
		UserID:      recurring.UserID,
		Type:        recurring.Type,
		Amount:      recurring.Amount,
		Currency:    recurring.Currency,
		Category:    recurring.Category,
		Source:      "recurring",
		Description: recurring.Description,
		CreatedAt:   now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, category, source, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.Category, transaction.Source, transaction.Description, transaction.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("recording transaction: %w", err)
	}

	// Update next execution date
	nextExecution := model.CalculateNextExecution(recurring.NextExecution, recurring.Frequency)
	_, err = tx.Exec(ctx, `
		UPDATE recurring_transactions
		SET next_execution = $1, updated_at = $2
		WHERE id = $3
	`, nextExecution, now, recurring.ID)
	if err != nil {
		return nil, fmt.Errorf("updating next execution: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return transaction, nil
}
