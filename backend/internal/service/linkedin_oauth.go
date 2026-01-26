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
	ErrLinkedInOAuthNotConfigured = errors.New("LinkedIn OAuth not configured")
	ErrLinkedInOAuthFailed        = errors.New("LinkedIn OAuth failed")
	ErrLinkedInAccountLinked      = errors.New("LinkedIn account already linked to another user")
)

// LinkedInConfig holds LinkedIn OAuth configuration
type LinkedInConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// LinkedInOAuthService handles LinkedIn OAuth operations
type LinkedInOAuthService struct {
	authService    *AuthService
	userRepo       *repository.UserRepository
	oauthStateRepo *repository.OAuthStateRepository
	config         *LinkedInConfig
}

// LinkedInUser represents the user data returned by LinkedIn API
type LinkedInUser struct {
	Sub           string `json:"sub"` // LinkedIn user ID
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// LinkedInAccessToken represents the access token response from LinkedIn
type LinkedInAccessToken struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

// NewLinkedInOAuthService creates a new LinkedInOAuthService
func NewLinkedInOAuthService(authService *AuthService, userRepo *repository.UserRepository, oauthStateRepo *repository.OAuthStateRepository, config *LinkedInConfig) *LinkedInOAuthService {
	return &LinkedInOAuthService{
		authService:    authService,
		userRepo:       userRepo,
		oauthStateRepo: oauthStateRepo,
		config:         config,
	}
}

// IsConfigured returns true if LinkedIn OAuth is configured
func (s *LinkedInOAuthService) IsConfigured() bool {
	return s.config != nil && s.config.ClientID != "" && s.config.ClientSecret != ""
}

// GetAuthURL generates the LinkedIn OAuth authorization URL
func (s *LinkedInOAuthService) GetAuthURL() (string, string, error) {
	if !s.IsConfigured() {
		return "", "", ErrLinkedInOAuthNotConfigured
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

	// Build authorization URL using OpenID Connect
	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", s.config.ClientID)
	params.Set("redirect_uri", s.config.RedirectURI)
	params.Set("scope", "openid profile email")
	params.Set("state", state)

	authURL := fmt.Sprintf("https://www.linkedin.com/oauth/v2/authorization?%s", params.Encode())

	return authURL, state, nil
}

// ValidateState validates the OAuth state parameter
func (s *LinkedInOAuthService) ValidateState(ctx context.Context, state string) error {
	return s.oauthStateRepo.Validate(ctx, state)
}

// HandleCallback handles the LinkedIn OAuth callback
func (s *LinkedInOAuthService) HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, ErrLinkedInOAuthNotConfigured
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

	// Get LinkedIn user info
	linkedInUser, err := s.getLinkedInUser(accessToken)
	if err != nil {
		return nil, fmt.Errorf("getting LinkedIn user: %w", err)
	}

	// Try to find existing user by LinkedIn ID
	linkedInID := linkedInUser.Sub
	user, err := s.userRepo.GetByLinkedInID(ctx, linkedInID)
	if err == nil {
		// User found, generate token and return
		return s.generateAuthResponse(ctx, user)
	}

	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, fmt.Errorf("checking LinkedIn user: %w", err)
	}

	// User not found by LinkedIn ID, check if email exists
	if linkedInUser.Email != "" {
		existingUser, err := s.userRepo.GetByEmail(ctx, linkedInUser.Email)
		if err == nil {
			// User with this email exists, link LinkedIn account
			if err := s.userRepo.LinkLinkedInAccount(ctx, existingUser.ID, linkedInID, linkedInUser.Picture); err != nil {
				return nil, fmt.Errorf("linking LinkedIn account: %w", err)
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
	avatarURL := linkedInUser.Picture
	name := linkedInUser.Name
	if name == "" {
		name = fmt.Sprintf("%s %s", linkedInUser.GivenName, linkedInUser.FamilyName)
	}

	newUser := &model.User{
		Email:      linkedInUser.Email,
		Name:       strings.TrimSpace(name),
		LinkedInID: &linkedInID,
		AvatarURL:  &avatarURL,
	}

	// If no email from LinkedIn, use a placeholder
	if newUser.Email == "" {
		newUser.Email = fmt.Sprintf("%s@linkedin.local", linkedInID)
	}

	// If no name, use "LinkedIn User"
	if newUser.Name == "" {
		newUser.Name = "LinkedIn User"
	}

	if err := s.userRepo.CreateFromLinkedIn(ctx, newUser); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			return nil, fmt.Errorf("email already registered")
		}
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return s.generateAuthResponse(ctx, newUser)
}

// exchangeCodeForToken exchanges the authorization code for an access token
func (s *LinkedInOAuthService) exchangeCodeForToken(code string) (string, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("client_id", s.config.ClientID)
	data.Set("client_secret", s.config.ClientSecret)
	data.Set("redirect_uri", s.config.RedirectURI)

	req, err := http.NewRequest("POST", "https://www.linkedin.com/oauth/v2/accessToken", strings.NewReader(data.Encode()))
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
		return "", fmt.Errorf("LinkedIn token error: %s", string(body))
	}

	var tokenResp LinkedInAccessToken
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parsing token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token in response: %s", string(body))
	}

	return tokenResp.AccessToken, nil
}

// getLinkedInUser fetches the authenticated user's profile from LinkedIn
func (s *LinkedInOAuthService) getLinkedInUser(accessToken string) (*LinkedInUser, error) {
	// Use the OpenID Connect userinfo endpoint
	req, err := http.NewRequest("GET", "https://api.linkedin.com/v2/userinfo", nil)
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
		return nil, fmt.Errorf("LinkedIn API error: %s", string(body))
	}

	var user LinkedInUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// generateAuthResponse generates JWT tokens for a user
func (s *LinkedInOAuthService) generateAuthResponse(ctx context.Context, user *model.User) (*model.AuthResponse, error) {
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
func (s *LinkedInOAuthService) GetFrontendURL() string {
	if s.config != nil && s.config.FrontendURL != "" {
		return s.config.FrontendURL
	}
	return "http://localhost:5173"
}
