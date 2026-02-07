package handler

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

func withCategoryRouteParam(req *http.Request, categoryID string) *http.Request {
	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add("id", categoryID)
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, routeCtx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, uuid.New())
	return req.WithContext(ctx)
}

func TestWalletHandler_CreateCategory_DuplicateReturnsConflict(t *testing.T) {
	h := &WalletHandler{
		categoryService: &categoryServiceStub{
			createCategoryFn: func(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
				return nil, repository.ErrCategoryAlreadyExists
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/wallet/categories", bytes.NewBufferString(`{"name":"food"}`))
	req = withUser(req)
	rr := httptest.NewRecorder()

	h.CreateCategory(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d", rr.Code)
	}
}

func TestWalletHandler_CreateCategory_WhitespaceNameRejected(t *testing.T) {
	h := &WalletHandler{categoryService: &categoryServiceStub{}}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/wallet/categories", bytes.NewBufferString(`{"name":"   "}`))
	req = withUser(req)
	rr := httptest.NewRecorder()

	h.CreateCategory(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestWalletHandler_DeleteCategory_NotFound(t *testing.T) {
	h := &WalletHandler{
		categoryService: &categoryServiceStub{
			deleteCategoryFn: func(ctx context.Context, userID, categoryID uuid.UUID) error {
				return repository.ErrCategoryNotFound
			},
		},
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/wallet/categories/123", nil)
	req = withCategoryRouteParam(req, uuid.New().String())
	rr := httptest.NewRecorder()

	h.DeleteCategory(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rr.Code)
	}
}

func TestWalletHandler_DeleteCategory_DefaultProtected(t *testing.T) {
	h := &WalletHandler{
		categoryService: &categoryServiceStub{
			deleteCategoryFn: func(ctx context.Context, userID, categoryID uuid.UUID) error {
				return repository.ErrCategoryDefaultProtected
			},
		},
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/wallet/categories/123", nil)
	req = withCategoryRouteParam(req, uuid.New().String())
	rr := httptest.NewRecorder()

	h.DeleteCategory(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}
