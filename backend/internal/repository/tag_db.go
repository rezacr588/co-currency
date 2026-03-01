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

// TagRepository handles database operations for tags
type TagRepository struct {
	pool *pgxpool.Pool
}

// NewTagRepository creates a new TagRepository
func NewTagRepository(db *Database) *TagRepository {
	return &TagRepository{pool: db.Pool()}
}

// Create creates a new tag
func (r *TagRepository) Create(ctx context.Context, tag *model.Tag) error {
	query := `
		INSERT INTO tags (id, user_id, name, color, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	tag.ID = uuid.New()
	tag.CreatedAt = time.Now()

	_, err := r.pool.Exec(ctx, query,
		tag.ID,
		tag.UserID,
		tag.Name,
		tag.Color,
		tag.CreatedAt,
	)

	if err != nil {
		if isUniqueViolation(err) {
			return ErrTagExists
		}
		return fmt.Errorf("creating tag: %w", err)
	}

	return nil
}

// GetByUser retrieves all tags for a user
func (r *TagRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.Tag, error) {
	query := `
		SELECT id, user_id, name, color, created_at
		FROM tags
		WHERE user_id = $1
		ORDER BY name
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying tags: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		var color *string

		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &color, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}

		if color != nil {
			t.Color = *color
		}

		tags = append(tags, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tags: %w", err)
	}

	return tags, nil
}

// GetByID retrieves a tag by ID
func (r *TagRepository) GetByID(ctx context.Context, userID, tagID uuid.UUID) (*model.Tag, error) {
	query := `
		SELECT id, user_id, name, color, created_at
		FROM tags
		WHERE id = $1 AND user_id = $2
	`

	tag := &model.Tag{}
	var color *string

	err := r.pool.QueryRow(ctx, query, tagID, userID).Scan(
		&tag.ID, &tag.UserID, &tag.Name, &color, &tag.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTagNotFound
		}
		return nil, fmt.Errorf("getting tag: %w", err)
	}

	if color != nil {
		tag.Color = *color
	}

	return tag, nil
}

// Delete deletes a tag
func (r *TagRepository) Delete(ctx context.Context, userID, tagID uuid.UUID) error {
	query := `DELETE FROM tags WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, tagID, userID)
	if err != nil {
		return fmt.Errorf("deleting tag: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrTagNotFound
	}

	return nil
}

// AddTagToTransaction adds a tag to a transaction
func (r *TagRepository) AddTagToTransaction(ctx context.Context, transactionID, tagID uuid.UUID) error {
	query := `
		INSERT INTO transaction_tags (transaction_id, tag_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`

	_, err := r.pool.Exec(ctx, query, transactionID, tagID)
	if err != nil {
		return fmt.Errorf("adding tag to transaction: %w", err)
	}

	return nil
}

// RemoveTagFromTransaction removes a tag from a transaction
func (r *TagRepository) RemoveTagFromTransaction(ctx context.Context, transactionID, tagID uuid.UUID) error {
	query := `DELETE FROM transaction_tags WHERE transaction_id = $1 AND tag_id = $2`

	_, err := r.pool.Exec(ctx, query, transactionID, tagID)
	if err != nil {
		return fmt.Errorf("removing tag from transaction: %w", err)
	}

	return nil
}

// GetTagsForTransaction retrieves tags for a transaction
func (r *TagRepository) GetTagsForTransaction(ctx context.Context, transactionID uuid.UUID) ([]model.Tag, error) {
	query := `
		SELECT t.id, t.user_id, t.name, t.color, t.created_at
		FROM tags t
		JOIN transaction_tags tt ON t.id = tt.tag_id
		WHERE tt.transaction_id = $1
		ORDER BY t.name
	`

	rows, err := r.pool.Query(ctx, query, transactionID)
	if err != nil {
		return nil, fmt.Errorf("querying transaction tags: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		var color *string

		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &color, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}

		if color != nil {
			t.Color = *color
		}

		tags = append(tags, t)
	}

	return tags, nil
}

// AddTagToTask adds a tag to a task.
func (r *TagRepository) AddTagToTask(ctx context.Context, taskID, tagID uuid.UUID) error {
	query := `
		INSERT INTO task_tags (task_id, tag_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`
	if _, err := r.pool.Exec(ctx, query, taskID, tagID); err != nil {
		return fmt.Errorf("adding tag to task: %w", err)
	}
	return nil
}

// RemoveTagFromTask removes a tag from a task.
func (r *TagRepository) RemoveTagFromTask(ctx context.Context, taskID, tagID uuid.UUID) error {
	query := `DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2`
	if _, err := r.pool.Exec(ctx, query, taskID, tagID); err != nil {
		return fmt.Errorf("removing tag from task: %w", err)
	}
	return nil
}

// GetTagsForTask returns all tags assigned to a task.
func (r *TagRepository) GetTagsForTask(ctx context.Context, taskID uuid.UUID) ([]model.Tag, error) {
	query := `
		SELECT t.id, t.user_id, t.name, t.color, t.created_at
		FROM tags t
		JOIN task_tags tt ON t.id = tt.tag_id
		WHERE tt.task_id = $1
		ORDER BY t.name
	`
	rows, err := r.pool.Query(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("querying task tags: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		var color *string

		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &color, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		if color != nil {
			t.Color = *color
		}
		tags = append(tags, t)
	}
	return tags, nil
}
