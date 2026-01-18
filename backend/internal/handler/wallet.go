package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// WalletHandler handles wallet endpoints
type WalletHandler struct {
	walletService   *service.WalletService
	categoryService *service.CategoryService
}

// NewWalletHandler creates a new WalletHandler
func NewWalletHandler(walletService *service.WalletService) *WalletHandler {
	return &WalletHandler{walletService: walletService}
}

// NewWalletHandlerWithCategories creates a new WalletHandler with category support
func NewWalletHandlerWithCategories(walletService *service.WalletService, categoryService *service.CategoryService) *WalletHandler {
	return &WalletHandler{
		walletService:   walletService,
		categoryService: categoryService,
	}
}

// serviceUnavailable returns true and sends an error response if wallet service is not available
func (h *WalletHandler) serviceUnavailable(w http.ResponseWriter) bool {
	if h.walletService == nil {
		httputil.ServiceUnavailable(w, "wallet service not available - database connection failed")
		return true
	}
	return false
}

// GetCategories handles GET /api/v1/wallet/categories
func (h *WalletHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	if h.categoryService == nil {
		// Return default categories if service not configured
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

// GetBalances handles GET /api/v1/wallet/balances
func (h *WalletHandler) GetBalances(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
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

// GetSummary handles GET /api/v1/wallet/summary
func (h *WalletHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	summary, err := h.walletService.GetWalletSummary(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get wallet summary")
		return
	}

	httputil.Success(w, summary)
}

// AddTransaction handles POST /api/v1/wallet/transaction
func (h *WalletHandler) AddTransaction(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	tx, err := h.walletService.AddTransaction(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, tx)
}

// ConvertBalance handles POST /api/v1/wallet/convert
func (h *WalletHandler) ConvertBalance(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.ConvertBalanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	result, err := h.walletService.ConvertBalance(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, result)
}

// GetTransactions handles GET /api/v1/wallet/transactions
func (h *WalletHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	// Parse pagination params
	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Parse filter params
	filter := &model.TransactionFilter{
		Search:   r.URL.Query().Get("search"),
		Category: r.URL.Query().Get("category"),
		Type:     r.URL.Query().Get("type"),
		Currency: r.URL.Query().Get("currency"),
		FromDate: r.URL.Query().Get("from_date"),
		ToDate:   r.URL.Query().Get("to_date"),
	}

	// Check if any filter is set
	hasFilter := filter.Search != "" || filter.Category != "" || filter.Type != "" ||
		filter.Currency != "" || filter.FromDate != "" || filter.ToDate != ""

	var transactions []model.Transaction
	var total int
	var err error

	if hasFilter {
		transactions, total, err = h.walletService.GetTransactionsFiltered(r.Context(), userID, filter, limit, offset)
	} else {
		transactions, err = h.walletService.GetTransactions(r.Context(), userID, limit, offset)
		total = len(transactions) // Approximate for non-filtered queries
	}

	if err != nil {
		httputil.InternalServerError(w, "failed to get transactions")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"transactions": transactions,
		"total":        total,
		"limit":        limit,
		"offset":       offset,
	})
}

// ExportTransactions handles GET /api/v1/wallet/transactions/export
func (h *WalletHandler) ExportTransactions(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	if format != "csv" {
		httputil.BadRequest(w, "only csv format is supported")
		return
	}

	// Parse filter params
	filter := &model.TransactionFilter{
		Search:   r.URL.Query().Get("search"),
		Category: r.URL.Query().Get("category"),
		Type:     r.URL.Query().Get("type"),
		Currency: r.URL.Query().Get("currency"),
		FromDate: r.URL.Query().Get("from_date"),
		ToDate:   r.URL.Query().Get("to_date"),
	}

	// Get all transactions (with high limit)
	transactions, _, err := h.walletService.GetTransactionsFiltered(r.Context(), userID, filter, 10000, 0)
	if err != nil {
		httputil.InternalServerError(w, "failed to get transactions")
		return
	}

	// Set headers for CSV download
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=transactions.csv")

	// Write CSV header
	csvWriter := "Date,Type,Amount,Currency,Category,Description\n"

	// Write data rows
	for _, tx := range transactions {
		csvWriter += tx.CreatedAt.Format("2006-01-02 15:04:05") + ","
		csvWriter += tx.Type + ","
		csvWriter += strconv.FormatFloat(tx.Amount, 'f', 2, 64) + ","
		csvWriter += tx.Currency + ","
		csvWriter += tx.Category + ","
		// Escape description for CSV
		desc := tx.Description
		if desc != "" {
			desc = "\"" + desc + "\""
		}
		csvWriter += desc + "\n"
	}

	w.Write([]byte(csvWriter))
}

// GetTransaction handles GET /api/v1/wallet/transactions/{id}
func (h *WalletHandler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	txIDStr := chi.URLParam(r, "id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid transaction ID")
		return
	}

	tx, err := h.walletService.GetTransaction(r.Context(), userID, txID)
	if err != nil {
		if err.Error() == "transaction not found" {
			httputil.NotFound(w, "transaction not found")
			return
		}
		httputil.InternalServerError(w, "failed to get transaction")
		return
	}

	httputil.Success(w, tx)
}

// DeleteTransaction handles DELETE /api/v1/wallet/transactions/{id}
func (h *WalletHandler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	txIDStr := chi.URLParam(r, "id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid transaction ID")
		return
	}

	err = h.walletService.DeleteTransaction(r.Context(), userID, txID)
	if err != nil {
		if err.Error() == "transaction not found" {
			httputil.NotFound(w, "transaction not found")
			return
		}
		httputil.InternalServerError(w, "failed to delete transaction")
		return
	}

	httputil.Success(w, map[string]string{"message": "transaction deleted successfully"})
}

// UpdateTransaction handles PUT /api/v1/wallet/transactions/{id}
func (h *WalletHandler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	if h.serviceUnavailable(w) {
		return
	}

	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	txIDStr := chi.URLParam(r, "id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid transaction ID")
		return
	}

	var req model.UpdateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	tx, err := h.walletService.UpdateTransaction(r.Context(), userID, txID, &req)
	if err != nil {
		if err.Error() == "transaction not found" {
			httputil.NotFound(w, "transaction not found")
			return
		}
		if err.Error() == "insufficient balance" {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, tx)
}
