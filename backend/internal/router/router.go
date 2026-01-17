package router

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// Handlers holds all HTTP handlers for the application
type Handlers struct {
	Exchange *handler.Handler
	Auth     *handler.AuthHandler
	Wallet   *handler.WalletHandler
	AI       *handler.AIHandler
}

// New creates a new router with all routes configured
func New(h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth, staticFS fs.FS) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logging)
	r.Use(middleware.CORS)

	// Health check (no rate limiting)
	r.Get("/health", h.Exchange.Health)
	r.Get("/health/detailed", h.Exchange.HealthDetailed)

	// API routes with rate limiting
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(rateLimiter.Middleware)

		// Public exchange routes
		r.Get("/currencies", h.Exchange.GetCurrencies)
		r.Get("/rates/{base}", h.Exchange.GetRates)
		r.Get("/convert", h.Exchange.Convert)
		r.Get("/historical/{date}", h.Exchange.GetHistorical)

		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Auth.Register)
			r.Post("/login", h.Auth.Login)
			r.Post("/forgot-password", h.Auth.ForgotPassword)
			r.Post("/reset-password", h.Auth.ResetPassword)
			r.Post("/refresh", h.Auth.RefreshToken)
			r.Post("/logout", h.Auth.Logout)

			// Protected auth routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/profile", h.Auth.GetProfile)
			})
		})

		// Wallet routes (protected)
		r.Route("/wallet", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/balances", h.Wallet.GetBalances)
			r.Get("/summary", h.Wallet.GetSummary)
			r.Post("/transaction", h.Wallet.AddTransaction)
			r.Post("/convert", h.Wallet.ConvertBalance)
			r.Get("/transactions", h.Wallet.GetTransactions)
			r.Get("/transactions/export", h.Wallet.ExportTransactions)
			r.Get("/categories", h.Wallet.GetCategories)
		})

		// AI routes
		r.Route("/ai", func(r chi.Router) {
			// Status endpoint is public
			r.Get("/status", h.AI.GetStatus)

			// Parse endpoints don't require auth (for testing)
			r.Post("/parse-receipt", h.AI.ParseReceipt)
			r.Post("/parse-text", h.AI.ParseReceiptText)

			// Apply requires authentication
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Post("/apply-parsed", h.AI.ApplyParsed)
			})
		})
	})

	// Serve static files (frontend)
	if staticFS != nil {
		fileServer := http.FileServer(http.FS(staticFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file directly
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			// Check if file exists
			if _, err := fs.Stat(staticFS, path); err != nil {
				// File doesn't exist, serve index.html for SPA routing
				r.URL.Path = "/"
				path = "index.html"
			}

			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}
