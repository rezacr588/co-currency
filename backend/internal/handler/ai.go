package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AIHandler handles AI-related endpoints
type AIHandler struct {
	aiService        *service.AIService
	walletService    *service.WalletService
	recurringService *service.RecurringService
	goalService      *service.GoalService
	adviceService    *service.AdviceService
}

// NewAIHandler creates a new AIHandler
func NewAIHandler(aiService *service.AIService, walletService *service.WalletService) *AIHandler {
	return &AIHandler{
		aiService:     aiService,
		walletService: walletService,
	}
}

// SetRecurringService sets the recurring service (for dependency injection)
func (h *AIHandler) SetRecurringService(recurringService *service.RecurringService) {
	h.recurringService = recurringService
}

// SetGoalService sets the goal service (for dependency injection)
func (h *AIHandler) SetGoalService(goalService *service.GoalService) {
	h.goalService = goalService
}

// SetAdviceService sets the advice service (for dependency injection)
func (h *AIHandler) SetAdviceService(adviceService *service.AdviceService) {
	h.adviceService = adviceService
}

// GetPersonalizedAdvice handles GET /api/v1/ai/advice
func (h *AIHandler) GetPersonalizedAdvice(w http.ResponseWriter, r *http.Request) {
	if h.adviceService == nil {
		httputil.ServiceUnavailableWithContext(r.Context(), w, "advice service not configured")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	lang := r.URL.Query().Get("lang")

	advice, err := h.adviceService.GetAdvice(r.Context(), userID, lang)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to generate advice", err)
		return
	}

	httputil.Success(w, advice)
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

// DetectIntent handles POST /api/v1/ai/detect-intent
func (h *AIHandler) DetectIntent(w http.ResponseWriter, r *http.Request) {
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

	result, err := h.aiService.DetectIntent(r.Context(), req.Text)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to detect intent", err)
		return
	}

	httputil.Success(w, result)
}

// SmartParse handles POST /api/v1/ai/smart-parse
func (h *AIHandler) SmartParse(w http.ResponseWriter, r *http.Request) {
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

	result, err := h.aiService.SmartParse(r.Context(), req.Text)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to smart parse text", err)
		return
	}

	httputil.Success(w, result)
}

// ApplyRecurring handles POST /api/v1/ai/apply-recurring
func (h *AIHandler) ApplyRecurring(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	if h.recurringService == nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "recurring service not configured", nil)
		return
	}

	var req model.ApplyRecurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate required fields
	if req.Amount <= 0 {
		httputil.BadRequestWithContext(r.Context(), w, "amount must be positive", nil)
		return
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.Frequency == "" {
		req.Frequency = "monthly"
	}

	// Calculate next execution date (default to tomorrow)
	nextExecution := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	recurringReq := &model.CreateRecurringRequest{
		Type:          req.Type,
		Amount:        req.Amount,
		Currency:      strings.ToUpper(req.Currency),
		Category:      req.Category,
		Description:   req.Description,
		Frequency:     req.Frequency,
		NextExecution: nextExecution,
	}

	recurring, err := h.recurringService.CreateRecurring(r.Context(), userID, recurringReq)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "failed to create recurring transaction", err)
		return
	}

	httputil.Created(w, recurring)
}

// ApplyGoalContribution handles POST /api/v1/ai/apply-goal-contribution
func (h *AIHandler) ApplyGoalContribution(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	if h.goalService == nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "goal service not configured", nil)
		return
	}

	var req model.ApplyGoalContributionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		httputil.BadRequestWithContext(r.Context(), w, "amount must be positive", nil)
		return
	}

	var goalID uuid.UUID
	var err error

	// Try to parse goal_id first
	if req.GoalID != "" {
		goalID, err = uuid.Parse(req.GoalID)
		if err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "invalid goal_id format", err)
			return
		}
	} else if req.GoalName != "" {
		// Search for goal by name
		goals, err := h.goalService.GetGoals(r.Context(), userID)
		if err != nil {
			httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch goals", err)
			return
		}

		// Find goal by name (case-insensitive partial match)
		lowerName := strings.ToLower(req.GoalName)
		for _, g := range goals {
			if strings.Contains(strings.ToLower(g.Name), lowerName) {
				goalID = g.ID
				break
			}
		}

		if goalID == uuid.Nil {
			httputil.BadRequestWithContext(r.Context(), w, "no matching goal found for: "+req.GoalName, nil)
			return
		}
	} else {
		httputil.BadRequestWithContext(r.Context(), w, "goal_id or goal_name is required", nil)
		return
	}

	// Contribute to goal
	contributeReq := &model.ContributeToGoalRequest{
		Amount: req.Amount,
	}

	goal, transaction, err := h.goalService.ContributeToGoal(r.Context(), userID, goalID, contributeReq)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			httputil.BadRequestWithContext(r.Context(), w, "insufficient balance", err)
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to contribute to goal", err)
		return
	}

	httputil.Created(w, map[string]interface{}{
		"goal":        goal,
		"transaction": transaction,
	})
}
