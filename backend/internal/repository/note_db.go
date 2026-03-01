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

// NoteRepository handles database operations for notes
type NoteRepository struct {
	pool *pgxpool.Pool
}

// NewNoteRepository creates a new NoteRepository
func NewNoteRepository(db *Database) *NoteRepository {
	return &NoteRepository{pool: db.Pool()}
}

// Create creates a new note
func (r *NoteRepository) Create(ctx context.Context, note *model.Note) error {
	query := `
		INSERT INTO notes (id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	note.ID = uuid.New()
	now := time.Now()
	note.CreatedAt = now
	note.UpdatedAt = now

	if note.Color == "" {
		note.Color = "default"
	}

	_, err := r.pool.Exec(ctx, query,
		note.ID,
		note.UserID,
		note.TransactionID,
		note.Title,
		note.Content,
		note.Color,
		note.IsPinned,
		note.CreatedAt,
		note.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("creating note: %w", err)
	}

	return nil
}

// GetByID retrieves a note by ID for a user
func (r *NoteRepository) GetByID(ctx context.Context, userID, noteID uuid.UUID) (*model.Note, error) {
	query := `
		SELECT id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at
		FROM notes
		WHERE id = $1 AND user_id = $2
	`

	note := &model.Note{}
	var color *string

	err := r.pool.QueryRow(ctx, query, noteID, userID).Scan(
		&note.ID,
		&note.UserID,
		&note.TransactionID,
		&note.Title,
		&note.Content,
		&color,
		&note.IsPinned,
		&note.CreatedAt,
		&note.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoteNotFound
		}
		return nil, fmt.Errorf("getting note: %w", err)
	}

	if color != nil {
		note.Color = *color
	}

	return note, nil
}

// GetByUser retrieves all notes for a user, with pinned notes first
func (r *NoteRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]model.Note, error) {
	query := `
		SELECT id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at
		FROM notes
		WHERE user_id = $1
		ORDER BY is_pinned DESC, updated_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying notes: %w", err)
	}
	defer rows.Close()

	var notes []model.Note
	for rows.Next() {
		var n model.Note
		var color *string

		if err := rows.Scan(
			&n.ID,
			&n.UserID,
			&n.TransactionID,
			&n.Title,
			&n.Content,
			&color,
			&n.IsPinned,
			&n.CreatedAt,
			&n.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning note: %w", err)
		}

		if color != nil {
			n.Color = *color
		}

		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating notes: %w", err)
	}

	return notes, nil
}

// Search searches notes by title or content
func (r *NoteRepository) Search(ctx context.Context, userID uuid.UUID, query string) ([]model.Note, error) {
	sqlQuery := `
		SELECT id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at
		FROM notes
		WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
		ORDER BY is_pinned DESC, updated_at DESC
	`

	searchPattern := "%" + query + "%"
	rows, err := r.pool.Query(ctx, sqlQuery, userID, searchPattern)
	if err != nil {
		return nil, fmt.Errorf("searching notes: %w", err)
	}
	defer rows.Close()

	var notes []model.Note
	for rows.Next() {
		var n model.Note
		var color *string

		if err := rows.Scan(
			&n.ID,
			&n.UserID,
			&n.TransactionID,
			&n.Title,
			&n.Content,
			&color,
			&n.IsPinned,
			&n.CreatedAt,
			&n.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning note: %w", err)
		}

		if color != nil {
			n.Color = *color
		}

		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating notes: %w", err)
	}

	return notes, nil
}

// Update updates a note
func (r *NoteRepository) Update(ctx context.Context, note *model.Note) error {
	query := `
		UPDATE notes
		SET title = $1, content = $2, color = $3, is_pinned = $4, transaction_id = $5, updated_at = $6
		WHERE id = $7 AND user_id = $8
	`

	note.UpdatedAt = time.Now()

	result, err := r.pool.Exec(ctx, query,
		note.Title,
		note.Content,
		note.Color,
		note.IsPinned,
		note.TransactionID,
		note.UpdatedAt,
		note.ID,
		note.UserID,
	)

	if err != nil {
		return fmt.Errorf("updating note: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNoteNotFound
	}

	return nil
}

// Delete deletes a note
func (r *NoteRepository) Delete(ctx context.Context, userID, noteID uuid.UUID) error {
	query := `DELETE FROM notes WHERE id = $1 AND user_id = $2`

	result, err := r.pool.Exec(ctx, query, noteID, userID)
	if err != nil {
		return fmt.Errorf("deleting note: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNoteNotFound
	}

	return nil
}

// TogglePin toggles the pinned status of a note
func (r *NoteRepository) TogglePin(ctx context.Context, userID, noteID uuid.UUID) (*model.Note, error) {
	query := `
		UPDATE notes
		SET is_pinned = NOT is_pinned, updated_at = $1
		WHERE id = $2 AND user_id = $3
		RETURNING id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at
	`

	note := &model.Note{}
	var color *string
	now := time.Now()

	err := r.pool.QueryRow(ctx, query, now, noteID, userID).Scan(
		&note.ID,
		&note.UserID,
		&note.TransactionID,
		&note.Title,
		&note.Content,
		&color,
		&note.IsPinned,
		&note.CreatedAt,
		&note.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoteNotFound
		}
		return nil, fmt.Errorf("toggling note pin: %w", err)
	}

	if color != nil {
		note.Color = *color
	}

	return note, nil
}

// GetByTransaction retrieves all notes linked to a transaction
func (r *NoteRepository) GetByTransaction(ctx context.Context, userID, transactionID uuid.UUID) ([]model.Note, error) {
	query := `
		SELECT id, user_id, transaction_id, title, content, color, is_pinned, created_at, updated_at
		FROM notes
		WHERE user_id = $1 AND transaction_id = $2
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID, transactionID)
	if err != nil {
		return nil, fmt.Errorf("querying notes by transaction: %w", err)
	}
	defer rows.Close()

	var notes []model.Note
	for rows.Next() {
		var n model.Note
		var color *string

		if err := rows.Scan(
			&n.ID,
			&n.UserID,
			&n.TransactionID,
			&n.Title,
			&n.Content,
			&color,
			&n.IsPinned,
			&n.CreatedAt,
			&n.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning note: %w", err)
		}

		if color != nil {
			n.Color = *color
		}

		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating notes: %w", err)
	}

	return notes, nil
}
