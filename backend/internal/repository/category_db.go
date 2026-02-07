package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

var (
	ErrCategoryNotFound         = errors.New("category not found")
	ErrCategoryDefaultProtected = errors.New("default category cannot be deleted")
	ErrCategoryAlreadyExists    = errors.New("category already exists")
)

// CategoryRepository handles database operations for categories
type CategoryRepository struct {
	pool *pgxpool.Pool
}

// NewCategoryRepository creates a new CategoryRepository
func NewCategoryRepository(db *Database) *CategoryRepository {
	return &CategoryRepository{pool: db.Pool()}
}

// GetCategories retrieves all categories for a user (including defaults)
func (r *CategoryRepository) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	query := `
		SELECT id, user_id, name, icon, color, is_default
		FROM categories
		WHERE user_id = $1 OR is_default = TRUE
		ORDER BY is_default DESC, name
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying categories: %w", err)
	}
	defer rows.Close()

	var categories []model.Category
	for rows.Next() {
		var c model.Category
		var categoryUserID *uuid.UUID
		if err := rows.Scan(&c.ID, &categoryUserID, &c.Name, &c.Icon, &c.Color, &c.IsDefault); err != nil {
			return nil, fmt.Errorf("scanning category: %w", err)
		}
		if categoryUserID != nil {
			c.UserID = *categoryUserID
		}
		categories = append(categories, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating categories: %w", err)
	}

	// If no categories exist, return defaults
	if len(categories) == 0 {
		return model.DefaultCategories(), nil
	}

	return categories, nil
}

// CreateCategory creates a new user category
func (r *CategoryRepository) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	query := `
		INSERT INTO categories (id, user_id, name, icon, color, is_default)
		VALUES ($1, $2, $3, $4, $5, FALSE)
		RETURNING id, user_id, name, icon, color, is_default
	`

	c := &model.Category{}
	err := r.pool.QueryRow(ctx, query, uuid.New(), userID, name, icon, color).Scan(
		&c.ID, &c.UserID, &c.Name, &c.Icon, &c.Color, &c.IsDefault,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrCategoryAlreadyExists
		}
		return nil, fmt.Errorf("creating category: %w", err)
	}

	return c, nil
}

// DeleteCategory deletes a user category
func (r *CategoryRepository) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	var ownerID *uuid.UUID
	var isDefault bool
	if err := r.pool.QueryRow(ctx, `
		SELECT user_id, is_default
		FROM categories
		WHERE id = $1
	`, categoryID).Scan(&ownerID, &isDefault); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCategoryNotFound
		}
		return fmt.Errorf("finding category: %w", err)
	}

	if isDefault {
		return ErrCategoryDefaultProtected
	}
	if ownerID == nil || *ownerID != userID {
		return ErrCategoryNotFound
	}

	result, err := r.pool.Exec(ctx, `DELETE FROM categories WHERE id = $1 AND user_id = $2 AND is_default = FALSE`, categoryID, userID)
	if err != nil {
		return fmt.Errorf("deleting category: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

// InitDefaultCategories creates default categories if they don't exist
func (r *CategoryRepository) InitDefaultCategories(ctx context.Context) error {
	defaults := model.DefaultCategories()

	for _, c := range defaults {
		query := `
			INSERT INTO categories (id, name, icon, color, is_default)
			VALUES ($1, $2, $3, $4, TRUE)
			ON CONFLICT DO NOTHING
		`
		_, err := r.pool.Exec(ctx, query, uuid.New(), c.Name, c.Icon, c.Color)
		if err != nil {
			return fmt.Errorf("creating default category %s: %w", c.Name, err)
		}
	}

	return nil
}
