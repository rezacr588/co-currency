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

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrAccountLocked     = errors.New("account is temporarily locked")
	ErrInvalidResetToken = errors.New("invalid or expired reset token")
)

// UserRepository handles database operations for users
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository creates a new UserRepository
func NewUserRepository(db *Database) *UserRepository {
	return &UserRepository{pool: db.Pool()}
}

// Create creates a new user in the database
func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	now := time.Now()
	user.ID = uuid.New()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Name,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("creating user: %w", err)
	}

	return nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       github_id, avatar_url, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.GithubID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("getting user by id: %w", err)
	}

	return user, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       github_id, avatar_url, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.GithubID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("getting user by email: %w", err)
	}

	return user, nil
}

// Update updates a user's information
func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	query := `
		UPDATE users
		SET email = $2, name = $3, updated_at = $4
		WHERE id = $1
	`

	user.UpdatedAt = time.Now()

	result, err := r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("updating user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// Delete deletes a user by ID
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`

	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("deleting user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// IncrementFailedAttempts increments failed login attempts and locks account if threshold reached
func (r *UserRepository) IncrementFailedAttempts(ctx context.Context, email string) error {
	// Lock account for 15 minutes after 5 failed attempts
	query := `
		UPDATE users
		SET failed_login_attempts = failed_login_attempts + 1,
		    locked_until = CASE
		        WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
		        ELSE locked_until
		    END,
		    updated_at = NOW()
		WHERE email = $1
	`

	result, err := r.pool.Exec(ctx, query, email)
	if err != nil {
		return fmt.Errorf("incrementing failed attempts: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// ResetFailedAttempts resets failed login attempts after successful login
func (r *UserRepository) ResetFailedAttempts(ctx context.Context, userID uuid.UUID) error {
	query := `
		UPDATE users
		SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("resetting failed attempts: %w", err)
	}

	return nil
}

// IsAccountLocked checks if an account is currently locked
func (r *UserRepository) IsAccountLocked(ctx context.Context, email string) (bool, *time.Time, error) {
	query := `SELECT locked_until FROM users WHERE email = $1`

	var lockedUntil *time.Time
	err := r.pool.QueryRow(ctx, query, email).Scan(&lockedUntil)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil, nil
		}
		return false, nil, fmt.Errorf("checking account lock: %w", err)
	}

	if lockedUntil != nil && lockedUntil.After(time.Now()) {
		return true, lockedUntil, nil
	}

	return false, nil, nil
}

// SetPasswordResetToken sets a password reset token for a user
func (r *UserRepository) SetPasswordResetToken(ctx context.Context, email, token string, expiry time.Time) error {
	query := `
		UPDATE users
		SET password_reset_token = $2, password_reset_expires = $3, updated_at = NOW()
		WHERE email = $1
	`

	result, err := r.pool.Exec(ctx, query, email, token, expiry)
	if err != nil {
		return fmt.Errorf("setting reset token: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// GetByResetToken retrieves a user by password reset token
func (r *UserRepository) GetByResetToken(ctx context.Context, token string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       github_id, avatar_url, created_at, updated_at
		FROM users
		WHERE password_reset_token = $1 AND password_reset_expires > NOW()
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, token).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.GithubID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidResetToken
		}
		return nil, fmt.Errorf("getting user by reset token: %w", err)
	}

	return user, nil
}

// UpdatePassword updates a user's password and clears the reset token
func (r *UserRepository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	query := `
		UPDATE users
		SET password_hash = $2, password_reset_token = NULL, password_reset_expires = NULL,
		    failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID, passwordHash)
	if err != nil {
		return fmt.Errorf("updating password: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// SetOnboardingCompleted marks onboarding as completed for a user
func (r *UserRepository) SetOnboardingCompleted(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1`

	_, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("setting onboarding completed: %w", err)
	}

	return nil
}

// GetByGitHubID retrieves a user by GitHub ID
func (r *UserRepository) GetByGitHubID(ctx context.Context, githubID string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       github_id, avatar_url, created_at, updated_at
		FROM users
		WHERE github_id = $1
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, githubID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.GithubID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("getting user by github id: %w", err)
	}

	return user, nil
}

// CreateFromGitHub creates a new user from GitHub OAuth data
func (r *UserRepository) CreateFromGitHub(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, name, github_id, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	now := time.Now()
	user.ID = uuid.New()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.GithubID,
		user.AvatarURL,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("creating user from github: %w", err)
	}

	return nil
}

// LinkGitHubAccount links a GitHub account to an existing user
func (r *UserRepository) LinkGitHubAccount(ctx context.Context, userID uuid.UUID, githubID, avatarURL string) error {
	query := `
		UPDATE users
		SET github_id = $2, avatar_url = $3, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID, githubID, avatarURL)
	if err != nil {
		if isDuplicateKeyError(err) {
			return fmt.Errorf("github account already linked to another user")
		}
		return fmt.Errorf("linking github account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// UnlinkGitHubAccount removes GitHub link from a user
func (r *UserRepository) UnlinkGitHubAccount(ctx context.Context, userID uuid.UUID) error {
	// First check if user has a password (can't unlink if OAuth-only)
	var passwordHash *string
	err := r.pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("checking password: %w", err)
	}

	if passwordHash == nil || *passwordHash == "" {
		return fmt.Errorf("cannot unlink GitHub: no password set. Please set a password first")
	}

	query := `
		UPDATE users
		SET github_id = NULL, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("unlinking github account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// isDuplicateKeyError checks if the error is a duplicate key violation
func isDuplicateKeyError(err error) bool {
	return err != nil && (contains(err.Error(), "duplicate key") || contains(err.Error(), "23505"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
