package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

var (
	ErrGitHubOAuthNotConfigured = errors.New("GitHub OAuth not configured")
	ErrGitHubOAuthFailed        = errors.New("GitHub OAuth failed")
	ErrGitHubAccountLinked      = errors.New("GitHub account already linked to another user")
)

// GitHubConfig holds GitHub OAuth configuration
type GitHubConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// GitHubOAuthService handles GitHub OAuth operations
type GitHubOAuthService struct {
	authService *AuthService
	userRepo    *repository.UserRepository
	config      *GitHubConfig
	stateStore  map[string]time.Time // simple in-memory state store
	stateMutex  sync.Mutex
}

// GitHubUser represents the user data returned by GitHub API
type GitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// GitHubAccessToken represents the access token response from GitHub
type GitHubAccessToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

// NewGitHubOAuthService creates a new GitHubOAuthService
func NewGitHubOAuthService(authService *AuthService, userRepo *repository.UserRepository, config *GitHubConfig) *GitHubOAuthService {
	return &GitHubOAuthService{
		authService: authService,
		userRepo:    userRepo,
		config:      config,
		stateStore:  make(map[string]time.Time),
	}
}

// IsConfigured returns true if GitHub OAuth is configured
func (s *GitHubOAuthService) IsConfigured() bool {
	return s.config != nil && s.config.ClientID != "" && s.config.ClientSecret != ""
}

// GetAuthURL generates the GitHub OAuth authorization URL
func (s *GitHubOAuthService) GetAuthURL() (string, string, error) {
	if !s.IsConfigured() {
		return "", "", ErrGitHubOAuthNotConfigured
	}

	// Generate a random state token
	state := uuid.New().String()

	s.stateMutex.Lock()
	// Store state with expiry (5 minutes)
	s.stateStore[state] = time.Now().Add(5 * time.Minute)

	// Clean up expired states
	s.cleanupExpiredStates()
	s.stateMutex.Unlock()

	// Build authorization URL
	params := url.Values{}
	params.Set("client_id", s.config.ClientID)
	params.Set("redirect_uri", s.config.RedirectURI)
	params.Set("scope", "user:email")
	params.Set("state", state)

	authURL := fmt.Sprintf("https://github.com/login/oauth/authorize?%s", params.Encode())

	return authURL, state, nil
}

// ValidateState validates the OAuth state parameter
func (s *GitHubOAuthService) ValidateState(state string) bool {
	s.stateMutex.Lock()
	defer s.stateMutex.Unlock()

	expiry, exists := s.stateStore[state]
	if !exists {
		return false
	}

	// Remove the state (one-time use)
	delete(s.stateStore, state)

	// Check if expired
	return time.Now().Before(expiry)
}

// HandleCallback handles the GitHub OAuth callback
func (s *GitHubOAuthService) HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, ErrGitHubOAuthNotConfigured
	}

	// Validate state
	if !s.ValidateState(state) {
		return nil, fmt.Errorf("invalid or expired state parameter")
	}

	// Exchange code for access token
	accessToken, err := s.exchangeCodeForToken(code)
	if err != nil {
		return nil, fmt.Errorf("exchanging code for token: %w", err)
	}

	// Get GitHub user info
	githubUser, err := s.getGitHubUser(accessToken)
	if err != nil {
		return nil, fmt.Errorf("getting GitHub user: %w", err)
	}

	// Try to find existing user by GitHub ID
	githubID := strconv.Itoa(githubUser.ID)
	user, err := s.userRepo.GetByGitHubID(ctx, githubID)
	if err == nil {
		// User found, generate token and return
		return s.generateAuthResponse(ctx, user)
	}

	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, fmt.Errorf("checking GitHub user: %w", err)
	}

	// User not found by GitHub ID, check if email exists
	if githubUser.Email != "" {
		existingUser, err := s.userRepo.GetByEmail(ctx, githubUser.Email)
		if err == nil {
			// User with this email exists, link GitHub account
			if err := s.userRepo.LinkGitHubAccount(ctx, existingUser.ID, githubID, githubUser.AvatarURL); err != nil {
				return nil, fmt.Errorf("linking GitHub account: %w", err)
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
	avatarURL := githubUser.AvatarURL
	newUser := &model.User{
		Email:     githubUser.Email,
		Name:      githubUser.Name,
		GithubID:  &githubID,
		AvatarURL: &avatarURL,
	}

	// If no email from GitHub, use a placeholder
	if newUser.Email == "" {
		newUser.Email = fmt.Sprintf("%s@github.local", githubUser.Login)
	}

	// If no name, use login
	if newUser.Name == "" {
		newUser.Name = githubUser.Login
	}

	if err := s.userRepo.CreateFromGitHub(ctx, newUser); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			return nil, fmt.Errorf("email already registered")
		}
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return s.generateAuthResponse(ctx, newUser)
}

// LinkGitHubAccount links a GitHub account to an existing authenticated user
func (s *GitHubOAuthService) LinkGitHubAccount(ctx context.Context, userID uuid.UUID, code string) error {
	if !s.IsConfigured() {
		return ErrGitHubOAuthNotConfigured
	}

	// Exchange code for access token
	accessToken, err := s.exchangeCodeForToken(code)
	if err != nil {
		return fmt.Errorf("exchanging code for token: %w", err)
	}

	// Get GitHub user info
	githubUser, err := s.getGitHubUser(accessToken)
	if err != nil {
		return fmt.Errorf("getting GitHub user: %w", err)
	}

	githubID := strconv.Itoa(githubUser.ID)

	// Check if this GitHub account is already linked to another user
	existingUser, err := s.userRepo.GetByGitHubID(ctx, githubID)
	if err == nil && existingUser.ID != userID {
		return ErrGitHubAccountLinked
	}

	// Link the account
	return s.userRepo.LinkGitHubAccount(ctx, userID, githubID, githubUser.AvatarURL)
}

// UnlinkGitHubAccount removes GitHub link from a user
func (s *GitHubOAuthService) UnlinkGitHubAccount(ctx context.Context, userID uuid.UUID) error {
	return s.userRepo.UnlinkGitHubAccount(ctx, userID)
}

// exchangeCodeForToken exchanges the authorization code for an access token
func (s *GitHubOAuthService) exchangeCodeForToken(code string) (string, error) {
	data := url.Values{}
	data.Set("client_id", s.config.ClientID)
	data.Set("client_secret", s.config.ClientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", s.config.RedirectURI)

	req, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

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

	var tokenResp GitHubAccessToken
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parsing token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token in response: %s", string(body))
	}

	return tokenResp.AccessToken, nil
}

// getGitHubUser fetches the authenticated user's profile from GitHub
func (s *GitHubOAuthService) getGitHubUser(accessToken string) (*GitHubUser, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API error: %s", string(body))
	}

	var user GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	// If email is not public, try to get it from emails endpoint
	if user.Email == "" {
		email, err := s.getGitHubUserEmail(accessToken)
		if err != nil {
			log.Warn().Err(err).Msg("failed to get GitHub user email")
		} else {
			user.Email = email
		}
	}

	return &user, nil
}

// getGitHubUserEmail fetches the user's primary email from GitHub
func (s *GitHubOAuthService) getGitHubUserEmail(accessToken string) (string, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get emails: status %d", resp.StatusCode)
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", err
	}

	// Find primary verified email
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}

	// Fall back to any verified email
	for _, e := range emails {
		if e.Verified {
			return e.Email, nil
		}
	}

	return "", fmt.Errorf("no verified email found")
}

// generateAuthResponse generates JWT tokens for a user
func (s *GitHubOAuthService) generateAuthResponse(ctx context.Context, user *model.User) (*model.AuthResponse, error) {
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

// cleanupExpiredStates removes expired state tokens
// NOTE: This must be called while holding stateMutex lock
func (s *GitHubOAuthService) cleanupExpiredStates() {
	now := time.Now()
	for state, expiry := range s.stateStore {
		if now.After(expiry) {
			delete(s.stateStore, state)
		}
	}
}

// GetFrontendURL returns the frontend URL for redirects
func (s *GitHubOAuthService) GetFrontendURL() string {
	if s.config != nil && s.config.FrontendURL != "" {
		return s.config.FrontendURL
	}
	return "http://localhost:5173"
}
