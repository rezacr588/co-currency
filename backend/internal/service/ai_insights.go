package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/tmc/langchaingo/llms"
)

// GetInsights generates financial insights based on the user's report.
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

	responseText := cleanAIJSON(response.Choices[0].Content)

	var result model.InsightResponse
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return &model.InsightResponse{
			Advice:      "Could not parse AI insights. Please review your spending habits.",
			ActionItems: []string{"Track your expenses daily", "Review your subscription services"},
			Sentiment:   "neutral",
		}, nil
	}

	return &result, nil
}
