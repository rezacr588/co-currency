package handler

import (
	"errors"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
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
	userID, ok := requireUserID(w, r)
	if !ok {
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
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	req, ok := decodeJSON[model.CreateBudgetRequest](w, r)
	if !ok {
		return
	}

	budget, err := h.budgetService.CreateBudget(ctx, userID, req)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetExists) {
			httputil.BadRequest(w, "budget already exists for this category and period")
			return
		}
		httputil.BadRequestWithContext(ctx, w, "failed to create budget")
		return
	}

	httputil.Created(w, budget.ToBudgetResponse())
}

// UpdateBudget handles PUT /api/v1/budgets/{id}
func (h *BudgetHandler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	budgetID, ok := parseUUIDParam(w, r, "id", "budget")
	if !ok {
		return
	}

	req, ok := decodeJSON[model.UpdateBudgetRequest](w, r)
	if !ok {
		return
	}

	budget, err := h.budgetService.UpdateBudget(ctx, userID, budgetID, req)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			httputil.NotFoundWithContext(ctx, w, "budget not found")
			return
		}
		httputil.BadRequestWithContext(ctx, w, "failed to update budget")
		return
	}

	httputil.Success(w, budget.ToBudgetResponse())
}

// DeleteBudget handles DELETE /api/v1/budgets/{id}
func (h *BudgetHandler) DeleteBudget(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	budgetID, ok := parseUUIDParam(w, r, "id", "budget")
	if !ok {
		return
	}

	if err := h.budgetService.DeleteBudget(ctx, userID, budgetID); err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
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
