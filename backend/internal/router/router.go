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
	Todo          *handler.TodoHandler
	Task          *handler.TaskHandler
	Tag           *handler.TagHandler
	Budget        *handler.BudgetHandler
	Recurring     *handler.RecurringHandler
	Reports       *handler.ReportsHandler
	Subscription  *handler.SubscriptionHandler
	Badge         *handler.BadgeHandler
	Note          *handler.NoteHandler
	Loan          *handler.LoanHandler
	Notification  *handler.NotificationHandler
	Challenge     *handler.ChallengeHandler
	XP            *handler.XPHandler
	News          *handler.NewsHandler
}

// New creates a new router with all routes configured
func New(h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth, staticFS fs.FS) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Trace)    // Generate trace ID first
	r.Use(middleware.Recovery) // Catch panics
	r.Use(middleware.Logging)  // Logging will include trace ID
	r.Use(middleware.CORS)
	r.Use(middleware.Security)

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

		// News routes (public)
		if h.News != nil {
			r.Get("/news", h.News.GetNews)
		}

		// Auth routes (public)
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
			r.Post("/categories", h.Wallet.CreateCategory)
			r.Delete("/categories/{id}", h.Wallet.DeleteCategory)
		})

		// AI routes
		r.Route("/ai", func(r chi.Router) {
			// Status endpoint is public
			r.Get("/status", h.AI.GetStatus)

			// All other AI endpoints require authentication and AI rate limiting
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				if rateLimiter != nil {
					r.Use(rateLimiter.AIMiddleware)
				}
				// Parse endpoints now require auth to prevent abuse
				r.Post("/parse-receipt", h.AI.ParseReceipt)
				r.Post("/parse-text", h.AI.ParseReceiptText)
				r.Post("/detect-intent", h.AI.DetectIntent)
				r.Post("/smart-parse", h.AI.SmartParse)
				r.Post("/apply-parsed", h.AI.ApplyParsed)
				r.Post("/apply-recurring", h.AI.ApplyRecurring)
				r.Post("/apply-goal-contribution", h.AI.ApplyGoalContribution)
				r.Get("/advice", h.AI.GetPersonalizedAdvice)

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
				r.Get("/types", h.Goal.GetGoalTypes)
				r.Get("/categories", h.Goal.GetGoalCategories)
				r.Get("/{id}", h.Goal.GetGoal)
				r.Put("/{id}", h.Goal.UpdateGoal)
				r.Delete("/{id}", h.Goal.DeleteGoal)
				r.Post("/{id}/contribute", h.Goal.ContributeToGoal)
			})
		}

		// Tasks routes (protected)
		if h.Task != nil {
			r.Route("/tasks", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Task.GetTasks)
				r.Post("/", h.Task.CreateTask)
				r.Get("/statuses", h.Task.GetTaskStatuses)
				r.Get("/priorities", h.Task.GetTaskPriorities)
				r.Get("/{id}", h.Task.GetTask)
				r.Put("/{id}", h.Task.UpdateTask)
				r.Delete("/{id}", h.Task.DeleteTask)
				r.Post("/{id}/complete", h.Task.CompleteTask)
			})
		}

		// Unified todo list routes (protected)
		if h.Todo != nil {
			r.Route("/todo", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Todo.GetTodoList)
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
				r.Get("/health-score", h.Reports.GetHealthScore)
				r.Get("/weekly-recap", h.Reports.GetWeeklyRecap)
				r.Get("/cashflow", h.Reports.GetCashFlowProjection)
				r.Get("/anomalies", h.Reports.GetSpendingAnomalies)
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
				r.Get("/transaction/{transactionId}", h.Note.GetNotesByTransaction)
				r.Get("/{id}", h.Note.GetNote)
				r.Put("/{id}", h.Note.UpdateNote)
				r.Delete("/{id}", h.Note.DeleteNote)
				r.Post("/{id}/pin", h.Note.TogglePin)
			})
		}

		// Loans/Debts routes (protected)
		if h.Loan != nil {
			r.Route("/loans", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/", h.Loan.GetAllLoans)
				r.Post("/", h.Loan.CreateLoan)
				r.Get("/summary", h.Loan.GetSummary)
				r.Get("/upcoming", h.Loan.GetUpcoming)
				r.Get("/{id}", h.Loan.GetLoan)
				r.Put("/{id}", h.Loan.UpdateLoan)
				r.Delete("/{id}", h.Loan.DeleteLoan)
				r.Post("/{id}/payment", h.Loan.MakePayment)
				r.Get("/{id}/payments", h.Loan.GetPayments)
			})
		}

		// Notifications routes (protected)
		if h.Notification != nil {
			r.Route("/notifications", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Post("/register", h.Notification.RegisterToken)
				r.Post("/unregister", h.Notification.UnregisterToken)
				r.Get("/preferences", h.Notification.GetPreferences)
				r.Put("/preferences", h.Notification.UpdatePreferences)
				r.Post("/check-budgets", h.Notification.CheckBudgets)
				r.Post("/check-loans", h.Notification.CheckLoans)
			})
		}

		// Challenges routes (gamification)
		if h.Challenge != nil {
			r.Route("/challenges", func(r chi.Router) {
				// Public: list all challenges
				r.Get("/", h.Challenge.GetAllChallenges)
				r.Get("/featured", h.Challenge.GetFeaturedChallenges)

				// Protected: user-specific challenge routes
				r.Group(func(r chi.Router) {
					r.Use(authMiddleware.Middleware)
					r.Get("/browse", h.Challenge.GetChallengesWithStatus)
					r.Post("/join", h.Challenge.JoinChallenge)
					r.Get("/active", h.Challenge.GetActiveChallenges)
					r.Get("/history", h.Challenge.GetChallengeHistory)
					r.Get("/stats", h.Challenge.GetChallengeStats)
					r.Post("/check-progress", h.Challenge.CheckProgress)
					r.Delete("/{id}/abandon", h.Challenge.AbandonChallenge)
				})
			})
		}

		// XP and gamification routes (protected)
		if h.XP != nil {
			r.Route("/xp", func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/stats", h.XP.GetStats)
				r.Get("/history", h.XP.GetHistory)
				r.Get("/level", h.XP.GetLevelInfo)
				r.Post("/daily-reward", h.XP.ClaimDailyReward)
				r.Get("/daily-reward/status", h.XP.GetDailyRewardStatus)
				r.Get("/leaderboard", h.XP.GetLeaderboard)
			})
		}
	})

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"), //The url pointing to API definition
	))

	// Serve embedded static files (Expo web export)
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
