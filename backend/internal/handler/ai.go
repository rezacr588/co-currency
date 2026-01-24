package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AIHandler handles AI-related endpoints
type AIHandler struct {
	aiService     *service.AIService
	walletService *service.WalletService
}

// NewAIHandler creates a new AIHandler
func NewAIHandler(aiService *service.AIService, walletService *service.WalletService) *AIHandler {
	return &AIHandler{
		aiService:     aiService,
		walletService: walletService,
	}
}

// ParseReceipt handles POST /api/v1/ai/parse-receipt
// Currently disabled - image parsing not supported with current AI provider
func (h *AIHandler) ParseReceipt(w http.ResponseWriter, r *http.Request) {
	httputil.BadRequest(w, "Image parsing is not currently available. Please use /api/v1/ai/parse-text with extracted text from your receipt instead. You can use your phone's camera app or Google Lens to extract text from images.")
}

// ParseReceiptText handles POST /api/v1/ai/parse-text
func (h *AIHandler) ParseReceiptText(w http.ResponseWriter, r *http.Request) {
	if h.aiService == nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "AI service not configured", nil)
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	if req.Text == "" {
		httputil.BadRequestWithContext(r.Context(), w, "text is required", nil)
		return
	}

	result, err := h.aiService.ParseReceiptText(r.Context(), req.Text)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to parse text", err)
		return
	}

	httputil.Success(w, result)
}

// ApplyParsed handles POST /api/v1/ai/apply-parsed
func (h *AIHandler) ApplyParsed(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.ApplyParsedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Use regular AddTransaction which supports cross-currency
	txReq := &model.TransactionRequest{
		Type:           req.Type,
		Amount:         req.Amount,
		Currency:       req.Currency,
		WalletCurrency: req.WalletCurrency, // Support cross-currency transactions
		Category:       "ai_receipt",
		Description:    req.Description,
	}

	tx, err := h.walletService.AddTransaction(r.Context(), userID, txReq)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "failed to apply parsed result", err)
		return
	}

	httputil.Created(w, tx)
}

// GetStatus handles GET /api/v1/ai/status
func (h *AIHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"configured": h.aiService != nil && h.aiService.IsConfigured(),
	}

	if h.aiService != nil {
		status["provider"] = h.aiService.GetProvider()
	}

	httputil.Success(w, status)
}
