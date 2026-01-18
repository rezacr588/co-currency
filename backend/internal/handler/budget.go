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
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "user not found in context")
		return
	}

	budgets, err := h.budgetService.GetBudgets(ctx, userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(ctx, w, "failed to get budgets")
		return
	}

	// Convert to response type with computed fields including daily allowance
	budgetResponses := make([]model.BudgetResponse, len(budgets))
	for i, b := range budgets {
		budgetResponses[i] = b.ToBudgetResponse()
	}

	httputil.Success(w, map[string]interface{}{
		"budgets": budgetResponses,
	})
}

// CreateBudget handles POST /api/v1/budgets
func (h *BudgetHandler) CreateBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "user not found in context")
		return
	}

	var req model.CreateBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body")
		return
	}

	budget, err := h.budgetService.CreateBudget(ctx, userID, &req)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.Created(w, budget.ToBudgetResponse())
}

// UpdateBudget handles PUT /api/v1/budgets/{id}
func (h *BudgetHandler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "user not found in context")
		return
	}

	budgetIDStr := chi.URLParam(r, "id")
	budgetID, err := uuid.Parse(budgetIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid budget ID")
		return
	}

	var req model.UpdateBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid request body")
		return
	}

	budget, err := h.budgetService.UpdateBudget(ctx, userID, budgetID, &req)
	if err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFoundWithContext(ctx, w, "budget not found")
			return
		}
		httputil.BadRequestWithContext(ctx, w, err.Error())
		return
	}

	httputil.Success(w, budget.ToBudgetResponse())
}

// DeleteBudget handles DELETE /api/v1/budgets/{id}
func (h *BudgetHandler) DeleteBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "user not found in context")
		return
	}

	budgetIDStr := chi.URLParam(r, "id")
	budgetID, err := uuid.Parse(budgetIDStr)
	if err != nil {
		httputil.BadRequestWithContext(ctx, w, "invalid budget ID")
		return
	}

	if err := h.budgetService.DeleteBudget(ctx, userID, budgetID); err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFoundWithContext(ctx, w, "budget not found")
			return
		}
		httputil.InternalServerErrorWithContext(ctx, w, "failed to delete budget")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "budget deleted successfully",
	})
}
