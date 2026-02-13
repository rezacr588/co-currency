package middleware

import (
	"net/http"
	"os"
	"strings"
)

// allowedOrigins returns the list of origins permitted for CORS.
// It reads FRONTEND_URL from the environment and always includes
// common localhost origins for development.
func allowedOrigins() []string {
	origins := []string{
		"http://localhost:5173",
		"http://localhost:8080",
		"http://localhost:3000",
	}
	if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
		origins = append(origins, frontendURL)
	}
	return origins
}

// isOriginAllowed checks whether the given origin is in the allowed list.
func isOriginAllowed(origin string, allowed []string) bool {
	for _, o := range allowed {
		if strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}

// CORS adds CORS headers to responses.
// Only origins in the allowed list are reflected back; all others are
// rejected (no Access-Control-Allow-Origin header is set).
func CORS(next http.Handler) http.Handler {
	allowed := allowedOrigins()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" && isOriginAllowed(origin, allowed) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
