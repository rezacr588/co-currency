package httputil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
