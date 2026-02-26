package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

var (
	ErrGoalNotFound = errors.New("goal not found")
)

// GoalRepository handles database operations for goals.
type GoalRepository struct {
	pool *pgxpool.Pool
}

// NewGoalRepository creates a new GoalRepository
func NewGoalRepository(db *Database) *GoalRepository {
	return &GoalRepository{pool: db.Pool()}
}

// Create creates a new goal
func (r *GoalRepository) Create(ctx context.Context, goal *model.Goal) error {
	query := `
		INSERT INTO goals (
			id, user_id, name, goal_type, description, target_amount, current_amount, currency, unit, category,
			workflow_status, sort_order, deadline, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15
		)
	`

	goal.ID = uuid.New()
	now := time.Now()
	goal.CreatedAt = now
	goal.UpdatedAt = now
	if goal.Type == "" {
		goal.Type = model.GoalTypeFinancial
	}
	if goal.WorkflowStatus == "" {
		goal.WorkflowStatus = model.GoalWorkflowStatusTodo
	}

	_, err := r.pool.Exec(ctx, query,
		goal.ID,
		goal.UserID,
		goal.Name,
		goal.Type,
		nullableString(goal.Description),
		goal.TargetAmount,
		goal.CurrentAmount,
		nullableString(goal.Currency),
		nullableString(goal.Unit),
		nullableString(goal.Category),
		goal.WorkflowStatus,
		goal.SortOrder,
		goal.Deadline,
		goal.CreatedAt,
		goal.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("creating goal: %w", err)
	}

	return nil
}

// GetByID retrieves a goal by ID for a user
func (r *GoalRepository) GetByID(ctx context.Context, userID, goalID uuid.UUID) (*model.Goal, error) {
	query := `
		SELECT id, user_id, name, goal_type, description, target_amount, current_amount, currency, unit, category, workflow_status, sort_order, deadline, created_at, updated_at
		FROM goals
		WHERE id = $1 AND user_id = $2
	`

	goal := &model.Goal{}
	var goalType string
	var description *string
	var currency *string
	var unit *string
	var category *string
	var workflowStatus string
	var deadline *time.Time

	err := r.pool.QueryRow(ctx, query, goalID, userID).Scan(
		&goal.ID,
		&goal.UserID,
		&goal.Name,
		&goalType,
		&description,
		&goal.TargetAmount,
		&goal.CurrentAmount,
		&currency,
		&unit,
		&category,
		&workflowStatus,
		&goal.SortOrder,
		&deadline,
		&goal.CreatedAt,
		&goal.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrGoalNotFound
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}

	assignGoalOptionalFields(goal, goalType, description, currency, unit, category, workflowStatus, deadline)

	return goal, nil
}

// GetByUser retrieves all goals for a user
func (r *GoalRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.Goal, error) {
	query := `
		SELECT id, user_id, name, goal_type, description, target_amount, current_amount, currency, unit, category, workflow_status, sort_order, deadline, created_at, updated_at
		FROM goals
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying goals: %w", err)
	}
	defer rows.Close()

	var goals []model.Goal
	for rows.Next() {
		var g model.Goal
		var goalType string
		var description *string
		var currency *string
		var unit *string
		var category *string
		var workflowStatus string
		var deadline *time.Time

		if err := rows.Scan(
			&g.ID,
			&g.UserID,
			&g.Name,
			&goalType,
			&description,
			&g.TargetAmount,
			&g.CurrentAmount,
			&currency,
			&unit,
			&category,
			&workflowStatus,
			&g.SortOrder,
			&deadline,
			&g.CreatedAt,
			&g.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning goal: %w", err)
		}

		assignGoalOptionalFields(&g, goalType, description, currency, unit, category, workflowStatus, deadline)

		goals = append(goals, g)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating goals: %w", err)
	}

	return goals, nil
}

// Update updates a goal
func (r *GoalRepository) Update(ctx context.Context, goal *model.Goal) error {
	query := `
		UPDATE goals
		SET name = $1, goal_type = $2, description = $3, target_amount = $4, current_amount = $5, currency = $6, unit = $7, category = $8, workflow_status = $9, sort_order = $10, deadline = $11, updated_at = $12
		WHERE id = $13 AND user_id = $14
	`

	goal.UpdatedAt = time.Now()
	if goal.Type == "" {
		goal.Type = model.GoalTypeFinancial
	}
	if goal.WorkflowStatus == "" {
		goal.WorkflowStatus = model.GoalWorkflowStatusTodo
	}

	result, err := r.pool.Exec(ctx, query,
		goal.Name,
		goal.Type,
		nullableString(goal.Description),
		goal.TargetAmount,
		goal.CurrentAmount,
		nullableString(goal.Currency),
		nullableString(goal.Unit),
		nullableString(goal.Category),
		goal.WorkflowStatus,
		goal.SortOrder,
		goal.Deadline,
		goal.UpdatedAt,
		goal.ID,
		goal.UserID,
	)

	if err != nil {
		return fmt.Errorf("updating goal: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrGoalNotFound
	}

	return nil
}

// UpdateCurrentAmount updates the current amount of a goal
func (r *GoalRepository) UpdateCurrentAmount(ctx context.Context, userID, goalID uuid.UUID, delta float64) (*model.Goal, error) {
	query := `
		UPDATE goals
		SET current_amount = current_amount + $1, updated_at = $2
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, name, goal_type, description, target_amount, current_amount, currency, unit, category, workflow_status, sort_order, deadline, created_at, updated_at
	`

	goal := &model.Goal{}
	var goalType string
	var description *string
	var currency *string
	var unit *string
	var category *string
	var workflowStatus string
	var deadline *time.Time
	now := time.Now()

	err := r.pool.QueryRow(ctx, query, delta, now, goalID, userID).Scan(
		&goal.ID,
		&goal.UserID,
		&goal.Name,
		&goalType,
		&description,
		&goal.TargetAmount,
		&goal.CurrentAmount,
		&currency,
		&unit,
		&category,
		&workflowStatus,
		&goal.SortOrder,
		&deadline,
		&goal.CreatedAt,
		&goal.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrGoalNotFound
		}
		return nil, fmt.Errorf("updating goal amount: %w", err)
	}

	assignGoalOptionalFields(goal, goalType, description, currency, unit, category, workflowStatus, deadline)

	return goal, nil
}

// Delete deletes a goal
func (r *GoalRepository) Delete(ctx context.Context, userID, goalID uuid.UUID) error {
	query := `DELETE FROM goals WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, goalID, userID)
	if err != nil {
		return fmt.Errorf("deleting goal: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrGoalNotFound
	}

	return nil
}

// ContributeFromWallet atomically deducts from wallet and adds to goal
func (r *GoalRepository) ContributeFromWallet(ctx context.Context, userID, goalID uuid.UUID, amount float64, currency string) (*model.Goal, *model.Transaction, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Get the goal to verify currency matches
	var goalCurrency *string
	err = tx.QueryRow(ctx, `SELECT currency FROM goals WHERE id = $1 AND user_id = $2`, goalID, userID).Scan(&goalCurrency)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrGoalNotFound
		}
		return nil, nil, fmt.Errorf("getting goal: %w", err)
	}

	if goalCurrency == nil || strings.TrimSpace(*goalCurrency) == "" {
		return nil, nil, errors.New("goal has no contribution currency")
	}
	if *goalCurrency != currency {
		return nil, nil, fmt.Errorf("currency mismatch: goal is in %s, contribution is in %s", *goalCurrency, currency)
	}

	// Check wallet balance
	var currentBalance float64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(balance, 0) FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
		FOR UPDATE
	`, userID, currency).Scan(&currentBalance)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, fmt.Errorf("checking balance: %w", err)
	}
	if currentBalance < amount {
		return nil, nil, ErrInsufficientBalance
	}

	// Deduct from wallet
	_, err = tx.Exec(ctx, `
		UPDATE wallet_balances
		SET balance = balance - $1, updated_at = $2
		WHERE user_id = $3 AND currency = $4
	`, amount, now, userID, currency)
	if err != nil {
		return nil, nil, fmt.Errorf("debiting wallet: %w", err)
	}

	// Add to goal
	goal := &model.Goal{}
	var goalType string
	var description *string
	var goalCurrencyResult *string
	var unit *string
	var category *string
	var workflowStatus string
	var deadline *time.Time

	err = tx.QueryRow(ctx, `
		UPDATE goals
		SET current_amount = current_amount + $1, updated_at = $2
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, name, goal_type, description, target_amount, current_amount, currency, unit, category, workflow_status, sort_order, deadline, created_at, updated_at
	`, amount, now, goalID, userID).Scan(
		&goal.ID,
		&goal.UserID,
		&goal.Name,
		&goalType,
		&description,
		&goal.TargetAmount,
		&goal.CurrentAmount,
		&goalCurrencyResult,
		&unit,
		&category,
		&workflowStatus,
		&goal.SortOrder,
		&deadline,
		&goal.CreatedAt,
		&goal.UpdatedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("updating goal: %w", err)
	}

	assignGoalOptionalFields(goal, goalType, description, goalCurrencyResult, unit, category, workflowStatus, deadline)

	// Record transaction
	transaction := &model.Transaction{
		ID:          uuid.New(),
		UserID:      userID,
		Type:        "debit",
		Amount:      amount,
		Currency:    currency,
		Source:      "goal_contribution",
		Description: fmt.Sprintf("Contribution to goal: %s", goal.Name),
		CreatedAt:   now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, source, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.Source, transaction.Description, transaction.CreatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("recording transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("committing transaction: %w", err)
	}

	return goal, transaction, nil
}

func assignGoalOptionalFields(goal *model.Goal, goalType string, description, currency, unit, category *string, workflowStatus string, deadline *time.Time) {
	goal.Type = model.GoalType(goalType)
	if goal.Type == "" {
		goal.Type = model.GoalTypeFinancial
	}
	if description != nil {
		goal.Description = *description
	}
	if currency != nil {
		goal.Currency = *currency
	}
	if unit != nil {
		goal.Unit = *unit
	}
	if category != nil {
		goal.Category = *category
	}
	goal.WorkflowStatus = model.GoalWorkflowStatus(workflowStatus)
	if goal.WorkflowStatus == "" {
		goal.WorkflowStatus = model.GoalWorkflowStatusTodo
	}
	goal.Deadline = deadline
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
