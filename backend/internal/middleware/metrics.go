package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// HTTPMetrics captures HTTP request metrics for observability.
type HTTPMetrics struct {
	requestDuration *prometheus.HistogramVec
	requestTotal    *prometheus.CounterVec
	inFlight        prometheus.Gauge
	gatherer        prometheus.Gatherer
}

// NewHTTPMetrics creates middleware/handler metrics registered against the provided registry.
// If registry is nil, it uses Prometheus global defaults.
func NewHTTPMetrics(registry *prometheus.Registry) *HTTPMetrics {
	var (
		registerer prometheus.Registerer = prometheus.DefaultRegisterer
		gatherer   prometheus.Gatherer   = prometheus.DefaultGatherer
	)
	if registry != nil {
		registerer = registry
		gatherer = registry
	}

	factory := promauto.With(registerer)

	return &HTTPMetrics{
		requestDuration: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "cofinance_http_request_duration_seconds",
				Help:    "Duration of HTTP requests in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "route", "status"},
		),
		requestTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cofinance_http_requests_total",
				Help: "Total number of HTTP requests.",
			},
			[]string{"method", "route", "status"},
		),
		inFlight: factory.NewGauge(
			prometheus.GaugeOpts{
				Name: "cofinance_http_in_flight_requests",
				Help: "Current number of in-flight HTTP requests.",
			},
		),
		gatherer: gatherer,
	}
}

// Middleware records request count and latency for each request.
func (m *HTTPMetrics) Middleware(next http.Handler) http.Handler {
	if m == nil {
		return next
	}
	if next == nil {
		return http.NotFoundHandler()
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}

		m.inFlight.Inc()
		defer m.inFlight.Dec()

		next.ServeHTTP(wrapped, r)

		route := routePattern(r)
		status := strconv.Itoa(wrapped.status)

		m.requestTotal.WithLabelValues(r.Method, route, status).Inc()
		m.requestDuration.WithLabelValues(r.Method, route, status).Observe(time.Since(start).Seconds())
	})
}

// Handler returns a Prometheus scrape handler for this registry.
func (m *HTTPMetrics) Handler() http.Handler {
	if m == nil {
		return http.NotFoundHandler()
	}
	return promhttp.HandlerFor(m.gatherer, promhttp.HandlerOpts{})
}

func routePattern(r *http.Request) string {
	if r == nil {
		return "unknown"
	}

	if routeCtx := chi.RouteContext(r.Context()); routeCtx != nil {
		if pattern := routeCtx.RoutePattern(); pattern != "" {
			return pattern
		}
	}

	if r.URL != nil && r.URL.Path != "" {
		return r.URL.Path
	}

	return "unknown"
}
