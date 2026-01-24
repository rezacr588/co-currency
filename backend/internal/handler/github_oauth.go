package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GitHubOAuthHandler handles GitHub OAuth endpoints
type GitHubOAuthHandler struct {
	githubService *service.GitHubOAuthService
}

// NewGitHubOAuthHandler creates a new GitHubOAuthHandler
func NewGitHubOAuthHandler(githubService *service.GitHubOAuthService) *GitHubOAuthHandler {
	return &GitHubOAuthHandler{githubService: githubService}
}

// serviceUnavailable returns true and sends an error response if GitHub service is not available
func (h *GitHubOAuthHandler) serviceUnavailable(w http.ResponseWriter) bool {
	if h.githubService == nil || !h.githubService.IsConfigured() {
		httputil.ServiceUnavailable(w, "GitHub OAuth not configured")
		return true
	}
	return false
}

// GetAuthURL handles GET /api/v1/auth/github
// Redirects to GitHub OAuth authorization page
func (h *GitHubOAuthHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	authURL, _, err := h.githubService.GetAuthURL()
	if err != nil {
		if errors.Is(err, service.ErrGitHubOAuthNotConfigured) {
			httputil.ServiceUnavailable(w, "GitHub OAuth not configured")
			return
		}
		httputil.InternalServerError(w, "failed to generate auth URL")
		return
	}

	// Redirect to GitHub
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles GET /api/v1/auth/github/callback
// Handles the OAuth callback from GitHub
func (h *GitHubOAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	frontendURL := h.githubService.GetFrontendURL()

	// Handle OAuth errors from GitHub
	if errorParam != "" {
		errorDesc := r.URL.Query().Get("error_description")
		redirectURL := fmt.Sprintf("%s/login?error=%s", frontendURL, url.QueryEscape(errorDesc))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	if code == "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s", frontendURL, url.QueryEscape("missing authorization code"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Handle the callback
	response, err := h.githubService.HandleCallback(r.Context(), code, state)
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", frontendURL, url.QueryEscape(err.Error()))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("%s/auth/github/callback?token=%s", frontendURL, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// LinkAccount handles POST /api/v1/auth/github/link
// Links GitHub account to the authenticated user
func (h *GitHubOAuthHandler) LinkAccount(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		httputil.BadRequest(w, "authorization code is required")
		return
	}

	if err := h.githubService.LinkGitHubAccount(r.Context(), userID, code); err != nil {
		if errors.Is(err, service.ErrGitHubAccountLinked) {
			httputil.BadRequest(w, "GitHub account already linked to another user")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, map[string]string{"message": "GitHub account linked successfully"})
}

// UnlinkAccount handles DELETE /api/v1/auth/github/link
// Unlinks GitHub account from the authenticated user
func (h *GitHubOAuthHandler) UnlinkAccount(w http.ResponseWriter, r *http.Request) {
	if h.githubService == nil {
		httputil.ServiceUnavailable(w, "GitHub OAuth not configured")
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	if err := h.githubService.UnlinkGitHubAccount(r.Context(), userID); err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, map[string]string{"message": "GitHub account unlinked successfully"})
}

// GetLinkURL handles GET /api/v1/auth/github/link
// Returns the GitHub OAuth URL for linking (for authenticated users)
func (h *GitHubOAuthHandler) GetLinkURL(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	_, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	authURL, _, err := h.githubService.GetAuthURL()
	if err != nil {
		httputil.InternalServerError(w, "failed to generate auth URL")
		return
	}

	httputil.Success(w, map[string]string{"url": authURL})
}
