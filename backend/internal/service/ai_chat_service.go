package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

// AIChatService handles AI-powered financial advisor chat with full context
type AIChatService struct {
	aiService       *AIService
	exchangeService *ExchangeService
	chatRepo        *repository.ChatRepository
	walletRepo      *repository.WalletRepository
	goalRepo        *repository.GoalRepository
	budgetRepo      *repository.BudgetRepository
	userRepo        *repository.UserRepository
	recurringRepo   *repository.RecurringRepository
	memoryRepo      *repository.MemoryRepository
	memoryService   *MemoryService // Semantic memory with Qdrant
	loanRepo        *repository.LoanRepository
	categoryRepo     *repository.CategoryRepository
	reportsService   *ReportsService
	subscriptionRepo *repository.SubscriptionRepository
	noteRepo         *repository.NoteRepository
	toolExecutor     *AIToolExecutor
}

var (
	ErrConversationNotFound  = errors.New("conversation not found")
	ErrInvalidConversationID = errors.New("invalid conversation id")
)

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
) *AIChatService {
	toolExecutor := NewAIToolExecutor(walletRepo, categoryRepo, reportsService, subscriptionRepo, noteRepo, loanRepo, budgetRepo)
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
	}
}

// CreateConversation creates a new conversation without invoking the LLM.
func (s *AIChatService) CreateConversation(ctx context.Context, userID uuid.UUID, title string) (*model.ChatConversation, error) {
	return s.chatRepo.CreateConversation(ctx, userID, title)
}

// Chat processes a user message and returns an AI response with full context
func (s *AIChatService) Chat(ctx context.Context, userID uuid.UUID, userName string, conversationID string, message string) (*model.ChatResponse, error) {
	var convID uuid.UUID
	var conv *model.ChatConversation
	var err error

	// Trim and validate conversation ID
	conversationID = strings.TrimSpace(conversationID)

	// Get or create conversation
	// Ignore temp IDs or invalid formats
	if conversationID != "" && !strings.HasPrefix(conversationID, "temp-") {
		convID, err = uuid.Parse(conversationID)
		if err != nil {
			return nil, ErrInvalidConversationID
		}
		conv, err = s.chatRepo.GetConversation(ctx, convID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrConversationNotFound
			}
			return nil, fmt.Errorf("getting conversation: %w", err)
		}
		// Verify ownership
		if conv.UserID != userID {
			return nil, ErrConversationNotFound
		}
	} else {
		// Create new conversation with first message as title
		title := message
		if len(title) > 50 {
			title = title[:47] + "..."
		}
		conv, err = s.chatRepo.CreateConversation(ctx, userID, title)
		if err != nil {
			return nil, fmt.Errorf("creating conversation: %w", err)
		}
		convID = conv.ID
	}

	// Save user message
	userMsg, err := s.chatRepo.AddMessage(ctx, convID, "user", message, 0)
	if err != nil {
		return nil, fmt.Errorf("saving user message: %w", err)
	}
	if userMsg == nil {
		return nil, fmt.Errorf("saving user message: empty response")
	}

	// Get conversation history for context (last 20 messages)
	history, err := s.chatRepo.GetRecentMessages(ctx, convID, 20)
	if err != nil {
		return nil, fmt.Errorf("getting history: %w", err)
	}

	// Get financial context
	financialContext, err := s.getFinancialContext(ctx, userID)
	if err != nil {
		// Continue without financial context if there's an error
		financialContext = &model.FinancialContext{}
	}

	// Get user memories (long-term context) - use semantic search with current message
	memories, memErr := s.getUserMemories(ctx, userID, message)
	if memErr != nil {
		// Log but continue - memories are optional context
		log.Warn().Err(memErr).Str("user_id", userID.String()).Msg("Failed to retrieve user memories for chat")
	}

	// Get exchange rates (use user's preferred currency or USD)
	baseCurrency := financialContext.PreferredCurrency
	if baseCurrency == "" {
		baseCurrency = "USD"
	}
	rates := s.getExchangeRates(ctx, baseCurrency)

	// Build the system prompt with rich financial context
	systemPrompt := s.buildSystemPrompt(userName, financialContext, memories, rates)

	// Build message history for the LLM
	messages := s.buildLLMMessages(systemPrompt, history, *userMsg)

	// Call the AI with tool resolution loop
	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	aiResponse, err := s.resolveToolCalls(ctx, llm, messages, userID, baseCurrency)
	if err != nil {
		return nil, fmt.Errorf("calling AI: %w", err)
	}

	// Save AI response
	aiMsg, err := s.chatRepo.AddMessage(ctx, convID, "assistant", aiResponse, 0)
	if err != nil {
		return nil, fmt.Errorf("saving AI message: %w", err)
	}

	// Store messages in short-term memory (async) for semantic recall
	if s.memoryService != nil {
		s.memoryService.StoreShortTermMemory(ctx, userID, convID.String(), "user", message)
		s.memoryService.StoreShortTermMemory(ctx, userID, convID.String(), "assistant", aiResponse)
	}

	return &model.ChatResponse{
		ConversationID: convID.String(),
		Message:        *aiMsg,
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
	onStart func(conversationID string),
	onChunk func(chunk string) error,
) (*model.ChatResponse, error) {
	var convID uuid.UUID
	var conv *model.ChatConversation
	var err error

	// Trim and validate conversation ID
	conversationID = strings.TrimSpace(conversationID)

	// Get or create conversation
	// Ignore temp IDs or invalid formats
	if conversationID != "" && !strings.HasPrefix(conversationID, "temp-") {
		convID, err = uuid.Parse(conversationID)
		if err != nil {
			return nil, ErrInvalidConversationID
		}
		conv, err = s.chatRepo.GetConversation(ctx, convID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrConversationNotFound
			}
			return nil, fmt.Errorf("getting conversation: %w", err)
		}
		// Verify ownership
		if conv.UserID != userID {
			return nil, ErrConversationNotFound
		}
	} else {
		// Create new conversation with first message as title
		title := message
		if len(title) > 50 {
			title = title[:47] + "..."
		}
		conv, err = s.chatRepo.CreateConversation(ctx, userID, title)
		if err != nil {
			return nil, fmt.Errorf("creating conversation: %w", err)
		}
		convID = conv.ID
	}

	if onStart != nil {
		onStart(convID.String())
	}

	// Save user message
	userMsg, err := s.chatRepo.AddMessage(ctx, convID, "user", message, 0)
	if err != nil {
		return nil, fmt.Errorf("saving user message: %w", err)
	}
	if userMsg == nil {
		return nil, fmt.Errorf("saving user message: empty response")
	}

	// Get conversation history for context (last 20 messages)
	history, err := s.chatRepo.GetRecentMessages(ctx, convID, 20)
	if err != nil {
		return nil, fmt.Errorf("getting history: %w", err)
	}

	// Get financial context
	financialContext, err := s.getFinancialContext(ctx, userID)
	if err != nil {
		financialContext = &model.FinancialContext{}
	}

	// Get user memories (long-term context) - use semantic search with current message
	memories, memErr := s.getUserMemories(ctx, userID, message)
	if memErr != nil {
		// Log but continue - memories are optional context
		log.Warn().Err(memErr).Str("user_id", userID.String()).Msg("Failed to retrieve user memories for stream chat")
	}

	// Get exchange rates (use user's preferred currency or USD)
	baseCurrency := financialContext.PreferredCurrency
	if baseCurrency == "" {
		baseCurrency = "USD"
	}
	rates := s.getExchangeRates(ctx, baseCurrency)

	// Build the system prompt with rich financial context
	systemPrompt := s.buildSystemPrompt(userName, financialContext, memories, rates)

	// Build message history for the LLM
	messages := s.buildLLMMessages(systemPrompt, history, *userMsg)

	// Call the AI (with tool resolution, then stream final response)
	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	// First call: non-streaming to check for tool calls
	firstResponse, err := llm.GenerateContent(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("calling ai: %w", err)
	}
	if len(firstResponse.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	firstText := firstResponse.Choices[0].Content
	tc := parseToolCall(firstText)

	var aiResponse string

	if tc != nil {
		// Tool call detected — resolve non-streaming, then stream final answer
		// Append AI's tool call + tool result to messages
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(firstText)},
			Role:  llms.ChatMessageTypeAI,
		})

		result, execErr := s.toolExecutor.Execute(ctx, userID, baseCurrency, tc)
		if execErr != nil {
			log.Warn().Err(execErr).Str("tool", tc.Name).Msg("Tool execution failed")
			result = fmt.Sprintf("Tool error: %v. Please answer based on the available context.", execErr)
		}

		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(fmt.Sprintf("Tool '%s' returned:\n%s\n\nNow provide your final answer to the user based on this data.", tc.Name, result))},
			Role:  llms.ChatMessageTypeHuman,
		})

		// Allow up to 2 more iterations for chained tool calls
		for i := 0; i < 2; i++ {
			nextResp, err := llm.GenerateContent(ctx, messages)
			if err != nil {
				return nil, fmt.Errorf("calling ai (tool loop): %w", err)
			}
			if len(nextResp.Choices) == 0 {
				return nil, fmt.Errorf("no response from AI")
			}
			nextText := nextResp.Choices[0].Content
			nextTC := parseToolCall(nextText)
			if nextTC == nil {
				// No more tool calls — stream this final response
				aiResponse = stripToolCallMarkers(nextText)
				break
			}
			// Another tool call
			messages = append(messages, llms.MessageContent{
				Parts: []llms.ContentPart{llms.TextPart(nextText)},
				Role:  llms.ChatMessageTypeAI,
			})
			result, execErr = s.toolExecutor.Execute(ctx, userID, baseCurrency, nextTC)
			if execErr != nil {
				log.Warn().Err(execErr).Str("tool", nextTC.Name).Msg("Tool execution failed")
				result = fmt.Sprintf("Tool error: %v. Please answer based on the available context.", execErr)
			}
			messages = append(messages, llms.MessageContent{
				Parts: []llms.ContentPart{llms.TextPart(fmt.Sprintf("Tool '%s' returned:\n%s\n\nNow provide your final answer to the user based on this data.", nextTC.Name, result))},
				Role:  llms.ChatMessageTypeHuman,
			})
		}

		// If we exhausted iterations without a final answer, force one
		if aiResponse == "" {
			finalResp, err := llm.GenerateContent(ctx, messages)
			if err != nil {
				return nil, fmt.Errorf("calling ai (final): %w", err)
			}
			if len(finalResp.Choices) > 0 {
				aiResponse = stripToolCallMarkers(finalResp.Choices[0].Content)
			}
		}

		// Stream the final response to the client
		if onChunk != nil && aiResponse != "" {
			if err := onChunk(aiResponse); err != nil {
				return nil, err
			}
		}
	} else {
		// No tool call — redo with streaming for better UX
		var sb strings.Builder
		streamedAny := false
		streamingFunc := func(ctx context.Context, chunk []byte) error {
			if len(chunk) == 0 {
				return nil
			}
			streamedAny = true
			text := string(chunk)
			sb.WriteString(text)
			if onChunk != nil {
				if err := onChunk(text); err != nil {
					return err
				}
			}
			return nil
		}

		response, err := llm.GenerateContent(ctx, messages, llms.WithStreamingFunc(streamingFunc))
		if err != nil {
			if streamedAny {
				return nil, fmt.Errorf("calling ai: streaming failed: %w", err)
			}
			sb.Reset()
			// Fallback to non-streaming
			response, err = llm.GenerateContent(ctx, messages)
			if err != nil {
				return nil, fmt.Errorf("calling ai: %w", err)
			}
		}

		if len(response.Choices) == 0 {
			return nil, fmt.Errorf("no response from AI")
		}

		aiResponse = strings.TrimSpace(sb.String())
		if aiResponse == "" {
			aiResponse = response.Choices[0].Content
			if onChunk != nil && aiResponse != "" {
				if err := onChunk(aiResponse); err != nil {
					return nil, err
				}
			}
		}

		// Strip any accidental tool call markers
		aiResponse = stripToolCallMarkers(aiResponse)
	}

	// Save AI response
	aiMsg, err := s.chatRepo.AddMessage(ctx, convID, "assistant", aiResponse, 0)
	if err != nil {
		return nil, fmt.Errorf("saving AI message: %w", err)
	}

	// Store messages in short-term memory (async) for semantic recall
	if s.memoryService != nil {
		s.memoryService.StoreShortTermMemory(ctx, userID, convID.String(), "user", message)
		s.memoryService.StoreShortTermMemory(ctx, userID, convID.String(), "assistant", aiResponse)
	}

	return &model.ChatResponse{
		ConversationID: convID.String(),
		Message:        *aiMsg,
	}, nil
}

// buildSystemPrompt creates a rich system prompt with financial context
func (s *AIChatService) buildSystemPrompt(userName string, fctx *model.FinancialContext, memories []model.UserMemory, rates map[string]float64) string {
	var sb strings.Builder

	// Header with user context
	displayName := userName
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
		sb.WriteString(fmt.Sprintf("- Name: %s\n", fctx.UserName))
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
			sb.WriteString(fmt.Sprintf("- [%s] %s\n", m.Category, m.Content))
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

	// Savings goals
	if len(fctx.SavingsGoals) > 0 {
		sb.WriteString("## SAVINGS GOALS\n")
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
5. **Be Concise**: Keep responses focused and easy to read
6. **Track Insights**: When you learn something important about the user (preferences, goals, habits), note it for future conversations

## CAPABILITIES

You can help with:
- Financial analysis and advice based on their data
- Currency conversions using real-time rates
- Budget tracking and recommendations
- Goal progress updates
- Spending pattern analysis
- Recurring expense insights

Remember: Be friendly, professional, and always use the user's actual data when giving advice.
`)

	// Append tool definitions
	sb.WriteString("\n")
	sb.WriteString(buildToolDefinitionsPrompt())

	return sb.String()
}

// resolveToolCalls runs the LLM and resolves any tool calls (max 3 iterations)
func (s *AIChatService) resolveToolCalls(ctx context.Context, llm llms.Model, messages []llms.MessageContent, userID uuid.UUID, currency string) (string, error) {
	const maxIterations = 3

	for i := 0; i < maxIterations; i++ {
		response, err := llm.GenerateContent(ctx, messages)
		if err != nil {
			return "", fmt.Errorf("generating content: %w", err)
		}
		if len(response.Choices) == 0 {
			return "", fmt.Errorf("no response from AI")
		}

		text := response.Choices[0].Content
		tc := parseToolCall(text)

		if tc == nil {
			// No tool call — return the final response
			return stripToolCallMarkers(text), nil
		}

		// Execute the tool
		result, execErr := s.toolExecutor.Execute(ctx, userID, currency, tc)
		if execErr != nil {
			log.Warn().Err(execErr).Str("tool", tc.Name).Msg("Tool execution failed")
			result = fmt.Sprintf("Tool error: %v. Please answer based on the available context.", execErr)
		}

		// Append the AI response and tool result to messages for the next iteration
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(text)},
			Role:  llms.ChatMessageTypeAI,
		})
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(fmt.Sprintf("Tool '%s' returned:\n%s\n\nNow provide your final answer to the user based on this data.", tc.Name, result))},
			Role:  llms.ChatMessageTypeHuman,
		})
	}

	// If we exhausted iterations, make one final call
	response, err := llm.GenerateContent(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("generating final content: %w", err)
	}
	if len(response.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}
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

// getFinancialContext gathers the user's financial data for the AI
func (s *AIChatService) getFinancialContext(ctx context.Context, userID uuid.UUID) (*model.FinancialContext, error) {
	fctx := &model.FinancialContext{}
	now := time.Now()

	// Set date context
	fctx.TodayDate = now.Format("January 2, 2006")
	fctx.DaysUntilMonthEnd = daysUntilEndOfMonth(now)

	// Get user info (with nil check for both error and user)
	if s.userRepo != nil {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err == nil && user != nil {
			fctx.UserName = user.Name
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
			fctx.TotalBalance += b.Balance
		}
		// Determine preferred currency (highest balance)
		if len(fctx.Balances) > 0 {
			maxBal := fctx.Balances[0]
			for _, b := range fctx.Balances {
				if b.Balance > maxBal.Balance {
					maxBal = b
				}
			}
			fctx.PreferredCurrency = maxBal.Currency
		}
	}

	// Get transactions and calculate monthly stats
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startOfLastMonth := startOfMonth.AddDate(0, -1, 0)

	transactions, err := s.walletRepo.GetTransactions(ctx, userID, 500, 0)
	if err == nil {
		categoryTotals := make(map[string]float64)

		for i, tx := range transactions {
			// This month
			if tx.CreatedAt.After(startOfMonth) {
				fctx.RecentTransactions++
				if tx.Type == "credit" {
					fctx.MonthlyIncome += tx.Amount
				} else if tx.Type == "debit" {
					fctx.MonthlyExpenses += tx.Amount
					if tx.Category != "" {
						categoryTotals[tx.Category] += tx.Amount
					}
				}
			}

			// Last month (for trend)
			if tx.CreatedAt.After(startOfLastMonth) && tx.CreatedAt.Before(startOfMonth) {
				if tx.Type == "debit" {
					fctx.LastMonthExpenses += tx.Amount
				}
			}

			// Add recent transactions to list (last 50)
			if i < 50 {
				fctx.RecentTransactionList = append(fctx.RecentTransactionList, model.TransactionSummary{
					Date:        tx.CreatedAt.Format("Jan 2"),
					Type:        tx.Type,
					Amount:      tx.Amount,
					Currency:    tx.Currency,
					Category:    tx.Category,
					Description: tx.Description,
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

	// Get budgets
	budgets, err := s.budgetRepo.GetByUser(ctx, userID)
	if err == nil {
		for _, b := range budgets {
			fctx.ActiveBudgets = append(fctx.ActiveBudgets, model.BudgetSummary{
				Category: b.Category,
				Budget:   b.Amount,
				Spent:    b.Spent,
			})
		}
	}

	// Get goals
	goals, err := s.goalRepo.GetByUser(ctx, userID)
	if err == nil {
		for _, g := range goals {
			progress := float64(0)
			if g.TargetAmount > 0 {
				progress = (g.CurrentAmount / g.TargetAmount) * 100
			}
			fctx.SavingsGoals = append(fctx.SavingsGoals, model.GoalSummary{
				Name:     g.Name,
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
						Description: r.Description,
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

	// Get categories
	if s.categoryRepo != nil {
		categories, err := s.categoryRepo.GetCategories(ctx, userID)
		if err == nil {
			for _, cat := range categories {
				fctx.Categories = append(fctx.Categories, model.CategoryInfo{
					Name:      cat.Name,
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
					Name:            loan.Name,
					Type:            string(loan.Type),
					RemainingAmount: loan.RemainingAmount,
					Currency:        loan.Currency,
					Counterparty:    loan.Counterparty,
				}
				if loan.DueDate != nil {
					loanSummary.DueDate = loan.DueDate.Format("Jan 2, 2006")
				}
				fctx.ActiveLoans = append(fctx.ActiveLoans, loanSummary)

				if loan.Type == model.LoanTypeBorrowed {
					fctx.TotalDebt += loan.RemainingAmount
				} else {
					fctx.TotalReceivable += loan.RemainingAmount
				}
			}
			fctx.NetDebtPosition = fctx.TotalDebt - fctx.TotalReceivable
		}
	}

	return fctx, nil
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
