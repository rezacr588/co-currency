package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// RecurringHandler handles recurring transaction endpoints
type RecurringHandler struct {
	recurringService *service.RecurringService
}

// NewRecurringHandler creates a new RecurringHandler
func NewRecurringHandler(recurringService *service.RecurringService) *RecurringHandler {
	return &RecurringHandler{recurringService: recurringService}
}

// GetRecurring handles GET /api/v1/recurring
func (h *RecurringHandler) GetRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	recurring, err := h.recurringService.GetRecurring(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get recurring transactions")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"recurring_transactions": recurring,
	})
}

// CreateRecurring handles POST /api/v1/recurring
func (h *RecurringHandler) CreateRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.CreateRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	recurring, err := h.recurringService.CreateRecurring(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, recurring)
}

// UpdateRecurring handles PUT /api/v1/recurring/{id}
func (h *RecurringHandler) UpdateRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid recurring transaction ID")
		return
	}

	var req model.UpdateRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	recurring, err := h.recurringService.UpdateRecurring(r.Context(), userID, recurringID, &req)
	if err != nil {
		if err.Error() == "recurring transaction not found" {
			httputil.NotFound(w, "recurring transaction not found")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, recurring)
}

// DeleteRecurring handles DELETE /api/v1/recurring/{id}
func (h *RecurringHandler) DeleteRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid recurring transaction ID")
		return
	}

	if err := h.recurringService.DeleteRecurring(r.Context(), userID, recurringID); err != nil {
		if err.Error() == "recurring transaction not found" {
			httputil.NotFound(w, "recurring transaction not found")
			return
		}
		httputil.InternalServerError(w, "failed to delete recurring transaction")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "recurring transaction deleted successfully",
	})
}

// ExecuteRecurring handles POST /api/v1/recurring/{id}/execute
func (h *RecurringHandler) ExecuteRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid recurring transaction ID")
		return
	}

	transaction, recurring, err := h.recurringService.ExecuteRecurring(r.Context(), userID, recurringID)
	if err != nil {
		if err.Error() == "recurring transaction not found" {
			httputil.NotFound(w, "recurring transaction not found")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, map[string]interface{}{
		"transaction":           transaction,
		"recurring_transaction": recurring,
		"message":               "recurring transaction executed successfully",
	})
}

// GetFrequencies handles GET /api/v1/recurring/frequencies
func (h *RecurringHandler) GetFrequencies(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"frequencies": model.RecurringFrequencies,
	})
}
