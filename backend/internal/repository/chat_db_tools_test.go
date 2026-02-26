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

func TestUnmarshalChatToolsUsed_EmptyAndNullDefaultToSlice(t *testing.T) {
	tests := []struct {
		name string
		raw  []byte
	}{
		{name: "empty", raw: nil},
		{name: "json null", raw: []byte("null")},
		{name: "json empty array", raw: []byte("[]")},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var decoded []model.ChatToolUsage
			if err := unmarshalChatToolsUsed(tc.raw, &decoded); err != nil {
				t.Fatalf("unmarshalChatToolsUsed() error = %v", err)
			}
			if decoded == nil {
				t.Fatalf("expected non-nil decoded slice for %s", tc.name)
			}
			if len(decoded) != 0 {
				t.Fatalf("expected empty decoded slice for %s, got %d", tc.name, len(decoded))
			}
		})
	}
}

func TestUnmarshalChatToolsUsed_InvalidJSONReturnsError(t *testing.T) {
	var decoded []model.ChatToolUsage
	err := unmarshalChatToolsUsed([]byte("{not-json}"), &decoded)
	if err == nil {
		t.Fatal("expected error for invalid json, got nil")
	}
}

func TestUnmarshalChatToolsUsed_NilDestinationIsNoop(t *testing.T) {
	if err := unmarshalChatToolsUsed([]byte("[]"), nil); err != nil {
		t.Fatalf("expected nil error when destination is nil, got %v", err)
	}
}
