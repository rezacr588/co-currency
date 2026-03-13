package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrGoogleOAuthNotConfigured = errors.New("Google OAuth not configured")
	ErrGoogleOAuthFailed        = errors.New("Google OAuth failed")
	ErrGoogleAccountLinked      = errors.New("Google account already linked to another user")
)

// GoogleOAuthService handles Google OAuth operations.
type GoogleOAuthService struct {
	baseOAuthService
}

// GoogleUser represents the user data returned by Google API.
type GoogleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// NewGoogleOAuthService creates a new GoogleOAuthService.
func NewGoogleOAuthService(authService *AuthService, userRepo *repository.UserRepository, oauthStateRepo *repository.OAuthStateRepository, config *GoogleConfig) *GoogleOAuthService {
	return &GoogleOAuthService{
		baseOAuthService: baseOAuthService{
			authService:    authService,
			userRepo:       userRepo,
			oauthStateRepo: oauthStateRepo,
			config: &OAuthProviderConfig{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				RedirectURI:  config.RedirectURI,
				FrontendURL:  config.FrontendURL,
				AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL:     "https://oauth2.googleapis.com/token",
				Scopes:       []string{"openid", "email", "profile"},
				ExtraParams:  map[string]string{"access_type": "offline", "prompt": "consent"},
			},
		},
	}
}

// GoogleConfig holds Google OAuth configuration.
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// HandleCallback handles the Google OAuth callback.
func (s *GoogleOAuthService) HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, ErrGoogleOAuthNotConfigured
	}

	// Validate state via shared base
	if err := s.validateOAuthState(ctx, state); err != nil {
		return nil, err
	}

	// Exchange code for access token via shared base
	accessToken, err := s.exchangeCodeForToken(code)
	if err != nil {
		return nil, fmt.Errorf("exchanging code for token: %w", err)
	}

	// Get Google user info (provider-specific)
	googleUser, err := s.getGoogleUser(accessToken)
	if err != nil {
		return nil, fmt.Errorf("getting Google user: %w", err)
	}

	// Try to find existing user by Google ID
	googleID := googleUser.ID
	user, err := s.userRepo.GetByGoogleID(ctx, googleID)
	if err == nil {
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

	if newUser.Email == "" {
		newUser.Email = fmt.Sprintf("%s@google.local", googleID)
	}
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

// getGoogleUser fetches the authenticated user's profile from Google (provider-specific).
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
