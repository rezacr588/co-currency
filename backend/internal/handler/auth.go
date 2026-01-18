package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// serviceUnavailable returns true and sends an error response if auth service is not available
func (h *AuthHandler) serviceUnavailable(w http.ResponseWriter) bool {
	if h.authService == nil {
		httputil.ServiceUnavailable(w, "authentication service not available - database connection failed")
		return true
	}
	return false
}

// Register handles POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	var req model.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	response, err := h.authService.Register(r.Context(), &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, response)
}

// Login handles POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	response, err := h.authService.Login(r.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			httputil.Unauthorized(w, "invalid email or password")
			return
		}
		if errors.Is(err, service.ErrAccountLocked) {
			httputil.TooManyRequests(w, "account temporarily locked due to too many failed login attempts")
			return
		}
		// Check if it's an account locked error with time info (wrapped error)
		if strings.Contains(err.Error(), "account is temporarily locked") {
			httputil.TooManyRequests(w, err.Error())
			return
		}
		httputil.InternalServerError(w, "login failed")
		return
	}

	httputil.Success(w, response)
}

// ForgotPassword handles POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	var req model.ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Email == "" {
		httputil.BadRequest(w, "email is required")
		return
	}

	// Generate reset token (always return success to not leak email existence)
	token, err := h.authService.GeneratePasswordResetToken(r.Context(), req.Email)
	if err != nil {
		// Log error but don't expose to user
		httputil.Success(w, map[string]string{
			"message": "If an account exists with this email, a password reset link has been sent",
		})
		return
	}

	// In a real app, you would send an email here with the token
	// For security, never expose the token in the API response
	// TODO: Implement email service to send reset link with token
	_ = token // Token should be sent via email, not exposed in response
	httputil.Success(w, map[string]string{
		"message": "If an account exists with this email, a password reset link has been sent",
	})
}

// ResetPassword handles POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	var req model.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Token == "" || req.NewPassword == "" {
		httputil.BadRequest(w, "token and new_password are required")
		return
	}

	if err := h.authService.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		if err == service.ErrInvalidResetToken {
			httputil.BadRequest(w, "invalid or expired reset token")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, map[string]string{
		"message": "password reset successfully",
	})
}

// GetProfile handles GET /api/v1/auth/profile
func (h *AuthHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	user, err := h.authService.GetUserByID(r.Context(), userID)
	if err != nil {
		httputil.NotFound(w, "user not found")
		return
	}

	httputil.Success(w, user.ToProfile())
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	var req model.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		httputil.BadRequest(w, "refresh_token is required")
		return
	}

	response, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		if err == service.ErrInvalidToken {
			httputil.Unauthorized(w, "invalid refresh token")
			return
		}
		if err == service.ErrTokenExpired {
			httputil.Unauthorized(w, "refresh token expired")
			return
		}
		httputil.InternalServerError(w, "failed to refresh token")
		return
	}

	httputil.Success(w, response)
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Logout is idempotent, so if service is unavailable, just return success
	if h.authService == nil {
		httputil.Success(w, map[string]string{"message": "logged out successfully"})
		return
	}

	var req model.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// If no body, just return success (logout is idempotent)
		httputil.Success(w, map[string]string{"message": "logged out successfully"})
		return
	}

	if req.RefreshToken != "" {
		// Try to revoke the refresh token
		_ = h.authService.Logout(r.Context(), req.RefreshToken)
	}

	httputil.Success(w, map[string]string{"message": "logged out successfully"})
}
