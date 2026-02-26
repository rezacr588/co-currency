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
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

var (
	ErrTaskNotFound = errors.New("task not found")
)

type TaskRepository struct {
	pool *pgxpool.Pool
}

func NewTaskRepository(db *Database) *TaskRepository {
	return &TaskRepository{pool: db.Pool()}
}

func (r *TaskRepository) Create(ctx context.Context, task *model.Task) error {
	query := `
		INSERT INTO tasks (
			id, user_id, goal_id, transaction_id, title, description, status, priority, sort_order, subtasks, due_date,
			reminder_mode, reminder_next_at, auto_ledger_enabled, ledger_type, ledger_amount, ledger_currency, ledger_wallet_currency,
			ledger_category, ledger_description, completed_at, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23
		)
	`

	now := time.Now()
	task.ID = uuid.New()
	task.CreatedAt = now
	task.UpdatedAt = now
	if task.ReminderMode == "" {
		task.ReminderMode = model.TaskReminderModeOff
	}
	subtasks, err := json.Marshal(task.Subtasks)
	if err != nil {
		return fmt.Errorf("marshaling subtasks: %w", err)
	}

	_, err = r.pool.Exec(ctx, query,
		task.ID,
		task.UserID,
		task.GoalID,
		task.TransactionID,
		task.Title,
		nullableTaskText(task.Description),
		task.Status,
		task.Priority,
		task.SortOrder,
		subtasks,
		task.DueDate,
		task.ReminderMode,
		task.ReminderNextAt,
		task.AutoLedgerEnabled,
		nullableTaskText(task.LedgerType),
		task.LedgerAmount,
		nullableTaskText(task.LedgerCurrency),
		nullableTaskText(task.LedgerWalletCurrency),
		nullableTaskText(task.LedgerCategory),
		nullableTaskText(task.LedgerDescription),
		task.CompletedAt,
		task.CreatedAt,
		task.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	return nil
}

func (r *TaskRepository) GetByID(ctx context.Context, userID, taskID uuid.UUID) (*model.Task, error) {
	query := `
		SELECT
			id, user_id, goal_id::text, transaction_id::text, title, description, status, priority, sort_order, subtasks, due_date,
			reminder_mode, reminder_next_at, auto_ledger_enabled, ledger_type, ledger_amount, ledger_currency, ledger_wallet_currency,
			ledger_category, ledger_description, completed_at, created_at, updated_at
		FROM tasks
		WHERE id = $1 AND user_id = $2
	`

	task, err := scanTask(r.pool.QueryRow(ctx, query, taskID, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}

	return task, nil
}

func (r *TaskRepository) GetByUser(ctx context.Context, userID uuid.UUID, filter model.TaskListFilter) ([]model.Task, error) {
	query := `
		SELECT
			id, user_id, goal_id::text, transaction_id::text, title, description, status, priority, sort_order, subtasks, due_date,
			reminder_mode, reminder_next_at, auto_ledger_enabled, ledger_type, ledger_amount, ledger_currency, ledger_wallet_currency,
			ledger_category, ledger_description, completed_at, created_at, updated_at
		FROM tasks
		WHERE user_id = $1
	`
	args := []interface{}{userID}
	argPos := 2

	if filter.GoalID != nil {
		query += fmt.Sprintf(" AND goal_id = $%d", argPos)
		args = append(args, *filter.GoalID)
		argPos++
	}
	if filter.TransactionID != nil {
		query += fmt.Sprintf(" AND transaction_id = $%d", argPos)
		args = append(args, *filter.TransactionID)
		argPos++
	}
	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, filter.Status)
		argPos++
	}
	if filter.Priority != "" {
		query += fmt.Sprintf(" AND priority = $%d", argPos)
		args = append(args, filter.Priority)
		argPos++
	}

	query += `
		ORDER BY
			CASE status
				WHEN 'in_progress' THEN 1
				WHEN 'todo' THEN 2
				WHEN 'done' THEN 3
				WHEN 'archived' THEN 4
				ELSE 5
			END,
			sort_order ASC,
			due_date ASC NULLS LAST,
			created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying tasks: %w", err)
	}
	defer rows.Close()

	tasks := make([]model.Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
		tasks = append(tasks, *task)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tasks: %w", err)
	}

	return tasks, nil
}

func (r *TaskRepository) Update(ctx context.Context, task *model.Task) error {
	query := `
		UPDATE tasks
		SET goal_id = $1, transaction_id = $2, title = $3, description = $4, status = $5, priority = $6, sort_order = $7, subtasks = $8, due_date = $9,
		    reminder_mode = $10, reminder_next_at = $11, auto_ledger_enabled = $12, ledger_type = $13, ledger_amount = $14,
		    ledger_currency = $15, ledger_wallet_currency = $16, ledger_category = $17, ledger_description = $18,
		    completed_at = $19, updated_at = $20
		WHERE id = $21 AND user_id = $22
	`

	task.UpdatedAt = time.Now()
	if task.ReminderMode == "" {
		task.ReminderMode = model.TaskReminderModeOff
	}
	subtasks, err := json.Marshal(task.Subtasks)
	if err != nil {
		return fmt.Errorf("marshaling subtasks: %w", err)
	}

	result, err := r.pool.Exec(ctx, query,
		task.GoalID,
		task.TransactionID,
		task.Title,
		nullableTaskText(task.Description),
		task.Status,
		task.Priority,
		task.SortOrder,
		subtasks,
		task.DueDate,
		task.ReminderMode,
		task.ReminderNextAt,
		task.AutoLedgerEnabled,
		nullableTaskText(task.LedgerType),
		task.LedgerAmount,
		nullableTaskText(task.LedgerCurrency),
		nullableTaskText(task.LedgerWalletCurrency),
		nullableTaskText(task.LedgerCategory),
		nullableTaskText(task.LedgerDescription),
		task.CompletedAt,
		task.UpdatedAt,
		task.ID,
		task.UserID,
	)
	if err != nil {
		return fmt.Errorf("updating task: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrTaskNotFound
	}

	return nil
}

func (r *TaskRepository) Delete(ctx context.Context, userID, taskID uuid.UUID) error {
	query := `DELETE FROM tasks WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, taskID, userID)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrTaskNotFound
	}

	return nil
}

type taskScanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(scanner taskScanner) (*model.Task, error) {
	task := &model.Task{}
	var goalID *string
	var transactionID *string
	var description *string
	var status string
	var priority string
	var reminderMode string
	var ledgerType *string
	var ledgerCurrency *string
	var ledgerWalletCurrency *string
	var ledgerCategory *string
	var ledgerDescription *string
	var ledgerAmount *float64
	var dueDate *time.Time
	var reminderNextAt *time.Time
	var subtasksRaw []byte
	var autoLedgerEnabled bool
	var completedAt *time.Time

	if err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&goalID,
		&transactionID,
		&task.Title,
		&description,
		&status,
		&priority,
		&task.SortOrder,
		&subtasksRaw,
		&dueDate,
		&reminderMode,
		&reminderNextAt,
		&autoLedgerEnabled,
		&ledgerType,
		&ledgerAmount,
		&ledgerCurrency,
		&ledgerWalletCurrency,
		&ledgerCategory,
		&ledgerDescription,
		&completedAt,
		&task.CreatedAt,
		&task.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if goalID != nil && strings.TrimSpace(*goalID) != "" {
		parsedGoalID, err := uuid.Parse(*goalID)
		if err != nil {
			return nil, fmt.Errorf("parsing goal id: %w", err)
		}
		task.GoalID = &parsedGoalID
	}
	if transactionID != nil && strings.TrimSpace(*transactionID) != "" {
		parsedTransactionID, err := uuid.Parse(*transactionID)
		if err != nil {
			return nil, fmt.Errorf("parsing transaction id: %w", err)
		}
		task.TransactionID = &parsedTransactionID
	}
	if description != nil {
		task.Description = *description
	}
	task.ReminderMode = model.TaskReminderMode(reminderMode)
	task.ReminderNextAt = reminderNextAt
	task.AutoLedgerEnabled = autoLedgerEnabled
	task.LedgerAmount = ledgerAmount
	if ledgerType != nil {
		task.LedgerType = *ledgerType
	}
	if ledgerCurrency != nil {
		task.LedgerCurrency = *ledgerCurrency
	}
	if ledgerWalletCurrency != nil {
		task.LedgerWalletCurrency = *ledgerWalletCurrency
	}
	if ledgerCategory != nil {
		task.LedgerCategory = *ledgerCategory
	}
	if ledgerDescription != nil {
		task.LedgerDescription = *ledgerDescription
	}
	if len(subtasksRaw) > 0 {
		if err := json.Unmarshal(subtasksRaw, &task.Subtasks); err != nil {
			return nil, fmt.Errorf("unmarshaling subtasks: %w", err)
		}
	}
	task.Status = model.TaskStatus(status)
	task.Priority = model.TaskPriority(priority)
	task.DueDate = dueDate
	task.CompletedAt = completedAt

	return task, nil
}

func nullableTaskText(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
