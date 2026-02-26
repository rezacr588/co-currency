package service

import (
	"encoding/json"
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
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

func TestChatUsageTracker_ToMessageMetaIncludesToolsAndUsage(t *testing.T) {
	tracker := newChatUsageTracker("openai", "gpt-4o-mini", model.ChatThinkingModeFast)
	tracker.promptTokens = 111
	tracker.completionTokens = 22
	tracker.totalTokens = 133
	tracker.estimatedCostUSD = 0.1234567
	tracker.billedCostUSD = 0.7654321
	tracker.hasBilledCost = true

	tools := []model.ChatToolUsage{{Name: "web_search", Count: 2}}
	meta := tracker.toMessageMeta(tools)

	if meta.Provider != "openai" || meta.Model != "gpt-4o-mini" {
		t.Fatalf("unexpected provider/model: %s/%s", meta.Provider, meta.Model)
	}
	if meta.ThinkingMode != string(model.ChatThinkingModeFast) {
		t.Fatalf("unexpected thinking mode: %s", meta.ThinkingMode)
	}
	if len(meta.ToolsUsed) != 1 || meta.ToolsUsed[0].Name != "web_search" || meta.ToolsUsed[0].Count != 2 {
		t.Fatalf("unexpected tools: %+v", meta.ToolsUsed)
	}
	if meta.PromptTokens != 111 || meta.CompletionTokens != 22 || meta.TotalTokens != 133 {
		t.Fatalf("unexpected tokens in meta: %+v", meta)
	}
	if meta.EstimatedCostUSD == nil || *meta.EstimatedCostUSD != 0.123457 {
		t.Fatalf("unexpected estimated cost: %#v", meta.EstimatedCostUSD)
	}
	if meta.BilledCostUSD == nil || *meta.BilledCostUSD != 0.765432 {
		t.Fatalf("unexpected billed cost: %#v", meta.BilledCostUSD)
	}
	if meta.BillingSource != "hybrid" {
		t.Fatalf("unexpected billing source: %s", meta.BillingSource)
	}
}

func TestChatToolUsageTracker_SnapshotPreservesOrderAndCounts(t *testing.T) {
	tracker := newChatToolUsageTracker()
	tracker.add("search_transactions")
	tracker.add("web_search")
	tracker.add("search_transactions")
	tracker.add(" ")
	tracker.add("")

	got := tracker.snapshot()
	if len(got) != 2 {
		t.Fatalf("expected 2 tool rows, got %d", len(got))
	}

	if got[0].Name != "search_transactions" || got[0].Count != 2 {
		t.Fatalf("unexpected first tool row: %+v", got[0])
	}
	if got[1].Name != "web_search" || got[1].Count != 1 {
		t.Fatalf("unexpected second tool row: %+v", got[1])
	}
}

func TestChatToolUsageTracker_NilSafe(t *testing.T) {
	var tracker *chatToolUsageTracker
	tracker.add("web_search")
	if out := tracker.snapshot(); out != nil {
		t.Fatalf("expected nil snapshot for nil tracker, got %+v", out)
	}
}
