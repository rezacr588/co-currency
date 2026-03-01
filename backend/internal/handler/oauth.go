package handler

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/rezacr588/currency-converter/internal/model"
)

// OAuthProvider abstracts an OAuth service (Google, LinkedIn, etc.).
type OAuthProvider interface {
	IsConfigured() bool
	GetAuthURL() (string, string, error)
	HandleCallback(ctx context.Context, code, state string) (*model.AuthResponse, error)
}

// OAuthHandler handles OAuth endpoints for any provider.
type OAuthHandler struct {
	provider     OAuthProvider
	providerName string // e.g. "Google", "LinkedIn"
	callbackPath string // e.g. "/auth/google/callback"
	frontendURL  string
}

// NewOAuthHandler creates a new OAuthHandler for the given provider.
func NewOAuthHandler(provider OAuthProvider, providerName, callbackPath, frontendURL string) *OAuthHandler {
	return &OAuthHandler{
		provider:     provider,
		providerName: providerName,
		callbackPath: callbackPath,
		frontendURL:  frontendURL,
	}
}

// GetAuthURL redirects to the provider's OAuth authorization page.
func (h *OAuthHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if h.provider == nil || !h.provider.IsConfigured() {
		h.redirectError(w, r, h.providerName+" OAuth not configured")
		return
	}

	authURL, _, err := h.provider.GetAuthURL()
	if err != nil {
		h.redirectError(w, r, "authentication_failed")
		return
	}

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles the OAuth callback from the provider.
func (h *OAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.provider == nil || !h.provider.IsConfigured() {
		h.redirectError(w, r, h.providerName+" OAuth not configured")
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	if errorParam != "" {
		h.redirectError(w, r, "authentication_failed")
		return
	}

	if code == "" {
		h.redirectError(w, r, "missing authorization code")
		return
	}

	response, err := h.provider.HandleCallback(r.Context(), code, state)
	if err != nil || response == nil {
		h.redirectError(w, r, "authentication_failed")
		return
	}

	redirectURL := fmt.Sprintf("%s%s#token=%s", h.frontendURL, h.callbackPath, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *OAuthHandler) redirectError(w http.ResponseWriter, r *http.Request, msg string) {
	redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(msg))
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
