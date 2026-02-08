package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/googleai"
	"github.com/tmc/langchaingo/llms/openai"
)

// AIService handles AI-powered receipt/invoice parsing
type AIService struct {
	llm          llms.Model
	llmOnce      sync.Once
	llmErr       error
	provider     string
	apiKey       string
	model        string
	cloudProject string
}

// NewAIService creates a new AIService with the specified provider
func NewAIService(provider, apiKey, model, cloudProject string) (*AIService, error) {
	if apiKey == "" {
		return nil, errors.New("AI_API_KEY is required")
	}

	// Auto-detect provider if default is used but key matches specific patterns
	p := strings.ToLower(provider)
	if p == "googleai" || p == "gemini" || p == "" {
		if strings.HasPrefix(apiKey, "csk-") {
			p = "cerebras"
		} else if strings.HasPrefix(apiKey, "sk-") {
			p = "openai"
		}
	}

	// We'll initialize the LLM lazily to avoid requiring context at construction time
	return &AIService{
		provider:     p,
		apiKey:       apiKey,
		model:        model,
		cloudProject: cloudProject,
	}, nil
}

// getLLM initializes the LLM on first use (for text-only operations)
// Thread-safe via sync.Once to prevent race conditions
func (s *AIService) getLLM(ctx context.Context) (llms.Model, error) {
	s.llmOnce.Do(func() {
		var llm llms.Model
		var err error

		switch s.provider {
		case "cerebras":
			// Cerebras uses OpenAI-compatible API
			model := s.model
			if model == "" {
				model = "llama-3.3-70b" // Default fallback
			}
			llm, err = openai.New(
				openai.WithToken(s.apiKey),
				openai.WithBaseURL("https://api.cerebras.ai/v1"),
				openai.WithModel(model),
			)
		case "openai":
			llm, err = openai.New(
				openai.WithToken(s.apiKey),
				openai.WithModel("gpt-4o-mini"),
			)
		case "googleai", "gemini", "":
			opts := []googleai.Option{
				googleai.WithAPIKey(s.apiKey),
				googleai.WithDefaultModel("gemini-1.5-flash"),
			}
			if s.cloudProject != "" {
				opts = append(opts, googleai.WithCloudProject(s.cloudProject))
			}
			llm, err = googleai.New(ctx, opts...)
		default:
			s.llmErr = fmt.Errorf("unsupported AI provider: %s (supported: cerebras, openai, googleai/gemini)", s.provider)
			return
		}

		if err != nil {
			s.llmErr = fmt.Errorf("initializing AI provider: %w", err)
			return
		}

		s.llm = llm
	})

	if s.llmErr != nil {
		return nil, s.llmErr
	}
	return s.llm, nil
}

const receiptPromptTemplate = `Analyze this receipt or invoice %s. Extract the following information and return ONLY a valid JSON object (no markdown, no explanation):

{
  "amount": <number - the total amount as a decimal number>,
  "currency": "<3-letter ISO currency code, e.g., USD, EUR, IRR>",
  "type": "<either 'credit' for income/refund or 'debit' for expense/payment>",
  "description": "<brief description of the transaction, max 100 characters>"
}

Rules:
- For receipts/invoices showing purchases: type should be "debit"
- For receipts showing refunds or income: type should be "credit"
- Use the total/grand total amount, not subtotals
- If currency symbol is $ assume USD, € assume EUR, £ assume GBP
- If you cannot determine a field, use reasonable defaults (USD for currency, "debit" for type)
- Return ONLY the JSON object, nothing else`

func buildReceiptPrompt(subject, text string) string {
	prompt := fmt.Sprintf(receiptPromptTemplate, subject)
	if text == "" {
		return prompt
	}
	return fmt.Sprintf("%s\n\nReceipt text:\n%s", prompt, text)
}

// ParseReceipt parses a receipt image and extracts transaction data
func (s *AIService) ParseReceipt(ctx context.Context, imageData []byte, mimeType string) (*model.AIParseResult, error) {
	if len(imageData) == 0 {
		return nil, errors.New("image data is required")
	}

	llm, err := s.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	prompt := buildReceiptPrompt("image", "")

	// Create message with image
	var content []llms.ContentPart

	// Add image part
	base64Image := base64.StdEncoding.EncodeToString(imageData)
	content = append(content, llms.ImageURLPart(fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)))

	// Add text prompt
	content = append(content, llms.TextPart(prompt))

	// Call the LLM
	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: content,
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("provider", s.provider).
			Msg("AI service call failed")
		return nil, fmt.Errorf("calling AI service (%s): %w", s.provider, err)
	}

	if len(response.Choices) == 0 {
		return nil, errors.New("no response from AI service")
	}

	responseText := response.Choices[0].Content

	// Parse the JSON response
	result, err := s.parseAIResponse(responseText)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	return result, nil
}

// ParseReceiptText parses text content (e.g., OCR'd receipt) and extracts transaction data
func (s *AIService) ParseReceiptText(ctx context.Context, text string) (*model.AIParseResult, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	llm, err := s.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	prompt := buildReceiptPrompt("text", text)

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("provider", s.provider).
			Msg("AI service call (text) failed")
		return nil, fmt.Errorf("calling AI service (text, %s): %w", s.provider, err)
	}

	if len(response.Choices) == 0 {
		return nil, errors.New("no response from AI service")
	}

	responseText := response.Choices[0].Content

	result, err := s.parseAIResponse(responseText)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	result.RawText = text
	return result, nil
}

// parseAIResponse extracts and validates the JSON from AI response
func (s *AIService) parseAIResponse(responseText string) (*model.AIParseResult, error) {
	// Clean up the response - remove markdown code blocks if present
	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	// Try to extract JSON from the response
	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}")
	if jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart {
		responseText = responseText[jsonStart : jsonEnd+1]
	}

	// Parse JSON
	var result model.AIParseResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		// Try to extract fields manually if JSON parsing fails
		result = s.extractFieldsManually(responseText)
	}

	// Validate and set defaults
	if result.Currency == "" {
		result.Currency = "USD"
	}
	if result.Type == "" {
		result.Type = "debit"
	}
	if result.Type != "credit" && result.Type != "debit" {
		result.Type = "debit"
	}

	// Normalize currency code
	result.Currency = strings.ToUpper(result.Currency)

	// Set confidence based on completeness
	result.Confidence = s.calculateConfidence(&result)

	return &result, nil
}

// extractFieldsManually attempts to extract fields from malformed response
func (s *AIService) extractFieldsManually(text string) model.AIParseResult {
	result := model.AIParseResult{
		Type:     "debit",
		Currency: "USD",
	}

	// Try to find amount
	amountPattern := regexp.MustCompile(`"amount"\s*:\s*([0-9.]+)`)
	if matches := amountPattern.FindStringSubmatch(text); len(matches) > 1 {
		if amount, err := strconv.ParseFloat(matches[1], 64); err == nil {
			result.Amount = amount
		}
	}

	// Try to find currency
	currencyPattern := regexp.MustCompile(`"currency"\s*:\s*"([A-Z]{3})"`)
	if matches := currencyPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Currency = matches[1]
	}

	// Try to find type
	typePattern := regexp.MustCompile(`"type"\s*:\s*"(credit|debit)"`)
	if matches := typePattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Type = matches[1]
	}

	// Try to find description
	descPattern := regexp.MustCompile(`"description"\s*:\s*"([^"]*)"`)
	if matches := descPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Description = matches[1]
	}

	return result
}

// calculateConfidence calculates a confidence score based on field completeness
func (s *AIService) calculateConfidence(result *model.AIParseResult) float64 {
	confidence := 0.0

	if result.Amount > 0 {
		confidence += 0.3
	}
	if result.Currency != "" {
		confidence += 0.2 // Equal weight for all currencies
	}
	if result.Type != "" {
		confidence += 0.2
	}
	if result.Description != "" {
		confidence += 0.15
	}
	// Category inference bonus
	if inferCategory(result.Description) != "other" {
		confidence += 0.15
	}

	return confidence
}

// categoryKeywords maps keywords to categories for smart inference
var categoryKeywords = map[string][]string{
	"food":           {"coffee", "lunch", "dinner", "breakfast", "restaurant", "cafe", "food", "eat", "meal", "snack", "grocery", "groceries", "pizza", "burger", "sushi", "takeout", "delivery"},
	"transportation": {"uber", "lyft", "taxi", "gas", "fuel", "parking", "metro", "bus", "train", "flight", "airline", "car", "transit", "commute"},
	"entertainment":  {"movie", "netflix", "spotify", "game", "concert", "show", "theater", "museum", "subscription", "stream"},
	"shopping":       {"amazon", "store", "shop", "clothes", "shoes", "electronics", "purchase", "buy", "bought"},
	"bills":          {"rent", "electricity", "water", "internet", "phone", "utility", "insurance", "bill"},
	"income":         {"salary", "paycheck", "paid", "income", "bonus", "freelance", "dividend", "interest"},
	"transfer":       {"transfer", "send", "wire", "venmo", "paypal", "zelle"},
}

// inferCategory infers a category from description text
func inferCategory(description string) string {
	lowerDesc := strings.ToLower(description)
	for category, keywords := range categoryKeywords {
		for _, keyword := range keywords {
			if strings.Contains(lowerDesc, keyword) {
				return category
			}
		}
	}
	return "other"
}

// IsConfigured returns true if the AI service is properly configured
func (s *AIService) IsConfigured() bool {
	return s.apiKey != ""
}

// GetProvider returns the configured AI provider name
func (s *AIService) GetProvider() string {
	return s.provider
}

const detectIntentPromptTemplate = `Classify the user's intent. Return ONLY a JSON object with one field "intent".

Possible intents:
- "transaction": User wants to ADD/RECORD a one-time financial transaction (must include or imply a specific amount)
- "recurring": User wants to ADD/RECORD a recurring/repeated transaction (keywords: every, monthly, weekly, daily, yearly, subscription, rent, salary)
- "goal_contribution": User wants to SAVE or CONTRIBUTE money toward a financial goal
- "convert": User wants to CONVERT one currency to another (e.g. "convert 100 USD to EUR")
- "rate": User wants to CHECK an exchange rate between currencies (e.g. "rate USD to EUR")
- "none": User is asking a question, making conversation, seeking advice, or anything else that is NOT a request to add/record a financial event

IMPORTANT:
- Questions about past spending (e.g. "how much did I spend?", "what did I buy?") are "none" — they are queries, not requests to record
- Vague statements without specific amounts (e.g. "I spend a lot on food") are "none"
- Only classify as "transaction"/"recurring"/"goal_contribution" when the user clearly intends to ADD or RECORD something

Return ONLY: {"intent": "<one of the above>"}

User message: %s`

// DetectIntent uses a lightweight AI call to classify user intent
func (s *AIService) DetectIntent(ctx context.Context, text string) (*model.IntentResult, error) {
	if text == "" {
		return &model.IntentResult{Intent: "none"}, nil
	}

	llm, err := s.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	prompt := fmt.Sprintf(detectIntentPromptTemplate, text)

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		log.Error().Err(err).Str("provider", s.provider).Msg("AI intent detection failed")
		return nil, fmt.Errorf("calling AI service (detect-intent, %s): %w", s.provider, err)
	}

	if len(response.Choices) == 0 {
		return &model.IntentResult{Intent: "none"}, nil
	}

	responseText := strings.TrimSpace(response.Choices[0].Content)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	// Extract JSON
	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}")
	if jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart {
		responseText = responseText[jsonStart : jsonEnd+1]
	}

	var result model.IntentResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return &model.IntentResult{Intent: "none"}, nil
	}

	// Validate intent value
	validIntents := map[string]bool{
		"transaction":       true,
		"recurring":         true,
		"goal_contribution": true,
		"convert":           true,
		"rate":              true,
		"none":              true,
	}
	if !validIntents[result.Intent] {
		result.Intent = "none"
	}

	return &result, nil
}

const smartParsePromptTemplate = `Analyze this user message and determine the user's financial intent. Extract the following information and return ONLY a valid JSON object (no markdown, no explanation):

{
  "amount": <number - the amount as a decimal number, or 0 if not specified>,
  "currency": "<3-letter ISO currency code, e.g., USD, EUR, GBP>",
  "type": "<'credit' for income/receiving money or 'debit' for expense/spending>",
  "description": "<brief description, max 100 characters>",
  "category": "<one of: food, transportation, entertainment, shopping, bills, income, transfer, other>",
  "action_type": "<one of: 'transaction', 'recurring', 'goal_contribution', 'convert', 'rate', 'none'>",
  "frequency": "<only if recurring: 'daily', 'weekly', 'monthly', or 'yearly'>",
  "goal_name": "<only if goal_contribution: the name of the savings goal>",
  "from_currency": "<only if convert/rate: source currency code>",
  "to_currency": "<only if convert/rate: target currency code>"
}

Action type rules:
- "transaction": User wants to ADD/RECORD a one-time financial event with a specific amount (e.g., "spent $50 on coffee", "add $12 lunch")
- "recurring": User wants to ADD/RECORD a repeated transaction (keywords: every, each, monthly, weekly, daily, yearly, subscription, rent, salary)
- "goal_contribution": User wants to SAVE or CONTRIBUTE money toward a financial goal (keywords: put toward, save for, contribute to, goal, fund)
- "convert": User wants to CONVERT a specific amount from one currency to another (e.g., "convert 100 USD to EUR", "exchange 50 dollars to euros")
- "rate": User wants to CHECK the exchange rate between two currencies without converting (e.g., "rate USD to EUR", "what is EUR in GBP", "how much is 1 dollar in yen")
- "none": ANYTHING ELSE — questions about finances, advice requests, conversation, vague statements without amounts, greetings

CRITICAL rules for "none":
- Questions about past spending (e.g., "how much did I spend?", "what did I buy?") → "none"
- Vague statements without a specific amount (e.g., "I spend a lot on food") → "none"
- Advice requests (e.g., "how can I save more?") → "none"
- Greetings and conversation (e.g., "hello", "thanks", "tell me about my budget") → "none"
- ONLY use transaction/recurring/goal_contribution when the user clearly intends to ADD or RECORD something with a specific amount

Category inference:
- coffee, lunch, dinner, restaurant, grocery → food
- uber, lyft, gas, parking, flight → transportation
- netflix, spotify, movie, game → entertainment
- amazon, store, clothes, electronics → shopping
- rent, electricity, internet, phone → bills
- salary, paycheck, income, bonus → income
- transfer, send, venmo, paypal → transfer

Transaction type: "spent"/"paid"/"bought" → debit; "received"/"earned"/"salary" → credit

Currency: $ or no symbol → USD, € → EUR, £ → GBP, toman/rial → IRR

Return ONLY the JSON object, nothing else.

User message: %s`

// SmartParse parses text with enhanced context detection for transactions, recurring, and goals
func (s *AIService) SmartParse(ctx context.Context, text string) (*model.SmartParseResult, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	llm, err := s.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	prompt := fmt.Sprintf(smartParsePromptTemplate, text)

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("provider", s.provider).
			Msg("AI smart parse failed")
		return nil, fmt.Errorf("calling AI service (smart-parse, %s): %w", s.provider, err)
	}

	if len(response.Choices) == 0 {
		return nil, errors.New("no response from AI service")
	}

	responseText := response.Choices[0].Content

	result, err := s.parseSmartResponse(responseText, text)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	result.RawText = text
	return result, nil
}

// parseSmartResponse extracts and validates the JSON from smart parse response
func (s *AIService) parseSmartResponse(responseText, originalText string) (*model.SmartParseResult, error) {
	// Clean up the response
	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	// Extract JSON
	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}")
	if jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart {
		responseText = responseText[jsonStart : jsonEnd+1]
	}

	var result model.SmartParseResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		// Fallback: try to extract fields manually
		result = s.extractSmartFieldsManually(responseText, originalText)
	}

	// Validate and set defaults
	if result.Currency == "" {
		result.Currency = "USD"
	}
	result.Currency = strings.ToUpper(result.Currency)

	if result.Type == "" || (result.Type != "credit" && result.Type != "debit") {
		result.Type = "debit"
	}

	validActions := map[string]bool{
		"transaction":       true,
		"recurring":         true,
		"goal_contribution": true,
		"convert":           true,
		"rate":              true,
		"none":              true,
	}
	if !validActions[result.ActionType] {
		result.ActionType = "none"
	}

	// Infer category if not set or is "other"
	if result.Category == "" || result.Category == "other" {
		result.Category = inferCategory(result.Description)
	}

	// Normalize from/to currencies for convert/rate
	if result.FromCurrency != "" {
		result.FromCurrency = strings.ToUpper(result.FromCurrency)
	}
	if result.ToCurrency != "" {
		result.ToCurrency = strings.ToUpper(result.ToCurrency)
	}

	// Validate frequency for recurring
	if result.ActionType == "recurring" && result.Frequency == "" {
		result.Frequency = "monthly" // Default frequency
	}

	// Calculate confidence
	result.Confidence = s.calculateSmartConfidence(&result)

	return &result, nil
}

// extractSmartFieldsManually attempts to extract smart parse fields from malformed response
func (s *AIService) extractSmartFieldsManually(text, originalText string) model.SmartParseResult {
	result := model.SmartParseResult{
		Type:       "debit",
		Currency:   "USD",
		ActionType: "none",
	}

	// Try to find amount
	amountPattern := regexp.MustCompile(`"amount"\s*:\s*([0-9.]+)`)
	if matches := amountPattern.FindStringSubmatch(text); len(matches) > 1 {
		if amount, err := strconv.ParseFloat(matches[1], 64); err == nil {
			result.Amount = amount
		}
	}

	// Try to find currency
	currencyPattern := regexp.MustCompile(`"currency"\s*:\s*"([A-Z]{3})"`)
	if matches := currencyPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Currency = matches[1]
	}

	// Try to find type
	typePattern := regexp.MustCompile(`"type"\s*:\s*"(credit|debit)"`)
	if matches := typePattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Type = matches[1]
	}

	// Try to find description
	descPattern := regexp.MustCompile(`"description"\s*:\s*"([^"]*)"`)
	if matches := descPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Description = matches[1]
	}

	// Try to find category
	catPattern := regexp.MustCompile(`"category"\s*:\s*"([^"]*)"`)
	if matches := catPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Category = matches[1]
	}

	// Try to find action_type
	actionPattern := regexp.MustCompile(`"action_type"\s*:\s*"([^"]*)"`)
	if matches := actionPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.ActionType = matches[1]
	}

	// Try to find frequency
	freqPattern := regexp.MustCompile(`"frequency"\s*:\s*"([^"]*)"`)
	if matches := freqPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Frequency = matches[1]
	}

	// Try to find goal_name
	goalPattern := regexp.MustCompile(`"goal_name"\s*:\s*"([^"]*)"`)
	if matches := goalPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.GoalName = matches[1]
	}

	// Try to find from_currency
	fromCurrPattern := regexp.MustCompile(`"from_currency"\s*:\s*"([A-Za-z]{3})"`)
	if matches := fromCurrPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.FromCurrency = strings.ToUpper(matches[1])
	}

	// Try to find to_currency
	toCurrPattern := regexp.MustCompile(`"to_currency"\s*:\s*"([A-Za-z]{3})"`)
	if matches := toCurrPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.ToCurrency = strings.ToUpper(matches[1])
	}

	// Fallback: infer from original text
	if result.Category == "" {
		result.Category = inferCategory(originalText)
	}

	return result
}

// calculateSmartConfidence calculates confidence for smart parse result
func (s *AIService) calculateSmartConfidence(result *model.SmartParseResult) float64 {
	confidence := 0.0

	if result.Amount > 0 {
		confidence += 0.3
	}
	if result.Currency != "" {
		confidence += 0.2
	}
	if result.Type != "" {
		confidence += 0.2
	}
	if result.Description != "" {
		confidence += 0.15
	}
	if result.Category != "" && result.Category != "other" {
		confidence += 0.15
	}

	return confidence
}

// GetInsights generates financial insights based on the user's report
func (s *AIService) GetInsights(ctx context.Context, report *ForecastReport) (*model.InsightResponse, error) {
	llm, err := s.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	reportJSON, _ := json.MarshalIndent(report, "", "  ")

	prompt := fmt.Sprintf(`You are a financial advisor. Analyze the following financial forecast report for a user and provide concise, actionable advice.

Report Data:
%s

Instructions:
1. Provide a brief summary of their financial health (1-2 sentences).
2. List 3 specific action items to improve their situation (e.g., "Cut spending by 10%%", "Increase income stream").
3. Determine the overall sentiment (positive, neutral, negative).
4. Return ONLY a JSON object with this structure:
{
  "advice": "summary text...",
  "action_items": ["action 1", "action 2", "action 3"],
  "sentiment": "positive/neutral/negative"
}
`, string(reportJSON))

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		return nil, fmt.Errorf("calling AI service: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, errors.New("no response from AI service")
	}

	responseText := response.Choices[0].Content

	// Clean up markdown code blocks if present
	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var result model.InsightResponse
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		// Fallback if JSON parsing fails
		return &model.InsightResponse{
			Advice:      "Could not parse AI insights. Please review your spending habits.",
			ActionItems: []string{"Track your expenses daily", "Review your subscription services"},
			Sentiment:   "neutral",
		}, nil
	}

	return &result, nil
}
