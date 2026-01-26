package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

var (
	ErrGoogleOAuthNotConfigured = errors.New("Google OAuth not configured")
	ErrGoogleOAuthFailed        = errors.New("Google OAuth failed")
	ErrGoogleAccountLinked      = errors.New("Google account already linked to another user")
)

// GoogleConfig holds Google OAuth configuration
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// GoogleOAuthService handles Google OAuth operations
type GoogleOAuthService struct {
	authService    *AuthService
	userRepo       *repository.UserRepository
	oauthStateRepo *repository.OAuthStateRepository
	config         *GoogleConfig
}

// GoogleUser represents the user data returned by Google API
type GoogleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// GoogleAccessToken represents the access token response from Google
type GoogleAccessToken struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// NewGoogleOAuthService creates a new GoogleOAuthService
func NewGoogleOAuthService(authService *AuthService, userRepo *repository.UserRepository, oauthStateRepo *repository.OAuthStateRepository, config *GoogleConfig) *GoogleOAuthService {
	return &GoogleOAuthService{
		authService:    authService,
		userRepo:       userRepo,
		oauthStateRepo: oauthStateRepo,
		config:         config,
	}
}

// IsConfigured returns true if Google OAuth is configured
func (s *GoogleOAuthService) IsConfigured() bool {
	return s.config != nil && s.config.ClientID != "" && s.config.ClientSecret != ""
}

// GetAuthURL generates the Google OAuth authorization URL
func (s *GoogleOAuthService) GetAuthURL() (string, string, error) {
	if !s.IsConfigured() {
		return "", "", ErrGoogleOAuthNotConfigured
	}

	// Generate a random state token
	state := uuid.New().String()

	// Store state in database with 5 minute expiry
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	expiresAt := time.Now().Add(5 * time.Minute)
	if err := s.oauthStateRepo.Create(ctx, state, expiresAt); err != nil {
		log.Error().Err(err).Msg("failed to store OAuth state in database")
		return "", "", fmt.Errorf("storing OAuth state: %w", err)
	}

	// Clean up expired states in background
	go func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		if err := s.oauthStateRepo.CleanupExpired(cleanupCtx); err != nil {
			log.Warn().Err(err).Msg("failed to cleanup expired OAuth states")
		}
	}()

	// Build authorization URL
	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", s.config.ClientID)
	params.Set("redirect_uri", s.config.RedirectURI)
	params.Set("scope", "openid email profile")
	params.Set("state", state)
	params.Set("access_type", "offline")
	params.Set("prompt", "consent")

	authURL := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?%s", params.Encode())

	return authURL, state, nil
}

// ValidateState validates the OAuth state parameter
func (s *GoogleOAuthService) ValidateState(ctx context.Context, state string) error {
	return s.oauthStateRepo.Validate(ctx, state)
}

// HandleCallback handles the Google OAuth callback
func (s *GoogleOAuthService) HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, ErrGoogleOAuthNotConfigured
	}

	// Validate state from database
	if err := s.ValidateState(ctx, state); err != nil {
		if errors.Is(err, repository.ErrOAuthStateNotFound) {
			return nil, fmt.Errorf("invalid or expired state parameter")
		}
		if errors.Is(err, repository.ErrOAuthStateExpired) {
			return nil, fmt.Errorf("OAuth state has expired, please try again")
		}
		return nil, fmt.Errorf("validating state: %w", err)
	}

	// Exchange code for access token
	accessToken, err := s.exchangeCodeForToken(code)
	if err != nil {
		return nil, fmt.Errorf("exchanging code for token: %w", err)
	}

	// Get Google user info
	googleUser, err := s.getGoogleUser(accessToken)
	if err != nil {
		return nil, fmt.Errorf("getting Google user: %w", err)
	}

	// Try to find existing user by Google ID
	googleID := googleUser.ID
	user, err := s.userRepo.GetByGoogleID(ctx, googleID)
	if err == nil {
		// User found, generate token and return
		return s.generateAuthResponse(ctx, user)
	}

	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, fmt.Errorf("checking Google user: %w", err)
	}

	// User not found by Google ID, check if email exists
	if googleUser.Email != "" {
		existingUser, err := s.userRepo.GetByEmail(ctx, googleUser.Email)
		if err == nil {
			// User with this email exists, link Google account
			if err := s.userRepo.LinkGoogleAccount(ctx, existingUser.ID, googleID, googleUser.Picture); err != nil {
				return nil, fmt.Errorf("linking Google account: %w", err)
			}
			// Reload user with updated data
			existingUser, err = s.userRepo.GetByID(ctx, existingUser.ID)
			if err != nil {
				return nil, fmt.Errorf("reloading user: %w", err)
			}
			return s.generateAuthResponse(ctx, existingUser)
		}
		if !errors.Is(err, repository.ErrUserNotFound) {
			return nil, fmt.Errorf("checking email: %w", err)
		}
	}

	// No existing user, create a new one
	avatarURL := googleUser.Picture
	name := googleUser.Name
	if name == "" {
		name = fmt.Sprintf("%s %s", googleUser.GivenName, googleUser.FamilyName)
	}

	newUser := &model.User{
		Email:     googleUser.Email,
		Name:      strings.TrimSpace(name),
		GoogleID:  &googleID,
		AvatarURL: &avatarURL,
	}

	// If no email from Google, use a placeholder
	if newUser.Email == "" {
		newUser.Email = fmt.Sprintf("%s@google.local", googleID)
	}

	// If no name, use "Google User"
	if newUser.Name == "" {
		newUser.Name = "Google User"
	}

	if err := s.userRepo.CreateFromGoogle(ctx, newUser); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			return nil, fmt.Errorf("email already registered")
		}
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return s.generateAuthResponse(ctx, newUser)
}

// exchangeCodeForToken exchanges the authorization code for an access token
func (s *GoogleOAuthService) exchangeCodeForToken(code string) (string, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("client_id", s.config.ClientID)
	data.Set("client_secret", s.config.ClientSecret)
	data.Set("redirect_uri", s.config.RedirectURI)

	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Google token error: %s", string(body))
	}

	var tokenResp GoogleAccessToken
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parsing token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token in response: %s", string(body))
	}

	return tokenResp.AccessToken, nil
}

// getGoogleUser fetches the authenticated user's profile from Google
func (s *GoogleOAuthService) getGoogleUser(accessToken string) (*GoogleUser, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google API error: %s", string(body))
	}

	var user GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// generateAuthResponse generates JWT tokens for a user
func (s *GoogleOAuthService) generateAuthResponse(ctx context.Context, user *model.User) (*model.AuthResponse, error) {
	// Reset failed attempts on successful OAuth login
	if err := s.userRepo.ResetFailedAttempts(ctx, user.ID); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to reset failed attempts")
	}

	// Generate access token
	token, err := s.authService.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}

	response := &model.AuthResponse{
		Token: token,
		User:  user,
	}

	// Generate refresh token if repository is configured
	if s.authService.refreshTokenRepo != nil {
		refreshToken := uuid.New().String()
		expiresAt := time.Now().Add(s.authService.refreshExpiry)
		if err := s.authService.refreshTokenRepo.Create(ctx, user.ID, refreshToken, expiresAt); err != nil {
			log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to create refresh token")
		} else {
			response.RefreshToken = refreshToken
		}
	}

	return response, nil
}

// GetFrontendURL returns the frontend URL for redirects
func (s *GoogleOAuthService) GetFrontendURL() string {
	if s.config != nil && s.config.FrontendURL != "" {
		return s.config.FrontendURL
	}
	return "http://localhost:5173"
}
