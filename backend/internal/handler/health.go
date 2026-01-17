package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// HealthResponse represents the basic health check response
type HealthResponse struct {
	Status string `json:"status"`
}

// DetailedHealthResponse represents a detailed health check response
type DetailedHealthResponse struct {
	Status    string                   `json:"status"`
	Timestamp string                   `json:"timestamp"`
	Version   string                   `json:"version,omitempty"`
	Checks    map[string]ComponentHealth `json:"checks"`
}

// ComponentHealth represents the health of a single component
type ComponentHealth struct {
	Status  string `json:"status"` // "healthy", "unhealthy", "degraded"
	Message string `json:"message,omitempty"`
	Latency string `json:"latency,omitempty"`
}

// Health handles GET /health (basic)
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, HealthResponse{Status: "ok"})
}

// HealthDetailed handles GET /health/detailed (comprehensive check)
func (h *Handler) HealthDetailed(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]ComponentHealth)
	overallStatus := "healthy"

	// Check database connectivity
	dbHealth := h.checkDatabase(r.Context())
	checks["database"] = dbHealth
	if dbHealth.Status != "healthy" {
		overallStatus = "unhealthy"
	}

	// Check cache status
	cacheHealth := h.checkCache()
	checks["cache"] = cacheHealth
	if cacheHealth.Status != "healthy" && overallStatus == "healthy" {
		overallStatus = "degraded"
	}

	// Check external API (Frankfurter)
	apiHealth := h.checkExternalAPI(r.Context())
	checks["exchange_api"] = apiHealth
	if apiHealth.Status != "healthy" && overallStatus == "healthy" {
		overallStatus = "degraded"
	}

	// Check rate limiter stats
	rateLimitHealth := h.checkRateLimiter()
	checks["rate_limiter"] = rateLimitHealth

	response := DetailedHealthResponse{
		Status:    overallStatus,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   "1.0.0",
		Checks:    checks,
	}

	if overallStatus == "unhealthy" {
		httputil.JSON(w, http.StatusServiceUnavailable, response)
		return
	}

	httputil.Success(w, response)
}

// checkDatabase checks database connectivity
func (h *Handler) checkDatabase(ctx context.Context) ComponentHealth {
	if h.db == nil {
		return ComponentHealth{
			Status:  "unhealthy",
			Message: "database not configured",
		}
	}

	start := time.Now()

	if err := h.db.IsHealthy(ctx); err != nil {
		return ComponentHealth{
			Status:  "unhealthy",
			Message: err.Error(),
		}
	}

	// Include pool stats for diagnostics
	stats := h.db.Stats()
	message := "connected"
	if stats != nil {
		message = fmt.Sprintf("connected (pool: %d/%d total, %d idle, %d in-use)",
			stats.TotalConns(), stats.MaxConns(), stats.IdleConns(), stats.AcquiredConns())
	}

	return ComponentHealth{
		Status:  "healthy",
		Message: message,
		Latency: time.Since(start).String(),
	}
}

// checkCache checks cache status
func (h *Handler) checkCache() ComponentHealth {
	if h.cache == nil {
		return ComponentHealth{
			Status:  "degraded",
			Message: "cache not configured",
		}
	}

	return ComponentHealth{
		Status:  "healthy",
		Message: "operational",
		Latency: "0ms",
	}
}

// checkExternalAPI checks external API connectivity
func (h *Handler) checkExternalAPI(ctx context.Context) ComponentHealth {
	if h.exchangeService == nil {
		return ComponentHealth{
			Status:  "degraded",
			Message: "exchange service not configured",
		}
	}

	start := time.Now()

	// Try to fetch a simple rate to check API connectivity
	_, err := h.exchangeService.GetLatestRates(ctx, "EUR")
	if err != nil {
		return ComponentHealth{
			Status:  "degraded",
			Message: "external API unavailable: " + err.Error(),
			Latency: time.Since(start).String(),
		}
	}

	return ComponentHealth{
		Status:  "healthy",
		Message: "connected",
		Latency: time.Since(start).String(),
	}
}

// checkRateLimiter checks rate limiter status
func (h *Handler) checkRateLimiter() ComponentHealth {
	if h.rateLimiter == nil {
		return ComponentHealth{
			Status:  "healthy",
			Message: "not configured",
		}
	}

	return ComponentHealth{
		Status:  "healthy",
		Message: "operational",
	}
}
