package handler

import (
	"github.com/rezacr588/currency-converter/internal/service"
)

// Handler holds all HTTP handlers
type Handler struct {
	exchange *service.ExchangeService
}

// New creates a new Handler
func New(exchange *service.ExchangeService) *Handler {
	return &Handler{
		exchange: exchange,
	}
}
