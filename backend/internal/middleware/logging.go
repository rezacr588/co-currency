package middleware

import (
	"net/http"
	"time"

	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rs/zerolog/log"
)

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Logging middleware logs HTTP requests with trace ID
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		wrapped := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}

		next.ServeHTTP(wrapped, r)

		// Get trace ID from context (set by Trace middleware)
		traceID := ctxkeys.GetTraceID(r.Context())

		logEvent := log.Info().
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", wrapped.status).
			Dur("duration", time.Since(start)).
			Str("remote", r.RemoteAddr)

		// Add trace ID if available
		if traceID != "" {
			logEvent = logEvent.Str("trace_id", traceID)
		}

		logEvent.Msg("request")
	})
}
