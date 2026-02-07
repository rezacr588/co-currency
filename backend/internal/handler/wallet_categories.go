package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// GetCategories handles GET /api/v1/wallet/categories.
func (h *WalletHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	if h.categoryService == nil {
		httputil.Success(w, map[string]interface{}{
			"categories": model.DefaultCategories(),
		})
		return
	}

	categories, err := h.categoryService.GetCategories(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get categories")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"categories": categories,
	})
}

// CreateCategory handles POST /api/v1/wallet/categories.
func (h *WalletHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.categoryService != nil, "category service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req struct {
		Name  string `json:"name"`
		Icon  string `json:"icon,omitempty"`
		Color string `json:"color,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httputil.BadRequest(w, "category name is required")
		return
	}

	category, err := h.categoryService.CreateCategory(r.Context(), userID, req.Name, req.Icon, req.Color)
	if err != nil {
		handleCreateCategoryError(r.Context(), w, err)
		return
	}

	httputil.Created(w, category)
}

// DeleteCategory handles DELETE /api/v1/wallet/categories/{id}.
func (h *WalletHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.categoryService != nil, "category service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	categoryIDStr := chi.URLParam(r, "id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid category ID")
		return
	}

	if err := h.categoryService.DeleteCategory(r.Context(), userID, categoryID); err != nil {
		handleDeleteCategoryError(r.Context(), w, err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "category deleted successfully",
	})
}

func handleCreateCategoryError(ctx context.Context, w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrCategoryNameRequired):
		httputil.BadRequestWithContext(ctx, w, err.Error(), err)
	case errors.Is(err, repository.ErrCategoryAlreadyExists):
		httputil.ErrorWithContext(ctx, w, http.StatusConflict, "conflict", "category already exists", err)
	default:
		httputil.InternalServerErrorWithContext(ctx, w, "failed to create category", err)
	}
}

func handleDeleteCategoryError(ctx context.Context, w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrCategoryNotFound):
		httputil.NotFoundWithContext(ctx, w, "category not found", err)
	case errors.Is(err, repository.ErrCategoryDefaultProtected):
		httputil.BadRequestWithContext(ctx, w, "default categories cannot be deleted", err)
	default:
		httputil.InternalServerErrorWithContext(ctx, w, "failed to delete category", err)
	}
}
