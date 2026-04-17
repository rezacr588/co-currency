package handler

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

const mobileScheme = "coai://"

// oauthPostMessageTemplate renders a minimal same-origin HTML page that
// delivers OAuth tokens to window.opener via postMessage, then closes.
// This replaces URL-fragment token delivery for web clients, which could
// leak JWTs into browser history and (in some browsers) Referer headers.
var oauthPostMessageTemplate = template.Must(template.New("oauth").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<p>Signing you in…</p>
<script>
(function () {
  var payload = {
    type: "coai:oauth",
    token: {{.Token}},
    refresh_token: {{.RefreshToken}},
    error: {{.Error}}
  };
  try {
    if (window.opener) {
      window.opener.postMessage(payload, {{.Origin}});
    }
  } catch (e) {}
  window.close();
})();
</script>
</body>
</html>`))

// oauthPostMessageData is the template input. String fields are HTML-escaped
// by html/template so a malicious provider response can't inject script.
type oauthPostMessageData struct {
	Token        string
	RefreshToken string
	Error        string
	Origin       string
}

// frontendOrigin returns scheme://host for the configured FrontendURL.
// Returns empty string if parsing fails, which prevents rendering rather
// than falling back to "*" (which would allow any parent window to read
// the token).
func (h *OAuthHandler) frontendOrigin() string {
	u, err := url.Parse(h.frontendURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// renderOAuthPostMessage serves the postMessage HTML page. Call only for web.
func (h *OAuthHandler) renderOAuthPostMessage(w http.ResponseWriter, data oauthPostMessageData) {
	// COOP allows window.opener to remain accessible to the popup; without
	// it modern browsers null the reference and postMessage silently fails.
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if err := oauthPostMessageTemplate.Execute(w, data); err != nil {
		log.Error().Err(err).Msg("Failed to render OAuth postMessage template")
	}
}

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

	if isMobile {
		// Native: keep URL fragment on the coai:// deep link — deep links
		// aren't exposed to the same log/history surfaces as web URLs.
		redirectURL := fmt.Sprintf("%s%s#token=%s", mobileScheme, h.callbackPath, url.QueryEscape(response.Token))
		if response.RefreshToken != "" {
			redirectURL += fmt.Sprintf("&refresh_token=%s", url.QueryEscape(response.RefreshToken))
		}
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Web: deliver tokens to window.opener via postMessage rather than URL
	// fragment to avoid leaking them into browser history or Referer headers.
	origin := h.frontendOrigin()
	if origin == "" {
		h.redirectErrorForPlatform(w, r, "authentication_failed", false)
		return
	}
	h.renderOAuthPostMessage(w, oauthPostMessageData{
		Token:        response.Token,
		RefreshToken: response.RefreshToken,
		Origin:       origin,
	})
}

func (h *OAuthHandler) redirectError(w http.ResponseWriter, r *http.Request, msg string) {
	h.redirectErrorForPlatform(w, r, msg, false)
}

func (h *OAuthHandler) redirectErrorForPlatform(w http.ResponseWriter, r *http.Request, msg string, isMobile bool) {
	if isMobile {
		redirectURL := fmt.Sprintf("%s/login?error=%s", mobileScheme, url.QueryEscape(msg))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	// Web: surface errors via postMessage so the popup flow can display them
	// without navigating the parent window.
	origin := h.frontendOrigin()
	if origin == "" {
		// Fall back to the query-string redirect when the frontend URL is
		// misconfigured, so operators still see the error instead of a
		// blank page. Tokens are never returned on this path.
		redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(msg))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}
	h.renderOAuthPostMessage(w, oauthPostMessageData{
		Error:  msg,
		Origin: origin,
	})
}
