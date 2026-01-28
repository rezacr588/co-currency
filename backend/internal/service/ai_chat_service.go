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
	"github.com/tmc/langchaingo/llms"
)

// AIChatService handles AI-powered financial advisor chat with full context
type AIChatService struct {
	aiService  *AIService
	chatRepo   *repository.ChatRepository
	walletRepo *repository.WalletRepository
	goalRepo   *repository.GoalRepository
	budgetRepo *repository.BudgetRepository
}

var (
	ErrConversationNotFound  = errors.New("conversation not found")
	ErrInvalidConversationID = errors.New("invalid conversation id")
)

// NewAIChatService creates a new AIChatService
func NewAIChatService(
	aiService *AIService,
	chatRepo *repository.ChatRepository,
	walletRepo *repository.WalletRepository,
	goalRepo *repository.GoalRepository,
	budgetRepo *repository.BudgetRepository,
) *AIChatService {
	return &AIChatService{
		aiService:  aiService,
		chatRepo:   chatRepo,
		walletRepo: walletRepo,
		goalRepo:   goalRepo,
		budgetRepo: budgetRepo,
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

	// Get or create conversation
	if conversationID != "" {
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

	// Build the system prompt with rich financial context
	systemPrompt := s.buildSystemPrompt(userName, financialContext)

	// Build message history for the LLM
	messages := s.buildLLMMessages(systemPrompt, history, *userMsg)

	// Call the AI
	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	response, err := llm.GenerateContent(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("calling AI: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	aiResponse := response.Choices[0].Content

	// Save AI response
	aiMsg, err := s.chatRepo.AddMessage(ctx, convID, "assistant", aiResponse, 0)
	if err != nil {
		return nil, fmt.Errorf("saving AI message: %w", err)
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

	// Get or create conversation
	if conversationID != "" {
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

	// Build the system prompt with rich financial context
	systemPrompt := s.buildSystemPrompt(userName, financialContext)

	// Build message history for the LLM
	messages := s.buildLLMMessages(systemPrompt, history, *userMsg)

	// Call the AI (streaming)
	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

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
		// Fallback to non-streaming if the provider doesn't support streaming.
		response, err = llm.GenerateContent(ctx, messages)
		if err != nil {
			return nil, fmt.Errorf("calling ai: %w", err)
		}
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	aiResponse := strings.TrimSpace(sb.String())
	if aiResponse == "" {
		aiResponse = response.Choices[0].Content
		if onChunk != nil && aiResponse != "" {
			if err := onChunk(aiResponse); err != nil {
				return nil, err
			}
		}
	}

	// Save AI response
	aiMsg, err := s.chatRepo.AddMessage(ctx, convID, "assistant", aiResponse, 0)
	if err != nil {
		return nil, fmt.Errorf("saving AI message: %w", err)
	}

	return &model.ChatResponse{
		ConversationID: convID.String(),
		Message:        *aiMsg,
	}, nil
}

// buildSystemPrompt creates a rich system prompt with financial context
func (s *AIChatService) buildSystemPrompt(userName string, ctx *model.FinancialContext) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf(`You are a helpful and knowledgeable personal finance advisor for %s. You have access to their complete financial data and should use it to provide personalized, actionable advice.

`, userName))

	sb.WriteString("## USER'S FINANCIAL SNAPSHOT\n\n")

	// Balance
	sb.WriteString(fmt.Sprintf("**Total Balance**: $%.2f USD\n", ctx.TotalBalance))

	// Monthly overview
	sb.WriteString(fmt.Sprintf("**This Month's Income**: $%.2f\n", ctx.MonthlyIncome))
	sb.WriteString(fmt.Sprintf("**This Month's Expenses**: $%.2f\n", ctx.MonthlyExpenses))

	savings := ctx.MonthlyIncome - ctx.MonthlyExpenses
	savingsRate := float64(0)
	if ctx.MonthlyIncome > 0 {
		savingsRate = (savings / ctx.MonthlyIncome) * 100
	}
	sb.WriteString(fmt.Sprintf("**Net Savings This Month**: $%.2f (%.1f%% savings rate)\n\n", savings, savingsRate))

	// Top spending categories
	if len(ctx.TopCategories) > 0 {
		sb.WriteString("**Top Spending Categories**:\n")
		for _, cat := range ctx.TopCategories {
			sb.WriteString(fmt.Sprintf("- %s: $%.2f\n", cat.Category, cat.Amount))
		}
		sb.WriteString("\n")
	}

	// Active budgets
	if len(ctx.ActiveBudgets) > 0 {
		sb.WriteString("**Active Budgets**:\n")
		for _, b := range ctx.ActiveBudgets {
			pct := (b.Spent / b.Budget) * 100
			status := "✅ On track"
			if pct > 90 {
				status = "⚠️ Near limit"
			}
			if pct > 100 {
				status = "🔴 Over budget"
			}
			sb.WriteString(fmt.Sprintf("- %s: $%.2f / $%.2f spent (%.0f%%) %s\n", b.Category, b.Spent, b.Budget, pct, status))
		}
		sb.WriteString("\n")
	}

	// Savings goals
	if len(ctx.SavingsGoals) > 0 {
		sb.WriteString("**Savings Goals**:\n")
		for _, g := range ctx.SavingsGoals {
			sb.WriteString(fmt.Sprintf("- %s: $%.2f / $%.2f (%.0f%% complete)\n", g.Name, g.Current, g.Target, g.Progress))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(fmt.Sprintf("**Recent Activity**: %d transactions this month\n\n", ctx.RecentTransactions))

	sb.WriteString(`## YOUR ROLE

1. **Be Personalized**: Reference specific numbers from their financial data when answering questions
2. **Be Actionable**: Give concrete suggestions with specific amounts (e.g., "Cut $50 from dining" not "spend less on food")
3. **Be Encouraging**: Celebrate progress and frame advice positively
4. **Be Concise**: Keep responses focused and easy to read
5. **Ask Clarifying Questions**: If the user's question is vague, ask for specifics

## EXAMPLE INTERACTIONS

User: "How am I doing financially?"
Good response: Reference their savings rate, budget status, and goal progress with specific numbers.

User: "How can I save more?"
Good response: Identify their top spending categories and suggest specific reductions based on their data.

Remember: You are having a conversation. Reference previous messages when relevant. Be friendly but professional.
`)

	return sb.String()
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

	// Get total balance
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err == nil {
		for _, b := range balances {
			// Simplified: sum all balances (in production, convert to USD)
			fctx.TotalBalance += b.Balance
		}
	}

	// Get this month's income and expenses
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	transactions, err := s.walletRepo.GetTransactions(ctx, userID, 100, 0)
	if err == nil {
		categoryTotals := make(map[string]float64)

		for _, tx := range transactions {
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
		}

		// Get top 5 spending categories
		for cat, amount := range categoryTotals {
			fctx.TopCategories = append(fctx.TopCategories, model.CategorySpending{
				Category: cat,
				Amount:   amount,
			})
		}
		// Sort by amount (simple bubble sort for small list)
		for i := 0; i < len(fctx.TopCategories); i++ {
			for j := i + 1; j < len(fctx.TopCategories); j++ {
				if fctx.TopCategories[j].Amount > fctx.TopCategories[i].Amount {
					fctx.TopCategories[i], fctx.TopCategories[j] = fctx.TopCategories[j], fctx.TopCategories[i]
				}
			}
		}
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

	return fctx, nil
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
