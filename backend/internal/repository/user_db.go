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
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
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
		&user.LinkedInID,
		&user.GoogleID,
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
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
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
		&user.LinkedInID,
		&user.GoogleID,
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

// UpdateProfile updates a user's profile information
func (r *UserRepository) UpdateProfile(ctx context.Context, user *model.User) error {
	query := `
		UPDATE users
		SET email = $2, name = $3, avatar_url = $4, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.AvatarURL,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("updating user profile: %w", err)
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
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
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
		&user.LinkedInID,
		&user.GoogleID,
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

// GetByLinkedInID retrieves a user by LinkedIn ID
func (r *UserRepository) GetByLinkedInID(ctx context.Context, linkedinID string) (*model.User, error) {
	query := `
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE linkedin_id = $1
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, linkedinID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.LinkedInID,
		&user.GoogleID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("getting user by linkedin id: %w", err)
	}

	return user, nil
}

// CreateFromLinkedIn creates a new user from LinkedIn OAuth data
func (r *UserRepository) CreateFromLinkedIn(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, name, linkedin_id, avatar_url, created_at, updated_at)
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
		user.LinkedInID,
		user.AvatarURL,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("creating user from linkedin: %w", err)
	}

	return nil
}

// LinkLinkedInAccount links a LinkedIn account to an existing user
func (r *UserRepository) LinkLinkedInAccount(ctx context.Context, userID uuid.UUID, linkedinID, avatarURL string) error {
	query := `
		UPDATE users
		SET linkedin_id = $2, avatar_url = $3, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID, linkedinID, avatarURL)
	if err != nil {
		if isDuplicateKeyError(err) {
			return fmt.Errorf("linkedin account already linked to another user")
		}
		return fmt.Errorf("linking linkedin account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// UnlinkLinkedInAccount removes LinkedIn link from a user
func (r *UserRepository) UnlinkLinkedInAccount(ctx context.Context, userID uuid.UUID) error {
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
		return fmt.Errorf("cannot unlink LinkedIn: no password set. Please set a password first")
	}

	query := `
		UPDATE users
		SET linkedin_id = NULL, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("unlinking linkedin account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// GetByGoogleID retrieves a user by Google ID
func (r *UserRepository) GetByGoogleID(ctx context.Context, googleID string) (*model.User, error) {
	query := `
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE google_id = $1
	`

	user := &model.User{}
	err := r.pool.QueryRow(ctx, query, googleID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.LinkedInID,
		&user.GoogleID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("getting user by google id: %w", err)
	}

	return user, nil
}

// CreateFromGoogle creates a new user from Google OAuth data
func (r *UserRepository) CreateFromGoogle(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, name, google_id, avatar_url, created_at, updated_at)
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
		user.GoogleID,
		user.AvatarURL,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("creating user from google: %w", err)
	}

	return nil
}

// LinkGoogleAccount links a Google account to an existing user
func (r *UserRepository) LinkGoogleAccount(ctx context.Context, userID uuid.UUID, googleID, avatarURL string) error {
	query := `
		UPDATE users
		SET google_id = $2, avatar_url = $3, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID, googleID, avatarURL)
	if err != nil {
		if isDuplicateKeyError(err) {
			return fmt.Errorf("google account already linked to another user")
		}
		return fmt.Errorf("linking google account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

// UnlinkGoogleAccount removes Google link from a user
func (r *UserRepository) UnlinkGoogleAccount(ctx context.Context, userID uuid.UUID) error {
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
		return fmt.Errorf("cannot unlink Google: no password set. Please set a password first")
	}

	query := `
		UPDATE users
		SET google_id = NULL, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("unlinking google account: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}
