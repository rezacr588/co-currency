package router

import (
	"io/fs"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// Handlers holds all HTTP handlers for the application
type Handlers struct {
	Exchange      *handler.Handler
	Auth          *handler.AuthHandler
	LinkedInOAuth *handler.OAuthHandler
	GoogleOAuth   *handler.OAuthHandler
	Wallet        *handler.WalletHandler
	CoAI          *handler.CoAIHandler
	AI            *handler.AIHandler
	AIChat        *handler.AIChatHandler
	Goal          *handler.GoalHandler
	Todo          *handler.TodoHandler
	Task          *handler.TaskHandler
	Planner       *handler.PlannerHandler
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
	Wealth        *handler.WealthHandler
	News          *handler.NewsHandler
	Forecasting   *handler.ForecastingHandler
	Agent         *handler.AgentHandler
	DNA           *handler.FinancialDNAHandler
	Social        *handler.SocialHandler
	Crypto        *handler.CryptoHandler
	WebSocket     *handler.WebSocketHandler
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

	// Health, swagger, and static file serving
	registerPublicRoutes(r, h, staticFS)

	// API routes with selective rate limiting
	r.Route("/api/v1", func(api chi.Router) {
		if rateLimiter != nil {
			api.Use(rateLimiter.Middleware)
		}

		registerPublicAPIRoutes(api, h)
		registerAuthRoutes(api, h, rateLimiter, authMiddleware)
		registerWalletRoutes(api, h, authMiddleware)
		registerFeatureRoutes(api, h, rateLimiter, authMiddleware)
	})

	return r
}
