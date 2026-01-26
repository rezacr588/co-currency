package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GitHubOAuthHandler handles GitHub OAuth endpoints
type GitHubOAuthHandler struct {
	githubService *service.GitHubOAuthService
	frontendURL   string
}

// NewGitHubOAuthHandler creates a new GitHubOAuthHandler
func NewGitHubOAuthHandler(githubService *service.GitHubOAuthService, frontendURL string) *GitHubOAuthHandler {
	return &GitHubOAuthHandler{
		githubService: githubService,
		frontendURL:   frontendURL,
	}
}

// GetAuthURL handles GET /api/v1/auth/github
// Redirects to GitHub OAuth authorization page
func (h *GitHubOAuthHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if h.githubService == nil || !h.githubService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("GitHub OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	authURL, _, err := h.githubService.GetAuthURL()
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(err.Error()))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to GitHub
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles GET /api/v1/auth/github/callback
// Handles the OAuth callback from GitHub
func (h *GitHubOAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.githubService == nil || !h.githubService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("GitHub OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	// Handle OAuth errors from GitHub
	if errorParam != "" {
		errorDesc := r.URL.Query().Get("error_description")
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(errorDesc))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	if code == "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("missing authorization code"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Handle the callback
	response, err := h.githubService.HandleCallback(r.Context(), code, state)
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(err.Error()))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("%s/auth/github/callback?token=%s", h.frontendURL, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// LinkAccount handles POST /api/v1/auth/github/link
// Links GitHub account to the authenticated user
func (h *GitHubOAuthHandler) LinkAccount(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.githubService != nil && h.githubService.IsConfigured(), "GitHub OAuth not configured") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		httputil.BadRequestWithContext(r.Context(), w, "authorization code is required", nil)
		return
	}

	if err := h.githubService.LinkGitHubAccount(r.Context(), userID, code); err != nil {
		if errors.Is(err, service.ErrGitHubAccountLinked) {
			httputil.BadRequestWithContext(r.Context(), w, "GitHub account already linked to another user", err)
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to link GitHub account", err)
		return
	}

	httputil.Success(w, map[string]string{"message": "GitHub account linked successfully"})
}

// UnlinkAccount handles DELETE /api/v1/auth/github/link
// Unlinks GitHub account from the authenticated user
func (h *GitHubOAuthHandler) UnlinkAccount(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.githubService != nil && h.githubService.IsConfigured(), "GitHub OAuth not configured") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	if err := h.githubService.UnlinkGitHubAccount(r.Context(), userID); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "failed to unlink GitHub account", err)
		return
	}

	httputil.Success(w, map[string]string{"message": "GitHub account unlinked successfully"})
}

// GetLinkURL handles GET /api/v1/auth/github/link
// Returns the GitHub OAuth URL for linking (for authenticated users)
func (h *GitHubOAuthHandler) GetLinkURL(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.githubService != nil && h.githubService.IsConfigured(), "GitHub OAuth not configured") {
		return
	}

	if _, ok := requireUserID(w, r); !ok {
		return
	}

	authURL, _, err := h.githubService.GetAuthURL()
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate auth URL", err)
		return
	}

	httputil.Success(w, map[string]string{"url": authURL})
}
