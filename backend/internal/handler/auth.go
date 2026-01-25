package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
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

// Register handles POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	var req model.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	response, err := h.authService.Register(r.Context(), &req)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "registration failed")
		return
	}

	httputil.Created(w, response)
}

// Login handles POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	response, err := h.authService.Login(r.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			httputil.UnauthorizedWithContext(r.Context(), w, "invalid email or password")
			return
		}
		if errors.Is(err, service.ErrAccountLocked) {
			httputil.TooManyRequestsWithContext(r.Context(), w, "account temporarily locked")
			return
		}
		// Check if it's an account locked error with time info (wrapped error)
		if strings.Contains(err.Error(), "account is temporarily locked") {
			httputil.TooManyRequestsWithContext(r.Context(), w, "account locked")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "login failed")
		return
	}

	httputil.Success(w, response)
}

// ForgotPassword handles POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	var req model.ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	if req.Email == "" {
		httputil.BadRequestWithContext(r.Context(), w, "email is required")
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
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	var req model.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	if req.Token == "" || req.NewPassword == "" {
		httputil.BadRequestWithContext(r.Context(), w, "token and new_password are required")
		return
	}

	if err := h.authService.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		if err == service.ErrInvalidResetToken {
			httputil.BadRequestWithContext(r.Context(), w, "invalid or expired reset token")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "password reset failed")
		return
	}

	httputil.Success(w, map[string]string{
		"message": "password reset successfully",
	})
}

// GetProfile handles GET /api/v1/auth/profile
func (h *AuthHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	user, err := h.authService.GetUserByID(r.Context(), userID)
	if err != nil {
		httputil.NotFoundWithContext(r.Context(), w, "user not found")
		return
	}

	httputil.Success(w, user.ToProfile())
}

// UpdateProfile handles PUT /api/v1/auth/profile
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	if req.Email == nil && req.Name == nil && req.AvatarURL == nil {
		httputil.BadRequestWithContext(r.Context(), w, "no profile fields provided")
		return
	}

	user, err := h.authService.UpdateProfile(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			httputil.BadRequestWithContext(r.Context(), w, "email already registered")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "profile update failed")
		return
	}

	httputil.Success(w, user.ToProfile())
}

// ChangePassword handles POST /api/v1/auth/password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	if strings.TrimSpace(req.NewPassword) == "" {
		httputil.BadRequestWithContext(r.Context(), w, "new_password is required")
		return
	}

	if err := h.authService.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			httputil.UnauthorizedWithContext(r.Context(), w, "current password is incorrect")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error())
		return
	}

	httputil.Success(w, map[string]string{"message": "password updated"})
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	var req model.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		httputil.BadRequestWithContext(r.Context(), w, "refresh_token is required")
		return
	}

	response, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		if err == service.ErrInvalidToken {
			httputil.UnauthorizedWithContext(r.Context(), w, "invalid refresh token")
			return
		}
		if err == service.ErrTokenExpired {
			httputil.UnauthorizedWithContext(r.Context(), w, "refresh token expired")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to refresh token")
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
