package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// UserRepository handles database operations for users
type UserRepository struct {
	pool *pgxpool.Pool
}

type userScanner interface {
	Scan(dest ...interface{}) error
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
	if user.PreferredCurrency == "" {
		user.PreferredCurrency = "USD"
	}
	if len(user.CoAIFocusAreas) == 0 {
		user.CoAIFocusAreas = []string{"general"}
	}
	user.WeeklyBriefEnabled = true
	user.ProactiveAlertsEnabled = true

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

func scanUser(scanner userScanner) (*model.User, error) {
	user := &model.User{}
	var focusAreasJSON []byte
	err := scanner.Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.PasswordResetToken,
		&user.PasswordResetExpires,
		&user.OnboardingCompleted,
		&user.PreferredCurrency,
		&focusAreasJSON,
		&user.WeeklyBriefEnabled,
		&user.ProactiveAlertsEnabled,
		&user.LinkedInID,
		&user.GoogleID,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if user.PreferredCurrency == "" {
		user.PreferredCurrency = "USD"
	}
	user.CoAIFocusAreas = []string{"general"}
	if len(focusAreasJSON) > 0 {
		var focusAreas []string
		if err := json.Unmarshal(focusAreasJSON, &focusAreas); err == nil && len(focusAreas) > 0 {
			user.CoAIFocusAreas = focusAreas
		}
	}

	return user, nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       COALESCE(preferred_currency, 'USD') AS preferred_currency,
		       COALESCE(coai_focus_areas, '["general"]'::jsonb) AS coai_focus_areas,
		       COALESCE(coai_weekly_brief_enabled, TRUE) AS coai_weekly_brief_enabled,
		       COALESCE(coai_proactive_alerts_enabled, TRUE) AS coai_proactive_alerts_enabled,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user, err := scanUser(r.pool.QueryRow(ctx, query, id))
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
		       COALESCE(preferred_currency, 'USD') AS preferred_currency,
		       COALESCE(coai_focus_areas, '["general"]'::jsonb) AS coai_focus_areas,
		       COALESCE(coai_weekly_brief_enabled, TRUE) AS coai_weekly_brief_enabled,
		       COALESCE(coai_proactive_alerts_enabled, TRUE) AS coai_proactive_alerts_enabled,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	user, err := scanUser(r.pool.QueryRow(ctx, query, email))
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
		       COALESCE(preferred_currency, 'USD') AS preferred_currency,
		       COALESCE(coai_focus_areas, '["general"]'::jsonb) AS coai_focus_areas,
		       COALESCE(coai_weekly_brief_enabled, TRUE) AS coai_weekly_brief_enabled,
		       COALESCE(coai_proactive_alerts_enabled, TRUE) AS coai_proactive_alerts_enabled,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE password_reset_token = $1 AND password_reset_expires > NOW()
	`

	user, err := scanUser(r.pool.QueryRow(ctx, query, token))
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

func (r *UserRepository) GetCoAIPreferences(ctx context.Context, userID uuid.UUID) (*model.CoAIPreferences, error) {
	user, err := r.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &model.CoAIPreferences{
		UserID:                 user.ID.String(),
		PreferredCurrency:      user.PreferredCurrency,
		FocusAreas:             user.CoAIFocusAreas,
		WeeklyBriefEnabled:     user.WeeklyBriefEnabled,
		ProactiveAlertsEnabled: user.ProactiveAlertsEnabled,
		UpdatedAt:              user.UpdatedAt,
	}, nil
}

func (r *UserRepository) UpdateCoAIPreferences(ctx context.Context, userID uuid.UUID, req model.UpdateCoAIPreferencesRequest) (*model.CoAIPreferences, error) {
	current, err := r.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	preferredCurrency := current.PreferredCurrency
	if req.PreferredCurrency != nil && *req.PreferredCurrency != "" {
		preferredCurrency = *req.PreferredCurrency
	}

	focusAreas := current.CoAIFocusAreas
	if req.FocusAreas != nil {
		focusAreas = append([]string{}, (*req.FocusAreas)...)
	}
	if len(focusAreas) == 0 {
		focusAreas = []string{"general"}
	}

	weeklyBriefEnabled := current.WeeklyBriefEnabled
	if req.WeeklyBriefEnabled != nil {
		weeklyBriefEnabled = *req.WeeklyBriefEnabled
	}

	proactiveAlertsEnabled := current.ProactiveAlertsEnabled
	if req.ProactiveAlertsEnabled != nil {
		proactiveAlertsEnabled = *req.ProactiveAlertsEnabled
	}

	focusAreasJSON, err := json.Marshal(focusAreas)
	if err != nil {
		return nil, fmt.Errorf("marshaling focus areas: %w", err)
	}

	query := `
		UPDATE users
		SET preferred_currency = $2,
		    coai_focus_areas = $3,
		    coai_weekly_brief_enabled = $4,
		    coai_proactive_alerts_enabled = $5,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	var updatedAt time.Time
	if err := r.pool.QueryRow(ctx, query, userID, preferredCurrency, focusAreasJSON, weeklyBriefEnabled, proactiveAlertsEnabled).Scan(&updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("updating CoAI preferences: %w", err)
	}

	return &model.CoAIPreferences{
		UserID:                 userID.String(),
		PreferredCurrency:      preferredCurrency,
		FocusAreas:             focusAreas,
		WeeklyBriefEnabled:     weeklyBriefEnabled,
		ProactiveAlertsEnabled: proactiveAlertsEnabled,
		UpdatedAt:              updatedAt,
	}, nil
}

// GetByLinkedInID retrieves a user by LinkedIn ID
func (r *UserRepository) GetByLinkedInID(ctx context.Context, linkedinID string) (*model.User, error) {
	query := `
		SELECT id, email, COALESCE(password_hash, '') AS password_hash, name, failed_login_attempts, locked_until,
		       password_reset_token, password_reset_expires, onboarding_completed,
		       COALESCE(preferred_currency, 'USD') AS preferred_currency,
		       COALESCE(coai_focus_areas, '["general"]'::jsonb) AS coai_focus_areas,
		       COALESCE(coai_weekly_brief_enabled, TRUE) AS coai_weekly_brief_enabled,
		       COALESCE(coai_proactive_alerts_enabled, TRUE) AS coai_proactive_alerts_enabled,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE linkedin_id = $1
	`

	user, err := scanUser(r.pool.QueryRow(ctx, query, linkedinID))
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
	if user.PreferredCurrency == "" {
		user.PreferredCurrency = "USD"
	}
	if len(user.CoAIFocusAreas) == 0 {
		user.CoAIFocusAreas = []string{"general"}
	}
	user.WeeklyBriefEnabled = true
	user.ProactiveAlertsEnabled = true

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
		       COALESCE(preferred_currency, 'USD') AS preferred_currency,
		       COALESCE(coai_focus_areas, '["general"]'::jsonb) AS coai_focus_areas,
		       COALESCE(coai_weekly_brief_enabled, TRUE) AS coai_weekly_brief_enabled,
		       COALESCE(coai_proactive_alerts_enabled, TRUE) AS coai_proactive_alerts_enabled,
		       linkedin_id, google_id, avatar_url, created_at, updated_at
		FROM users
		WHERE google_id = $1
	`

	user, err := scanUser(r.pool.QueryRow(ctx, query, googleID))
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
	if user.PreferredCurrency == "" {
		user.PreferredCurrency = "USD"
	}
	if len(user.CoAIFocusAreas) == 0 {
		user.CoAIFocusAreas = []string{"general"}
	}
	user.WeeklyBriefEnabled = true
	user.ProactiveAlertsEnabled = true

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
