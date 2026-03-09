package handler

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
)

const mobileScheme = "coai://"

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

	// If platform=mobile, encode it in the OAuth state so the callback
	// can redirect back to the native app via custom URL scheme.
	if r.URL.Query().Get("platform") == "mobile" {
		if parsed, parseErr := url.Parse(authURL); parseErr == nil {
			q := parsed.Query()
			q.Set("state", q.Get("state")+":mobile")
			parsed.RawQuery = q.Encode()
			authURL = parsed.String()
		}
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

	// Detect mobile platform from state suffix
	isMobile := strings.HasSuffix(state, ":mobile")
	if isMobile {
		state = strings.TrimSuffix(state, ":mobile")
	}

	if errorParam != "" {
		h.redirectErrorForPlatform(w, r, "authentication_failed", isMobile)
		return
	}

	if code == "" {
		h.redirectErrorForPlatform(w, r, "missing authorization code", isMobile)
		return
	}

	response, err := h.provider.HandleCallback(r.Context(), code, state)
	if err != nil || response == nil {
		h.redirectErrorForPlatform(w, r, "authentication_failed", isMobile)
		return
	}

	baseURL := h.frontendURL
	if isMobile {
		baseURL = mobileScheme
	}

	redirectURL := fmt.Sprintf("%s%s#token=%s", baseURL, h.callbackPath, url.QueryEscape(response.Token))
	if response.RefreshToken != "" {
		redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *OAuthHandler) redirectError(w http.ResponseWriter, r *http.Request, msg string) {
	h.redirectErrorForPlatform(w, r, msg, false)
}

func (h *OAuthHandler) redirectErrorForPlatform(w http.ResponseWriter, r *http.Request, msg string, isMobile bool) {
	baseURL := h.frontendURL
	if isMobile {
		baseURL = mobileScheme
	}
	redirectURL := fmt.Sprintf("%s/login?error=%s", baseURL, url.QueryEscape(msg))
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
