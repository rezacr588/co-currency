package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/router"
	"github.com/rezacr588/currency-converter/internal/service"

	// Swagger docs
	_ "github.com/rezacr588/currency-converter/docs"
)

// @title           CoFinance API
// @version         1.0
// @description     CoFinance is a personal finance management API with currency conversion, wallet management, budgets, goals, subscriptions, and achievement badges.
// @description
// @description     ## Features
// @description     - **Currency Conversion**: Real-time exchange rates with support for 30+ currencies including IRR
// @description     - **Wallet Management**: Multi-currency wallet with transaction tracking
// @description     - **Budgets**: Set and track spending budgets by category
// @description     - **Goals**: Create and track financial savings goals
// @description     - **Subscriptions**: Track recurring subscriptions and bills
// @description     - **Badges**: Earn achievement badges for financial milestones
// @description     - **AI Features**: Smart transaction parsing and categorization
// @description
// @description     ## Authentication
// @description     Most endpoints require JWT authentication. Include the token in the Authorization header:
// @description     `Authorization: Bearer <your-token>`

// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    https://github.com/rezacr588/currency-converter
// @contact.email  support@cofinance.app

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter your JWT token with the `Bearer ` prefix, e.g. "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// @tag.name Exchange
// @tag.description Currency exchange rate operations

// @tag.name Auth
// @tag.description User authentication and registration

// @tag.name Wallet
// @tag.description Multi-currency wallet and transaction management

// @tag.name Goals
// @tag.description Financial savings goals

// @tag.name Budgets
// @tag.description Budget tracking and management

// @tag.name Subscriptions
// @tag.description Recurring subscription and bill tracking

// @tag.name Badges
// @tag.description Achievement badges and gamification

// @tag.name AI
// @tag.description AI-powered features like transaction parsing

// @tag.name Reports
// @tag.description Financial reports and analytics

//go:embed static/*
var staticFiles embed.FS

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Setup logging
	setupLogging(cfg.Environment)

	log.Info().
		Str("environment", cfg.Environment).
		Str("port", cfg.Port).
		Msg("Starting Currency Converter API")

	// Initialize main database for users/wallet (if DATABASE_URL is configured)
	var mainDB *repository.Database
	var userRepo *repository.UserRepository
	var walletRepo *repository.WalletRepository

	// Initialize IRR database (if DATABASE_URL is configured)
	var irrDB *repository.IRRDatabase
	var irrCrawler *repository.IRRCrawler

	if cfg.DatabaseURL != "" {
		var err error

		// Initialize main database for users/wallet
		mainDB, err = repository.NewDatabase(cfg.DatabaseURL)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to main database, user/wallet features disabled")
		} else {
			log.Info().Msg("Connected to main database for users/wallet")
			userRepo = repository.NewUserRepository(mainDB)
			walletRepo = repository.NewWalletRepository(mainDB)
		}

		// Initialize IRR database
		irrDB, err = repository.NewIRRDatabase(cfg.DatabaseURL)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to IRR database, continuing without persistent storage")
		} else {
			log.Info().Msg("Connected to IRR rates database")
		}
	} else {
		log.Info().Msg("DATABASE_URL not configured, user/wallet features and IRR rates will use in-memory cache only")
	}

	// Initialize IRR client with database
	irrClient := repository.NewIRRClient(irrDB)

	// Start IRR crawler if enabled and database is available
	if cfg.IRRCrawlerEnabled && irrDB != nil {
		irrCrawler = repository.NewIRRCrawler(irrClient, irrDB, cfg.IRRCrawlerInterval)
		irrCrawler.Start()
		log.Info().
			Dur("interval", cfg.IRRCrawlerInterval).
			Msg("IRR rate crawler started")
	}

	// Initialize core dependencies
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	frankfurterClient := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	exchangeService := service.NewExchangeService(cfg, frankfurterClient, cache, irrClient)

	// Initialize auth service (requires database)
	var authService *service.AuthService
	var authMiddleware *middleware.Auth
	if userRepo != nil {
		authService = service.NewAuthService(userRepo, cfg.JWTSecret)
		authMiddleware = middleware.NewAuth(authService)
		log.Info().Msg("Authentication service initialized")
	} else {
		log.Warn().Msg("Authentication service not available - no database connection")
	}

	// Initialize wallet service (requires database and exchange service)
	var walletService *service.WalletService
	if walletRepo != nil {
		walletService = service.NewWalletService(walletRepo, exchangeService)
		log.Info().Msg("Wallet service initialized")
	} else {
		log.Warn().Msg("Wallet service not available - no database connection")
	}

	// Initialize AI service (optional)
	var aiService *service.AIService
	if cfg.AIAPIKey != "" {
		var err error
		aiService, err = service.NewAIService(cfg.AIProvider, cfg.AIAPIKey, cfg.AICloudProject)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to initialize AI service")
		} else {
			log.Info().Str("provider", cfg.AIProvider).Str("project", cfg.AICloudProject).Msg("AI service initialized")
		}
	} else {
		log.Info().Msg("AI_API_KEY not configured, AI features disabled")
	}

	// Initialize Phase 3 services (goals, tags, budgets, recurring, reports)
	var goalService *service.GoalService
	var tagService *service.TagService
	var budgetService *service.BudgetService
	var recurringService *service.RecurringService
	var reportsService *service.ReportsService

	// Initialize Phase 4 services (subscriptions, badges)
	var subscriptionService *service.SubscriptionService
	var badgeService *service.BadgeService

	if mainDB != nil {
		goalRepo := repository.NewGoalRepository(mainDB)
		goalService = service.NewGoalService(goalRepo)
		log.Info().Msg("Goal service initialized")

		tagRepo := repository.NewTagRepository(mainDB)
		tagService = service.NewTagService(tagRepo)
		log.Info().Msg("Tag service initialized")

		budgetRepo := repository.NewBudgetRepository(mainDB)
		budgetService = service.NewBudgetService(budgetRepo)
		log.Info().Msg("Budget service initialized")

		recurringRepo := repository.NewRecurringRepository(mainDB)
		recurringService = service.NewRecurringService(recurringRepo)
		log.Info().Msg("Recurring transaction service initialized")

		if walletRepo != nil {
			reportsService = service.NewReportsService(walletRepo, exchangeService)
			log.Info().Msg("Reports service initialized")
		}

		// Initialize subscription service
		subscriptionRepo := repository.NewSubscriptionRepository(mainDB)
		subscriptionService = service.NewSubscriptionService(subscriptionRepo)
		log.Info().Msg("Subscription service initialized")

		// Initialize badge service
		badgeRepo := repository.NewBadgeRepository(mainDB)
		// Initialize default badges in database
		if err := badgeRepo.InitDefaultBadges(context.Background()); err != nil {
			log.Warn().Err(err).Msg("Failed to initialize default badges")
		}
		badgeService = service.NewBadgeService(badgeRepo, walletRepo, budgetRepo, goalRepo, subscriptionRepo)
		log.Info().Msg("Badge service initialized")
	}

	// Initialize handlers
	exchangeHandler := handler.New(exchangeService)
	authHandler := handler.NewAuthHandler(authService)
	walletHandler := handler.NewWalletHandler(walletService)
	aiHandler := handler.NewAIHandler(aiService, walletService)

	// Initialize Phase 3 handlers
	var goalHandler *handler.GoalHandler
	var tagHandler *handler.TagHandler
	var budgetHandler *handler.BudgetHandler
	var recurringHandler *handler.RecurringHandler
	var reportsHandler *handler.ReportsHandler

	if goalService != nil {
		goalHandler = handler.NewGoalHandler(goalService)
	}
	if tagService != nil {
		tagHandler = handler.NewTagHandler(tagService)
	}
	if budgetService != nil {
		budgetHandler = handler.NewBudgetHandler(budgetService)
	}
	if recurringService != nil {
		recurringHandler = handler.NewRecurringHandler(recurringService)
	}
	if reportsService != nil {
		reportsHandler = handler.NewReportsHandler(reportsService)
	}

	// Initialize Phase 4 handlers
	var subscriptionHandler *handler.SubscriptionHandler
	var badgeHandler *handler.BadgeHandler

	if subscriptionService != nil {
		subscriptionHandler = handler.NewSubscriptionHandler(subscriptionService)
	}
	if badgeService != nil {
		badgeHandler = handler.NewBadgeHandler(badgeService)
	}

	handlers := &router.Handlers{
		Exchange:     exchangeHandler,
		Auth:         authHandler,
		Wallet:       walletHandler,
		AI:           aiHandler,
		Goal:         goalHandler,
		Tag:          tagHandler,
		Budget:       budgetHandler,
		Recurring:    recurringHandler,
		Reports:      reportsHandler,
		Subscription: subscriptionHandler,
		Badge:        badgeHandler,
	}

	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitPerMin)

	// Setup static file system
	var staticFS fs.FS
	if subFS, err := fs.Sub(staticFiles, "static"); err == nil {
		// Check if static folder has content
		entries, _ := fs.ReadDir(subFS, ".")
		if len(entries) > 0 {
			staticFS = subFS
			log.Info().Msg("Serving static frontend files")
		}
	}

	// Create router
	r := router.New(handlers, rateLimiter, authMiddleware, staticFS)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("Server listening")

	// Handle graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh

		log.Info().Msg("Shutting down...")

		// Stop crawler
		if irrCrawler != nil {
			irrCrawler.Stop()
		}

		// Close databases
		if irrDB != nil {
			if err := irrDB.Close(); err != nil {
				log.Error().Err(err).Msg("Error closing IRR database")
			}
		}
		if mainDB != nil {
			if err := mainDB.Close(); err != nil {
				log.Error().Err(err).Msg("Error closing main database")
			}
		}

		os.Exit(0)
	}()

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("Server failed")
	}
}

func setupLogging(environment string) {
	if environment == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
}
