package handler

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/rezacr588/currency-converter/internal/service"
)

// LinkedInOAuthHandler handles LinkedIn OAuth endpoints
type LinkedInOAuthHandler struct {
	linkedInService *service.LinkedInOAuthService
	frontendURL     string
}

// NewLinkedInOAuthHandler creates a new LinkedInOAuthHandler
func NewLinkedInOAuthHandler(linkedInService *service.LinkedInOAuthService, frontendURL string) *LinkedInOAuthHandler {
	return &LinkedInOAuthHandler{
		linkedInService: linkedInService,
		frontendURL:     frontendURL,
	}
}

// GetAuthURL handles GET /api/v1/auth/linkedin
// Redirects to LinkedIn OAuth authorization page
func (h *LinkedInOAuthHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if h.linkedInService == nil || !h.linkedInService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("LinkedIn OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	authURL, _, err := h.linkedInService.GetAuthURL()
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("authentication_failed"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to LinkedIn
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles GET /api/v1/auth/linkedin/callback
// Handles the OAuth callback from LinkedIn
func (h *LinkedInOAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.linkedInService == nil || !h.linkedInService.IsConfigured() {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("LinkedIn OAuth not configured"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	// Handle OAuth errors from LinkedIn
	if errorParam != "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("authentication_failed"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	if code == "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("missing authorization code"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Handle the callback
	response, err := h.linkedInService.HandleCallback(r.Context(), code, state)
	if err != nil {
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape("authentication_failed"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Redirect to frontend with token in URL fragment (#) instead of query params (?)
	// Fragments are not sent to servers in Referer headers, reducing token leakage risk.
	redirectURL := fmt.Sprintf("%s/auth/linkedin/callback#token=%s", h.frontendURL, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
