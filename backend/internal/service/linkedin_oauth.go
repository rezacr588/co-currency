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
	ErrLinkedInOAuthNotConfigured = errors.New("LinkedIn OAuth not configured")
	ErrLinkedInOAuthFailed        = errors.New("LinkedIn OAuth failed")
	ErrLinkedInAccountLinked      = errors.New("LinkedIn account already linked to another user")
)

// LinkedInConfig holds LinkedIn OAuth configuration.
type LinkedInConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// LinkedInOAuthService handles LinkedIn OAuth operations.
type LinkedInOAuthService struct {
	baseOAuthService
}

// LinkedInUser represents the user data returned by LinkedIn API.
type LinkedInUser struct {
	Sub           string `json:"sub"` // LinkedIn user ID
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// NewLinkedInOAuthService creates a new LinkedInOAuthService.
func NewLinkedInOAuthService(authService *AuthService, userRepo *repository.UserRepository, oauthStateRepo *repository.OAuthStateRepository, config *LinkedInConfig) *LinkedInOAuthService {
	return &LinkedInOAuthService{
		baseOAuthService: baseOAuthService{
			authService:    authService,
			userRepo:       userRepo,
			oauthStateRepo: oauthStateRepo,
			config: &OAuthProviderConfig{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				RedirectURI:  config.RedirectURI,
				FrontendURL:  config.FrontendURL,
				AuthURL:      "https://www.linkedin.com/oauth/v2/authorization",
				TokenURL:     "https://www.linkedin.com/oauth/v2/accessToken",
				Scopes:       []string{"openid", "profile", "email"},
			},
		},
	}
}

// HandleCallback handles the LinkedIn OAuth callback.
func (s *LinkedInOAuthService) HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error) {
	if !s.IsConfigured() {
		return nil, ErrLinkedInOAuthNotConfigured
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

	// Get LinkedIn user info (provider-specific)
	linkedInUser, err := s.getLinkedInUser(accessToken)
	if err != nil {
		return nil, fmt.Errorf("getting LinkedIn user: %w", err)
	}

	// Try to find existing user by LinkedIn ID
	linkedInID := linkedInUser.Sub
	user, err := s.userRepo.GetByLinkedInID(ctx, linkedInID)
	if err == nil {
		return s.generateAuthResponse(ctx, user)
	}

	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, fmt.Errorf("checking LinkedIn user: %w", err)
	}

	// User not found by LinkedIn ID, check if email exists
	if linkedInUser.Email != "" {
		existingUser, err := s.userRepo.GetByEmail(ctx, linkedInUser.Email)
		if err == nil {
			if err := s.userRepo.LinkLinkedInAccount(ctx, existingUser.ID, linkedInID, linkedInUser.Picture); err != nil {
				return nil, fmt.Errorf("linking LinkedIn account: %w", err)
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

	if newUser.Email == "" {
		newUser.Email = fmt.Sprintf("%s@linkedin.local", linkedInID)
	}
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

// getLinkedInUser fetches the authenticated user's profile from LinkedIn (provider-specific).
func (s *LinkedInOAuthService) getLinkedInUser(accessToken string) (*LinkedInUser, error) {
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
		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			body = []byte("(read error)")
		}
		return nil, fmt.Errorf("LinkedIn API error: %s", string(body))
	}

	var user LinkedInUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}
