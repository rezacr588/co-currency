package main

import (
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
)

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

	// Initialize handlers
	exchangeHandler := handler.New(exchangeService)
	authHandler := handler.NewAuthHandler(authService)
	walletHandler := handler.NewWalletHandler(walletService)
	aiHandler := handler.NewAIHandler(aiService, walletService)

	handlers := &router.Handlers{
		Exchange: exchangeHandler,
		Auth:     authHandler,
		Wallet:   walletHandler,
		AI:       aiHandler,
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
