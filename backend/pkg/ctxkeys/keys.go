// Package ctxkeys provides shared context key types and constants
// used across the application for type-safe context value storage.
package ctxkeys

import "context"

// Key is a custom type for context keys to avoid collisions
type Key string

const (
	// TraceID is the context key for request trace ID
	TraceID Key = "trace_id"
	// UserID is the context key for authenticated user ID
	UserID Key = "user_id"
	// UserEmail is the context key for authenticated user's email
	UserEmail Key = "user_email"
)

// GetTraceID extracts the trace ID from context
func GetTraceID(ctx context.Context) string {
	if traceID, ok := ctx.Value(TraceID).(string); ok {
		return traceID
	}
	return ""
}
