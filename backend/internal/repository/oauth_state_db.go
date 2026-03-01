package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OAuthStateRepository handles database operations for OAuth state tokens
type OAuthStateRepository struct {
	pool *pgxpool.Pool
}

// NewOAuthStateRepository creates a new OAuthStateRepository
func NewOAuthStateRepository(db *Database) *OAuthStateRepository {
	return &OAuthStateRepository{pool: db.Pool()}
}

// Create stores a new OAuth state with expiry
func (r *OAuthStateRepository) Create(ctx context.Context, state string, expiresAt time.Time) error {
	query := `
		INSERT INTO oauth_states (state, expires_at, created_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (state) DO UPDATE SET expires_at = $2
	`

	_, err := r.pool.Exec(ctx, query, state, expiresAt, time.Now())
	if err != nil {
		return fmt.Errorf("creating oauth state: %w", err)
	}

	return nil
}

// Validate checks if an OAuth state is valid and deletes it (one-time use)
func (r *OAuthStateRepository) Validate(ctx context.Context, state string) error {
	// Use a transaction to ensure atomic check-and-delete
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check if state exists and get expiry
	query := `SELECT expires_at FROM oauth_states WHERE state = $1`
	var expiresAt time.Time

	err = tx.QueryRow(ctx, query, state).Scan(&expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrOAuthStateNotFound
		}
		return fmt.Errorf("validating oauth state: %w", err)
	}

	// Check expiry BEFORE deleting so an expired state is not consumed
	if time.Now().After(expiresAt) {
		// Still delete the expired state to keep the table clean
		deleteQuery := `DELETE FROM oauth_states WHERE state = $1`
		_, _ = tx.Exec(ctx, deleteQuery, state)
		_ = tx.Commit(ctx)
		return ErrOAuthStateExpired
	}

	// Delete the state (one-time use)
	deleteQuery := `DELETE FROM oauth_states WHERE state = $1`
	_, err = tx.Exec(ctx, deleteQuery, state)
	if err != nil {
		return fmt.Errorf("deleting oauth state: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

// CleanupExpired removes all expired OAuth states
func (r *OAuthStateRepository) CleanupExpired(ctx context.Context) error {
	query := `DELETE FROM oauth_states WHERE expires_at < NOW()`

	_, err := r.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("cleaning up expired oauth states: %w", err)
	}

	return nil
}
