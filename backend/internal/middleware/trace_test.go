package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
)

func TestTrace(t *testing.T) {
	t.Run("generates trace ID when not provided", func(t *testing.T) {
		var capturedTraceID string

		handler := Trace(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedTraceID = ctxkeys.GetTraceID(r.Context())
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		// Verify trace ID is in response header
		responseTraceID := rec.Header().Get(TraceIDHeader)
		if responseTraceID == "" {
			t.Error("expected trace ID in response header")
		}

		// Verify it's a valid UUID
		if _, err := uuid.Parse(responseTraceID); err != nil {
			t.Errorf("expected valid UUID, got: %s", responseTraceID)
		}

		// Verify trace ID is in context
		if capturedTraceID == "" {
			t.Error("expected trace ID in context")
		}

		// Verify response header matches context value
		if responseTraceID != capturedTraceID {
			t.Errorf("expected response header %s to match context value %s", responseTraceID, capturedTraceID)
		}
	})

	t.Run("uses trace ID from request header when provided", func(t *testing.T) {
		providedTraceID := uuid.New().String()
		var capturedTraceID string

		handler := Trace(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedTraceID = ctxkeys.GetTraceID(r.Context())
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set(TraceIDHeader, providedTraceID)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		// Verify response header contains provided trace ID
		responseTraceID := rec.Header().Get(TraceIDHeader)
		if responseTraceID != providedTraceID {
			t.Errorf("expected response trace ID %s, got %s", providedTraceID, responseTraceID)
		}

		// Verify context contains provided trace ID
		if capturedTraceID != providedTraceID {
			t.Errorf("expected context trace ID %s, got %s", providedTraceID, capturedTraceID)
		}
	})
}
