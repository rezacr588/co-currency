package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// registerAuthRoutes registers the /auth route group including public auth
// endpoints, login-rate-limited endpoints, OAuth routes, and protected
// profile/password/onboarding endpoints.
func registerAuthRoutes(r chi.Router, h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Auth.Register)
		r.Post("/login", h.Auth.Login)
		// Apply login rate limiter to password reset endpoints to prevent abuse
		r.Group(func(r chi.Router) {
			if rateLimiter != nil {
				r.Use(rateLimiter.LoginMiddleware)
			}
			r.Post("/forgot-password", h.Auth.ForgotPassword)
			r.Post("/reset-password", h.Auth.ResetPassword)
		})
		r.Post("/refresh", h.Auth.RefreshToken)
		r.Post("/logout", h.Auth.Logout)

		// LinkedIn OAuth routes (public)
		if h.LinkedInOAuth != nil {
			r.Get("/linkedin", h.LinkedInOAuth.GetAuthURL)
			r.Get("/linkedin/callback", h.LinkedInOAuth.Callback)
		}

		// Google OAuth routes (public)
		if h.GoogleOAuth != nil {
			r.Get("/google", h.GoogleOAuth.GetAuthURL)
			r.Get("/google/callback", h.GoogleOAuth.Callback)
		}

		// Protected auth routes
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/profile", h.Auth.GetProfile)
			r.Put("/profile", h.Auth.UpdateProfile)
			r.Post("/password", h.Auth.ChangePassword)
			r.Delete("/account", h.Auth.DeleteAccount)
			r.Post("/onboarding/complete", h.Auth.CompleteOnboarding)
		})
	})
}
