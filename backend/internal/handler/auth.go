package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *service.AuthService
	rateLimiter *middleware.RateLimiter
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// SetRateLimiter wires a rate limiter for per-email throttles on endpoints
// like password reset. Safe to call with nil to leave disabled.
func (h *AuthHandler) SetRateLimiter(rl *middleware.RateLimiter) {
	h.rateLimiter = rl
}

// Register handles POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	req, ok := decodeJSON[model.RegisterRequest](w, r)
	if !ok {
		return
	}

	response, err := h.authService.Register(r.Context(), req)
	if err != nil {
		// Return the specific error message from the service
		httputil.BadRequestWithContext(r.Context(), w, err.Error())
		return
	}

	httputil.Created(w, response)
}

// Login handles POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	req, ok := decodeJSON[model.LoginRequest](w, r)
	if !ok {
		return
	}

	response, err := h.authService.Login(r.Context(), req)
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

	req, ok := decodeJSON[model.ForgotPasswordRequest](w, r)
	if !ok {
		return
	}

	if req.Email == "" {
		httputil.BadRequestWithContext(r.Context(), w, "email is required")
		return
	}

	// Throttle per-email to prevent targeted spam of a single inbox (the
	// IP-based LoginMiddleware already throttles bulk enumeration). Return the
	// same opaque success message on throttle to avoid leaking which emails
	// are registered.
	if h.rateLimiter != nil && !h.rateLimiter.AllowPerKey("reset", req.Email) {
		httputil.Success(w, map[string]string{
			"message": "If an account exists with this email, a password reset link has been sent",
		})
		return
	}

	// Generate reset token and send email (service handles email delivery via Resend)
	// Always return success to not leak email existence
	_, err := h.authService.GeneratePasswordResetToken(r.Context(), req.Email)
	if err != nil {
		// Log error but don't expose to user - token generation or email send failed
		httputil.Success(w, map[string]string{
			"message": "If an account exists with this email, a password reset link has been sent",
		})
		return
	}

	httputil.Success(w, map[string]string{
		"message": "If an account exists with this email, a password reset link has been sent",
	})
}

// ResetPassword handles POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	req, ok := decodeJSON[model.ResetPasswordRequest](w, r)
	if !ok {
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

// IssueWSTicket handles POST /api/v1/auth/ws-ticket. Requires a valid JWT
// and returns a short-lived single-use ticket that the web client presents
// when opening a WebSocket connection. Keeps the JWT out of query strings
// and server access logs.
func (h *AuthHandler) IssueWSTicket(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	ticket, err := h.authService.IssueWSTicket(userID)
	if err != nil {
		httputil.ServiceUnavailableWithContext(r.Context(), w, "websocket tickets not available")
		return
	}

	httputil.Success(w, map[string]string{"ticket": ticket})
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

	req, ok := decodeJSON[model.UpdateProfileRequest](w, r)
	if !ok {
		return
	}

	if req.Email == nil && req.Name == nil && req.AvatarURL == nil {
		httputil.BadRequestWithContext(r.Context(), w, "no profile fields provided")
		return
	}

	user, err := h.authService.UpdateProfile(r.Context(), userID, req)
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

	req, ok := decodeJSON[model.ChangePasswordRequest](w, r)
	if !ok {
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

// DeleteAccount handles DELETE /api/v1/auth/account
func (h *AuthHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	req, ok := decodeJSON[model.DeleteAccountRequest](w, r)
	if !ok {
		return
	}

	if err := h.authService.DeleteAccount(r.Context(), userID, req.Password); err != nil {
		if strings.Contains(err.Error(), "invalid password") {
			httputil.UnauthorizedWithContext(r.Context(), w, "invalid password")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete account")
		return
	}

	httputil.Success(w, map[string]string{"message": "account deleted successfully"})
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	req, ok := decodeJSON[model.RefreshTokenRequest](w, r)
	if !ok {
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

// CompleteOnboarding handles POST /api/v1/auth/onboarding/complete
func (h *AuthHandler) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.authService != nil, "authentication service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	if err := h.authService.SetOnboardingCompleted(r.Context(), userID); err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to complete onboarding", err)
		return
	}

	user, err := h.authService.GetUserByID(r.Context(), userID)
	if err != nil {
		httputil.NotFoundWithContext(r.Context(), w, "user not found")
		return
	}

	httputil.Success(w, user.ToProfile())
}
