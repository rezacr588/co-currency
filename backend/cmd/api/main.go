package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"

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

	// Initialize dependencies
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	frankfurterClient := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	exchangeService := service.NewExchangeService(cfg, frankfurterClient, cache)
	h := handler.New(exchangeService)
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
	r := router.New(h, rateLimiter, staticFS)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("Server listening")

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
