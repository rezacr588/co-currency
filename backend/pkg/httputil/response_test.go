package httputil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	data := map[string]string{"key": "value"}

	JSON(rec, http.StatusOK, data)

	if rec.Code != http.StatusOK {
		t.Errorf("JSON() status = %v, want %v", rec.Code, http.StatusOK)
	}

	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %v, want application/json", ct)
	}

	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got["key"] != "value" {
		t.Errorf("Response body key = %v, want value", got["key"])
	}
}

func TestSuccess(t *testing.T) {
	rec := httptest.NewRecorder()
	Success(rec, "test")

	if rec.Code != http.StatusOK {
		t.Errorf("Success() status = %v, want %v", rec.Code, http.StatusOK)
	}
}

func TestCreated(t *testing.T) {
	rec := httptest.NewRecorder()
	Created(rec, "test")

	if rec.Code != http.StatusCreated {
		t.Errorf("Created() status = %v, want %v", rec.Code, http.StatusCreated)
	}
}

func TestNoContent(t *testing.T) {
	rec := httptest.NewRecorder()
	NoContent(rec)

	if rec.Code != http.StatusNoContent {
		t.Errorf("NoContent() status = %v, want %v", rec.Code, http.StatusNoContent)
	}
}
