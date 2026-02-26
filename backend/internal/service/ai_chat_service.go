package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	gocache "github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

// AIChatService handles AI-powered financial advisor chat with full context
type AIChatService struct {
	aiService        *AIService
	exchangeService  *ExchangeService
	chatRepo         *repository.ChatRepository
	walletRepo       *repository.WalletRepository
	goalRepo         *repository.GoalRepository
	budgetRepo       *repository.BudgetRepository
	userRepo         *repository.UserRepository
	recurringRepo    *repository.RecurringRepository
	memoryRepo       *repository.MemoryRepository
	memoryService    *MemoryService // Semantic memory with Qdrant
	loanRepo         *repository.LoanRepository
	categoryRepo     *repository.CategoryRepository
	reportsService   *ReportsService
	subscriptionRepo *repository.SubscriptionRepository
	noteRepo         *repository.NoteRepository
	toolExecutor     *AIToolExecutor
	contextCache     *gocache.Cache // In-memory cache for financial context per user
	fastModel        string
	thinkingModel    string
	defaultMode      model.ChatThinkingMode
}

var (
	ErrConversationNotFound  = errors.New("conversation not found")
	ErrInvalidConversationID = errors.New("invalid conversation id")
	errNoAIResponse          = errors.New("no response from AI")

	// promptInjectionPattern matches lines that look like prompt override attempts
	promptInjectionPattern = regexp.MustCompile(`(?i)^(SYSTEM:|You are |Ignore previous|Forget all|Disregard|New instructions:|ASSISTANT:|<\|im_start\||<\|system\|)`)
)

type currencyConverterFunc func(ctx context.Context, from, to string, amount float64) (*model.ConversionResult, error)

type chatTraceCallback func(step string, fields map[string]interface{})

func emitChatTrace(
	ctx context.Context,
	userID uuid.UUID,
	conversationID string,
	step string,
	fields map[string]interface{},
	cb chatTraceCallback,
) {
	traceID := ctxkeys.GetTraceID(ctx)

	eventFields := map[string]interface{}{
		"step":     step,
		"user_id":  userID.String(),
		"trace_id": traceID,
	}
	if conversationID != "" {
		eventFields["conversation_id"] = conversationID
	}
	for k, v := range fields {
		eventFields[k] = v
	}

	logEvent := log.Info().
		Str("component", "ai_chat").
		Str("step", step).
		Str("user_id", userID.String())
	if traceID != "" {
		logEvent = logEvent.Str("trace_id", traceID)
	}
	if conversationID != "" {
		logEvent = logEvent.Str("conversation_id", conversationID)
	}
	for k, v := range fields {
		logEvent = logEvent.Interface(k, v)
	}
	logEvent.Msg("AI chat trace")

	if cb != nil {
		cb(step, eventFields)
	}
}

// sanitizeForPrompt sanitizes user-provided data before interpolation into the system prompt.
// It strips characters that could be used for prompt injection and limits length.
func sanitizeForPrompt(s string, maxLen int) string {
	if s == "" {
		return s
	}

	// Remove control characters (except common whitespace)
	var sb strings.Builder
	for _, r := range s {
		if r == '\n' || r == '\r' || r == '\t' || (r >= 32 && r < 127) || (r >= 160) {
			sb.WriteRune(r)
		}
	}
	s = sb.String()

	// Remove lines that look like prompt injection attempts
	lines := strings.Split(s, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !promptInjectionPattern.MatchString(trimmed) {
			cleaned = append(cleaned, line)
		}
	}
	s = strings.Join(cleaned, "\n")

	// Truncate to max length
	if len(s) > maxLen {
		s = s[:maxLen]
	}

	return strings.TrimSpace(s)
}

// NewAIChatService creates a new AIChatService
func NewAIChatService(
	aiService *AIService,
	exchangeService *ExchangeService,
	chatRepo *repository.ChatRepository,
	walletRepo *repository.WalletRepository,
	goalRepo *repository.GoalRepository,
	budgetRepo *repository.BudgetRepository,
	userRepo *repository.UserRepository,
	recurringRepo *repository.RecurringRepository,
	memoryRepo *repository.MemoryRepository,
	memoryService *MemoryService,
	loanRepo *repository.LoanRepository,
	categoryRepo *repository.CategoryRepository,
	reportsService *ReportsService,
	subscriptionRepo *repository.SubscriptionRepository,
	noteRepo *repository.NoteRepository,
	tavilyAPIKey string,
) *AIChatService {
	toolExecutor := NewAIToolExecutor(walletRepo, categoryRepo, reportsService, subscriptionRepo, noteRepo, loanRepo, budgetRepo, tavilyAPIKey)
	return &AIChatService{
		aiService:        aiService,
		exchangeService:  exchangeService,
		chatRepo:         chatRepo,
		walletRepo:       walletRepo,
		goalRepo:         goalRepo,
		budgetRepo:       budgetRepo,
		userRepo:         userRepo,
		recurringRepo:    recurringRepo,
		memoryRepo:       memoryRepo,
		memoryService:    memoryService,
		loanRepo:         loanRepo,
		categoryRepo:     categoryRepo,
		reportsService:   reportsService,
		subscriptionRepo: subscriptionRepo,
		noteRepo:         noteRepo,
		toolExecutor:     toolExecutor,
		contextCache:     gocache.New(60*time.Second, 2*time.Minute),
		fastModel:        aiService.GetDefaultModel(),
		thinkingModel:    aiService.GetDefaultModel(),
		defaultMode:      model.ChatThinkingModeAuto,
	}
}

// SetThinkingConfig configures model routing between fast and thinking modes.
func (s *AIChatService) SetThinkingConfig(fastModel, thinkingModel string, defaultMode model.ChatThinkingMode) {
	if strings.TrimSpace(fastModel) != "" {
		s.fastModel = strings.TrimSpace(fastModel)
	}
	if strings.TrimSpace(thinkingModel) != "" {
		s.thinkingModel = strings.TrimSpace(thinkingModel)
	}
	if defaultMode.IsValid() {
		s.defaultMode = defaultMode
	}
}

// GetUsageSummary returns aggregated token and cost usage for the authenticated user.
func (s *AIChatService) GetUsageSummary(ctx context.Context, userID uuid.UUID, days int) (*model.ChatUsageSummary, error) {
	if s.chatRepo == nil {
		return nil, errors.New("chat repository is not configured")
	}
	return s.chatRepo.GetUsageSummary(ctx, userID, days)
}

// CreateConversation creates a new conversation without invoking the LLM.
func (s *AIChatService) CreateConversation(ctx context.Context, userID uuid.UUID, title string) (*model.ChatConversation, error) {
	return s.chatRepo.CreateConversation(ctx, userID, title)
}

type preparedChatInput struct {
	UserMessage  *model.ChatMessage
	LLMMessages  []llms.MessageContent
	BaseCurrency string
	HistoryCount int
}

type modelPricing struct {
	InputUSDPer1K  float64
	OutputUSDPer1K float64
}

var estimatedModelPricingUSD = map[string]modelPricing{
	"gpt-4o-mini":             {InputUSDPer1K: 0.00015, OutputUSDPer1K: 0.00060},
	"gpt-4o":                  {InputUSDPer1K: 0.00500, OutputUSDPer1K: 0.01500},
	"gemini-1.5-flash":        {InputUSDPer1K: 0.000075, OutputUSDPer1K: 0.00030},
	"gemini-1.5-pro":          {InputUSDPer1K: 0.00125, OutputUSDPer1K: 0.00500},
	"gemini-2.0-flash":        {InputUSDPer1K: 0.00010, OutputUSDPer1K: 0.00040},
	"llama-3.3-70b":           {InputUSDPer1K: 0.00060, OutputUSDPer1K: 0.00080},
	"llama-3.3-70b-versatile": {InputUSDPer1K: 0.00060, OutputUSDPer1K: 0.00080},
	"llama-3.1-8b":            {InputUSDPer1K: 0.00005, OutputUSDPer1K: 0.00008},
}

type chatUsageTracker struct {
	provider         string
	model            string
	thinkingMode     string
	promptTokens     int
	completionTokens int
	totalTokens      int
	estimatedCostUSD float64
	billedCostUSD    float64
	hasBilledCost    bool
}

func newChatUsageTracker(provider, modelName string, mode model.ChatThinkingMode) *chatUsageTracker {
	return &chatUsageTracker{
		provider:     provider,
		model:        modelName,
		thinkingMode: string(mode),
	}
}

func (u *chatUsageTracker) addResponse(response *llms.ContentResponse) {
	if response == nil || len(response.Choices) == 0 || response.Choices[0] == nil {
		return
	}

	promptTokens, completionTokens, totalTokens, billedCost := extractUsageFromGenerationInfo(response.Choices[0].GenerationInfo)
	if totalTokens == 0 {
		totalTokens = promptTokens + completionTokens
	}

	u.promptTokens += promptTokens
	u.completionTokens += completionTokens
	u.totalTokens += totalTokens

	if estimatedCost := estimateCostUSDForModel(u.model, promptTokens, completionTokens); estimatedCost > 0 {
		u.estimatedCostUSD += estimatedCost
	}

	if billedCost != nil {
		u.hasBilledCost = true
		u.billedCostUSD += *billedCost
	}
}

func (u *chatUsageTracker) usage() model.ChatUsage {
	return model.ChatUsage{
		PromptTokens:     u.promptTokens,
		CompletionTokens: u.completionTokens,
		TotalTokens:      u.totalTokens,
	}
}

func (u *chatUsageTracker) estimatedCostPtr() *float64 {
	if u.estimatedCostUSD <= 0 {
		return nil
	}
	v := roundUSD(u.estimatedCostUSD)
	return &v
}

func (u *chatUsageTracker) billedCostPtr() *float64 {
	if !u.hasBilledCost {
		return nil
	}
	v := roundUSD(u.billedCostUSD)
	return &v
}

func (u *chatUsageTracker) billingSource() string {
	if u.hasBilledCost && u.estimatedCostUSD > 0 {
		return "hybrid"
	}
	if u.hasBilledCost {
		return "exact"
	}
	return "estimated"
}

func (u *chatUsageTracker) toMessageMeta() *repository.ChatMessageMeta {
	return &repository.ChatMessageMeta{
		Provider:         u.provider,
		Model:            u.model,
		ThinkingMode:     u.thinkingMode,
		PromptTokens:     u.promptTokens,
		CompletionTokens: u.completionTokens,
		TotalTokens:      u.totalTokens,
		EstimatedCostUSD: u.estimatedCostPtr(),
		BilledCostUSD:    u.billedCostPtr(),
		BillingSource:    u.billingSource(),
	}
}

func roundUSD(value float64) float64 {
	const factor = 1_000_000
	return float64(int(value*factor+0.5)) / factor
}

func extractUsageFromGenerationInfo(generationInfo map[string]any) (promptTokens int, completionTokens int, totalTokens int, billedCost *float64) {
	if generationInfo == nil {
		return 0, 0, 0, nil
	}

	promptTokens = intFromAny(
		generationInfo["PromptTokens"],
		generationInfo["promptTokens"],
		generationInfo["prompt_tokens"],
		generationInfo["input_tokens"],
		generationInfo["inputTokenCount"],
		generationInfo["promptTokenCount"],
	)
	completionTokens = intFromAny(
		generationInfo["CompletionTokens"],
		generationInfo["completionTokens"],
		generationInfo["completion_tokens"],
		generationInfo["output_tokens"],
		generationInfo["outputTokenCount"],
		generationInfo["candidatesTokenCount"],
	)
	totalTokens = intFromAny(
		generationInfo["TotalTokens"],
		generationInfo["totalTokens"],
		generationInfo["total_tokens"],
		generationInfo["token_count"],
		generationInfo["tokenCount"],
		generationInfo["usage_tokens"],
		generationInfo["totalTokenCount"],
	)

	// Some providers nest token usage in a usage object.
	if usageObj := usageAsMap(generationInfo["usage"]); usageObj != nil {
		if promptTokens == 0 {
			promptTokens = intFromAny(
				usageObj["PromptTokens"],
				usageObj["promptTokens"],
				usageObj["prompt_tokens"],
				usageObj["input_tokens"],
				usageObj["inputTokenCount"],
				usageObj["promptTokenCount"],
			)
		}
		if completionTokens == 0 {
			completionTokens = intFromAny(
				usageObj["CompletionTokens"],
				usageObj["completionTokens"],
				usageObj["completion_tokens"],
				usageObj["output_tokens"],
				usageObj["outputTokenCount"],
				usageObj["candidatesTokenCount"],
			)
		}
		if totalTokens == 0 {
			totalTokens = intFromAny(
				usageObj["TotalTokens"],
				usageObj["totalTokens"],
				usageObj["total_tokens"],
				usageObj["token_count"],
				usageObj["tokenCount"],
				usageObj["usage_tokens"],
				usageObj["totalTokenCount"],
			)
		}
		if billedCost == nil {
			if value, ok := floatFromAny(
				usageObj["billed_cost_usd"],
				usageObj["billedCostUSD"],
				usageObj["cost_usd"],
				usageObj["costUSD"],
				usageObj["billed_cost"],
			); ok {
				billedCost = &value
			}
		}
	}

	if billedCost == nil {
		if value, ok := floatFromAny(
			generationInfo["billed_cost_usd"],
			generationInfo["billedCostUSD"],
			generationInfo["cost_usd"],
			generationInfo["costUSD"],
			generationInfo["billed_cost"],
		); ok {
			billedCost = &value
		}
	}

	return promptTokens, completionTokens, totalTokens, billedCost
}

func usageAsMap(value any) map[string]any {
	switch v := value.(type) {
	case nil:
		return nil
	case map[string]any:
		return v
	default:
		raw, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err != nil {
			return nil
		}
		return m
	}
}

func intFromAny(values ...any) int {
	for _, value := range values {
		switch v := value.(type) {
		case int:
			return v
		case int8:
			return int(v)
		case int16:
			return int(v)
		case int32:
			return int(v)
		case int64:
			return int(v)
		case uint:
			return int(v)
		case uint8:
			return int(v)
		case uint16:
			return int(v)
		case uint32:
			return int(v)
		case uint64:
			return int(v)
		case float32:
			return int(v)
		case float64:
			return int(v)
		case json.Number:
			if parsed, err := v.Int64(); err == nil {
				return int(parsed)
			}
			if parsed, err := v.Float64(); err == nil {
				return int(parsed)
			}
		case string:
			v = strings.TrimSpace(v)
			if v == "" {
				continue
			}
			var parsed int
			if _, err := fmt.Sscanf(v, "%d", &parsed); err == nil {
				return parsed
			}
		}
	}
	return 0
}

func floatFromAny(values ...any) (float64, bool) {
	for _, value := range values {
		switch v := value.(type) {
		case float32:
			return float64(v), true
		case float64:
			return v, true
		case int:
			return float64(v), true
		case uint:
			return float64(v), true
		case int32:
			return float64(v), true
		case int64:
			return float64(v), true
		case uint32:
			return float64(v), true
		case uint64:
			return float64(v), true
		case json.Number:
			if parsed, err := v.Float64(); err == nil {
				return parsed, true
			}
		case string:
			v = strings.TrimSpace(v)
			if v == "" {
				continue
			}
			var parsed float64
			if _, err := fmt.Sscanf(v, "%f", &parsed); err == nil {
				return parsed, true
			}
		}
	}
	return 0, false
}

func estimateCostUSDForModel(modelName string, promptTokens, completionTokens int) float64 {
	if promptTokens == 0 && completionTokens == 0 {
		return 0
	}
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if modelName == "" {
		return 0
	}

	var pricing modelPricing
	found := false
	for key, candidate := range estimatedModelPricingUSD {
		if strings.Contains(modelName, key) {
			pricing = candidate
			found = true
			break
		}
	}
	if !found {
		return 0
	}

	return (float64(promptTokens)/1000.0)*pricing.InputUSDPer1K + (float64(completionTokens)/1000.0)*pricing.OutputUSDPer1K
}

func (s *AIChatService) fastModelName() string {
	if strings.TrimSpace(s.fastModel) != "" {
		return strings.TrimSpace(s.fastModel)
	}
	return s.aiService.GetDefaultModel()
}

func (s *AIChatService) thinkingModelName() string {
	if strings.TrimSpace(s.thinkingModel) != "" {
		return strings.TrimSpace(s.thinkingModel)
	}
	return s.fastModelName()
}

func (s *AIChatService) effectiveThinkingMode(requested model.ChatThinkingMode, message string) model.ChatThinkingMode {
	mode := requested
	if !mode.IsValid() {
		mode = s.defaultMode
	}
	if !mode.IsValid() {
		mode = model.ChatThinkingModeAuto
	}

	if mode == model.ChatThinkingModeAuto {
		if looksComplexPrompt(message) {
			return model.ChatThinkingModeThinking
		}
		return model.ChatThinkingModeFast
	}

	return mode
}

func looksComplexPrompt(message string) bool {
	text := strings.ToLower(strings.TrimSpace(message))
	if text == "" {
		return false
	}

	if len([]rune(text)) >= 260 {
		return true
	}
	if strings.Count(text, "\n") >= 3 {
		return true
	}
	if strings.Count(text, "?") >= 2 {
		return true
	}

	complexSignals := 0
	for _, signal := range []string{
		"analy", "strategy", "plan", "roadmap", "step by step", "optimiz", "trade-off", "tradeoff",
		"scenario", "compare", "forecast", "projection", "portfolio", "allocation", "debt", "budget",
		"investment", "tax", "cash flow", "what if",
	} {
		if strings.Contains(text, signal) {
			complexSignals++
		}
	}

	return complexSignals >= 2
}

func (s *AIChatService) initLLMForMode(ctx context.Context, mode model.ChatThinkingMode) (llms.Model, model.ChatThinkingMode, string, error) {
	requestedModel := s.fastModelName()
	switch mode {
	case model.ChatThinkingModeThinking:
		requestedModel = s.thinkingModelName()
	case model.ChatThinkingModeFast:
		requestedModel = s.fastModelName()
	}

	llm, resolvedModel, err := s.aiService.getLLMForModel(ctx, requestedModel)
	if err == nil {
		return llm, mode, resolvedModel, nil
	}

	// Fallback to fast model if thinking model is unavailable.
	if mode == model.ChatThinkingModeThinking {
		fallback := s.fastModelName()
		if fallback != requestedModel {
			if fallbackLLM, fallbackModel, fallbackErr := s.aiService.getLLMForModel(ctx, fallback); fallbackErr == nil {
				return fallbackLLM, model.ChatThinkingModeFast, fallbackModel, nil
			}
		}
	}

	return nil, mode, "", err
}

func (s *AIChatService) resolveConversation(
	ctx context.Context,
	userID uuid.UUID,
	conversationID string,
	message string,
) (uuid.UUID, bool, error) {
	conversationID = strings.TrimSpace(conversationID)

	// Reuse existing conversation when provided (ignore temporary client IDs).
	if conversationID != "" && !strings.HasPrefix(conversationID, "temp-") {
		convID, err := uuid.Parse(conversationID)
		if err != nil {
			return uuid.Nil, false, ErrInvalidConversationID
		}

		conv, err := s.chatRepo.GetConversation(ctx, convID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return uuid.Nil, false, ErrConversationNotFound
			}
			return uuid.Nil, false, fmt.Errorf("getting conversation: %w", err)
		}
		if conv.UserID != userID {
			return uuid.Nil, false, ErrConversationNotFound
		}

		return convID, false, nil
	}

	title := message
	if len(title) > 50 {
		title = title[:47] + "..."
	}
	conv, err := s.chatRepo.CreateConversation(ctx, userID, title)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("creating conversation: %w", err)
	}
	return conv.ID, true, nil
}

func (s *AIChatService) prepareChatInput(
	ctx context.Context,
	userID uuid.UUID,
	userName string,
	conversationID uuid.UUID,
	message string,
) (*preparedChatInput, error) {
	userMsg, err := s.chatRepo.AddMessage(ctx, conversationID, "user", message, 0)
	if err != nil {
		return nil, fmt.Errorf("saving user message: %w", err)
	}
	if userMsg == nil {
		return nil, fmt.Errorf("saving user message: empty response")
	}

	history, err := s.chatRepo.GetRecentMessages(ctx, conversationID, 40)
	if err != nil {
		return nil, fmt.Errorf("getting history: %w", err)
	}

	financialContext, err := s.getFinancialContext(ctx, userID)
	if err != nil {
		financialContext = &model.FinancialContext{}
	}

	// Memories are optional context, so errors are ignored.
	memories, _ := s.getUserMemories(ctx, userID, message)

	baseCurrency := financialContext.PreferredCurrency
	if baseCurrency == "" {
		baseCurrency = "USD"
	}
	rates := s.getExchangeRates(ctx, baseCurrency)
	systemPrompt := s.buildSystemPrompt(userName, financialContext, memories, rates)

	return &preparedChatInput{
		UserMessage:  userMsg,
		LLMMessages:  s.buildLLMMessages(systemPrompt, history, *userMsg),
		BaseCurrency: baseCurrency,
		HistoryCount: len(history),
	}, nil
}

func (s *AIChatService) persistAssistantResponse(
	ctx context.Context,
	userID uuid.UUID,
	conversationID uuid.UUID,
	userMessage string,
	aiResponse string,
	meta *repository.ChatMessageMeta,
) (*model.ChatMessage, error) {
	aiMsg, err := s.chatRepo.AddMessageWithMeta(ctx, conversationID, "assistant", aiResponse, 0, meta)
	if err != nil {
		return nil, fmt.Errorf("saving AI message: %w", err)
	}

	if s.memoryService != nil {
		s.memoryService.StoreShortTermMemory(ctx, userID, conversationID.String(), "user", userMessage)
		s.memoryService.StoreShortTermMemory(ctx, userID, conversationID.String(), "assistant", aiResponse)
	}

	return aiMsg, nil
}

func buildToolResultPrompt(toolName, result string) string {
	return fmt.Sprintf(
		"Tool '%s' returned:\n%s\n\nNow provide your final answer to the user based on this data. Keep a natural personal-advisor tone. Do not use tables in the main body; only an optional final Summary table if needed.",
		toolName,
		result,
	)
}

func appendToolResultMessage(messages []llms.MessageContent, toolName, result string) []llms.MessageContent {
	return append(messages, llms.MessageContent{
		Parts: []llms.ContentPart{llms.TextPart(buildToolResultPrompt(toolName, result))},
		Role:  llms.ChatMessageTypeHuman,
	})
}

func (s *AIChatService) executeToolWithTrace(
	ctx context.Context,
	userID uuid.UUID,
	currency string,
	conversationID string,
	tc *ToolCall,
	onTrace chatTraceCallback,
	logContext string,
) string {
	toolStartedAt := time.Now()
	result, execErr := s.toolExecutor.Execute(ctx, userID, currency, tc)
	if execErr != nil {
		log.Warn().
			Err(execErr).
			Str("tool", tc.Name).
			Str("user_id", userID.String()).
			Str("context", logContext).
			Str("error_type", fmt.Sprintf("%T", execErr)).
			Msg("Tool execution failed")
		result = fmt.Sprintf("Tool '%s' failed: %v. Please answer based on the available context.", tc.Name, execErr)
		emitChatTrace(ctx, userID, conversationID, "tool_execution_failed", map[string]interface{}{
			"tool":        tc.Name,
			"tool_args":   tc.Params,
			"duration_ms": time.Since(toolStartedAt).Milliseconds(),
			"error":       execErr.Error(),
		}, onTrace)
		return result
	}

	emitChatTrace(ctx, userID, conversationID, "tool_execution_completed", map[string]interface{}{
		"tool":        tc.Name,
		"tool_args":   tc.Params,
		"duration_ms": time.Since(toolStartedAt).Milliseconds(),
		"result_size": len(result),
	}, onTrace)
	return result
}

func emitChatFailure(
	ctx context.Context,
	userID uuid.UUID,
	conversationID string,
	requestStartedAt time.Time,
	onTrace chatTraceCallback,
	err error,
) {
	emitChatTrace(ctx, userID, conversationID, "chat_request_failed", map[string]interface{}{
		"duration_ms": time.Since(requestStartedAt).Milliseconds(),
		"error":       err.Error(),
	}, onTrace)
}

func failChatWithWrap(
	ctx context.Context,
	userID uuid.UUID,
	conversationID string,
	requestStartedAt time.Time,
	onTrace chatTraceCallback,
	format string,
	cause error,
) error {
	err := fmt.Errorf(format, cause)
	emitChatFailure(ctx, userID, conversationID, requestStartedAt, onTrace, err)
	return err
}

func failChatWithError(
	ctx context.Context,
	userID uuid.UUID,
	conversationID string,
	requestStartedAt time.Time,
	onTrace chatTraceCallback,
	err error,
) error {
	emitChatFailure(ctx, userID, conversationID, requestStartedAt, onTrace, err)
	return err
}

func emitChunkedText(onChunk func(chunk string) error, text string) (int, int, error) {
	if onChunk == nil || text == "" {
		return 0, 0, nil
	}

	const chunkSize = 120
	const minChunkSize = 40

	runes := []rune(text)
	chunkCount := 0
	start := 0
	for start < len(runes) {
		end := start + chunkSize
		if end > len(runes) {
			end = len(runes)
		} else {
			split := -1
			for i := end - 1; i >= start+minChunkSize; i-- {
				switch runes[i] {
				case ' ', '\n', '\t':
					split = i + 1
					i = start - 1
				}
			}
			if split != -1 {
				end = split
			}
		}

		if end <= start {
			end = start + 1
		}
		if err := onChunk(string(runes[start:end])); err != nil {
			return chunkCount, len(runes), err
		}
		chunkCount++
		start = end
	}

	return chunkCount, len(runes), nil
}

// Chat processes a user message and returns an AI response with full context.
func (s *AIChatService) Chat(
	ctx context.Context,
	userID uuid.UUID,
	userName string,
	conversationID string,
	message string,
	thinkingMode model.ChatThinkingMode,
) (*model.ChatResponse, error) {
	requestStartedAt := time.Now()
	effectiveMode := s.effectiveThinkingMode(thinkingMode, message)
	emitChatTrace(ctx, userID, conversationID, "chat_request_started", map[string]interface{}{
		"message_length": len(message),
		"streaming":      false,
		"thinking_mode":  effectiveMode,
	}, nil)

	convID, createdConversation, err := s.resolveConversation(ctx, userID, conversationID, message)
	if err != nil {
		return nil, err
	}
	emitChatTrace(ctx, userID, convID.String(), "conversation_ready", map[string]interface{}{
		"created": createdConversation,
	}, nil)

	prepared, err := s.prepareChatInput(ctx, userID, userName, convID, message)
	if err != nil {
		return nil, err
	}
	emitChatTrace(ctx, userID, convID.String(), "user_message_saved", map[string]interface{}{
		"message_id": prepared.UserMessage.ID.String(),
	}, nil)
	emitChatTrace(ctx, userID, convID.String(), "llm_input_ready", map[string]interface{}{
		"history_messages": prepared.HistoryCount,
		"llm_messages":     len(prepared.LLMMessages),
		"base_currency":    prepared.BaseCurrency,
	}, nil)

	// Call the AI with tool resolution loop
	llm, finalMode, modelName, err := s.initLLMForMode(ctx, effectiveMode)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}
	usageTracker := newChatUsageTracker(s.aiService.GetProvider(), modelName, finalMode)
	emitChatTrace(ctx, userID, convID.String(), "llm_initialized", map[string]interface{}{
		"provider": s.aiService.provider,
		"model":    modelName,
		"mode":     finalMode,
	}, nil)

	llmStartedAt := time.Now()
	aiResponse, err := s.resolveToolCalls(
		ctx,
		llm,
		prepared.LLMMessages,
		userID,
		prepared.BaseCurrency,
		convID.String(),
		nil,
		usageTracker,
	)
	if err != nil {
		return nil, failChatWithWrap(ctx, userID, convID.String(), requestStartedAt, nil, "calling AI: %w", err)
	}
	emitChatTrace(ctx, userID, convID.String(), "llm_completed", map[string]interface{}{
		"duration_ms":     time.Since(llmStartedAt).Milliseconds(),
		"response_length": len(aiResponse),
	}, nil)

	aiMsg, err := s.persistAssistantResponse(ctx, userID, convID, message, aiResponse, usageTracker.toMessageMeta())
	if err != nil {
		return nil, err
	}

	emitChatTrace(ctx, userID, convID.String(), "chat_request_completed", map[string]interface{}{
		"duration_ms":        time.Since(requestStartedAt).Milliseconds(),
		"prompt_tokens":      usageTracker.promptTokens,
		"completion_tokens":  usageTracker.completionTokens,
		"total_tokens":       usageTracker.totalTokens,
		"estimated_cost_usd": usageTracker.estimatedCostUSD,
		"billed_cost_usd":    usageTracker.billedCostUSD,
		"billing_source":     usageTracker.billingSource(),
	}, nil)

	usage := usageTracker.usage()

	return &model.ChatResponse{
		ConversationID:   convID.String(),
		Message:          *aiMsg,
		TokensUsed:       usage.TotalTokens,
		Provider:         usageTracker.provider,
		Model:            usageTracker.model,
		ThinkingMode:     string(finalMode),
		Usage:            usage,
		EstimatedCostUSD: usageTracker.estimatedCostPtr(),
		BilledCostUSD:    usageTracker.billedCostPtr(),
		BillingSource:    usageTracker.billingSource(),
	}, nil
}

// ChatStream processes a user message and streams the AI response chunks.
// It returns the final ChatResponse once complete.
func (s *AIChatService) ChatStream(
	ctx context.Context,
	userID uuid.UUID,
	userName string,
	conversationID string,
	message string,
	thinkingMode model.ChatThinkingMode,
	onStart func(conversationID string),
	onChunk func(chunk string) error,
	onTrace chatTraceCallback,
) (*model.ChatResponse, error) {
	requestStartedAt := time.Now()
	effectiveMode := s.effectiveThinkingMode(thinkingMode, message)
	emitChatTrace(ctx, userID, conversationID, "chat_request_started", map[string]interface{}{
		"message_length": len(message),
		"streaming":      true,
		"thinking_mode":  effectiveMode,
	}, onTrace)

	convID, createdConversation, err := s.resolveConversation(ctx, userID, conversationID, message)
	if err != nil {
		return nil, err
	}
	emitChatTrace(ctx, userID, convID.String(), "conversation_ready", map[string]interface{}{
		"created": createdConversation,
	}, onTrace)

	if onStart != nil {
		onStart(convID.String())
	}
	emitChatTrace(ctx, userID, convID.String(), "stream_started", nil, onTrace)

	prepared, err := s.prepareChatInput(ctx, userID, userName, convID, message)
	if err != nil {
		return nil, err
	}
	emitChatTrace(ctx, userID, convID.String(), "user_message_saved", map[string]interface{}{
		"message_id": prepared.UserMessage.ID.String(),
	}, onTrace)
	emitChatTrace(ctx, userID, convID.String(), "llm_input_ready", map[string]interface{}{
		"history_messages": prepared.HistoryCount,
		"llm_messages":     len(prepared.LLMMessages),
		"base_currency":    prepared.BaseCurrency,
	}, onTrace)

	// Call the AI (with tool resolution, then stream final response)
	llm, finalMode, modelName, err := s.initLLMForMode(ctx, effectiveMode)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}
	usageTracker := newChatUsageTracker(s.aiService.GetProvider(), modelName, finalMode)
	emitChatTrace(ctx, userID, convID.String(), "llm_initialized", map[string]interface{}{
		"provider": s.aiService.provider,
		"model":    modelName,
		"mode":     finalMode,
	}, onTrace)

	// Single-pass first response. Buffer stream output so we can detect tool calls without leaking markers.
	firstLLMStartedAt := time.Now()
	var initialStreamBuffer strings.Builder
	streamingFunc := func(ctx context.Context, chunk []byte) error {
		if len(chunk) == 0 {
			return nil
		}
		initialStreamBuffer.Write(chunk)
		return nil
	}
	firstResponse, err := llm.GenerateContent(ctx, prepared.LLMMessages, llms.WithStreamingFunc(streamingFunc))
	if err != nil {
		// Some providers reject streaming callbacks; retry once without streaming.
		firstResponse, err = llm.GenerateContent(ctx, prepared.LLMMessages)
		if err != nil {
			return nil, failChatWithWrap(ctx, userID, convID.String(), requestStartedAt, onTrace, "calling ai: %w", err)
		}
	}
	usageTracker.addResponse(firstResponse)
	if len(firstResponse.Choices) == 0 {
		return nil, failChatWithError(ctx, userID, convID.String(), requestStartedAt, onTrace, errNoAIResponse)
	}

	firstText := strings.TrimSpace(initialStreamBuffer.String())
	if firstText == "" {
		firstText = firstResponse.Choices[0].Content
	}
	tc := parseToolCall(firstText)
	emitChatTrace(ctx, userID, convID.String(), "llm_first_response", map[string]interface{}{
		"duration_ms":     time.Since(firstLLMStartedAt).Milliseconds(),
		"tool_call_found": tc != nil,
		"response_length": len(firstText),
	}, onTrace)

	var aiResponse string
	streamChunkCount := 0
	streamChars := 0

	if tc != nil {
		emitChatTrace(ctx, userID, convID.String(), "tool_call_detected", map[string]interface{}{
			"tool":      tc.Name,
			"tool_args": tc.Params,
		}, onTrace)

		// Tool call detected — execute it, then resolve remaining tool chain non-streaming.
		messages := append(prepared.LLMMessages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(firstText)},
			Role:  llms.ChatMessageTypeAI,
		})
		result := s.executeToolWithTrace(ctx, userID, prepared.BaseCurrency, convID.String(), tc, onTrace, "chat_stream_initial_tool")
		messages = appendToolResultMessage(messages, tc.Name, result)

		aiResponse, err = s.resolveToolCallsWithLimit(
			ctx,
			llm,
			messages,
			userID,
			prepared.BaseCurrency,
			convID.String(),
			onTrace,
			2,
			usageTracker,
		)
		if err != nil {
			return nil, failChatWithWrap(ctx, userID, convID.String(), requestStartedAt, onTrace, "calling ai (tool loop): %w", err)
		}

		if onChunk != nil && aiResponse != "" {
			chunks, chars, err := emitChunkedText(onChunk, aiResponse)
			if err != nil {
				return nil, err
			}
			streamChunkCount += chunks
			streamChars += chars
		}
	} else {
		// No tool call — stream the first response without issuing a second model request.
		aiResponse = stripToolCallMarkers(firstText)
		if onChunk != nil && aiResponse != "" {
			chunks, chars, err := emitChunkedText(onChunk, aiResponse)
			if err != nil {
				return nil, err
			}
			streamChunkCount += chunks
			streamChars += chars
		}
	}

	aiMsg, err := s.persistAssistantResponse(ctx, userID, convID, message, aiResponse, usageTracker.toMessageMeta())
	if err != nil {
		return nil, failChatWithError(ctx, userID, convID.String(), requestStartedAt, onTrace, err)
	}
	emitChatTrace(ctx, userID, convID.String(), "chat_request_completed", map[string]interface{}{
		"duration_ms":        time.Since(requestStartedAt).Milliseconds(),
		"chunk_count":        streamChunkCount,
		"stream_chars":       streamChars,
		"prompt_tokens":      usageTracker.promptTokens,
		"completion_tokens":  usageTracker.completionTokens,
		"total_tokens":       usageTracker.totalTokens,
		"estimated_cost_usd": usageTracker.estimatedCostUSD,
		"billed_cost_usd":    usageTracker.billedCostUSD,
		"billing_source":     usageTracker.billingSource(),
	}, onTrace)

	usage := usageTracker.usage()

	return &model.ChatResponse{
		ConversationID:   convID.String(),
		Message:          *aiMsg,
		TokensUsed:       usage.TotalTokens,
		Provider:         usageTracker.provider,
		Model:            usageTracker.model,
		ThinkingMode:     string(finalMode),
		Usage:            usage,
		EstimatedCostUSD: usageTracker.estimatedCostPtr(),
		BilledCostUSD:    usageTracker.billedCostPtr(),
		BillingSource:    usageTracker.billingSource(),
	}, nil
}

// buildSystemPrompt creates a rich system prompt with financial context
func (s *AIChatService) buildSystemPrompt(userName string, fctx *model.FinancialContext, memories []model.UserMemory, rates map[string]float64) string {
	var sb strings.Builder

	// Header with user context (sanitize to prevent prompt injection)
	displayName := sanitizeForPrompt(userName, 100)
	if displayName == "" {
		displayName = "User"
	}

	sb.WriteString(fmt.Sprintf(`You are a helpful and knowledgeable personal finance advisor for %s. You have access to their complete financial data, memories from past conversations, and real-time exchange rates. Use this information to provide personalized, actionable advice.

## TODAY'S DATE
%s (%d days until month end)

`, displayName, fctx.TodayDate, fctx.DaysUntilMonthEnd))

	// User profile
	sb.WriteString("## USER PROFILE\n")
	if fctx.UserName != "" {
		sb.WriteString(fmt.Sprintf("- Name: %s\n", sanitizeForPrompt(fctx.UserName, 100)))
	}
	if fctx.AccountAgeDays > 0 {
		sb.WriteString(fmt.Sprintf("- Account age: %d days\n", fctx.AccountAgeDays))
	}
	if fctx.PreferredCurrency != "" {
		sb.WriteString(fmt.Sprintf("- Primary currency: %s\n", fctx.PreferredCurrency))
	}
	sb.WriteString("\n")

	// Long-term memories
	if len(memories) > 0 {
		sb.WriteString("## WHAT I REMEMBER ABOUT YOU\n")
		for _, m := range memories {
			sb.WriteString(fmt.Sprintf("- [%s] %s\n", sanitizeForPrompt(m.Category, 100), sanitizeForPrompt(m.Content, 500)))
		}
		sb.WriteString("\n")
	}

	// Multi-currency balances
	sb.WriteString("## WALLET BALANCES\n")
	if len(fctx.Balances) > 0 {
		for _, b := range fctx.Balances {
			sb.WriteString(fmt.Sprintf("- %s: %.2f\n", b.Currency, b.Balance))
		}
	} else {
		sb.WriteString("- No balances yet\n")
	}
	sb.WriteString("\n")

	// Exchange rates
	if len(rates) > 0 {
		sb.WriteString("## LIVE EXCHANGE RATES\n")
		baseCurrency := fctx.PreferredCurrency
		if baseCurrency == "" {
			baseCurrency = "USD"
		}
		sb.WriteString(fmt.Sprintf("Base: %s\n", baseCurrency))
		for currency, rate := range rates {
			if currency != baseCurrency {
				sb.WriteString(fmt.Sprintf("- 1 %s = %.4f %s\n", baseCurrency, rate, currency))
			}
		}
		sb.WriteString("\n")
	}

	// Monthly overview
	sb.WriteString("## THIS MONTH'S OVERVIEW\n")
	sb.WriteString(fmt.Sprintf("- Income: %.2f %s\n", fctx.MonthlyIncome, fctx.PreferredCurrency))
	sb.WriteString(fmt.Sprintf("- Expenses: %.2f %s\n", fctx.MonthlyExpenses, fctx.PreferredCurrency))
	savings := fctx.MonthlyIncome - fctx.MonthlyExpenses
	var savingsRate float64
	if fctx.MonthlyIncome > 0 {
		savingsRate = (savings / fctx.MonthlyIncome) * 100
	}
	sb.WriteString(fmt.Sprintf("- Net savings: %.2f (%.1f%% savings rate)\n", savings, savingsRate))
	if fctx.SpendingTrend != "" {
		sb.WriteString(fmt.Sprintf("- Spending trend: %s vs last month\n", fctx.SpendingTrend))
	}
	sb.WriteString(fmt.Sprintf("- Transactions: %d\n\n", fctx.RecentTransactions))

	// Recent transactions
	if len(fctx.RecentTransactionList) > 0 {
		sb.WriteString("## RECENT TRANSACTIONS\n")
		for _, tx := range fctx.RecentTransactionList {
			sign := "+"
			if tx.Type == "debit" {
				sign = "-"
			}
			sb.WriteString(fmt.Sprintf("- %s: %s%.2f %s - %s", tx.Date, sign, tx.Amount, tx.Currency, tx.Description))
			if tx.Category != "" {
				sb.WriteString(fmt.Sprintf(" [%s]", tx.Category))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	// Top spending categories
	if len(fctx.TopCategories) > 0 {
		sb.WriteString("## TOP SPENDING CATEGORIES\n")
		for _, cat := range fctx.TopCategories {
			sb.WriteString(fmt.Sprintf("- %s: %.2f %s\n", cat.Category, cat.Amount, fctx.PreferredCurrency))
		}
		sb.WriteString("\n")
	}

	// Active budgets
	if len(fctx.ActiveBudgets) > 0 {
		sb.WriteString("## BUDGETS\n")
		for _, b := range fctx.ActiveBudgets {
			pct := float64(0)
			if b.Budget > 0 {
				pct = (b.Spent / b.Budget) * 100
			}
			status := "on track"
			if pct > 90 {
				status = "NEAR LIMIT"
			}
			if pct > 100 {
				status = "OVER BUDGET"
			}
			sb.WriteString(fmt.Sprintf("- %s: %.2f / %.2f spent (%.0f%%) - %s\n", b.Category, b.Spent, b.Budget, pct, status))
		}
		sb.WriteString("\n")
	}

	// Goals
	if len(fctx.SavingsGoals) > 0 {
		sb.WriteString("## GOALS\n")
		for _, g := range fctx.SavingsGoals {
			sb.WriteString(fmt.Sprintf("- %s: %.2f / %.2f (%.0f%% complete)\n", g.Name, g.Current, g.Target, g.Progress))
		}
		sb.WriteString("\n")
	}

	// Recurring items
	if len(fctx.RecurringItems) > 0 {
		sb.WriteString("## RECURRING TRANSACTIONS\n")
		for _, r := range fctx.RecurringItems {
			sb.WriteString(fmt.Sprintf("- %s: %.2f %s (%s, next: %s)\n", r.Description, r.Amount, r.Currency, r.Frequency, r.NextDate))
		}
		sb.WriteString("\n")
	}

	// Loans and Debts
	if len(fctx.ActiveLoans) > 0 || fctx.TotalDebt > 0 || fctx.TotalReceivable > 0 {
		sb.WriteString("## LOANS & DEBTS\n")
		if fctx.TotalDebt > 0 {
			sb.WriteString(fmt.Sprintf("- Total owed to others: %.2f %s\n", fctx.TotalDebt, fctx.PreferredCurrency))
		}
		if fctx.TotalReceivable > 0 {
			sb.WriteString(fmt.Sprintf("- Total owed to user: %.2f %s\n", fctx.TotalReceivable, fctx.PreferredCurrency))
		}
		if fctx.NetDebtPosition != 0 {
			position := "net creditor"
			if fctx.NetDebtPosition > 0 {
				position = "net debtor"
			}
			sb.WriteString(fmt.Sprintf("- Net position: %.2f %s (%s)\n", fctx.NetDebtPosition, fctx.PreferredCurrency, position))
		}
		if len(fctx.ActiveLoans) > 0 {
			sb.WriteString("\nActive loans:\n")
			for _, loan := range fctx.ActiveLoans {
				loanType := "owes"
				if loan.Type == "lent" {
					loanType = "owed by"
				}
				sb.WriteString(fmt.Sprintf("- %s (%s %s): %.2f %s remaining", loan.Name, loanType, loan.Counterparty, loan.RemainingAmount, loan.Currency))
				if loan.DueDate != "" {
					sb.WriteString(fmt.Sprintf(" (due: %s)", loan.DueDate))
				}
				sb.WriteString("\n")
			}
		}
		sb.WriteString("\n")
	}

	// Available categories
	if len(fctx.Categories) > 0 {
		sb.WriteString("## AVAILABLE CATEGORIES\n")
		for _, cat := range fctx.Categories {
			label := cat.Name
			if cat.Icon != "" {
				label = cat.Icon + " " + label
			}
			sb.WriteString(fmt.Sprintf("- %s\n", label))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`## YOUR ROLE

1. **Use Real Data**: Always reference specific numbers from their financial data
2. **Use Correct Rates**: When converting currencies or discussing exchange rates, use the LIVE EXCHANGE RATES provided above
3. **Remember Context**: Reference memories and previous conversations when relevant
4. **Be Actionable**: Give concrete suggestions with specific amounts
5. **Talk Like a Human Advisor**: Sound like a trusted personal finance advisor in a natural conversation, not like an analyst report
6. **Avoid Jargon**: Use plain language and explain clearly when needed
7. **Be Concise**: Keep responses focused and easy to read
8. **Track Insights**: When you learn something important about the user (preferences, goals, habits), note it for future conversations

## RESPONSE FORMAT

- Be prose-first and conversational. Sound like a real advisor speaking naturally.
- Prefer 2-6 short paragraphs. Use bullets only when they improve clarity.
- Do **not** use markdown tables in the main body.
- If structured tabular data is truly needed, add one table at the very end under a clear "Summary Table" heading.
- Keep any table separate from the main explanation so clients can render it in a dedicated modal.

## CAPABILITIES

You can help with:
- Financial analysis and advice based on their data
- Currency conversions using real-time rates
- Budget tracking and recommendations
- Goal progress updates
- Spending pattern analysis
- Recurring expense insights

Remember: Be friendly, personal, practical, and always use the user's actual data when giving advice.
`)

	// Append tool definitions
	sb.WriteString("\n")
	sb.WriteString(buildToolDefinitionsPrompt())

	return sb.String()
}

// resolveToolCalls runs the LLM and resolves any tool calls (max 3 iterations)
func (s *AIChatService) resolveToolCalls(
	ctx context.Context,
	llm llms.Model,
	messages []llms.MessageContent,
	userID uuid.UUID,
	currency string,
	conversationID string,
	onTrace chatTraceCallback,
	usageTracker *chatUsageTracker,
) (string, error) {
	return s.resolveToolCallsWithLimit(ctx, llm, messages, userID, currency, conversationID, onTrace, 3, usageTracker)
}

func (s *AIChatService) resolveToolCallsWithLimit(
	ctx context.Context,
	llm llms.Model,
	messages []llms.MessageContent,
	userID uuid.UUID,
	currency string,
	conversationID string,
	onTrace chatTraceCallback,
	maxIterations int,
	usageTracker *chatUsageTracker,
) (string, error) {
	for i := 0; i < maxIterations; i++ {
		iterationStartedAt := time.Now()
		response, err := llm.GenerateContent(ctx, messages)
		if err != nil {
			emitChatTrace(ctx, userID, conversationID, "llm_iteration_failed", map[string]interface{}{
				"iteration": i + 1,
				"error":     err.Error(),
			}, onTrace)
			return "", fmt.Errorf("generating content: %w", err)
		}
		if usageTracker != nil {
			usageTracker.addResponse(response)
		}
		if len(response.Choices) == 0 {
			emitChatTrace(ctx, userID, conversationID, "llm_iteration_failed", map[string]interface{}{
				"iteration": i + 1,
				"error":     errNoAIResponse.Error(),
			}, onTrace)
			return "", errNoAIResponse
		}

		text := response.Choices[0].Content
		tc := parseToolCall(text)
		emitChatTrace(ctx, userID, conversationID, "llm_iteration_completed", map[string]interface{}{
			"iteration":       i + 1,
			"duration_ms":     time.Since(iterationStartedAt).Milliseconds(),
			"tool_call_found": tc != nil,
		}, onTrace)

		if tc == nil {
			// No tool call — return the final response
			return stripToolCallMarkers(text), nil
		}

		// Execute the tool
		result := s.executeToolWithTrace(ctx, userID, currency, conversationID, tc, onTrace, "resolve_tool_calls")

		// Append the AI response and tool result to messages for the next iteration
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(text)},
			Role:  llms.ChatMessageTypeAI,
		})
		messages = appendToolResultMessage(messages, tc.Name, result)
	}

	// If we exhausted iterations, make one final call
	response, err := llm.GenerateContent(ctx, messages)
	if err != nil {
		emitChatTrace(ctx, userID, conversationID, "llm_final_failed", map[string]interface{}{
			"error": err.Error(),
		}, onTrace)
		return "", fmt.Errorf("generating final content: %w", err)
	}
	if usageTracker != nil {
		usageTracker.addResponse(response)
	}
	if len(response.Choices) == 0 {
		emitChatTrace(ctx, userID, conversationID, "llm_final_failed", map[string]interface{}{
			"error": errNoAIResponse.Error(),
		}, onTrace)
		return "", errNoAIResponse
	}
	emitChatTrace(ctx, userID, conversationID, "llm_final_completed", map[string]interface{}{
		"response_length": len(response.Choices[0].Content),
	}, onTrace)
	return stripToolCallMarkers(response.Choices[0].Content), nil
}

// buildLLMMessages builds the message array for the LLM with full history
func (s *AIChatService) buildLLMMessages(systemPrompt string, history []model.ChatMessage, currentMessage model.ChatMessage) []llms.MessageContent {
	var messages []llms.MessageContent

	// System prompt
	messages = append(messages, llms.MessageContent{
		Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		Role:  llms.ChatMessageTypeSystem,
	})

	// Add conversation history (excluding the current message which we just saved)
	for _, msg := range history {
		// Skip the current message we just added
		if msg.ID == currentMessage.ID {
			continue
		}
		role := llms.ChatMessageTypeHuman
		if msg.Role == "assistant" {
			role = llms.ChatMessageTypeAI
		}
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(msg.Content)},
			Role:  role,
		})
	}

	// Add current user message
	messages = append(messages, llms.MessageContent{
		Parts: []llms.ContentPart{llms.TextPart(currentMessage.Content)},
		Role:  llms.ChatMessageTypeHuman,
	})

	return messages
}

// getFinancialContext gathers the user's financial data for the AI (with 60s cache)
func (s *AIChatService) getFinancialContext(ctx context.Context, userID uuid.UUID) (*model.FinancialContext, error) {
	cacheKey := "financial-context:" + userID.String()
	if cached, found := s.contextCache.Get(cacheKey); found {
		if fctx, ok := cached.(*model.FinancialContext); ok {
			return fctx, nil
		}
	}

	fctx, err := s.fetchFinancialContext(ctx, userID)
	if err != nil {
		return fctx, err
	}

	s.contextCache.Set(cacheKey, fctx, 60*time.Second)
	return fctx, nil
}

// fetchFinancialContext performs the actual queries to gather financial data
func (s *AIChatService) fetchFinancialContext(ctx context.Context, userID uuid.UUID) (*model.FinancialContext, error) {
	// Log context retrieval without exposing sensitive data
	log.Debug().
		Str("user_id", userID.String()).
		Msg("Retrieved financial context for AI chat")

	fctx := &model.FinancialContext{}
	now := time.Now()
	rateCache := make(map[string]float64)
	convertCurrency := s.contextCurrencyConverter()

	// Set date context
	fctx.TodayDate = now.Format("January 2, 2006")
	fctx.DaysUntilMonthEnd = daysUntilEndOfMonth(now)

	// Get user info (with nil check for both error and user)
	if s.userRepo != nil {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err == nil && user != nil {
			fctx.UserName = sanitizeForPrompt(user.Name, 100)
			if !user.CreatedAt.IsZero() {
				fctx.AccountAgeDays = int(now.Sub(user.CreatedAt).Hours() / 24)
			}
		}
	}

	// Get balances by currency
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err == nil {
		for _, b := range balances {
			fctx.Balances = append(fctx.Balances, model.CurrencyBalance{
				Currency: b.Currency,
				Balance:  b.Balance,
			})
		}
		fctx.PreferredCurrency = selectPreferredCurrencyFromBalances(ctx, balances, rateCache, convertCurrency)
	}

	if fctx.PreferredCurrency == "" {
		fctx.PreferredCurrency = "USD"
	}

	// Convert aggregate balance to preferred currency to avoid mixed-currency math.
	for _, b := range fctx.Balances {
		converted, _ := convertAmountWithRateCache(
			ctx,
			b.Balance,
			b.Currency,
			fctx.PreferredCurrency,
			rateCache,
			convertCurrency,
		)
		fctx.TotalBalance += converted
	}

	// Get transactions and calculate monthly stats
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startOfLastMonth := startOfMonth.AddDate(0, -1, 0)

	transactions, err := s.walletRepo.GetTransactions(ctx, userID, 100, 0)
	if err == nil {
		if len(fctx.Balances) == 0 && len(transactions) > 0 {
			currency := normalizeCurrencyCode(transactions[0].Currency)
			if currency != "" {
				fctx.PreferredCurrency = currency
			}
		}

		categoryTotals := make(map[string]float64)

		for i, tx := range transactions {
			convertedAmount, _ := convertAmountWithRateCache(
				ctx,
				tx.Amount,
				tx.Currency,
				fctx.PreferredCurrency,
				rateCache,
				convertCurrency,
			)

			// This month
			if tx.CreatedAt.After(startOfMonth) {
				fctx.RecentTransactions++
				if tx.Type == "credit" {
					fctx.MonthlyIncome += convertedAmount
				} else if tx.Type == "debit" {
					fctx.MonthlyExpenses += convertedAmount
					if tx.Category != "" {
						categoryTotals[tx.Category] += convertedAmount
					}
				}
			}

			// Last month (for trend)
			if tx.CreatedAt.After(startOfLastMonth) && tx.CreatedAt.Before(startOfMonth) {
				if tx.Type == "debit" {
					fctx.LastMonthExpenses += convertedAmount
				}
			}

			// Add recent transactions to list (last 10 for prompt efficiency)
			if i < 10 {
				fctx.RecentTransactionList = append(fctx.RecentTransactionList, model.TransactionSummary{
					Date:        tx.CreatedAt.Format("Jan 2"),
					Type:        tx.Type,
					Amount:      tx.Amount,
					Currency:    tx.Currency,
					Category:    sanitizeForPrompt(tx.Category, 100),
					Description: sanitizeForPrompt(tx.Description, 500),
				})
			}
		}

		// Calculate spending trend (guard against division by zero)
		if fctx.LastMonthExpenses > 0 {
			change := ((fctx.MonthlyExpenses - fctx.LastMonthExpenses) / fctx.LastMonthExpenses) * 100
			if change > 10 {
				fctx.SpendingTrend = "increasing"
			} else if change < -10 {
				fctx.SpendingTrend = "decreasing"
			} else {
				fctx.SpendingTrend = "stable"
			}
		} else if fctx.MonthlyExpenses > 0 {
			fctx.SpendingTrend = "no prior data"
		}

		// Get top 5 spending categories
		for cat, amount := range categoryTotals {
			fctx.TopCategories = append(fctx.TopCategories, model.CategorySpending{
				Category: cat,
				Amount:   amount,
			})
		}
		// Sort by amount (descending)
		for i := 0; i < len(fctx.TopCategories); i++ {
			for j := i + 1; j < len(fctx.TopCategories); j++ {
				if fctx.TopCategories[j].Amount > fctx.TopCategories[i].Amount {
					fctx.TopCategories[i], fctx.TopCategories[j] = fctx.TopCategories[j], fctx.TopCategories[i]
				}
			}
		}
		// Truncate to top 5 categories (with length guard)
		if len(fctx.TopCategories) > 5 {
			fctx.TopCategories = fctx.TopCategories[:5]
		}
	}

	// Get budgets (limit to 10 for prompt efficiency)
	budgets, err := s.budgetRepo.GetByUser(ctx, userID)
	if err == nil {
		for i, b := range budgets {
			if i >= 10 {
				break
			}
			fctx.ActiveBudgets = append(fctx.ActiveBudgets, model.BudgetSummary{
				Category: sanitizeForPrompt(b.Category, 100),
				Budget:   b.Amount,
				Spent:    b.Spent,
			})
		}
	}

	// Get goals (limit to 10 for prompt efficiency)
	goals, err := s.goalRepo.GetByUser(ctx, userID)
	if err == nil {
		for i, g := range goals {
			if i >= 10 {
				break
			}
			progress := float64(0)
			if g.TargetAmount > 0 {
				progress = (g.CurrentAmount / g.TargetAmount) * 100
			}
			fctx.SavingsGoals = append(fctx.SavingsGoals, model.GoalSummary{
				Name:     sanitizeForPrompt(g.Name, 100),
				Target:   g.TargetAmount,
				Current:  g.CurrentAmount,
				Progress: progress,
			})
		}
	}

	// Get recurring transactions
	if s.recurringRepo != nil {
		recurring, err := s.recurringRepo.GetByUser(ctx, userID)
		if err == nil {
			for _, r := range recurring {
				if r.IsActive {
					recType := "expense"
					if r.Type == "credit" {
						recType = "income"
					}
					fctx.RecurringItems = append(fctx.RecurringItems, model.RecurringSummary{
						Description: sanitizeForPrompt(r.Description, 500),
						Amount:      r.Amount,
						Currency:    r.Currency,
						Frequency:   r.Frequency,
						NextDate:    r.NextExecution.Format("Jan 2"),
						Type:        recType,
					})
				}
			}
		}
	}

	// Get categories (limit to top 10 for prompt efficiency)
	if s.categoryRepo != nil {
		categories, err := s.categoryRepo.GetCategories(ctx, userID)
		if err == nil {
			for i, cat := range categories {
				if i >= 10 {
					break
				}
				fctx.Categories = append(fctx.Categories, model.CategoryInfo{
					Name:      sanitizeForPrompt(cat.Name, 100),
					Icon:      cat.Icon,
					IsDefault: cat.IsDefault,
				})
			}
		}
	}

	// Get loans and debts
	if s.loanRepo != nil {
		loans, err := s.loanRepo.GetAllByUser(ctx, userID.String(), "active", "")
		if err == nil {
			for _, loan := range loans {
				loanSummary := model.LoanSummaryForAI{
					Name:            sanitizeForPrompt(loan.Name, 100),
					Type:            string(loan.Type),
					RemainingAmount: loan.RemainingAmount,
					Currency:        loan.Currency,
					Counterparty:    sanitizeForPrompt(loan.Counterparty, 100),
				}
				if loan.DueDate != nil {
					loanSummary.DueDate = loan.DueDate.Format("Jan 2, 2006")
				}
				fctx.ActiveLoans = append(fctx.ActiveLoans, loanSummary)

				convertedRemaining, _ := convertAmountWithRateCache(
					ctx,
					loan.RemainingAmount,
					loan.Currency,
					fctx.PreferredCurrency,
					rateCache,
					convertCurrency,
				)

				if loan.Type == model.LoanTypeBorrowed {
					fctx.TotalDebt += convertedRemaining
				} else {
					fctx.TotalReceivable += convertedRemaining
				}
			}
			fctx.NetDebtPosition = fctx.TotalDebt - fctx.TotalReceivable
		}
	}

	return fctx, nil
}

func (s *AIChatService) contextCurrencyConverter() currencyConverterFunc {
	if s.exchangeService == nil {
		return nil
	}
	return s.exchangeService.Convert
}

func normalizeCurrencyCode(currency string) string {
	return strings.ToUpper(strings.TrimSpace(currency))
}

func convertAmountWithRateCache(
	ctx context.Context,
	amount float64,
	fromCurrency string,
	toCurrency string,
	rateCache map[string]float64,
	convert currencyConverterFunc,
) (float64, bool) {
	from := normalizeCurrencyCode(fromCurrency)
	to := normalizeCurrencyCode(toCurrency)

	if amount == 0 {
		return 0, true
	}
	if from == "" || to == "" || from == to {
		return amount, true
	}
	if convert == nil {
		return amount, false
	}

	cacheKey := from + "->" + to
	if rate, found := rateCache[cacheKey]; found {
		if rate > 0 {
			return amount * rate, true
		}
		return amount, false
	}

	result, err := convert(ctx, from, to, 1.0)
	if err != nil {
		log.Debug().
			Err(err).
			Str("from_currency", from).
			Str("to_currency", to).
			Msg("Failed to fetch exchange rate for AI context aggregation")
		rateCache[cacheKey] = 0
		return amount, false
	}

	rate := result.Result
	if rate <= 0 {
		rate = result.Rate
	}
	if rate <= 0 {
		rateCache[cacheKey] = 0
		return amount, false
	}

	rateCache[cacheKey] = rate
	return amount * rate, true
}

func selectPreferredCurrencyFromBalances(
	ctx context.Context,
	balances []model.WalletBalance,
	rateCache map[string]float64,
	convert currencyConverterFunc,
) string {
	if len(balances) == 0 {
		return ""
	}

	maxRawBalance := balances[0].Balance
	preferredRaw := normalizeCurrencyCode(balances[0].Currency)
	for _, b := range balances[1:] {
		if b.Balance > maxRawBalance {
			maxRawBalance = b.Balance
			preferredRaw = normalizeCurrencyCode(b.Currency)
		}
	}

	// Prefer the currency with the highest USD-equivalent value when rates are available.
	bestCurrency := ""
	bestUSDEquivalent := 0.0
	hasConverted := false
	totalCurrencies := 0
	convertibleCurrencies := 0
	for _, b := range balances {
		currency := normalizeCurrencyCode(b.Currency)
		if currency == "" {
			continue
		}
		totalCurrencies++
		converted, ok := convertAmountWithRateCache(ctx, b.Balance, currency, "USD", rateCache, convert)
		if !ok {
			continue
		}
		convertibleCurrencies++
		if !hasConverted || converted > bestUSDEquivalent {
			hasConverted = true
			bestUSDEquivalent = converted
			bestCurrency = currency
		}
	}

	if hasConverted && bestCurrency != "" && convertibleCurrencies == totalCurrencies {
		return bestCurrency
	}
	if preferredRaw != "" {
		return preferredRaw
	}
	return "USD"
}

// daysUntilEndOfMonth calculates days remaining in the current month
func daysUntilEndOfMonth(t time.Time) int {
	firstOfNextMonth := time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
	return int(firstOfNextMonth.Sub(t).Hours() / 24)
}

// getUserMemories retrieves long-term memories about the user
// If memoryService is available, uses semantic search; otherwise falls back to recent memories
func (s *AIChatService) getUserMemories(ctx context.Context, userID uuid.UUID, currentMessage string) ([]model.UserMemory, error) {
	// Try semantic search via memory service first
	if s.memoryService != nil {
		memories, err := s.memoryService.GetUserMemoriesForContext(ctx, userID, currentMessage)
		if err == nil && len(memories) > 0 {
			return memories, nil
		}
		// Fall through to fallback if semantic search fails
	}

	// Fallback to PostgreSQL recent memories
	if s.memoryRepo == nil {
		return nil, nil
	}
	return s.memoryRepo.GetRecent(ctx, userID, 20)
}

// SaveMemory stores a new memory about the user (in both PostgreSQL and Qdrant if available)
func (s *AIChatService) SaveMemory(ctx context.Context, userID uuid.UUID, category, content, source string) (*model.UserMemory, error) {
	// Use memory service if available (handles both PostgreSQL and Qdrant)
	if s.memoryService != nil {
		return s.memoryService.StoreLongTermMemory(ctx, userID, category, content, source)
	}

	// Fallback to direct PostgreSQL storage
	if s.memoryRepo == nil {
		return nil, fmt.Errorf("memory repository not available")
	}
	return s.memoryRepo.Create(ctx, userID, category, content, source)
}

// getExchangeRates fetches current exchange rates for common currencies
func (s *AIChatService) getExchangeRates(ctx context.Context, baseCurrency string) map[string]float64 {
	rates := make(map[string]float64)
	if s.exchangeService == nil {
		return rates
	}

	// Get rates for common currencies
	commonCurrencies := []string{"USD", "EUR", "GBP", "IRR", "TRY", "AED", "CAD", "AUD"}
	for _, currency := range commonCurrencies {
		if currency == baseCurrency {
			rates[currency] = 1.0
			continue
		}
		result, err := s.exchangeService.Convert(ctx, baseCurrency, currency, 1.0)
		if err == nil {
			rates[currency] = result.Rate
		}
	}
	return rates
}

// GetAIService returns the underlying AI service for direct operations
func (s *AIChatService) GetAIService() *AIService {
	return s.aiService
}

// ListConversations returns all conversations for a user
func (s *AIChatService) ListConversations(ctx context.Context, userID uuid.UUID) ([]model.ChatConversation, error) {
	return s.chatRepo.ListConversations(ctx, userID)
}

// GetConversation returns a conversation with its messages
func (s *AIChatService) GetConversation(ctx context.Context, userID uuid.UUID, conversationID string) (*model.ConversationWithMessages, error) {
	convID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, fmt.Errorf("invalid conversation ID")
	}

	conv, err := s.chatRepo.GetConversation(ctx, convID)
	if err != nil {
		return nil, err
	}

	// Verify ownership
	if conv.UserID != userID {
		return nil, fmt.Errorf("conversation not found")
	}

	messages, err := s.chatRepo.GetMessages(ctx, convID)
	if err != nil {
		return nil, err
	}

	return &model.ConversationWithMessages{
		Conversation: *conv,
		Messages:     messages,
	}, nil
}

// DeleteConversation deletes a conversation
func (s *AIChatService) DeleteConversation(ctx context.Context, userID uuid.UUID, conversationID string) error {
	convID, err := uuid.Parse(conversationID)
	if err != nil {
		return fmt.Errorf("invalid conversation ID")
	}

	return s.chatRepo.DeleteConversation(ctx, convID, userID)
}
