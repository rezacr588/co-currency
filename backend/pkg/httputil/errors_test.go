package httputil

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
)

func TestError(t *testing.T) {
	rec := httptest.NewRecorder()
	Error(rec, http.StatusBadRequest, "bad_request", "Invalid input")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Error() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.Error != "bad_request" {
		t.Errorf("Error = %v, want bad_request", got.Error)
	}
	if got.Code != http.StatusBadRequest {
		t.Errorf("Code = %v, want %v", got.Code, http.StatusBadRequest)
	}
	if got.Message != "Invalid input" {
		t.Errorf("Message = %v, want Invalid input", got.Message)
	}
}

func TestBadRequest(t *testing.T) {
	rec := httptest.NewRecorder()
	BadRequest(rec, "test message")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("BadRequest() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}
}

func TestNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	NotFound(rec, "test message")

	if rec.Code != http.StatusNotFound {
		t.Errorf("NotFound() status = %v, want %v", rec.Code, http.StatusNotFound)
	}
}

func TestInternalServerError(t *testing.T) {
	rec := httptest.NewRecorder()
	InternalServerError(rec, "test message")

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("InternalServerError() status = %v, want %v", rec.Code, http.StatusInternalServerError)
	}
}

func TestTooManyRequests(t *testing.T) {
	rec := httptest.NewRecorder()
	TooManyRequests(rec, "test message")

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("TooManyRequests() status = %v, want %v", rec.Code, http.StatusTooManyRequests)
	}
}

func TestServiceUnavailable(t *testing.T) {
	rec := httptest.NewRecorder()
	ServiceUnavailable(rec, "test message")

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("ServiceUnavailable() status = %v, want %v", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestUnauthorized(t *testing.T) {
	rec := httptest.NewRecorder()
	Unauthorized(rec, "unauthorized access")

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Unauthorized() status = %v, want %v", rec.Code, http.StatusUnauthorized)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.Error != "unauthorized" {
		t.Errorf("Error = %v, want unauthorized", got.Error)
	}
}

func TestForbidden(t *testing.T) {
	rec := httptest.NewRecorder()
	Forbidden(rec, "access denied")

	if rec.Code != http.StatusForbidden {
		t.Errorf("Forbidden() status = %v, want %v", rec.Code, http.StatusForbidden)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.Error != "forbidden" {
		t.Errorf("Error = %v, want forbidden", got.Error)
	}
}

func TestNewError(t *testing.T) {
	err := NewError(http.StatusBadRequest, "bad_request", "Invalid data")

	if err.Code != http.StatusBadRequest {
		t.Errorf("NewError().Code = %v, want %v", err.Code, http.StatusBadRequest)
	}
	if err.Error != "bad_request" {
		t.Errorf("NewError().Error = %v, want bad_request", err.Error)
	}
	if err.Message != "Invalid data" {
		t.Errorf("NewError().Message = %v, want 'Invalid data'", err.Message)
	}
}

func TestNewErrorWithTrace(t *testing.T) {
	traceID := "test-trace-123"
	details := "original error details"
	err := NewErrorWithTrace(http.StatusBadRequest, "bad_request", "Invalid data", details, traceID)

	if err.Code != http.StatusBadRequest {
		t.Errorf("NewErrorWithTrace().Code = %v, want %v", err.Code, http.StatusBadRequest)
	}
	if err.Error != "bad_request" {
		t.Errorf("NewErrorWithTrace().Error = %v, want bad_request", err.Error)
	}
	if err.Message != "Invalid data" {
		t.Errorf("NewErrorWithTrace().Message = %v, want 'Invalid data'", err.Message)
	}
	if err.Details != details {
		t.Errorf("NewErrorWithTrace().Details = %v, want %v", err.Details, details)
	}
	if err.TraceID != traceID {
		t.Errorf("NewErrorWithTrace().TraceID = %v, want %v", err.TraceID, traceID)
	}
}

func TestErrorWithContext(t *testing.T) {
	traceID := "test-trace-456"
	ctx := context.WithValue(context.Background(), ctxkeys.TraceID, traceID)
	rec := httptest.NewRecorder()
	internalErr := fmt.Errorf("database connection failed")

	ErrorWithContext(ctx, rec, http.StatusInternalServerError, "internal_error", "failed to fetch data", internalErr)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("ErrorWithContext() status = %v, want %v", rec.Code, http.StatusInternalServerError)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.TraceID != traceID {
		t.Errorf("ErrorWithContext() TraceID = %v, want %v", got.TraceID, traceID)
	}
	if got.Details != internalErr.Error() {
		t.Errorf("ErrorWithContext() Details = %v, want %v", got.Details, internalErr.Error())
	}
}

func TestBadRequestWithContext(t *testing.T) {
	traceID := "trace-bad-request"
	ctx := context.WithValue(context.Background(), ctxkeys.TraceID, traceID)
	rec := httptest.NewRecorder()
	internalErr := fmt.Errorf("invalid amount")

	BadRequestWithContext(ctx, rec, "test message", internalErr)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("BadRequestWithContext() status = %v, want %v", rec.Code, http.StatusBadRequest)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.TraceID != traceID {
		t.Errorf("BadRequestWithContext() TraceID = %v, want %v", got.TraceID, traceID)
	}
	if got.Details != internalErr.Error() {
		t.Errorf("BadRequestWithContext() Details = %v, want %v", got.Details, internalErr.Error())
	}
}

func TestInternalServerErrorWithContext(t *testing.T) {
	traceID := "trace-internal-error"
	ctx := context.WithValue(context.Background(), ctxkeys.TraceID, traceID)
	rec := httptest.NewRecorder()
	internalErr := fmt.Errorf("unexpected panic")

	InternalServerErrorWithContext(ctx, rec, "something went wrong", internalErr)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("InternalServerErrorWithContext() status = %v, want %v", rec.Code, http.StatusInternalServerError)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.TraceID != traceID {
		t.Errorf("InternalServerErrorWithContext() TraceID = %v, want %v", got.TraceID, traceID)
	}
	if got.Details != internalErr.Error() {
		t.Errorf("InternalServerErrorWithContext() Details = %v, want %v", got.Details, internalErr.Error())
	}
}

func TestUnauthorizedWithContext(t *testing.T) {
	traceID := "trace-unauthorized"
	ctx := context.WithValue(context.Background(), ctxkeys.TraceID, traceID)
	rec := httptest.NewRecorder()

	UnauthorizedWithContext(ctx, rec, "not allowed", nil)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("UnauthorizedWithContext() status = %v, want %v", rec.Code, http.StatusUnauthorized)
	}

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.TraceID != traceID {
		t.Errorf("UnauthorizedWithContext() TraceID = %v, want %v", got.TraceID, traceID)
	}
}

func TestContextErrorWithoutTraceID(t *testing.T) {
	ctx := context.Background() // No trace ID in context
	rec := httptest.NewRecorder()

	BadRequestWithContext(ctx, rec, "test message", nil)

	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got.TraceID != "" {
		t.Errorf("Expected empty TraceID when not in context, got %v", got.TraceID)
	}
}
