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

// New creates a new Handler
func New(exchange *service.ExchangeService) *Handler {
	return &Handler{
		exchangeService: exchange,
	}
}

