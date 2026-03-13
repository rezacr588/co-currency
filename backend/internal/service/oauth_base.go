package service

import (
	"context"
	"encoding/json"
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

// OAuthProviderConfig describes the provider-specific endpoints and scopes
// needed by the shared OAuth flow.
type OAuthProviderConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
	AuthURL      string   // e.g. "https://accounts.google.com/o/oauth2/v2/auth"
	TokenURL     string   // e.g. "https://oauth2.googleapis.com/token"
	Scopes       []string // e.g. ["openid", "email", "profile"]
	ExtraParams  map[string]string // e.g. {"access_type": "offline", "prompt": "consent"}
}

// baseOAuthService contains the shared logic for all OAuth providers.
type baseOAuthService struct {
	authService    *AuthService
	userRepo       *repository.UserRepository
	oauthStateRepo *repository.OAuthStateRepository
	config         *OAuthProviderConfig
}

// IsConfigured returns true if the OAuth provider is configured.
func (b *baseOAuthService) IsConfigured() bool {
	return b.config != nil && b.config.ClientID != "" && b.config.ClientSecret != ""
}

// GetFrontendURL returns the frontend URL for redirects.
func (b *baseOAuthService) GetFrontendURL() string {
	if b.config != nil && b.config.FrontendURL != "" {
		return b.config.FrontendURL
	}
	return "http://localhost:5173"
}

// GetAuthURL generates the OAuth authorization URL with a CSRF state token.
func (b *baseOAuthService) GetAuthURL() (string, string, error) {
	if !b.IsConfigured() {
		return "", "", fmt.Errorf("OAuth not configured")
	}

	state := uuid.New().String()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	expiresAt := time.Now().Add(5 * time.Minute)
	if err := b.oauthStateRepo.Create(ctx, state, expiresAt); err != nil {
		log.Error().Err(err).Msg("failed to store OAuth state in database")
		return "", "", fmt.Errorf("storing OAuth state: %w", err)
	}

	// Cleanup expired states in background
	go func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		if err := b.oauthStateRepo.CleanupExpired(cleanupCtx); err != nil {
			log.Warn().Err(err).Msg("failed to cleanup expired OAuth states")
		}
	}()

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", b.config.ClientID)
	params.Set("redirect_uri", b.config.RedirectURI)
	params.Set("scope", strings.Join(b.config.Scopes, " "))
	params.Set("state", state)
	for k, v := range b.config.ExtraParams {
		params.Set(k, v)
	}

	authURL := fmt.Sprintf("%s?%s", b.config.AuthURL, params.Encode())
	return authURL, state, nil
}

// ValidateState validates the OAuth state parameter against the database.
func (b *baseOAuthService) ValidateState(ctx context.Context, state string) error {
	return b.oauthStateRepo.Validate(ctx, state)
}

// exchangeCodeForToken exchanges an authorization code for an access token.
func (b *baseOAuthService) exchangeCodeForToken(code string) (string, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("client_id", b.config.ClientID)
	data.Set("client_secret", b.config.ClientSecret)
	data.Set("redirect_uri", b.config.RedirectURI)

	req, err := http.NewRequest("POST", b.config.TokenURL, strings.NewReader(data.Encode()))
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
		return "", fmt.Errorf("token exchange error (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parsing token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token in response: %s", string(body))
	}

	return tokenResp.AccessToken, nil
}

// generateAuthResponse creates JWT tokens for a user after a successful OAuth login.
func (b *baseOAuthService) generateAuthResponse(ctx context.Context, user *model.User) (*model.AuthResponse, error) {
	// Reset failed attempts on successful OAuth login
	if err := b.userRepo.ResetFailedAttempts(ctx, user.ID); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to reset failed attempts")
	}

	token, err := b.authService.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}

	response := &model.AuthResponse{
		Token: token,
		User:  user,
	}

	if b.authService.refreshTokenRepo != nil {
		refreshToken := uuid.New().String()
		expiresAt := time.Now().Add(b.authService.refreshExpiry)
		if err := b.authService.refreshTokenRepo.Create(ctx, user.ID, refreshToken, expiresAt); err != nil {
			log.Error().Err(err).Str("user_id", user.ID.String()).Msg("failed to create refresh token")
		} else {
			response.RefreshToken = refreshToken
		}
	}

	return response, nil
}

// validateOAuthState wraps ValidateState with user-friendly error messages.
func (b *baseOAuthService) validateOAuthState(ctx context.Context, state string) error {
	if err := b.ValidateState(ctx, state); err != nil {
		if isOAuthStateNotFound(err) {
			return fmt.Errorf("invalid or expired state parameter")
		}
		if isOAuthStateExpired(err) {
			return fmt.Errorf("OAuth state has expired, please try again")
		}
		return fmt.Errorf("validating state: %w", err)
	}
	return nil
}

func isOAuthStateNotFound(err error) bool {
	return err != nil && err.Error() == repository.ErrOAuthStateNotFound.Error()
}

func isOAuthStateExpired(err error) bool {
	return err != nil && err.Error() == repository.ErrOAuthStateExpired.Error()
}
