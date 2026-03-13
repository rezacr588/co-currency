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
)

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

// ParseReceipt parses a receipt image and extracts transaction data.
func (s *AIService) ParseReceipt(ctx context.Context, imageData []byte, mimeType string) (*model.AIParseResult, error) {
	if len(imageData) == 0 {
		return nil, errors.New("image data is required")
	}

	llm, err := s.getVisionLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting vision LLM: %w", err)
	}

	prompt := buildReceiptPrompt("image", "")

	var content []llms.ContentPart
	base64Image := base64.StdEncoding.EncodeToString(imageData)
	content = append(content, llms.ImageURLPart(fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)))
	content = append(content, llms.TextPart(prompt))

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

	result, err := s.parseAIResponse(response.Choices[0].Content)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	return result, nil
}

// ParseReceiptText parses text content (e.g., OCR'd receipt) and extracts transaction data.
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

	result, err := s.parseAIResponse(response.Choices[0].Content)
	if err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	result.RawText = text
	return result, nil
}

// parseAIResponse extracts and validates the JSON from AI response.
func (s *AIService) parseAIResponse(responseText string) (*model.AIParseResult, error) {
	responseText = cleanAIJSON(responseText)

	var result model.AIParseResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
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

	result.Currency = strings.ToUpper(result.Currency)
	result.Confidence = s.calculateConfidence(&result)

	return &result, nil
}

// extractFieldsManually attempts to extract fields from malformed response.
func (s *AIService) extractFieldsManually(text string) model.AIParseResult {
	result := model.AIParseResult{
		Type:     "debit",
		Currency: "USD",
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

	return result
}

// calculateConfidence calculates a confidence score based on field completeness.
func (s *AIService) calculateConfidence(result *model.AIParseResult) float64 {
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
	if inferCategory(result.Description) != "other" {
		confidence += 0.15
	}

	return confidence
}
