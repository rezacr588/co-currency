package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RefreshToken represents a refresh token in the database
type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// RefreshTokenRepository handles database operations for refresh tokens
type RefreshTokenRepository struct {
	pool *pgxpool.Pool
}

// NewRefreshTokenRepository creates a new RefreshTokenRepository
func NewRefreshTokenRepository(db *Database) *RefreshTokenRepository {
	return &RefreshTokenRepository{pool: db.Pool()}
}

// hashToken creates a SHA-256 hash of the token
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Create stores a new refresh token
func (r *RefreshTokenRepository) Create(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error {
	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := r.pool.Exec(ctx, query,
		uuid.New(),
		userID,
		hashToken(token),
		expiresAt,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("creating refresh token: %w", err)
	}

	return nil
}

// Validate checks if a refresh token is valid and returns the user ID
func (r *RefreshTokenRepository) Validate(ctx context.Context, token string) (uuid.UUID, error) {
	query := `
		SELECT user_id, expires_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`

	var userID uuid.UUID
	var expiresAt time.Time

	err := r.pool.QueryRow(ctx, query, hashToken(token)).Scan(&userID, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrRefreshTokenNotFound
		}
		return uuid.Nil, fmt.Errorf("validating refresh token: %w", err)
	}

	if time.Now().After(expiresAt) {
		return uuid.Nil, ErrRefreshTokenExpired
	}

	return userID, nil
}

// Delete removes a refresh token (for logout)
func (r *RefreshTokenRepository) Delete(ctx context.Context, token string) error {
	query := `DELETE FROM refresh_tokens WHERE token_hash = $1`

	result, err := r.pool.Exec(ctx, query, hashToken(token))
	if err != nil {
		return fmt.Errorf("deleting refresh token: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

// DeleteAllForUser removes all refresh tokens for a user (for logout all devices)
func (r *RefreshTokenRepository) DeleteAllForUser(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM refresh_tokens WHERE user_id = $1`

	_, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("deleting all refresh tokens: %w", err)
	}

	return nil
}

// CleanupExpired removes all expired refresh tokens
func (r *RefreshTokenRepository) CleanupExpired(ctx context.Context) error {
	query := `DELETE FROM refresh_tokens WHERE expires_at < NOW()`

	_, err := r.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("cleaning up expired tokens: %w", err)
	}

	return nil
}
