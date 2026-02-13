package middleware

import (
	"net/http"
	"os"
)

// Security adds security-related HTTP headers to all responses.
// HSTS is only set when ENVIRONMENT is not "development".
func Security(next http.Handler) http.Handler {
	isDev := os.Getenv("ENVIRONMENT") == "development"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		if !isDev {
			// max-age=31536000 = 1 year; includeSubDomains ensures all subdomains use HTTPS
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		next.ServeHTTP(w, r)
	})
}
