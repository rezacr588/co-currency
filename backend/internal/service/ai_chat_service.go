package service

import (
	"context"
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
	wealthService    *WealthService
	toolExecutor     *AIToolExecutor
	contextCache     *gocache.Cache // In-memory cache for financial context per user
	fastModel        string
	thinkingModel    string
	defaultMode      model.ChatThinkingMode
}

// SetWealthService sets the wealth service for purchasing power context
func (s *AIChatService) SetWealthService(ws *WealthService) {
	s.wealthService = ws
	if s.toolExecutor != nil {
		s.toolExecutor.wealthService = ws
	}
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
	toolUsageTracker := newChatToolUsageTracker()
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
		toolUsageTracker,
	)
	if err != nil {
		return nil, failChatWithWrap(ctx, userID, convID.String(), requestStartedAt, nil, "calling AI: %w", err)
	}
	emitChatTrace(ctx, userID, convID.String(), "llm_completed", map[string]interface{}{
		"duration_ms":     time.Since(llmStartedAt).Milliseconds(),
		"response_length": len(aiResponse),
	}, nil)

	aiMsg, err := s.persistAssistantResponse(ctx, userID, convID, message, aiResponse, usageTracker.toMessageMeta(toolUsageTracker.snapshot()))
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
	toolUsageTracker := newChatToolUsageTracker()
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
		result := s.executeToolWithTrace(ctx, userID, prepared.BaseCurrency, convID.String(), tc, onTrace, "chat_stream_initial_tool", toolUsageTracker)
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
			toolUsageTracker,
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

	aiMsg, err := s.persistAssistantResponse(ctx, userID, convID, message, aiResponse, usageTracker.toMessageMeta(toolUsageTracker.snapshot()))
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
