package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// MockAIServiceForHandler provides mock AI service for handler testing
type MockAIServiceForHandler struct {
	isConfigured    bool
	provider        string
	parseTextResult *model.AIParseResult
	parseTextErr    error
}

func NewMockAIServiceForHandler() *MockAIServiceForHandler {
	return &MockAIServiceForHandler{
		isConfigured: true,
		provider:     "googleai",
		parseTextResult: &model.AIParseResult{
			Amount:      100,
			Currency:    "USD",
			Type:        "debit",
			Description: "Test purchase",
			Confidence:  0.9,
		},
	}
}

func (m *MockAIServiceForHandler) IsConfigured() bool {
	return m.isConfigured
}

func (m *MockAIServiceForHandler) GetProvider() string {
	return m.provider
}

func (m *MockAIServiceForHandler) ParseReceiptText(ctx context.Context, text string) (*model.AIParseResult, error) {
	if m.parseTextErr != nil {
		return nil, m.parseTextErr
	}
	result := *m.parseTextResult
	result.RawText = text
	return &result, nil
}

// MockWalletServiceForAIHandler provides mock wallet service for AI handler testing
type MockWalletServiceForAIHandler struct {
	walletRepo *MockWalletRepoForHandler
}

func NewMockWalletServiceForAIHandler(walletRepo *MockWalletRepoForHandler) *MockWalletServiceForAIHandler {
	return &MockWalletServiceForAIHandler{
		walletRepo: walletRepo,
	}
}

func (s *MockWalletServiceForAIHandler) ApplyAIParsedResult(ctx context.Context, userID uuid.UUID, parsed *model.AIParseResult) (*model.Transaction, error) {
	if parsed.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	if parsed.Currency == "" {
		return nil, errors.New("currency is required")
	}

	if parsed.Type != "credit" && parsed.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	delta := parsed.Amount
	if parsed.Type == "debit" {
		delta = -parsed.Amount
	}

	_, err := s.walletRepo.UpdateBalance(ctx, userID, parsed.Currency, delta)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, err
	}

	tx := &model.Transaction{
		ID:          uuid.New(),
		UserID:      userID,
		Type:        parsed.Type,
		Amount:      parsed.Amount,
		Currency:    parsed.Currency,
		Source:      "ai_receipt",
		Description: parsed.Description,
		CreatedAt:   time.Now(),
	}

	return tx, nil
}

// AIHandlerWithMock wraps AIHandler with mock services
type AIHandlerWithMock struct {
	aiService         *MockAIServiceForHandler
	walletService     *MockWalletServiceForAIHandler
	aiRateLimitPerMin int
	aiRateLimitBurst  int
}

func NewAIHandlerWithMock(aiService *MockAIServiceForHandler, walletService *MockWalletServiceForAIHandler) *AIHandlerWithMock {
	return &AIHandlerWithMock{
		aiService:         aiService,
		walletService:     walletService,
		aiRateLimitPerMin: 20,
		aiRateLimitBurst:  5,
	}
}

func (h *AIHandlerWithMock) ParseReceipt(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusBadRequest, map[string]interface{}{
		"error":   "bad_request",
		"code":    400,
		"message": "Image parsing is not currently available. Please use /api/v1/ai/parse-text with extracted text from your receipt instead.",
	})
}

func (h *AIHandlerWithMock) ParseReceiptText(w http.ResponseWriter, r *http.Request) {
	if h.aiService == nil || !h.aiService.IsConfigured() {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "internal_error",
			"code":    500,
			"message": "AI service not configured",
		})
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "bad_request",
			"code":    400,
			"message": "invalid request body",
		})
		return
	}

	if req.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "bad_request",
			"code":    400,
			"message": "text is required",
		})
		return
	}

	result, err := h.aiService.ParseReceiptText(r.Context(), req.Text)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "internal_error",
			"code":    500,
			"message": "failed to parse text: " + err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *AIHandlerWithMock) ApplyParsed(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"error":   "unauthorized",
			"code":    401,
			"message": "user not found in context",
		})
		return
	}

	var req model.ApplyParsedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "bad_request",
			"code":    400,
			"message": "invalid request body",
		})
		return
	}

	parsed := &model.AIParseResult{
		Amount:      req.Amount,
		Currency:    req.Currency,
		Type:        req.Type,
		Description: req.Description,
	}

	tx, err := h.walletService.ApplyAIParsedResult(r.Context(), userID, parsed)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "bad_request",
			"code":    400,
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusCreated, tx)
}

func (h *AIHandlerWithMock) GetStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"configured":            h.aiService != nil && h.aiService.IsConfigured(),
		"rate_limit_per_minute": h.aiRateLimitPerMin,
		"rate_limit_burst":      h.aiRateLimitBurst,
	}

	if h.aiService != nil {
		status["provider"] = h.aiService.GetProvider()
	}

	writeJSON(w, http.StatusOK, status)
}

// Tests for ParseReceipt Handler
func TestParseReceiptHandler_Disabled(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	req := httptest.NewRequest("POST", "/api/v1/ai/parse-receipt", nil)
	rr := httptest.NewRecorder()

	handler.ParseReceipt(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

// Tests for ParseReceiptText Handler
func TestParseReceiptTextHandler_Success(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{"text": "Receipt: Coffee $5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var result model.AIParseResult
	json.NewDecoder(rr.Body).Decode(&result)

	if result.Amount != 100 {
		t.Errorf("Expected amount 100, got %f", result.Amount)
	}

	if result.Currency != "USD" {
		t.Errorf("Expected currency USD, got %s", result.Currency)
	}
}

func TestParseReceiptTextHandler_EmptyText(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{"text": ""}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestParseReceiptTextHandler_InvalidJSON(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{invalid json}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestParseReceiptTextHandler_AIServiceNotConfigured(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockAI.isConfigured = false
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{"text": "Receipt: Coffee $5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", rr.Code)
	}
}

func TestParseReceiptTextHandler_AIServiceNil(t *testing.T) {
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(nil, mockWallet)

	body := `{"text": "Receipt: Coffee $5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", rr.Code)
	}
}

func TestParseReceiptTextHandler_AIServiceError(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockAI.parseTextErr = errors.New("AI service error")
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{"text": "Receipt: Coffee $5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", rr.Code)
	}
}

// Tests for ApplyParsed Handler
func TestApplyParsedHandler_CreditSuccess(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()

	body := `{"amount": 100, "currency": "USD", "type": "credit", "description": "AI parsed receipt"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var tx model.Transaction
	json.NewDecoder(rr.Body).Decode(&tx)

	if tx.Type != "credit" {
		t.Errorf("Expected type credit, got %s", tx.Type)
	}

	if tx.Source != "ai_receipt" {
		t.Errorf("Expected source ai_receipt, got %s", tx.Source)
	}
}

func TestApplyParsedHandler_DebitSuccess(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()
	mockWalletRepo.SetBalance(userID, "USD", 100)

	body := `{"amount": 50, "currency": "USD", "type": "debit", "description": "AI parsed expense"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_NoUserInContext(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	body := `{"amount": 100, "currency": "USD", "type": "credit"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_InvalidJSON(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()

	body := `{invalid json}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_InvalidAmount(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()

	body := `{"amount": 0, "currency": "USD", "type": "credit"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_InvalidType(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()

	body := `{"amount": 100, "currency": "USD", "type": "invalid"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_InsufficientBalance(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()
	mockWalletRepo.SetBalance(userID, "USD", 50)

	body := `{"amount": 100, "currency": "USD", "type": "debit"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestApplyParsedHandler_EmptyCurrency(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	userID := uuid.New()

	body := `{"amount": 100, "currency": "", "type": "credit"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

// Tests for GetStatus Handler
func TestGetStatusHandler_Configured(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	handler.GetStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&response)

	configured, ok := response["configured"].(bool)
	if !ok || !configured {
		t.Error("Expected configured to be true")
	}

	provider, ok := response["provider"].(string)
	if !ok || provider != "googleai" {
		t.Errorf("Expected provider googleai, got %v", response["provider"])
	}

	limit, ok := response["rate_limit_per_minute"].(float64)
	if !ok || int(limit) != 20 {
		t.Errorf("Expected rate_limit_per_minute 20, got %v", response["rate_limit_per_minute"])
	}

	burst, ok := response["rate_limit_burst"].(float64)
	if !ok || int(burst) != 5 {
		t.Errorf("Expected rate_limit_burst 5, got %v", response["rate_limit_burst"])
	}
}

func TestGetStatusHandler_NotConfigured(t *testing.T) {
	mockAI := NewMockAIServiceForHandler()
	mockAI.isConfigured = false
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(mockAI, mockWallet)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	handler.GetStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&response)

	configured, ok := response["configured"].(bool)
	if !ok || configured {
		t.Error("Expected configured to be false")
	}
}

func TestGetStatusHandler_NilAIService(t *testing.T) {
	mockWalletRepo := NewMockWalletRepoForHandler()
	mockWallet := NewMockWalletServiceForAIHandler(mockWalletRepo)
	handler := NewAIHandlerWithMock(nil, mockWallet)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	handler.GetStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&response)

	configured, ok := response["configured"].(bool)
	if !ok || configured {
		t.Error("Expected configured to be false when AI service is nil")
	}
}

// Test NewAIHandler
func TestNewAIHandler(t *testing.T) {
	handler := NewAIHandler(nil, nil)
	if handler == nil {
		t.Error("Expected handler to be created")
	}
}

// Test actual handler methods
func TestAIHandler_ParseReceipt_Disabled(t *testing.T) {
	handler := NewAIHandler(nil, nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/parse-receipt", nil)
	rr := httptest.NewRecorder()

	handler.ParseReceipt(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestAIHandler_ParseReceiptText_NoAIService(t *testing.T) {
	handler := NewAIHandler(nil, nil)

	body := `{"text": "Receipt text"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ParseReceiptText(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", rr.Code)
	}
}

func TestAIHandler_ApplyParsed_NoContext(t *testing.T) {
	handler := NewAIHandler(nil, nil)

	body := `{"amount": 100, "currency": "USD", "type": "credit"}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

func TestAIHandler_ApplyParsed_InvalidBody(t *testing.T) {
	handler := NewAIHandler(nil, nil)

	userID := uuid.New()

	body := `{invalid json}`
	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ApplyParsed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", rr.Code)
	}
}

func TestAIHandler_GetStatus_NoAIService(t *testing.T) {
	handler := NewAIHandler(nil, nil)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	handler.GetStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&response)

	configured, ok := response["configured"].(bool)
	if !ok || configured {
		t.Error("Expected configured to be false")
	}
}

func TestAIHandler_GetStatus_CustomRateLimit(t *testing.T) {
	handler := NewAIHandler(nil, nil)
	handler.SetRateLimitInfo(42, 9)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	handler.GetStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&response)

	limit, ok := response["rate_limit_per_minute"].(float64)
	if !ok || int(limit) != 42 {
		t.Errorf("Expected rate_limit_per_minute 42, got %v", response["rate_limit_per_minute"])
	}

	burst, ok := response["rate_limit_burst"].(float64)
	if !ok || int(burst) != 9 {
		t.Errorf("Expected rate_limit_burst 9, got %v", response["rate_limit_burst"])
	}
}
