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

// BudgetHandler handles budget endpoints
type BudgetHandler struct {
	budgetService *service.BudgetService
}

// NewBudgetHandler creates a new BudgetHandler
func NewBudgetHandler(budgetService *service.BudgetService) *BudgetHandler {
	return &BudgetHandler{budgetService: budgetService}
}

// GetBudgets handles GET /api/v1/budgets
func (h *BudgetHandler) GetBudgets(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	budgets, err := h.budgetService.GetBudgets(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get budgets")
		return
	}

	// Add computed fields to response
	type budgetWithStatus struct {
		model.Budget
		Remaining    float64 `json:"remaining"`
		Progress     float64 `json:"progress"`
		IsOverBudget bool    `json:"is_over_budget"`
		IsNearLimit  bool    `json:"is_near_limit"`
	}

	budgetsWithStatus := make([]budgetWithStatus, len(budgets))
	for i, b := range budgets {
		budgetsWithStatus[i] = budgetWithStatus{
			Budget:       b,
			Remaining:    b.Remaining(),
			Progress:     b.Progress(),
			IsOverBudget: b.IsOverBudget(),
			IsNearLimit:  b.IsNearLimit(),
		}
	}

	httputil.Success(w, map[string]interface{}{
		"budgets": budgetsWithStatus,
	})
}

// CreateBudget handles POST /api/v1/budgets
func (h *BudgetHandler) CreateBudget(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.CreateBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	budget, err := h.budgetService.CreateBudget(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, map[string]interface{}{
		"budget":        budget,
		"remaining":     budget.Remaining(),
		"progress":      budget.Progress(),
		"is_over_budget": budget.IsOverBudget(),
		"is_near_limit": budget.IsNearLimit(),
	})
}

// UpdateBudget handles PUT /api/v1/budgets/{id}
func (h *BudgetHandler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	budgetIDStr := chi.URLParam(r, "id")
	budgetID, err := uuid.Parse(budgetIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid budget ID")
		return
	}

	var req model.UpdateBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	budget, err := h.budgetService.UpdateBudget(r.Context(), userID, budgetID, &req)
	if err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFound(w, "budget not found")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, map[string]interface{}{
		"budget":        budget,
		"remaining":     budget.Remaining(),
		"progress":      budget.Progress(),
		"is_over_budget": budget.IsOverBudget(),
		"is_near_limit": budget.IsNearLimit(),
	})
}

// DeleteBudget handles DELETE /api/v1/budgets/{id}
func (h *BudgetHandler) DeleteBudget(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	budgetIDStr := chi.URLParam(r, "id")
	budgetID, err := uuid.Parse(budgetIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid budget ID")
		return
	}

	if err := h.budgetService.DeleteBudget(r.Context(), userID, budgetID); err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFound(w, "budget not found")
			return
		}
		httputil.InternalServerError(w, "failed to delete budget")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "budget deleted successfully",
	})
}
