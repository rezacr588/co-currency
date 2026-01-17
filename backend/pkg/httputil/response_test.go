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

func TestJSON_NilData(t *testing.T) {
	rec := httptest.NewRecorder()
	JSON(rec, http.StatusOK, nil)

	if rec.Code != http.StatusOK {
		t.Errorf("JSON() status = %v, want %v", rec.Code, http.StatusOK)
	}

	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %v, want application/json", ct)
	}

	// Body should be empty when data is nil
	if rec.Body.Len() != 0 {
		t.Errorf("Body should be empty for nil data, got %s", rec.Body.String())
	}
}

func TestJSON_DifferentStatusCodes(t *testing.T) {
	testCases := []struct {
		name   string
		status int
	}{
		{"OK", http.StatusOK},
		{"Created", http.StatusCreated},
		{"BadRequest", http.StatusBadRequest},
		{"NotFound", http.StatusNotFound},
		{"InternalServerError", http.StatusInternalServerError},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			JSON(rec, tc.status, map[string]string{"status": tc.name})

			if rec.Code != tc.status {
				t.Errorf("JSON() status = %v, want %v", rec.Code, tc.status)
			}
		})
	}
}

func TestSuccess_ComplexData(t *testing.T) {
	rec := httptest.NewRecorder()
	data := struct {
		Name  string   `json:"name"`
		Items []string `json:"items"`
	}{
		Name:  "test",
		Items: []string{"a", "b", "c"},
	}

	Success(rec, data)

	if rec.Code != http.StatusOK {
		t.Errorf("Success() status = %v, want %v", rec.Code, http.StatusOK)
	}

	var got map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if got["name"] != "test" {
		t.Errorf("Response name = %v, want test", got["name"])
	}
}
