package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

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

// DetectIntent uses a lightweight AI call to classify user intent.
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

	responseText := cleanAIJSON(response.Choices[0].Content)

	var result model.IntentResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return &model.IntentResult{Intent: "none"}, nil
	}

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

// SmartParse parses text with enhanced context detection for transactions, recurring, and goals.
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

	result, err := s.parseSmartResponse(response.Choices[0].Content, text)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	result.RawText = text
	return result, nil
}

// parseSmartResponse extracts and validates the JSON from smart parse response.
func (s *AIService) parseSmartResponse(responseText, originalText string) (*model.SmartParseResult, error) {
	responseText = cleanAIJSON(responseText)

	var result model.SmartParseResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
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

	if result.Category == "" || result.Category == "other" {
		result.Category = inferCategory(result.Description)
	}

	if result.FromCurrency != "" {
		result.FromCurrency = strings.ToUpper(result.FromCurrency)
	}
	if result.ToCurrency != "" {
		result.ToCurrency = strings.ToUpper(result.ToCurrency)
	}

	if result.ActionType == "recurring" && result.Frequency == "" {
		result.Frequency = "monthly"
	}

	result.Confidence = s.calculateSmartConfidence(&result)

	return &result, nil
}

// extractSmartFieldsManually attempts to extract smart parse fields from malformed response.
func (s *AIService) extractSmartFieldsManually(text, originalText string) model.SmartParseResult {
	result := model.SmartParseResult{
		Type:       "debit",
		Currency:   "USD",
		ActionType: "none",
	}

	amountPattern := regexp.MustCompile(`"amount"\s*:\s*([0-9.]+)`)
	if matches := amountPattern.FindStringSubmatch(text); len(matches) > 1 {
		if amount, err := strconv.ParseFloat(matches[1], 64); err == nil {
			result.Amount = amount
		}
	}

	currencyPattern := regexp.MustCompile(`"currency"\s*:\s*"([A-Z]{3})"`)
	if matches := currencyPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Currency = matches[1]
	}

	typePattern := regexp.MustCompile(`"type"\s*:\s*"(credit|debit)"`)
	if matches := typePattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Type = matches[1]
	}

	descPattern := regexp.MustCompile(`"description"\s*:\s*"([^"]*)"`)
	if matches := descPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Description = matches[1]
	}

	catPattern := regexp.MustCompile(`"category"\s*:\s*"([^"]*)"`)
	if matches := catPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Category = matches[1]
	}

	actionPattern := regexp.MustCompile(`"action_type"\s*:\s*"([^"]*)"`)
	if matches := actionPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.ActionType = matches[1]
	}

	freqPattern := regexp.MustCompile(`"frequency"\s*:\s*"([^"]*)"`)
	if matches := freqPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.Frequency = matches[1]
	}

	goalPattern := regexp.MustCompile(`"goal_name"\s*:\s*"([^"]*)"`)
	if matches := goalPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.GoalName = matches[1]
	}

	fromCurrPattern := regexp.MustCompile(`"from_currency"\s*:\s*"([A-Za-z]{3})"`)
	if matches := fromCurrPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.FromCurrency = strings.ToUpper(matches[1])
	}

	toCurrPattern := regexp.MustCompile(`"to_currency"\s*:\s*"([A-Za-z]{3})"`)
	if matches := toCurrPattern.FindStringSubmatch(text); len(matches) > 1 {
		result.ToCurrency = strings.ToUpper(matches[1])
	}

	if result.Category == "" {
		result.Category = inferCategory(originalText)
	}

	return result
}

// calculateSmartConfidence calculates confidence for smart parse result.
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
