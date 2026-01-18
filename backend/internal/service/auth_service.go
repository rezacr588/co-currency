package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid token")
	ErrTokenExpired       = errors.New("token expired")
	ErrAccountLocked      = errors.New("account is temporarily locked due to too many failed login attempts")
	ErrInvalidResetToken  = errors.New("invalid or expired password reset token")
)

// AuthService handles authentication operations
type AuthService struct {
	userRepo         *repository.UserRepository
	refreshTokenRepo *repository.RefreshTokenRepository
	jwtSecret        []byte
	jwtExpiry        time.Duration
	refreshExpiry    time.Duration
}

// JWTClaims represents the claims in our JWT token
type JWTClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	jwt.RegisteredClaims
}

// NewAuthService creates a new AuthService
func NewAuthService(userRepo *repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		jwtSecret:     []byte(jwtSecret),
		jwtExpiry:     15 * time.Minute, // Short-lived access token
		refreshExpiry: 7 * 24 * time.Hour, // 7 days refresh token
	}
}

// NewAuthServiceWithRefresh creates a new AuthService with refresh token support
func NewAuthServiceWithRefresh(userRepo *repository.UserRepository, refreshTokenRepo *repository.RefreshTokenRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		refreshTokenRepo: refreshTokenRepo,
		jwtSecret:        []byte(jwtSecret),
		jwtExpiry:        15 * time.Minute, // Short-lived access token
		refreshExpiry:    7 * 24 * time.Hour, // 7 days refresh token
	}
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, req *model.RegisterRequest) (*model.AuthResponse, error) {
	// Validate request
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	if len(req.Password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	// Create user
	user := &model.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			return nil, errors.New("email already registered")
		}
		return nil, fmt.Errorf("creating user: %w", err)
	}

	// Generate token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}

	return &model.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// Login authenticates a user and returns a token
func (s *AuthService) Login(ctx context.Context, req *model.LoginRequest) (*model.AuthResponse, error) {
	// Validate request
	if req.Email == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}

	// Check if account is locked
	locked, lockedUntil, err := s.userRepo.IsAccountLocked(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("checking account lock: %w", err)
	}
	if locked {
		return nil, fmt.Errorf("%w: try again after %s", ErrAccountLocked, lockedUntil.Format(time.RFC3339))
	}

	// Find user by email
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("finding user: %w", err)
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Increment failed attempts
		if incErr := s.userRepo.IncrementFailedAttempts(ctx, req.Email); incErr != nil {
			// Log error but don't expose to user
			log.Error().Err(incErr).Str("email", req.Email).Msg("failed to increment failed attempts")
		}
		return nil, ErrInvalidCredentials
	}

	// Reset failed attempts on successful login
	if err := s.userRepo.ResetFailedAttempts(ctx, user.ID); err != nil {
		// Log error but don't fail login
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to reset failed attempts")
	}

	// Generate access token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}

	response := &model.AuthResponse{
		Token: token,
		User:  user,
	}

	// Generate refresh token if repository is configured
	if s.refreshTokenRepo != nil {
		refreshToken := uuid.New().String()
		expiresAt := time.Now().Add(s.refreshExpiry)
		if err := s.refreshTokenRepo.Create(ctx, user.ID, refreshToken, expiresAt); err != nil {
			// Log error but don't fail login
			log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to create refresh token")
		} else {
			response.RefreshToken = refreshToken
		}
	}

	return response, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

// generateToken creates a new JWT token for a user
func (s *AuthService) generateToken(user *model.User) (string, error) {
	claims := &JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.jwtExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// GeneratePasswordResetToken creates a password reset token for a user
func (s *AuthService) GeneratePasswordResetToken(ctx context.Context, email string) (string, error) {
	// Check if user exists
	_, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			// Don't reveal whether email exists
			return "", nil
		}
		return "", fmt.Errorf("checking user: %w", err)
	}

	// Generate a secure random token
	token := uuid.New().String()
	expiry := time.Now().Add(1 * time.Hour) // Token valid for 1 hour

	if err := s.userRepo.SetPasswordResetToken(ctx, email, token, expiry); err != nil {
		return "", fmt.Errorf("setting reset token: %w", err)
	}

	return token, nil
}

// ResetPassword resets a user's password using a reset token
func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("password must be at least 6 characters")
	}

	// Find user by reset token
	user, err := s.userRepo.GetByResetToken(ctx, token)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidResetToken) {
			return ErrInvalidResetToken
		}
		return fmt.Errorf("finding user: %w", err)
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	// Update password
	if err := s.userRepo.UpdatePassword(ctx, user.ID, string(hashedPassword)); err != nil {
		return fmt.Errorf("updating password: %w", err)
	}

	return nil
}

// SetOnboardingCompleted marks the onboarding as completed for a user
func (s *AuthService) SetOnboardingCompleted(ctx context.Context, userID uuid.UUID) error {
	return s.userRepo.SetOnboardingCompleted(ctx, userID)
}

// RefreshToken validates a refresh token and returns a new access token
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*model.AuthResponse, error) {
	if s.refreshTokenRepo == nil {
		return nil, errors.New("refresh tokens not configured")
	}

	// Validate refresh token
	userID, err := s.refreshTokenRepo.Validate(ctx, refreshToken)
	if err != nil {
		if errors.Is(err, repository.ErrRefreshTokenNotFound) {
			return nil, ErrInvalidToken
		}
		if errors.Is(err, repository.ErrRefreshTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, fmt.Errorf("validating refresh token: %w", err)
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting user: %w", err)
	}

	// Generate new access token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}

	return &model.AuthResponse{
		Token:        token,
		RefreshToken: refreshToken, // Return the same refresh token
		User:         user,
	}, nil
}

// Logout invalidates a refresh token
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if s.refreshTokenRepo == nil {
		return nil // No-op if refresh tokens not configured
	}

	return s.refreshTokenRepo.Delete(ctx, refreshToken)
}

// LogoutAllDevices invalidates all refresh tokens for a user
func (s *AuthService) LogoutAllDevices(ctx context.Context, userID uuid.UUID) error {
	if s.refreshTokenRepo == nil {
		return nil // No-op if refresh tokens not configured
	}

	return s.refreshTokenRepo.DeleteAllForUser(ctx, userID)
}
