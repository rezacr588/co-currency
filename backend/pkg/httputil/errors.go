package httputil

import (
	"context"
	"net/http"
	"runtime/debug"
	"sync/atomic"

	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rs/zerolog/log"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
	Details string `json:"details,omitempty"`
	TraceID string `json:"trace_id,omitempty"`
}

var exposeErrorDetails atomic.Bool

// SetExposeErrorDetails controls whether internal error details are included in API responses.
func SetExposeErrorDetails(enabled bool) {
	exposeErrorDetails.Store(enabled)
}

// ExposeErrorDetailsEnabled returns whether internal error details are included in API responses.
func ExposeErrorDetailsEnabled() bool {
	return exposeErrorDetails.Load()
}

// NewError creates a new ErrorResponse
func NewError(code int, err string, message string) ErrorResponse {
	return ErrorResponse{
		Error:   err,
		Code:    code,
		Message: message,
	}
}

// NewErrorWithTrace creates a new ErrorResponse with trace ID and details
func NewErrorWithTrace(code int, err string, message string, details string, traceID string) ErrorResponse {
	return ErrorResponse{
		Error:   err,
		Code:    code,
		Message: message,
		Details: details,
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

// ErrorWithContext writes an error response with trace ID from context and logs it.
// It takes the actual error object to provide full details in the response.
func ErrorWithContext(ctx context.Context, w http.ResponseWriter, status int, apiErr string, message string, internalErr error) {
	traceID := getTraceID(ctx)
	logDetails := ""
	responseDetails := ""
	if internalErr != nil {
		logDetails = internalErr.Error()
		if exposeErrorDetails.Load() {
			responseDetails = internalErr.Error()
		}
	}

	// Log the error with stack trace if it's a 500
	logEvent := log.Error().Str("trace_id", traceID).Int("status", status).Str("error", apiErr).Str("details", logDetails)
	if status >= 500 {
		logEvent = logEvent.Str("stack", string(debug.Stack()))
	}
	logEvent.Msg(message)

	JSON(w, status, NewErrorWithTrace(status, apiErr, message, responseDetails, traceID))
}

func firstError(errs []error) error {
	if len(errs) == 0 {
		return nil
	}
	return errs[0]
}

// BadRequestWithContext writes a 400 Bad Request response with trace ID
func BadRequestWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusBadRequest, "bad_request", message, firstError(err))
}

// BadRequest writes a 400 Bad Request response
func BadRequest(w http.ResponseWriter, message string) {
	BadRequestWithContext(context.Background(), w, message, nil)
}

// NotFoundWithContext writes a 404 Not Found response with trace ID
func NotFoundWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusNotFound, "not_found", message, firstError(err))
}

// NotFound writes a 404 Not Found response
func NotFound(w http.ResponseWriter, message string) {
	NotFoundWithContext(context.Background(), w, message, nil)
}

// InternalServerErrorWithContext writes a 500 Internal Server Error response with trace ID
func InternalServerErrorWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusInternalServerError, "internal_error", message, firstError(err))
}

// InternalServerError writes a 500 Internal Server Error response
func InternalServerError(w http.ResponseWriter, message string) {
	InternalServerErrorWithContext(context.Background(), w, message, nil)
}

// TooManyRequestsWithContext writes a 429 Too Many Requests response with trace ID
func TooManyRequestsWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusTooManyRequests, "rate_limit_exceeded", message, firstError(err))
}

// TooManyRequests writes a 429 Too Many Requests response
func TooManyRequests(w http.ResponseWriter, message string) {
	TooManyRequestsWithContext(context.Background(), w, message, nil)
}

// ServiceUnavailableWithContext writes a 503 Service Unavailable response with trace ID
func ServiceUnavailableWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusServiceUnavailable, "service_unavailable", message, firstError(err))
}

// ServiceUnavailable writes a 503 Service Unavailable response
func ServiceUnavailable(w http.ResponseWriter, message string) {
	ServiceUnavailableWithContext(context.Background(), w, message, nil)
}

// UnauthorizedWithContext writes a 401 Unauthorized response with trace ID
func UnauthorizedWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusUnauthorized, "unauthorized", message, firstError(err))
}

// Unauthorized writes a 401 Unauthorized response
func Unauthorized(w http.ResponseWriter, message string) {
	UnauthorizedWithContext(context.Background(), w, message, nil)
}

// ForbiddenWithContext writes a 403 Forbidden response with trace ID
func ForbiddenWithContext(ctx context.Context, w http.ResponseWriter, message string, err ...error) {
	ErrorWithContext(ctx, w, http.StatusForbidden, "forbidden", message, firstError(err))
}

// Forbidden writes a 403 Forbidden response
func Forbidden(w http.ResponseWriter, message string) {
	ForbiddenWithContext(context.Background(), w, message, nil)
}
