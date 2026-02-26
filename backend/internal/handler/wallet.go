package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// WalletServiceAPI is the handler-facing contract for wallet operations.
type WalletServiceAPI interface {
	GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error)
	GetWalletSummary(ctx context.Context, userID uuid.UUID) (*model.WalletSummary, error)
	AddTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error)
	ConvertBalance(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error)
	GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error)
	CountTransactions(ctx context.Context, userID uuid.UUID) (int, error)
	GetTransactionsFiltered(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error)
	GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error)
	DeleteTransaction(ctx context.Context, userID, txID uuid.UUID) error
	UpdateTransaction(ctx context.Context, userID, txID uuid.UUID, req *model.UpdateTransactionRequest) (*model.Transaction, error)
	ImportTransactions(ctx context.Context, userID uuid.UUID, req []model.TransactionRequest) (int, error)
	GetTransactionTags(ctx context.Context, userID, txID uuid.UUID) ([]model.Tag, error)
	AddTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error
	RemoveTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error
}

// CategoryServiceAPI is the handler-facing contract for category operations.
type CategoryServiceAPI interface {
	GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error)
	CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error)
	DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error
}

var _ WalletServiceAPI = (*service.WalletService)(nil)
var _ CategoryServiceAPI = (*service.CategoryService)(nil)

// WalletHandler handles wallet endpoints.
type WalletHandler struct {
	walletService   WalletServiceAPI
	categoryService CategoryServiceAPI
}

// NewWalletHandler creates a new WalletHandler.
func NewWalletHandler(walletService *service.WalletService) *WalletHandler {
	var walletAPI WalletServiceAPI
	if walletService != nil {
		walletAPI = walletService
	}
	return &WalletHandler{walletService: walletAPI}
}

// NewWalletHandlerWithCategories creates a new WalletHandler with category support.
func NewWalletHandlerWithCategories(walletService *service.WalletService, categoryService *service.CategoryService) *WalletHandler {
	var walletAPI WalletServiceAPI
	if walletService != nil {
		walletAPI = walletService
	}

	var categoryAPI CategoryServiceAPI
	if categoryService != nil {
		categoryAPI = categoryService
	}

	return &WalletHandler{
		walletService:   walletAPI,
		categoryService: categoryAPI,
	}
}

// GetBalances handles GET /api/v1/wallet/balances.
func (h *WalletHandler) GetBalances(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	balances, err := h.walletService.GetBalances(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get balances")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"balances": balances,
	})
}

// GetSummary handles GET /api/v1/wallet/summary.
func (h *WalletHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	summary, err := h.walletService.GetWalletSummary(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get wallet summary")
		return
	}

	httputil.Success(w, summary)
}

// AddTransaction handles POST /api/v1/wallet/transaction.
func (h *WalletHandler) AddTransaction(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	tx, err := h.walletService.AddTransaction(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, tx)
}

// ConvertBalance handles POST /api/v1/wallet/convert.
func (h *WalletHandler) ConvertBalance(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.ConvertBalanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	result, err := h.walletService.ConvertBalance(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, result)
}
