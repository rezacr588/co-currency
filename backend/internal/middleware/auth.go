package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// ContextKey is a custom type for context keys
type ContextKey string

const (
	// UserIDKey is the context key for the authenticated user ID
	UserIDKey ContextKey = "user_id"
	// UserEmailKey is the context key for the authenticated user's email
	UserEmailKey ContextKey = "user_email"
)

// Auth middleware handles JWT authentication
type Auth struct {
	authService *service.AuthService
}

// NewAuth creates a new Auth middleware
func NewAuth(authService *service.AuthService) *Auth {
	return &Auth{authService: authService}
}

// Middleware returns an HTTP middleware that validates JWT tokens
func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract token
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			httputil.UnauthorizedWithContext(r.Context(), w, "missing authorization header", nil)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			httputil.UnauthorizedWithContext(r.Context(), w, "invalid authorization format", nil)
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := a.authService.ValidateToken(tokenString)
		if err != nil {
			if strings.Contains(err.Error(), "expired") {
				httputil.UnauthorizedWithContext(r.Context(), w, "token expired", err)
				return
			}
			if strings.Contains(err.Error(), "invalid") {
				httputil.UnauthorizedWithContext(r.Context(), w, "invalid token", err)
				return
			}
			httputil.UnauthorizedWithContext(r.Context(), w, "unauthorized", err)
			return
		}
		// Add user info to context
		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

		// Call the next handler with the updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return userID, ok
}

// GetUserEmailFromContext extracts the user email from the request context
func GetUserEmailFromContext(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(UserEmailKey).(string)
	return email, ok
}
