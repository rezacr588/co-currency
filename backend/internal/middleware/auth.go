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
		// Get the Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			httputil.Unauthorized(w, "missing authorization header")
			return
		}

		// Check for Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			httputil.Unauthorized(w, "invalid authorization header format")
			return
		}

		tokenString := parts[1]

		// Validate the token
		claims, err := a.authService.ValidateToken(tokenString)
		if err != nil {
			switch err {
			case service.ErrTokenExpired:
				httputil.Unauthorized(w, "token expired")
			case service.ErrInvalidToken:
				httputil.Unauthorized(w, "invalid token")
			default:
				httputil.Unauthorized(w, "authentication failed")
			}
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
