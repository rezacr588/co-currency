package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
)

// GetTransactions handles GET /api/v1/wallet/transactions.
func (h *WalletHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	filter, err := parseTransactionFilter(r)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	maxLimit := 500
	if hasTransactionFilter(filter) {
		maxLimit = 2000
	}

	limit, offset, ok := parsePaginationParamsWithMax(w, r, maxLimit)
	if !ok {
		return
	}

	var transactions []model.Transaction
	var total int

	if hasTransactionFilter(filter) {
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

// ExportTransactions handles GET /api/v1/wallet/transactions/export.
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

	filter, err := parseTransactionFilter(r)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	transactions, _, err := h.walletService.GetTransactionsFiltered(r.Context(), userID, filter, 10000, 0)
	if err != nil {
		httputil.InternalServerError(w, "failed to get transactions")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=transactions.csv")

	var csvBuilder strings.Builder
	csvBuilder.WriteString("Date,Type,Amount,Currency,Category,Description\n")

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

	if _, err := w.Write([]byte(csvBuilder.String())); err != nil {
		log.Error().Err(err).Msg("Failed to write CSV export response")
	}
}

// GetTransaction handles GET /api/v1/wallet/transactions/{id}.
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

// DeleteTransaction handles DELETE /api/v1/wallet/transactions/{id}.
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

// UpdateTransaction handles PUT /api/v1/wallet/transactions/{id}.
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

// GetTransactionTags handles GET /api/v1/wallet/transactions/{id}/tags.
func (h *WalletHandler) GetTransactionTags(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	txID, ok := parseTransactionIDParam(w, r)
	if !ok {
		return
	}

	tags, err := h.walletService.GetTransactionTags(r.Context(), userID, txID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
		return
	}

	httputil.Success(w, map[string]interface{}{"tags": tags})
}

// AddTransactionTag handles POST /api/v1/wallet/transactions/{id}/tags.
func (h *WalletHandler) AddTransactionTag(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	txID, ok := parseTransactionIDParam(w, r)
	if !ok {
		return
	}
	var req struct {
		TagID string `json:"tag_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}
	tagID, err := uuid.Parse(strings.TrimSpace(req.TagID))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid tag ID", err)
		return
	}
	if err := h.walletService.AddTransactionTag(r.Context(), userID, txID, tagID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		if errors.Is(err, repository.ErrTagNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "tag not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
		return
	}
	httputil.Success(w, map[string]string{"message": "tag added to transaction"})
}

// RemoveTransactionTag handles DELETE /api/v1/wallet/transactions/{id}/tags/{tagID}.
func (h *WalletHandler) RemoveTransactionTag(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.walletService != nil, "wallet service not available - database connection failed") {
		return
	}
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	txID, ok := parseTransactionIDParam(w, r)
	if !ok {
		return
	}
	tagID, err := uuid.Parse(chi.URLParam(r, "tagID"))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid tag ID", err)
		return
	}
	if err := h.walletService.RemoveTransactionTag(r.Context(), userID, txID, tagID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		if errors.Is(err, repository.ErrTagNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "tag not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
		return
	}
	httputil.Success(w, map[string]string{"message": "tag removed from transaction"})
}

// ImportTransactions handles POST /api/v1/wallet/transactions/import.
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

// escapeCSVField prevents CSV injection by neutralizing formula-triggering characters
// and properly quoting fields that contain special CSV characters.
func escapeCSVField(field string) string {
	if len(field) > 0 {
		firstChar := field[0]
		// Characters that can trigger formula execution in spreadsheet applications
		if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' ||
			firstChar == '\t' || firstChar == '\r' || firstChar == '\n' ||
			firstChar == '|' || firstChar == '\\' {
			// Wrap in quotes with a leading tab to neutralize formula injection.
			// The tab prevents spreadsheet apps from interpreting the content as a formula.
			field = strings.ReplaceAll(field, "\"", "\"\"")
			return "\"\t" + field + "\""
		}
	}

	if strings.ContainsAny(field, ",\"\r\n") {
		field = strings.ReplaceAll(field, "\"", "\"\"")
		field = "\"" + field + "\""
	}

	return field
}

func parsePaginationParams(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	return parsePaginationParamsWithMax(w, r, 500)
}

func parseTransactionIDParam(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	txIDStr := chi.URLParam(r, "id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid transaction ID", err)
		return uuid.Nil, false
	}
	return txID, true
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

func parseTransactionFilter(r *http.Request) (*model.TransactionFilter, error) {
	query := r.URL.Query()

	filter := &model.TransactionFilter{
		Search:   strings.TrimSpace(query.Get("search")),
		Category: strings.TrimSpace(query.Get("category")),
		Type:     strings.TrimSpace(query.Get("type")),
		Currency: strings.TrimSpace(query.Get("currency")),
		FromDate: strings.TrimSpace(query.Get("from_date")),
		ToDate:   strings.TrimSpace(query.Get("to_date")),
	}

	// Input length validation
	if len(filter.Search) > 500 {
		return nil, errors.New("search query too long (max 500 characters)")
	}
	if len(filter.Category) > 100 {
		return nil, errors.New("category too long (max 100 characters)")
	}
	if len(filter.Currency) > 10 {
		return nil, errors.New("currency code too long (max 10 characters)")
	}
	// Whitelist transaction types
	if filter.Type != "" {
		switch filter.Type {
		case "credit", "debit", "convert":
			// valid
		default:
			return nil, errors.New("invalid transaction type: must be credit, debit, or convert")
		}
	}

	var fromTS time.Time
	var toTS time.Time
	var err error

	if raw := strings.TrimSpace(query.Get("from_ts")); raw != "" {
		fromTS, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, errors.New("invalid from_ts parameter")
		}
		filter.FromTimestamp = fromTS.UTC().Format(time.RFC3339)
	}

	if raw := strings.TrimSpace(query.Get("to_ts")); raw != "" {
		toTS, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, errors.New("invalid to_ts parameter")
		}
		filter.ToTimestamp = toTS.UTC().Format(time.RFC3339)
	}

	if !fromTS.IsZero() && !toTS.IsZero() && fromTS.After(toTS) {
		return nil, errors.New("from_ts must be less than or equal to to_ts")
	}

	return filter, nil
}

func hasTransactionFilter(filter *model.TransactionFilter) bool {
	if filter == nil {
		return false
	}

	return filter.Search != "" ||
		filter.Category != "" ||
		filter.Type != "" ||
		filter.Currency != "" ||
		filter.FromDate != "" ||
		filter.ToDate != "" ||
		filter.FromTimestamp != "" ||
		filter.ToTimestamp != ""
}
