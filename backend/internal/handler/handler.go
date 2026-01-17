package handler

import (
	"github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
)

// Handler holds all HTTP handlers
type Handler struct {
	exchangeService *service.ExchangeService
	db              *repository.Database
	cache           *cache.Cache
	rateLimiter     *middleware.RateLimiter
}

// HandlerConfig contains optional dependencies for the handler
type HandlerConfig struct {
	DB          *repository.Database
	Cache       *cache.Cache
	RateLimiter *middleware.RateLimiter
}

// New creates a new Handler
func New(exchange *service.ExchangeService) *Handler {
	return &Handler{
		exchangeService: exchange,
	}
}

// NewWithConfig creates a new Handler with optional dependencies
func NewWithConfig(exchange *service.ExchangeService, cfg *HandlerConfig) *Handler {
	h := &Handler{
		exchangeService: exchange,
	}
	if cfg != nil {
		h.db = cfg.DB
		h.cache = cfg.Cache
		h.rateLimiter = cfg.RateLimiter
	}
	return h
}
