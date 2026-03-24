package handler

import (
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
)

// Handler holds all HTTP handlers
type Handler struct {
	exchangeService *service.ExchangeService
	db              *repository.Database
	cache           repository.Cache
	rateLimiter     *middleware.RateLimiter
}

// New creates a new Handler
func New(exchange *service.ExchangeService) *Handler {
	return &Handler{
		exchangeService: exchange,
	}
}

// SetDatabase injects the main database dependency used by detailed health checks.
func (h *Handler) SetDatabase(db *repository.Database) {
	h.db = db
}

// SetCache injects cache dependency used by detailed health checks.
func (h *Handler) SetCache(cache repository.Cache) {
	h.cache = cache
}

// SetRateLimiter injects rate limiter dependency used by detailed health checks.
func (h *Handler) SetRateLimiter(rateLimiter *middleware.RateLimiter) {
	h.rateLimiter = rateLimiter
}
