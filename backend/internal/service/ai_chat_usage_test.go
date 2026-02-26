package service

import (
	"encoding/json"
	"testing"
)

func TestExtractUsageFromGenerationInfo_OpenAIKeys(t *testing.T) {
	generationInfo := map[string]any{
		"PromptTokens":     120,
		"CompletionTokens": 80,
		"TotalTokens":      200,
		"cost_usd":         0.0025,
	}

	prompt, completion, total, billed := extractUsageFromGenerationInfo(generationInfo)

	if prompt != 120 || completion != 80 || total != 200 {
		t.Fatalf("unexpected tokens: prompt=%d completion=%d total=%d", prompt, completion, total)
	}
	if billed == nil || *billed != 0.0025 {
		t.Fatalf("unexpected billed cost: %#v", billed)
	}
}

func TestExtractUsageFromGenerationInfo_NestedUsageStruct(t *testing.T) {
	type usagePayload struct {
		PromptTokens     int     `json:"prompt_tokens"`
		CompletionTokens int     `json:"completion_tokens"`
		TotalTokens      int     `json:"total_tokens"`
		BilledCostUSD    float64 `json:"billed_cost_usd"`
	}

	generationInfo := map[string]any{
		"usage": usagePayload{
			PromptTokens:     33,
			CompletionTokens: 22,
			TotalTokens:      55,
			BilledCostUSD:    0.0011,
		},
	}

	prompt, completion, total, billed := extractUsageFromGenerationInfo(generationInfo)

	if prompt != 33 || completion != 22 || total != 55 {
		t.Fatalf("unexpected tokens from nested usage: prompt=%d completion=%d total=%d", prompt, completion, total)
	}
	if billed == nil || *billed != 0.0011 {
		t.Fatalf("unexpected billed cost from nested usage: %#v", billed)
	}
}

func TestExtractUsageFromGenerationInfo_MixedNumericTypes(t *testing.T) {
	generationInfo := map[string]any{
		"prompt_tokens":     uint32(12),
		"completion_tokens": "8",
		"total_tokens":      json.Number("20"),
		"billedCostUSD":     json.Number("0.004"),
	}

	prompt, completion, total, billed := extractUsageFromGenerationInfo(generationInfo)

	if prompt != 12 || completion != 8 || total != 20 {
		t.Fatalf("unexpected mixed-type tokens: prompt=%d completion=%d total=%d", prompt, completion, total)
	}
	if billed == nil || *billed != 0.004 {
		t.Fatalf("unexpected mixed-type billed cost: %#v", billed)
	}
}
