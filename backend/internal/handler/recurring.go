package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
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
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	recurring, err := h.recurringService.GetRecurring(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get recurring transactions")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"recurring_transactions": recurring,
	})
}

// CreateRecurring handles POST /api/v1/recurring
func (h *RecurringHandler) CreateRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.CreateRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	recurring, err := h.recurringService.CreateRecurring(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "failed to create recurring transaction")
		return
	}

	httputil.Created(w, recurring)
}

// UpdateRecurring handles PUT /api/v1/recurring/{id}
func (h *RecurringHandler) UpdateRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid recurring transaction ID")
		return
	}

	var req model.UpdateRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	recurring, err := h.recurringService.UpdateRecurring(r.Context(), userID, recurringID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "recurring transaction not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to update recurring transaction")
		return
	}

	httputil.Success(w, recurring)
}

// DeleteRecurring handles DELETE /api/v1/recurring/{id}
func (h *RecurringHandler) DeleteRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid recurring transaction ID")
		return
	}

	if err := h.recurringService.DeleteRecurring(r.Context(), userID, recurringID); err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "recurring transaction not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete recurring transaction")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "recurring transaction deleted successfully",
	})
}

// ExecuteRecurring handles POST /api/v1/recurring/{id}/execute
func (h *RecurringHandler) ExecuteRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	recurringIDStr := chi.URLParam(r, "id")
	recurringID, err := uuid.Parse(recurringIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid recurring transaction ID")
		return
	}

	transaction, recurring, err := h.recurringService.ExecuteRecurring(r.Context(), userID, recurringID)
	if err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "recurring transaction not found")
			return
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to execute recurring transaction")
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
