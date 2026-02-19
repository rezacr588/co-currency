package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

// AdviceService generates personalized financial advice using AI
type AdviceService struct {
	aiService  *AIService
	walletRepo *repository.WalletRepository
	userRepo   *repository.UserRepository
	cache      *gocache.Cache
}

// NewAdviceService creates a new AdviceService
func NewAdviceService(aiService *AIService, walletRepo *repository.WalletRepository, userRepo *repository.UserRepository) *AdviceService {
	return &AdviceService{
		aiService:  aiService,
		walletRepo: walletRepo,
		userRepo:   userRepo,
		cache:      gocache.New(6*time.Hour, 10*time.Minute),
	}
}

var staticTips = []model.PersonalizedAdvice{
	{Title: "Track Every Expense", Detail: "Small purchases add up quickly. Track all expenses, even small ones, to understand where your money goes.", Category: "spending", IsAI: false},
	{Title: "Build an Emergency Fund", Detail: "Aim to save 3-6 months of expenses in an easily accessible account for unexpected costs.", Category: "saving", IsAI: false},
	{Title: "Review Subscriptions", Detail: "Audit your recurring subscriptions monthly. Cancel services you don't actively use.", Category: "budgeting", IsAI: false},
	{Title: "Use the 50/30/20 Rule", Detail: "Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.", Category: "budgeting", IsAI: false},
	{Title: "Set Specific Goals", Detail: "Give every savings goal a name and deadline. You're more likely to reach specific targets than vague ones.", Category: "saving", IsAI: false},
}

const advicePromptTemplate = `You are a concise, friendly personal finance advisor. Based on the user's financial data, generate ONE personalized, actionable financial tip.

User Financial Data:
- Total Balance: %.2f %s
- Monthly Income: %.2f
- Monthly Expenses: %.2f
- Spending Trend: %s
- Top Spending Categories: %s
- Active Goals: %d
- Active Budgets: %d

Language: %s

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "title": "<short title, max 50 characters>",
  "detail": "<actionable advice referencing their actual numbers, max 200 characters>",
  "category": "<one of: spending, saving, budgeting, investing, general>"
}

Rules:
- Reference their ACTUAL numbers (e.g., "Your food spending of $450 is 40%% of expenses")
- Be specific and actionable, not generic
- If they're doing well in an area, acknowledge it
- Keep it encouraging and practical
- Return ONLY the JSON, nothing else`

// GetAdvice returns personalized financial advice for a user
func (s *AdviceService) GetAdvice(ctx context.Context, userID uuid.UUID, lang string) (*model.PersonalizedAdvice, error) {
	// Check cache
	cacheKey := fmt.Sprintf("advice:%s:%s", userID.String(), lang)
	if cached, found := s.cache.Get(cacheKey); found {
		if advice, ok := cached.(*model.PersonalizedAdvice); ok {
			return advice, nil
		}
	}

	// Try AI-powered advice
	if s.aiService != nil && s.walletRepo != nil {
		advice, err := s.generateAIAdvice(ctx, userID, lang)
		if err != nil {
			log.Warn().Err(err).Msg("AI advice generation failed, falling back to static")
		} else {
			s.cache.Set(cacheKey, advice, 6*time.Hour)
			return advice, nil
		}
	}

	// Fallback to static tip
	tip := staticTips[time.Now().Day()%len(staticTips)]
	return &tip, nil
}

func (s *AdviceService) generateAIAdvice(ctx context.Context, userID uuid.UUID, lang string) (*model.PersonalizedAdvice, error) {
	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, err
	}

	// Gather financial context
	balances, _ := s.walletRepo.GetBalances(ctx, userID)
	var totalBalance float64
	var preferredCurrency string
	for _, b := range balances {
		totalBalance += b.Balance
		if b.Balance > 0 && preferredCurrency == "" {
			preferredCurrency = b.Currency
		}
	}
	if preferredCurrency == "" {
		preferredCurrency = "USD"
	}

	// Get transactions for this month
	transactions, _ := s.walletRepo.GetTransactions(ctx, userID, 100, 0)
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var monthlyIncome, monthlyExpenses, lastMonthExpenses float64
	categoryTotals := make(map[string]float64)
	startOfLastMonth := startOfMonth.AddDate(0, -1, 0)

	for _, tx := range transactions {
		if tx.CreatedAt.After(startOfMonth) {
			if tx.Type == "credit" {
				monthlyIncome += tx.Amount
			} else if tx.Type == "debit" {
				monthlyExpenses += tx.Amount
				if tx.Category != "" {
					categoryTotals[tx.Category] += tx.Amount
				}
			}
		}
		if tx.CreatedAt.After(startOfLastMonth) && tx.CreatedAt.Before(startOfMonth) {
			if tx.Type == "debit" {
				lastMonthExpenses += tx.Amount
			}
		}
	}

	spendingTrend := "stable"
	if lastMonthExpenses > 0 {
		change := ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
		if change > 10 {
			spendingTrend = "increasing"
		} else if change < -10 {
			spendingTrend = "decreasing"
		}
	}

	// Build category string
	var catParts []string
	for cat, amount := range categoryTotals {
		catParts = append(catParts, fmt.Sprintf("%s: %.2f", cat, amount))
	}
	catStr := "none yet"
	if len(catParts) > 0 {
		catStr = strings.Join(catParts, ", ")
	}

	if lang == "" {
		lang = "English"
	}

	prompt := fmt.Sprintf(advicePromptTemplate, totalBalance, preferredCurrency, monthlyIncome, monthlyExpenses, spendingTrend, catStr, 0, 0, lang)

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("AI advice call failed: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	responseText := strings.TrimSpace(response.Choices[0].Content)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}")
	if jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart {
		responseText = responseText[jsonStart : jsonEnd+1]
	}

	var advice model.PersonalizedAdvice
	if err := json.Unmarshal([]byte(responseText), &advice); err != nil {
		return nil, fmt.Errorf("parsing advice response: %w", err)
	}

	advice.IsAI = true
	return &advice, nil
}
