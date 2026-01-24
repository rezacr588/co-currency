package httputil

import (
	"context"
	"net/http"
	"runtime/debug"

	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rs/zerolog/log"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
	TraceID string `json:"trace_id,omitempty"`
}

// NewError creates a new ErrorResponse
func NewError(code int, err string, message string) ErrorResponse {
	return ErrorResponse{
		Error:   err,
		Code:    code,
		Message: message,
	}
}

// NewErrorWithTrace creates a new ErrorResponse with trace ID
func NewErrorWithTrace(code int, err string, message string, traceID string) ErrorResponse {
	return ErrorResponse{
		Error:   err,
		Code:    code,
		Message: message,
		TraceID: traceID,
	}
}

// getTraceID extracts trace ID from context
func getTraceID(ctx context.Context) string {
	return ctxkeys.GetTraceID(ctx)
}

// Error writes an error response
func Error(w http.ResponseWriter, status int, err string, message string) {
	JSON(w, status, NewError(status, err, message))
}

// ErrorWithContext writes an error response with trace ID from context and logs it
func ErrorWithContext(ctx context.Context, w http.ResponseWriter, status int, err string, message string) {
	traceID := getTraceID(ctx)
	
	// Log the error with stack trace if it's a 500
	logEvent := log.Error().Str("trace_id", traceID).Int("status", status).Str("error", err)
	if status >= 500 {
		logEvent = logEvent.Str("stack", string(debug.Stack()))
	}
	logEvent.Msg(message)

	JSON(w, status, NewErrorWithTrace(status, err, message, traceID))
}

// BadRequest writes a 400 Bad Request response
func BadRequest(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, "bad_request", message)
}

// BadRequestWithContext writes a 400 Bad Request response with trace ID
func BadRequestWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusBadRequest, "bad_request", message)
}

// NotFound writes a 404 Not Found response
func NotFound(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, "not_found", message)
}

// NotFoundWithContext writes a 404 Not Found response with trace ID
func NotFoundWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusNotFound, "not_found", message)
}

// InternalServerError writes a 500 Internal Server Error response
func InternalServerError(w http.ResponseWriter, message string) {
	Error(w, http.StatusInternalServerError, "internal_error", message)
}

// InternalServerErrorWithContext writes a 500 Internal Server Error response with trace ID
func InternalServerErrorWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusInternalServerError, "internal_error", message)
}

// TooManyRequests writes a 429 Too Many Requests response
func TooManyRequests(w http.ResponseWriter, message string) {
	Error(w, http.StatusTooManyRequests, "rate_limit_exceeded", message)
}

// TooManyRequestsWithContext writes a 429 Too Many Requests response with trace ID
func TooManyRequestsWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusTooManyRequests, "rate_limit_exceeded", message)
}

// ServiceUnavailable writes a 503 Service Unavailable response
func ServiceUnavailable(w http.ResponseWriter, message string) {
	Error(w, http.StatusServiceUnavailable, "service_unavailable", message)
}

// ServiceUnavailableWithContext writes a 503 Service Unavailable response with trace ID
func ServiceUnavailableWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusServiceUnavailable, "service_unavailable", message)
}

// Unauthorized writes a 401 Unauthorized response
func Unauthorized(w http.ResponseWriter, message string) {
	Error(w, http.StatusUnauthorized, "unauthorized", message)
}

// UnauthorizedWithContext writes a 401 Unauthorized response with trace ID
func UnauthorizedWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusUnauthorized, "unauthorized", message)
}

// Forbidden writes a 403 Forbidden response
func Forbidden(w http.ResponseWriter, message string) {
	Error(w, http.StatusForbidden, "forbidden", message)
}

// ForbiddenWithContext writes a 403 Forbidden response with trace ID
func ForbiddenWithContext(ctx context.Context, w http.ResponseWriter, message string) {
	ErrorWithContext(ctx, w, http.StatusForbidden, "forbidden", message)
}
