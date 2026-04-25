package middleware

import (
	"net/http"
	"strings"

	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// RequireAdmin gates a handler to requests authenticated as the configured
// admin email. Must be chained AFTER an auth middleware that populates the
// user_email context value.
//
// Returns 403 Forbidden when:
//   - adminEmail is empty (admin endpoints disabled)
//   - the authenticated user's email doesn't match adminEmail (case-insensitive)
//
// The match is case-insensitive on both sides because email addresses are
// case-insensitive per RFC 5321 §2.4 (local-part) — and the user table stores
// emails lowercased on insert. We compare lowercased to be safe regardless.
func RequireAdmin(adminEmail string) func(http.Handler) http.Handler {
	wantEmail := strings.ToLower(strings.TrimSpace(adminEmail))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if wantEmail == "" {
				httputil.Forbidden(w, "admin endpoints disabled")
				return
			}
			gotEmail, ok := GetUserEmailFromContext(r.Context())
			if !ok || strings.ToLower(strings.TrimSpace(gotEmail)) != wantEmail {
				httputil.Forbidden(w, "admin access required")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
