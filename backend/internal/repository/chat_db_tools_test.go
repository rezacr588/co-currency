package repository

import (
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

func TestMarshalChatToolsUsed_EmptyDefaultsToArray(t *testing.T) {
	raw, err := marshalChatToolsUsed(nil)
	if err != nil {
		t.Fatalf("marshalChatToolsUsed() error = %v", err)
	}
	if string(raw) != "[]" {
		t.Fatalf("expected [] json, got %q", string(raw))
	}
}

func TestMarshalAndUnmarshalChatToolsUsed_RoundTrip(t *testing.T) {
	tools := []model.ChatToolUsage{
		{Name: "web_search", Count: 2},
		{Name: "search_transactions", Count: 1},
	}

	raw, err := marshalChatToolsUsed(tools)
	if err != nil {
		t.Fatalf("marshalChatToolsUsed() error = %v", err)
	}

	var decoded []model.ChatToolUsage
	if err := unmarshalChatToolsUsed(raw, &decoded); err != nil {
		t.Fatalf("unmarshalChatToolsUsed() error = %v", err)
	}

	if len(decoded) != len(tools) {
		t.Fatalf("decoded length = %d, want %d", len(decoded), len(tools))
	}
	for i := range tools {
		if decoded[i] != tools[i] {
			t.Fatalf("decoded[%d] = %+v, want %+v", i, decoded[i], tools[i])
		}
	}
}
