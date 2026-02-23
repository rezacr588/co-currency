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
		INSERT INTO tasks (id, user_id, goal_id, title, description, status, priority, due_date, completed_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	now := time.Now()
	task.ID = uuid.New()
	task.CreatedAt = now
	task.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		task.ID,
		task.UserID,
		task.GoalID,
		task.Title,
		nullableTaskText(task.Description),
		task.Status,
		task.Priority,
		task.DueDate,
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
		SELECT id, user_id, goal_id::text, title, description, status, priority, due_date, completed_at, created_at, updated_at
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
		SELECT id, user_id, goal_id::text, title, description, status, priority, due_date, completed_at, created_at, updated_at
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
		SET goal_id = $1, title = $2, description = $3, status = $4, priority = $5, due_date = $6, completed_at = $7, updated_at = $8
		WHERE id = $9 AND user_id = $10
	`

	task.UpdatedAt = time.Now()

	result, err := r.pool.Exec(ctx, query,
		task.GoalID,
		task.Title,
		nullableTaskText(task.Description),
		task.Status,
		task.Priority,
		task.DueDate,
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
	var description *string
	var status string
	var priority string
	var dueDate *time.Time
	var completedAt *time.Time

	if err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&goalID,
		&task.Title,
		&description,
		&status,
		&priority,
		&dueDate,
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
	if description != nil {
		task.Description = *description
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
