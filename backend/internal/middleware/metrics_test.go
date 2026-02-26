package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestHTTPMetrics_UsesRoutePatternLabel(t *testing.T) {
	registry := prometheus.NewRegistry()
	metrics := NewHTTPMetrics(registry)

	r := chi.NewRouter()
	r.Use(metrics.Middleware)
	r.Get("/api/v1/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/42", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusCreated)
	}

	got := testutil.ToFloat64(metrics.requestTotal.WithLabelValues(http.MethodGet, "/api/v1/users/{id}", "201"))
	if got != 1 {
		t.Fatalf("request total = %v, want 1", got)
	}
}

func TestHTTPMetrics_FallsBackToPathWhenNoRoutePattern(t *testing.T) {
	registry := prometheus.NewRegistry()
	metrics := NewHTTPMetrics(registry)

	h := metrics.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/direct", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusNoContent)
	}

	got := testutil.ToFloat64(metrics.requestTotal.WithLabelValues(http.MethodGet, "/direct", "204"))
	if got != 1 {
		t.Fatalf("request total = %v, want 1", got)
	}
}

func TestHTTPMetrics_HandlerExposesPrometheusOutput(t *testing.T) {
	registry := prometheus.NewRegistry()
	metrics := NewHTTPMetrics(registry)
	metrics.requestTotal.WithLabelValues(http.MethodGet, "/health", "200").Inc()

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()
	metrics.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	if !strings.Contains(rr.Body.String(), "cofinance_http_requests_total") {
		t.Fatalf("metrics payload missing cofinance_http_requests_total")
	}
}
