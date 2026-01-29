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

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/googleai"
	"github.com/tmc/langchaingo/llms/openai"
)

// AIService handles AI-powered receipt/invoice parsing
type AIService struct {
	llm          llms.Model
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
func (s *AIService) getLLM(ctx context.Context) (llms.Model, error) {
	if s.llm != nil {
		return s.llm, nil
	}

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
		return nil, fmt.Errorf("unsupported AI provider: %s (supported: cerebras, openai, googleai/gemini)", s.provider)
	}

	if err != nil {
		return nil, fmt.Errorf("initializing AI provider: %w", err)
	}

	s.llm = llm
	return llm, nil
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
		confidence += 0.4
	}
	if result.Currency != "" && result.Currency != "USD" { // Non-default currency
		confidence += 0.2
	} else if result.Currency == "USD" {
		confidence += 0.1
	}
	if result.Type != "" {
		confidence += 0.2
	}
	if result.Description != "" {
		confidence += 0.2
	}

	return confidence
}

// IsConfigured returns true if the AI service is properly configured
func (s *AIService) IsConfigured() bool {
	return s.apiKey != ""
}

// GetProvider returns the configured AI provider name
func (s *AIService) GetProvider() string {
	return s.provider
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
