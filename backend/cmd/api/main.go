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

	"github.com/joho/godotenv"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/router"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"

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
	// Load .env file if it exists
	_ = godotenv.Load()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Setup logging
	setupLogging(cfg.Environment)
	httputil.SetExposeErrorDetails(cfg.ExposeErrorDetails)

	// Security check for production
	if cfg.Environment == "production" && (cfg.JWTSecret == "" || cfg.JWTSecret == "change-me-in-production-to-a-secure-secret") {
		log.Fatal().Msg("JWT_SECRET must be set to a secure value in production")
	}

	log.Info().
		Str("environment", cfg.Environment).
		Str("port", cfg.Port).
		Msg("Starting Currency Converter API")

	// Initialize main database for users/wallet (if DATABASE_URL is configured)
	var mainDB *repository.Database
	var userRepo *repository.UserRepository
	var walletRepo *repository.WalletRepository
	var loanRepo *repository.LoanRepository

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
	var linkedInOAuthService *service.LinkedInOAuthService
	var googleOAuthService *service.GoogleOAuthService
	if userRepo != nil {
		// Create refresh token repository for better token management
		refreshTokenRepo := repository.NewRefreshTokenRepository(mainDB)
		authService = service.NewAuthServiceWithRefresh(userRepo, refreshTokenRepo, cfg.JWTSecret)
		authMiddleware = middleware.NewAuth(authService)
		log.Info().Msg("Authentication service initialized")

		// Create OAuth state repository (shared by all OAuth providers)
		oauthStateRepo := repository.NewOAuthStateRepository(mainDB)

		// Initialize LinkedIn OAuth service if configured
		if cfg.LinkedInClientID != "" && cfg.LinkedInClientSecret != "" {
			linkedInConfig := &service.LinkedInConfig{
				ClientID:     cfg.LinkedInClientID,
				ClientSecret: cfg.LinkedInClientSecret,
				RedirectURI:  cfg.LinkedInRedirectURI,
				FrontendURL:  cfg.FrontendURL,
			}
			linkedInOAuthService = service.NewLinkedInOAuthService(authService, userRepo, oauthStateRepo, linkedInConfig)
			log.Info().Msg("LinkedIn OAuth service initialized with database-backed state storage")
		} else {
			log.Info().Msg("LinkedIn OAuth not configured (LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET not set)")
		}

		// Initialize Google OAuth service if configured
		if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
			googleConfig := &service.GoogleConfig{
				ClientID:     cfg.GoogleClientID,
				ClientSecret: cfg.GoogleClientSecret,
				RedirectURI:  cfg.GoogleRedirectURI,
				FrontendURL:  cfg.FrontendURL,
			}
			googleOAuthService = service.NewGoogleOAuthService(authService, userRepo, oauthStateRepo, googleConfig)
			log.Info().Msg("Google OAuth service initialized with database-backed state storage")
		} else {
			log.Info().Msg("Google OAuth not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set)")
		}
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
		aiService, err = service.NewAIService(cfg.AIProvider, cfg.AIAPIKey, cfg.AIModel, cfg.AICloudProject)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to initialize AI service")
		} else {
			log.Info().
				Str("provider", aiService.GetProvider()).
				Str("project", cfg.AICloudProject).
				Msg("AI service initialized")
		}
	} else {
		log.Info().Msg("AI_API_KEY not configured, AI features disabled")
	}

	// Initialize Phase 3 services (goals, tags, budgets, recurring, reports)
	var goalService *service.GoalService
	var tagService *service.TagService
	var categoryService *service.CategoryService
	var budgetService *service.BudgetService
	var recurringService *service.RecurringService
	var reportsService *service.ReportsService

	// Initialize Phase 4 services (subscriptions, badges)
	var subscriptionService *service.SubscriptionService
	var badgeService *service.BadgeService

	// Notes service
	var noteService *service.NoteService

	// Loans service
	var loanService *service.LoanService

	// Notification service
	var notificationService *service.NotificationService

	// Challenge service
	var challengeService *service.ChallengeService

	// XP service
	var xpService *service.XPService

	// AI Chat service
	var aiChatService *service.AIChatService

	if mainDB != nil {
		goalRepo := repository.NewGoalRepository(mainDB)
		goalService = service.NewGoalService(goalRepo)
		log.Info().Msg("Goal service initialized")

		tagRepo := repository.NewTagRepository(mainDB)
		tagService = service.NewTagService(tagRepo)
		log.Info().Msg("Tag service initialized")

		categoryRepo := repository.NewCategoryRepository(mainDB)
		if err := categoryRepo.InitDefaultCategories(context.Background()); err != nil {
			log.Warn().Err(err).Msg("Failed to initialize default categories")
		}
		categoryService = service.NewCategoryService(categoryRepo)
		log.Info().Msg("Category service initialized")

		budgetRepo := repository.NewBudgetRepository(mainDB)
		budgetService = service.NewBudgetService(budgetRepo)
		log.Info().Msg("Budget service initialized")

		recurringRepo := repository.NewRecurringRepository(mainDB)
		recurringService = service.NewRecurringService(recurringRepo)
		log.Info().Msg("Recurring transaction service initialized")

		if walletRepo != nil {
			reportsService = service.NewReportsService(walletRepo, exchangeService, aiService)
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

		// Initialize note service
		noteRepo := repository.NewNoteRepository(mainDB)
		noteService = service.NewNoteService(noteRepo, walletRepo)
		log.Info().Msg("Note service initialized")

		// Initialize loan service
		loanRepo = repository.NewLoanRepository(mainDB.Pool())
		loanService = service.NewLoanService(loanRepo)
		log.Info().Msg("Loan service initialized")

		// Initialize notification service
		notificationRepo := repository.NewNotificationRepository(mainDB.Pool())
		notificationService = service.NewNotificationService(notificationRepo, budgetRepo, loanRepo)
		log.Info().Msg("Notification service initialized")

		// Initialize challenge service
		challengeRepo := repository.NewChallengeRepository(mainDB)
		challengeService = service.NewChallengeService(challengeRepo, walletRepo, budgetRepo)
		log.Info().Msg("Challenge service initialized")

		// Initialize XP service
		xpRepo := repository.NewXPRepository(mainDB.Pool())
		xpService = service.NewXPService(xpRepo)
		log.Info().Msg("XP service initialized")

		// Initialize AI Chat service (requires AI service, wallet, goals, budgets, user, recurring, memory)
		if aiService != nil {
			chatRepo := repository.NewChatRepository(mainDB.Pool())
			memoryRepo := repository.NewMemoryRepository(mainDB)
			// Initialize memory schema
			if err := memoryRepo.InitSchema(context.Background()); err != nil {
				log.Warn().Err(err).Msg("Failed to initialize memory schema")
			}

			// Initialize Qdrant and embedding services for semantic memory (optional)
			var memoryService *service.MemoryService
			if cfg.QdrantEnabled && cfg.QdrantURL != "" {
				// Initialize Qdrant client
				qdrantClient, err := repository.NewQdrantClient(repository.QdrantConfig{
					URL:        cfg.QdrantURL,
					APIKey:     cfg.QdrantAPIKey,
					Dimensions: uint64(cfg.EmbeddingDimensions),
				})
				if err != nil {
					log.Warn().Err(err).Msg("Failed to initialize Qdrant client, semantic memory disabled")
				} else {
					log.Info().
						Str("url", cfg.QdrantURL).
						Int("dimensions", cfg.EmbeddingDimensions).
						Msg("Qdrant client initialized")

					// Initialize embedding service
					embeddingService, err := service.NewEmbeddingService(service.EmbeddingConfig{
						Provider:   service.EmbeddingProvider(cfg.EmbeddingProvider),
						APIKey:     cfg.EmbeddingAPIKey,
						Model:      cfg.EmbeddingModel,
						Dimensions: cfg.EmbeddingDimensions,
						OllamaURL:  cfg.OllamaURL,
					})
					if err != nil {
						log.Warn().Err(err).Msg("Failed to initialize embedding service, semantic memory disabled")
						qdrantClient.Close()
					} else {
						log.Info().
							Str("provider", cfg.EmbeddingProvider).
							Str("model", cfg.EmbeddingModel).
							Msg("Embedding service initialized")

						// Initialize vector memory repository
						vectorMemoryRepo := repository.NewVectorMemoryRepository(qdrantClient, cfg.ShortTermMemoryTTL)

						// Initialize memory service (orchestrates PostgreSQL + Qdrant)
						memoryService = service.NewMemoryService(
							memoryRepo,
							vectorMemoryRepo,
							embeddingService,
							cfg.MaxMemoryResults,
						)
						log.Info().Msg("Memory service initialized with semantic search (Qdrant)")
					}
				}
			} else {
				// Qdrant disabled, use PostgreSQL-only memory service
				memoryService = service.NewMemoryService(memoryRepo, nil, nil, cfg.MaxMemoryResults)
				log.Info().Msg("Memory service initialized (PostgreSQL only, Qdrant disabled)")
			}

			aiChatService = service.NewAIChatService(
				aiService,
				exchangeService,
				chatRepo,
				walletRepo,
				goalRepo,
				budgetRepo,
				userRepo,
				recurringRepo,
				memoryRepo,
				memoryService,
				loanRepo,
				categoryRepo,
				reportsService,
				subscriptionRepo,
				noteRepo,
			)
			log.Info().Msg("AI Chat service initialized with full context")
		}
	}

	// Initialize handlers
	exchangeHandler := handler.New(exchangeService)
	authHandler := handler.NewAuthHandler(authService)
	walletHandler := handler.NewWalletHandler(walletService)
	if categoryService != nil {
		walletHandler = handler.NewWalletHandlerWithCategories(walletService, categoryService)
	}
	aiHandler := handler.NewAIHandler(aiService, walletService)

	// Set additional services for AI handler
	if recurringService != nil {
		aiHandler.SetRecurringService(recurringService)
	}
	if goalService != nil {
		aiHandler.SetGoalService(goalService)
	}

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
	var noteHandler *handler.NoteHandler

	if subscriptionService != nil {
		subscriptionHandler = handler.NewSubscriptionHandler(subscriptionService)
	}
	if badgeService != nil {
		badgeHandler = handler.NewBadgeHandler(badgeService)
	}
	if noteService != nil {
		noteHandler = handler.NewNoteHandler(noteService)
	}

	// Initialize loan handler
	var loanHandler *handler.LoanHandler
	if loanService != nil {
		loanHandler = handler.NewLoanHandler(loanService)
	}

	// Initialize notification handler
	var notificationHandler *handler.NotificationHandler
	if notificationService != nil {
		notificationHandler = handler.NewNotificationHandler(notificationService)
	}

	// Initialize challenge handler
	var challengeHandler *handler.ChallengeHandler
	if challengeService != nil {
		challengeHandler = handler.NewChallengeHandler(challengeService)
	}

	// Initialize XP handler
	var xpHandler *handler.XPHandler
	if xpService != nil {
		xpHandler = handler.NewXPHandler(xpService)
	}

	// Initialize AI Chat handler
	var aiChatHandler *handler.AIChatHandler
	if aiChatService != nil {
		aiChatHandler = handler.NewAIChatHandler(aiChatService, authService)
	}

	// Initialize OAuth handlers
	// Always initialize handlers so routes are registered and return proper error if not configured
	linkedInOAuthHandler := handler.NewLinkedInOAuthHandler(linkedInOAuthService, cfg.FrontendURL)
	googleOAuthHandler := handler.NewGoogleOAuthHandler(googleOAuthService, cfg.FrontendURL)

	handlers := &router.Handlers{
		Exchange:      exchangeHandler,
		Auth:          authHandler,
		LinkedInOAuth: linkedInOAuthHandler,
		GoogleOAuth:   googleOAuthHandler,
		Wallet:        walletHandler,
		AI:            aiHandler,
		AIChat:        aiChatHandler,
		Goal:          goalHandler,
		Tag:           tagHandler,
		Budget:        budgetHandler,
		Recurring:     recurringHandler,
		Reports:       reportsHandler,
		Subscription:  subscriptionHandler,
		Badge:         badgeHandler,
		Note:          noteHandler,
		Loan:          loanHandler,
		Notification:  notificationHandler,
		Challenge:     challengeHandler,
		XP:            xpHandler,
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
