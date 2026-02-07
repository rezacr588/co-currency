package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
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

// GetCategories handles GET /api/v1/wallet/categories
func (h *WalletHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
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

// CreateCategory handles POST /api/v1/wallet/categories
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

// DeleteCategory handles DELETE /api/v1/wallet/categories/{id}
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

// GetBalances handles GET /api/v1/wallet/balances
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

// GetSummary handles GET /api/v1/wallet/summary
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

// AddTransaction handles POST /api/v1/wallet/transaction
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

// ConvertBalance handles POST /api/v1/wallet/convert
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

// GetTransactions handles GET /api/v1/wallet/transactions
func (h *WalletHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	filter := parseTransactionFilter(r)

	// Check if any filter is set
	hasFilter := filter.Search != "" || filter.Category != "" || filter.Type != "" ||
		filter.Currency != "" || filter.FromDate != "" || filter.ToDate != ""

	maxLimit := 500
	if hasFilter {
		maxLimit = 2000
	}
	limit, offset, ok := parsePaginationParamsWithMax(w, r, maxLimit)
	if !ok {
		return
	}

	var transactions []model.Transaction
	var total int
	var err error

	if hasFilter {
		transactions, total, err = h.walletService.GetTransactionsFiltered(r.Context(), userID, filter, limit, offset)
	} else {
		transactions, err = h.walletService.GetTransactions(r.Context(), userID, limit, offset)
		if err == nil {
			total, err = h.walletService.CountTransactions(r.Context(), userID)
		}
	}

	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get transactions")
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
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
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

	filter := parseTransactionFilter(r)

	// Get all transactions (with high limit)
	transactions, _, err := h.walletService.GetTransactionsFiltered(r.Context(), userID, filter, 10000, 0)
	if err != nil {
		httputil.InternalServerError(w, "failed to get transactions")
		return
	}

	// Set headers for CSV download
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=transactions.csv")

	// Write CSV header and data using strings.Builder for efficiency
	var csvBuilder strings.Builder
	csvBuilder.WriteString("Date,Type,Amount,Currency,Category,Description\n")

	// Write data rows with proper escaping to prevent CSV injection
	for _, tx := range transactions {
		csvBuilder.WriteString(tx.CreatedAt.Format("2006-01-02 15:04:05"))
		csvBuilder.WriteString(",")
		csvBuilder.WriteString(escapeCSVField(tx.Type))
		csvBuilder.WriteString(",")
		csvBuilder.WriteString(strconv.FormatFloat(tx.Amount, 'f', 2, 64))
		csvBuilder.WriteString(",")
		csvBuilder.WriteString(escapeCSVField(tx.Currency))
		csvBuilder.WriteString(",")
		csvBuilder.WriteString(escapeCSVField(tx.Category))
		csvBuilder.WriteString(",")
		csvBuilder.WriteString(escapeCSVField(tx.Description))
		csvBuilder.WriteString("\n")
	}

	w.Write([]byte(csvBuilder.String()))
}

// GetTransaction handles GET /api/v1/wallet/transactions/{id}
func (h *WalletHandler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
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
		if errors.Is(err, repository.ErrTransactionNotFound) {
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
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
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
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "cannot delete this transaction: it would result in a negative balance. Please adjust your balance first.")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete transaction")
		return
	}

	httputil.Success(w, map[string]string{"message": "transaction deleted successfully"})
}

// escapeCSVField properly escapes a field for CSV output to prevent formula injection
func escapeCSVField(field string) string {
	// Check for formula injection characters at the start
	if len(field) > 0 {
		firstChar := field[0]
		if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' || firstChar == '\t' || firstChar == '\r' || firstChar == '\n' {
			// Prefix with single quote to prevent formula execution
			field = "'" + field
		}
	}
	// Check if field contains special characters that require quoting
	if strings.ContainsAny(field, ",\"\r\n") {
		// Escape double quotes by doubling them
		field = strings.ReplaceAll(field, "\"", "\"\"")
		// Wrap in double quotes
		field = "\"" + field + "\""
	}
	return field
}

func parsePaginationParams(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	return parsePaginationParamsWithMax(w, r, 500)
}

func parsePaginationParamsWithMax(w http.ResponseWriter, r *http.Request, maxLimit int) (int, int, bool) {
	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil {
			httputil.BadRequest(w, "invalid limit parameter")
			return 0, 0, false
		}
		if parsed <= 0 || parsed > maxLimit {
			httputil.BadRequest(w, fmt.Sprintf("limit must be between 1 and %d", maxLimit))
			return 0, 0, false
		}
		limit = parsed
	}

	if o := r.URL.Query().Get("offset"); o != "" {
		parsed, err := strconv.Atoi(o)
		if err != nil || parsed < 0 {
			httputil.BadRequest(w, "invalid offset parameter")
			return 0, 0, false
		}
		offset = parsed
	}

	return limit, offset, true
}

func parseTransactionFilter(r *http.Request) *model.TransactionFilter {
	return &model.TransactionFilter{
		Search:   r.URL.Query().Get("search"),
		Category: r.URL.Query().Get("category"),
		Type:     r.URL.Query().Get("type"),
		Currency: r.URL.Query().Get("currency"),
		FromDate: r.URL.Query().Get("from_date"),
		ToDate:   r.URL.Query().Get("to_date"),
	}
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

// UpdateTransaction handles PUT /api/v1/wallet/transactions/{id}
func (h *WalletHandler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
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
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFound(w, "transaction not found")
			return
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequest(w, "insufficient balance")
			return
		}
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Success(w, tx)
}

// ImportTransactions handles POST /api/v1/wallet/transactions/import
func (h *WalletHandler) ImportTransactions(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req struct {
		Transactions []model.TransactionRequest `json:"transactions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	count, err := h.walletService.ImportTransactions(r.Context(), userID, req.Transactions)
	if err != nil {
		httputil.InternalServerError(w, "failed to import transactions")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": fmt.Sprintf("successfully imported %d transactions", count),
		"count":   count,
	})
}
