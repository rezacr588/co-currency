package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// MemoryRepository handles user memory persistence
type MemoryRepository struct {
	pool *pgxpool.Pool
}

// NewMemoryRepository creates a new MemoryRepository
func NewMemoryRepository(db *Database) *MemoryRepository {
	return &MemoryRepository{pool: db.Pool()}
}

// InitSchema creates the memories table if it doesn't exist
func (r *MemoryRepository) InitSchema(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS user_memories (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			category VARCHAR(50) NOT NULL,
			content TEXT NOT NULL,
			source VARCHAR(50) NOT NULL DEFAULT 'ai_inferred',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
		CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(category);
	`
	_, err := r.pool.Exec(ctx, query)
	return err
}

// Create adds a new memory for a user
func (r *MemoryRepository) Create(ctx context.Context, userID uuid.UUID, category, content, source string) (*model.UserMemory, error) {
	memory := &model.UserMemory{
		ID:        uuid.New(),
		UserID:    userID,
		Category:  category,
		Content:   content,
		Source:    source,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO user_memories (id, user_id, category, content, source, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		memory.ID, memory.UserID, memory.Category, memory.Content, memory.Source,
		memory.CreatedAt, memory.UpdatedAt,
	).Scan(&memory.ID, &memory.CreatedAt, &memory.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return memory, nil
}

// GetByUser returns all memories for a user
func (r *MemoryRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.UserMemory, error) {
	query := `
		SELECT id, user_id, category, content, source, created_at, updated_at
		FROM user_memories
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []model.UserMemory
	for rows.Next() {
		var m model.UserMemory
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.Source, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		memories = append(memories, m)
	}

	return memories, nil
}

// GetByCategory returns memories for a user filtered by category
func (r *MemoryRepository) GetByCategory(ctx context.Context, userID uuid.UUID, category string) ([]model.UserMemory, error) {
	query := `
		SELECT id, user_id, category, content, source, created_at, updated_at
		FROM user_memories
		WHERE user_id = $1 AND category = $2
		ORDER BY updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID, category)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []model.UserMemory
	for rows.Next() {
		var m model.UserMemory
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.Source, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		memories = append(memories, m)
	}

	return memories, nil
}

// GetRecent returns the most recent memories for a user (limit to avoid context overflow)
func (r *MemoryRepository) GetRecent(ctx context.Context, userID uuid.UUID, limit int) ([]model.UserMemory, error) {
	query := `
		SELECT id, user_id, category, content, source, created_at, updated_at
		FROM user_memories
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []model.UserMemory
	for rows.Next() {
		var m model.UserMemory
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.Source, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		memories = append(memories, m)
	}

	return memories, nil
}

// Delete removes a memory
func (r *MemoryRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM user_memories WHERE id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, id, userID)
	return err
}

// Update modifies a memory's content
func (r *MemoryRepository) Update(ctx context.Context, id uuid.UUID, userID uuid.UUID, content string) error {
	query := `
		UPDATE user_memories
		SET content = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`
	_, err := r.pool.Exec(ctx, query, content, id, userID)
	return err
}

// DeleteByContent removes memories with matching content (for deduplication)
func (r *MemoryRepository) DeleteByContent(ctx context.Context, userID uuid.UUID, content string) error {
	query := `DELETE FROM user_memories WHERE user_id = $1 AND content = $2`
	_, err := r.pool.Exec(ctx, query, userID, content)
	return err
}
