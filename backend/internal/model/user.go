package model

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID                   uuid.UUID  `json:"id"`
	Email                string     `json:"email"`
	PasswordHash         string     `json:"-"` // Never expose password hash
	Name                 string     `json:"name,omitempty"`
	FailedLoginAttempts  int        `json:"-"` // Never expose
	LockedUntil          *time.Time `json:"-"` // Never expose
	PasswordResetToken   *string    `json:"-"` // Never expose
	PasswordResetExpires *time.Time `json:"-"` // Never expose
	OnboardingCompleted  bool       `json:"onboarding_completed"`
	LinkedInID           *string    `json:"-"`                    // LinkedIn OAuth ID
	GoogleID             *string    `json:"-"`                    // Google OAuth ID
	AvatarURL            *string    `json:"avatar_url,omitempty"` // Profile picture from OAuth
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// RegisterRequest represents the request body for user registration
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name,omitempty"`
}

// LoginRequest represents the request body for user login
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse is returned after successful login or registration
type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	User         *User  `json:"user"`
}

// ForgotPasswordRequest represents a password reset request
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResetPasswordRequest represents a password reset with token
type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

// RefreshTokenRequest represents a token refresh request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// LinkedInCallbackRequest represents the OAuth callback request
type LinkedInCallbackRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

// UserProfile is a safe representation of user data for API responses
type UserProfile struct {
	ID                uuid.UUID `json:"id"`
	Email             string    `json:"email"`
	Name              string    `json:"name,omitempty"`
	AvatarURL         *string   `json:"avatar_url,omitempty"`
	HasLinkedInLinked bool      `json:"has_linkedin_linked"`
	HasGoogleLinked   bool      `json:"has_google_linked"`
	HasPassword       bool      `json:"has_password"`
	CreatedAt         time.Time `json:"created_at"`
}

// ToProfile converts a User to UserProfile
func (u *User) ToProfile() *UserProfile {
	return &UserProfile{
		ID:                u.ID,
		Email:             u.Email,
		Name:              u.Name,
		AvatarURL:         u.AvatarURL,
		HasLinkedInLinked: u.LinkedInID != nil,
		HasGoogleLinked:   u.GoogleID != nil,
		HasPassword:       u.PasswordHash != "",
		CreatedAt:         u.CreatedAt,
	}
}

// UpdateProfileRequest represents a profile update request
type UpdateProfileRequest struct {
	Email     *string `json:"email,omitempty"`
	Name      *string `json:"name,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password,omitempty"`
	NewPassword     string `json:"new_password"`
}
