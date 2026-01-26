package handler

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/rezacr588/currency-converter/internal/service"
)

// GoogleOAuthHandler handles Google OAuth endpoints
type GoogleOAuthHandler struct {
	googleService *service.GoogleOAuthService
	frontendURL   string
}

// NewGoogleOAuthHandler creates a new GoogleOAuthHandler
func NewGoogleOAuthHandler(googleService *service.GoogleOAuthService, frontendURL string) *GoogleOAuthHandler {
	return &GoogleOAuthHandler{
		googleService: googleService,
		frontendURL:   frontendURL,
	}
}

// GetAuthURL handles GET /api/v1/auth/google
// Redirects to Google OAuth authorization page
func (h *GoogleOAuthHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if h.googleService == nil || !h.googleService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("Google OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	authURL, _, err := h.googleService.GetAuthURL()
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(err.Error()))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to Google
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles GET /api/v1/auth/google/callback
// Handles the OAuth callback from Google
func (h *GoogleOAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.googleService == nil || !h.googleService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("Google OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	// Handle OAuth errors from Google
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
	response, err := h.googleService.HandleCallback(r.Context(), code, state)
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(err.Error()))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("%s/auth/google/callback?token=%s", h.frontendURL, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
