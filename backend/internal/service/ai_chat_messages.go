package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/tmc/langchaingo/llms"
)

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

func (u *chatUsageTracker) toMessageMeta(toolsUsed []model.ChatToolUsage) *repository.ChatMessageMeta {
	return &repository.ChatMessageMeta{
		Provider:         u.provider,
		Model:            u.model,
		ThinkingMode:     u.thinkingMode,
		ToolsUsed:        toolsUsed,
		PromptTokens:     u.promptTokens,
		CompletionTokens: u.completionTokens,
		TotalTokens:      u.totalTokens,
		EstimatedCostUSD: u.estimatedCostPtr(),
		BilledCostUSD:    u.billedCostPtr(),
		BillingSource:    u.billingSource(),
	}
}

type chatToolUsageTracker struct {
	order  []string
	counts map[string]int
}

func newChatToolUsageTracker() *chatToolUsageTracker {
	return &chatToolUsageTracker{
		order:  make([]string, 0, 4),
		counts: make(map[string]int),
	}
}

func (t *chatToolUsageTracker) add(name string) {
	if t == nil {
		return
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	if _, ok := t.counts[name]; !ok {
		t.order = append(t.order, name)
	}
	t.counts[name]++
}

func (t *chatToolUsageTracker) snapshot() []model.ChatToolUsage {
	if t == nil || len(t.order) == 0 {
		return nil
	}
	result := make([]model.ChatToolUsage, 0, len(t.order))
	for _, name := range t.order {
		count := t.counts[name]
		if count < 1 {
			continue
		}
		result = append(result, model.ChatToolUsage{
			Name:  name,
			Count: count,
		})
	}
	return result
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
