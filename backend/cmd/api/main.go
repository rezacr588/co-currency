package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/router"
	"github.com/rezacr588/currency-converter/pkg/httputil"

	// Swagger docs
	_ "github.com/rezacr588/currency-converter/docs"
)

// @title           CoAI API
// @version         1.0
// @description     CoAI is a personal finance management API with currency conversion, wallet management, budgets, goals, subscriptions, and achievement badges.
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
// @contact.email  support@coai.app

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
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	setupLogging(cfg.Environment)
	httputil.SetExposeErrorDetails(cfg.ExposeErrorDetails)

	if cfg.Environment == "production" && (cfg.JWTSecret == "" || cfg.JWTSecret == "change-me-in-production-to-a-secure-secret") {
		log.Fatal().Msg("JWT_SECRET must be set to a secure value in production")
	}

	log.Info().
		Str("environment", cfg.Environment).
		Str("port", cfg.Port).
		Msg("Starting Currency Converter API")

	// Initialize database, services, and handlers
	db := initDatabase(cfg)
	svc := initServices(cfg, db)
	handlers := initHandlers(cfg, db, svc)

	// Auth middleware
	var authMiddleware *middleware.Auth
	if svc.auth != nil {
		authMiddleware = middleware.NewAuth(svc.auth)
	}

	// Rate limiter
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitPerMin)
	if handlers.Exchange != nil {
		handlers.Exchange.SetRateLimiter(rateLimiter)
	}
	if handlers.AI != nil {
		aiLimitPerMin, aiBurst := rateLimiter.AISettings()
		handlers.AI.SetRateLimitInfo(aiLimitPerMin, aiBurst)
	}

	// Static file system
	var staticFS fs.FS
	if subFS, err := fs.Sub(staticFiles, "static"); err == nil {
		entries, _ := fs.ReadDir(subFS, ".")
		if len(entries) > 0 {
			staticFS = subFS
			log.Info().Msg("Serving static app web files")
		}
	}

	// Create router
	r := router.New(handlers, rateLimiter, authMiddleware, staticFS)

	// Wrap with metrics if enabled
	serverHandler := http.Handler(r)
	if cfg.MetricsEnabled {
		metricsRegistry := prometheus.NewRegistry()
		metricsRegistry.MustRegister(
			prometheus.NewGoCollector(),
			prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
		)
		httpMetrics := middleware.NewHTTPMetrics(metricsRegistry)

		mux := http.NewServeMux()
		mux.Handle("/metrics", httpMetrics.Handler())
		mux.Handle("/", httpMetrics.Middleware(serverHandler))
		serverHandler = mux

		log.Info().Msg("Prometheus metrics enabled at /metrics")
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           serverHandler,
		ReadTimeout:       cfg.HTTPReadTimeout,
		ReadHeaderTimeout: cfg.HTTPReadHeaderTimeout,
		WriteTimeout:      cfg.HTTPWriteTimeout,
		IdleTimeout:       cfg.HTTPIdleTimeout,
		MaxHeaderBytes:    cfg.HTTPMaxHeaderBytes,
	}

	// Start server and handle graceful shutdown
	log.Info().
		Str("addr", fmt.Sprintf(":%s", cfg.Port)).
		Dur("read_timeout", cfg.HTTPReadTimeout).
		Dur("read_header_timeout", cfg.HTTPReadHeaderTimeout).
		Dur("write_timeout", cfg.HTTPWriteTimeout).
		Dur("idle_timeout", cfg.HTTPIdleTimeout).
		Msg("Server listening")

	sigCtx, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()

	serverErrCh := make(chan error, 1)
	go func() {
		serverErrCh <- srv.ListenAndServe()
	}()

	var serveErr error
	select {
	case err := <-serverErrCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr = err
		}
	case <-sigCtx.Done():
		log.Info().Msg("Shutdown signal received")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTPShutdownTimeout)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("HTTP server graceful shutdown failed, forcing close")
			if closeErr := srv.Close(); closeErr != nil {
				log.Error().Err(closeErr).Msg("Failed to force-close HTTP server")
			}
		}

		if err := <-serverErrCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr = err
		}
	}

	// Cleanup background resources
	log.Info().Msg("Cleaning up background resources")
	if svc.wsFanoutCancel != nil {
		svc.wsFanoutCancel()
	}
	if svc.wsHub != nil {
		svc.wsHub.Shutdown()
	}
	if svc.wsRedisFanout != nil {
		if err := svc.wsRedisFanout.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing WebSocket Redis fanout")
		}
	}
	if db.inflationCrawler != nil {
		db.inflationCrawler.Stop()
	}
	if db.irrCrawler != nil {
		db.irrCrawler.Stop()
	}
	if svc.memoryService != nil {
		svc.memoryService.Close()
	}
	if svc.qdrantClient != nil {
		if err := svc.qdrantClient.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing Qdrant client")
		}
	}
	if db.irrDB != nil {
		if err := db.irrDB.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing IRR database")
		}
	}
	if db.mainDB != nil {
		if err := db.mainDB.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing main database")
		}
	}

	if serveErr != nil {
		log.Fatal().Err(serveErr).Msg("Server failed")
	}
}

func setupLogging(environment string) {
	if environment == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
}
