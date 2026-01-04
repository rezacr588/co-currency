package httputil

import (
	"encoding/json"
	"net/http"
)

// JSON writes a JSON response with the given status code
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// Success writes a successful JSON response
func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

// Created writes a 201 Created response
func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, data)
}

// NoContent writes a 204 No Content response
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
