package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/middleware"
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
		httputil.InternalServerError(w, "AI service not configured")
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	if req.Text == "" {
		httputil.BadRequest(w, "text is required")
		return
	}

	result, err := h.aiService.ParseReceiptText(r.Context(), req.Text)
	if err != nil {
		httputil.InternalServerError(w, "failed to parse text: "+err.Error())
		return
	}

	httputil.Success(w, result)
}

// ApplyParsed handles POST /api/v1/ai/apply-parsed
func (h *AIHandler) ApplyParsed(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.ApplyParsedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	// Convert to AIParseResult
	parsed := &model.AIParseResult{
		Amount:      req.Amount,
		Currency:    req.Currency,
		Type:        req.Type,
		Description: req.Description,
	}

	tx, err := h.walletService.ApplyAIParsedResult(r.Context(), userID, parsed)
	if err != nil {
		httputil.BadRequest(w, err.Error())
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
