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

// BudgetRepository handles database operations for budgets
type BudgetRepository struct {
	pool *pgxpool.Pool
}

// NewBudgetRepository creates a new BudgetRepository
func NewBudgetRepository(db *Database) *BudgetRepository {
	return &BudgetRepository{pool: db.Pool()}
}

// Create creates a new budget
func (r *BudgetRepository) Create(ctx context.Context, budget *model.Budget) error {
	query := `
		INSERT INTO budgets (id, user_id, category, amount, currency, period, spent, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	budget.ID = uuid.New()
	now := time.Now()
	budget.CreatedAt = now
	budget.UpdatedAt = now
	budget.Spent = 0

	_, err := r.pool.Exec(ctx, query,
		budget.ID,
		budget.UserID,
		budget.Category,
		budget.Amount,
		budget.Currency,
		budget.Period,
		budget.Spent,
		budget.CreatedAt,
		budget.UpdatedAt,
	)

	if err != nil {
		if isUniqueViolation(err) {
			return ErrBudgetExists
		}
		return fmt.Errorf("creating budget: %w", err)
	}

	return nil
}

// GetByID retrieves a budget by ID
func (r *BudgetRepository) GetByID(ctx context.Context, userID, budgetID uuid.UUID) (*model.Budget, error) {
	query := `
		SELECT id, user_id, category, amount, currency, period, spent, created_at, updated_at
		FROM budgets
		WHERE id = $1 AND user_id = $2
	`

	budget := &model.Budget{}
	err := r.pool.QueryRow(ctx, query, budgetID, userID).Scan(
		&budget.ID,
		&budget.UserID,
		&budget.Category,
		&budget.Amount,
		&budget.Currency,
		&budget.Period,
		&budget.Spent,
		&budget.CreatedAt,
		&budget.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBudgetNotFound
		}
		return nil, fmt.Errorf("getting budget: %w", err)
	}

	return budget, nil
}

// GetByUser retrieves all budgets for a user
func (r *BudgetRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.Budget, error) {
	query := `
		SELECT id, user_id, category, amount, currency, period, spent, created_at, updated_at
		FROM budgets
		WHERE user_id = $1
		ORDER BY category
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying budgets: %w", err)
	}
	defer rows.Close()

	var budgets []model.Budget
	for rows.Next() {
		var b model.Budget
		if err := rows.Scan(
			&b.ID,
			&b.UserID,
			&b.Category,
			&b.Amount,
			&b.Currency,
			&b.Period,
			&b.Spent,
			&b.CreatedAt,
			&b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning budget: %w", err)
		}
		budgets = append(budgets, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating budgets: %w", err)
	}

	return budgets, nil
}

// GetByUserWithSpent retrieves all budgets for a user with calculated spent amounts
// Uses a single aggregated query instead of N+1 queries for better performance
func (r *BudgetRepository) GetByUserWithSpent(ctx context.Context, userID uuid.UUID) ([]model.Budget, error) {
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())

	// Single query: JOIN budgets with aggregated transaction spending
	// Uses CASE to select correct period start based on budget.period
	query := `
		SELECT 
			b.id, b.user_id, b.category, b.amount, b.currency, b.period, 
			COALESCE(s.spent, 0) as spent,
			b.created_at, b.updated_at
		FROM budgets b
		LEFT JOIN LATERAL (
			SELECT SUM(t.amount) as spent
			FROM transactions t
			WHERE t.user_id = b.user_id
				AND t.category = b.category
				AND t.currency = b.currency
				AND t.type = 'debit'
				AND t.created_at >= CASE 
					WHEN b.period = 'yearly' THEN $2
					ELSE $3
				END
		) s ON true
		WHERE b.user_id = $1
		ORDER BY b.category
	`

	rows, err := r.pool.Query(ctx, query, userID, yearStart, monthStart)
	if err != nil {
		return nil, fmt.Errorf("querying budgets with spent: %w", err)
	}
	defer rows.Close()

	var budgets []model.Budget
	for rows.Next() {
		var b model.Budget
		if err := rows.Scan(
			&b.ID,
			&b.UserID,
			&b.Category,
			&b.Amount,
			&b.Currency,
			&b.Period,
			&b.Spent,
			&b.CreatedAt,
			&b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning budget with spent: %w", err)
		}
		budgets = append(budgets, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating budgets: %w", err)
	}

	return budgets, nil
}

// CalculateSpent calculates the total spent for a category in the current period
func (r *BudgetRepository) CalculateSpent(ctx context.Context, userID uuid.UUID, category, currency, period string) (float64, error) {
	var startDate time.Time
	now := time.Now()

	switch period {
	case "monthly":
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	case "yearly":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	default:
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	}

	query := `
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1
		AND category = $2
		AND currency = $3
		AND type = 'debit'
		AND created_at >= $4
	`

	var spent float64
	err := r.pool.QueryRow(ctx, query, userID, category, currency, startDate).Scan(&spent)
	if err != nil {
		return 0, fmt.Errorf("calculating spent: %w", err)
	}

	return spent, nil
}

// Update updates a budget
func (r *BudgetRepository) Update(ctx context.Context, budget *model.Budget) error {
	query := `
		UPDATE budgets
		SET amount = $1, period = $2, updated_at = $3
		WHERE id = $4 AND user_id = $5
	`

	budget.UpdatedAt = time.Now()

	result, err := r.pool.Exec(ctx, query,
		budget.Amount,
		budget.Period,
		budget.UpdatedAt,
		budget.ID,
		budget.UserID,
	)

	if err != nil {
		return fmt.Errorf("updating budget: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrBudgetNotFound
	}

	return nil
}

// Delete deletes a budget
func (r *BudgetRepository) Delete(ctx context.Context, userID, budgetID uuid.UUID) error {
	query := `DELETE FROM budgets WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, budgetID, userID)
	if err != nil {
		return fmt.Errorf("deleting budget: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrBudgetNotFound
	}

	return nil
}

// UpdateSpent updates the spent amount for matching budgets when a transaction is added
func (r *BudgetRepository) UpdateSpent(ctx context.Context, userID uuid.UUID, category, currency string, amount float64) error {
	now := time.Now()

	// Update monthly budget
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	_, err := r.pool.Exec(ctx, `
		UPDATE budgets
		SET spent = (
			SELECT COALESCE(SUM(amount), 0)
			FROM transactions
			WHERE user_id = $1 AND category = $2 AND currency = $3 AND type = 'debit' AND created_at >= $4
		), updated_at = $5
		WHERE user_id = $1 AND category = $2 AND currency = $3 AND period = 'monthly'
	`, userID, category, currency, monthStart, now)
	if err != nil {
		return fmt.Errorf("updating monthly budget: %w", err)
	}

	// Update yearly budget
	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	_, err = r.pool.Exec(ctx, `
		UPDATE budgets
		SET spent = (
			SELECT COALESCE(SUM(amount), 0)
			FROM transactions
			WHERE user_id = $1 AND category = $2 AND currency = $3 AND type = 'debit' AND created_at >= $4
		), updated_at = $5
		WHERE user_id = $1 AND category = $2 AND currency = $3 AND period = 'yearly'
	`, userID, category, currency, yearStart, now)
	if err != nil {
		return fmt.Errorf("updating yearly budget: %w", err)
	}

	return nil
}
