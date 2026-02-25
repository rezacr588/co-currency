package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
)

const (
	// TraceIDHeader is the HTTP header name for trace ID
	TraceIDHeader = "X-Trace-ID"
)

// Trace middleware generates a unique trace ID for each request
func Trace(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if trace ID was provided in request header
		traceID := r.Header.Get(TraceIDHeader)
		if traceID == "" {
			// Generate a new trace ID
			traceID = uuid.New().String()
		}

		// Add trace ID to response header
		w.Header().Set(TraceIDHeader, traceID)

		// Add trace ID to context using shared key
		ctx := context.WithValue(r.Context(), ctxkeys.TraceID, traceID)

		// Call next handler with updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
