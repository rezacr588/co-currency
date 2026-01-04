package handler

import (
	"net/http"

	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
}

// Health handles GET /health
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, HealthResponse{Status: "ok"})
}
