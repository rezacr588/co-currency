package router

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
	httpSwagger "github.com/swaggo/http-swagger"
)

// Handlers holds all HTTP handlers for the application
type Handlers struct {
	Exchange      *handler.Handler
	Auth          *handler.AuthHandler
	LinkedInOAuth *handler.LinkedInOAuthHandler
	GoogleOAuth   *handler.GoogleOAuthHandler
	Wallet        *handler.WalletHandler
	AI            *handler.AIHandler
	AIChat        *handler.AIChatHandler
	Goal          *handler.GoalHandler
	Tag           *handler.TagHandler
	Budget        *handler.BudgetHandler
	Recurring     *handler.RecurringHandler
	Reports       *handler.ReportsHandler
	Subscription  *handler.SubscriptionHandler
	Badge         *handler.BadgeHandler
	Note          *handler.NoteHandler
}

// New creates a new router with all routes configured
func New(h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth, staticFS fs.FS) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Trace)    // Generate trace ID first
	r.Use(middleware.Recovery) // Catch panics
	r.Use(middleware.Logging)  // Logging will include trace ID
	r.Use(middleware.CORS)

	// Health check (no rate limiting)
	r.Get("/health", h.Exchange.Health)
	r.Get("/health/detailed", h.Exchange.HealthDetailed)

	// API routes with selective rate limiting
	r.Route("/api/v1", func(r chi.Router) {
		// Apply rate limiting to API routes (re-enabled with proper configuration)
		if rateLimiter != nil {
			r.Use(rateLimiter.Middleware)
		}

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
				r.Post("/onboarding/complete", h.Auth.CompleteOnboarding)
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
			r.Post("/transactions/import", h.Wallet.ImportTransactions)
			r.Get("/transactions/export", h.Wallet.ExportTransactions)
			r.Get("/transactions/{id}", h.Wallet.GetTransaction)
			r.Put("/transactions/{id}", h.Wallet.UpdateTransaction)
			r.Delete("/transactions/{id}", h.Wallet.DeleteTransaction)
			r.Get("/categories", h.Wallet.GetCategories)
		})

		// AI routes
		r.Route("/ai", func(r chi.Router) {
			// Status endpoint is public
			r.Get("/status", h.AI.GetStatus)

			// All other AI endpoints require authentication
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				// Parse endpoints now require auth to prevent abuse
				r.Post("/parse-receipt", h.AI.ParseReceipt)
				r.Post("/parse-text", h.AI.ParseReceiptText)
				r.Post("/apply-parsed", h.AI.ApplyParsed)

				// AI Chat routes (protected)
				if h.AIChat != nil {
					h.AIChat.RegisterRoutes(r)
				}
			})
		})

		// Goals routes (protected)
		if h.Goal != nil {
			r.Route("/goals", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Goal.GetGoals)
				r.Post("/", h.Goal.CreateGoal)
				r.Get("/categories", h.Goal.GetGoalCategories)
				r.Get("/{id}", h.Goal.GetGoal)
				r.Put("/{id}", h.Goal.UpdateGoal)
				r.Delete("/{id}", h.Goal.DeleteGoal)
				r.Post("/{id}/contribute", h.Goal.ContributeToGoal)
			})
		}

		// Tags routes (protected)
		if h.Tag != nil {
			r.Route("/tags", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Tag.GetTags)
				r.Post("/", h.Tag.CreateTag)
				r.Delete("/{id}", h.Tag.DeleteTag)
			})
		}

		// Budgets routes (protected)
		if h.Budget != nil {
			r.Route("/budgets", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Budget.GetBudgets)
				r.Post("/", h.Budget.CreateBudget)
				r.Put("/{id}", h.Budget.UpdateBudget)
				r.Delete("/{id}", h.Budget.DeleteBudget)
			})
		}

		// Recurring transactions routes (protected)
		if h.Recurring != nil {
			r.Route("/recurring", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Recurring.GetRecurring)
				r.Get("/frequencies", h.Recurring.GetFrequencies)
				r.Post("/", h.Recurring.CreateRecurring)
				r.Put("/{id}", h.Recurring.UpdateRecurring)
				r.Delete("/{id}", h.Recurring.DeleteRecurring)
				r.Post("/{id}/execute", h.Recurring.ExecuteRecurring)
			})
		}

		// Reports routes (protected)
		if h.Reports != nil {
			r.Route("/reports", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/monthly", h.Reports.GetMonthlyReport)
				r.Get("/yearly", h.Reports.GetYearlyReport)
				r.Get("/category", h.Reports.GetCategoryReport)
				r.Get("/trends", h.Reports.GetTrendsReport)
				r.Get("/networth", h.Reports.GetNetWorthReport)
				r.Get("/forecast", h.Reports.GetForecast)
				r.Get("/insights", h.Reports.GetInsights)
			})
		}

		// Subscriptions routes (protected)
		if h.Subscription != nil {
			r.Route("/subscriptions", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Subscription.GetSubscriptions)
				r.Post("/", h.Subscription.CreateSubscription)
				r.Get("/summary", h.Subscription.GetSubscriptionSummary)
				r.Get("/upcoming", h.Subscription.GetUpcomingRenewals)
				r.Get("/billing-cycles", h.Subscription.GetBillingCycles)
				r.Get("/categories", h.Subscription.GetCategories)
				r.Get("/{id}", h.Subscription.GetSubscription)
				r.Put("/{id}", h.Subscription.UpdateSubscription)
				r.Delete("/{id}", h.Subscription.DeleteSubscription)
			})
		}

		// Badges routes
		if h.Badge != nil {
			r.Route("/badges", func(r chi.Router) {
				// Public: list all badges
				r.Get("/", h.Badge.GetAllBadges)

				// Protected: user-specific badge routes
				r.Group(func(r chi.Router) {
					r.Use(authMiddleware.Middleware)
					r.Get("/earned", h.Badge.GetEarnedBadges)
					r.Get("/progress", h.Badge.GetBadgeProgress)
					r.Post("/check", h.Badge.CheckBadges)
				})
			})
		}

		// Notes routes (protected)
		if h.Note != nil {
			r.Route("/notes", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Note.GetNotes)
				r.Post("/", h.Note.CreateNote)
				r.Get("/colors", h.Note.GetColors)
				r.Get("/{id}", h.Note.GetNote)
				r.Put("/{id}", h.Note.UpdateNote)
				r.Delete("/{id}", h.Note.DeleteNote)
				r.Post("/{id}/pin", h.Note.TogglePin)
			})
		}
	})

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"), //The url pointing to API definition
	))

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
