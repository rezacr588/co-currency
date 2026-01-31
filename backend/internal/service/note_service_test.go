package service

import (
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

func TestIsValidColor(t *testing.T) {
	tests := []struct {
		name     string
		color    string
		expected bool
	}{
		{"valid default color", "default", true},
		{"valid red color", "red", true},
		{"valid orange color", "orange", true},
		{"valid yellow color", "yellow", true},
		{"valid green color", "green", true},
		{"valid blue color", "blue", true},
		{"valid purple color", "purple", true},
		{"valid pink color", "pink", true},
		{"invalid color", "black", false},
		{"invalid color white", "white", false},
		{"empty color", "", false},
		{"random string", "random", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidColor(tt.color)
			if result != tt.expected {
				t.Errorf("isValidColor(%q) = %v, want %v", tt.color, result, tt.expected)
			}
		})
	}
}

func TestNoteColors(t *testing.T) {
	expectedColors := []string{
		"default",
		"red",
		"orange",
		"yellow",
		"green",
		"blue",
		"purple",
		"pink",
	}

	if len(model.NoteColors) != len(expectedColors) {
		t.Errorf("NoteColors length = %d, want %d", len(model.NoteColors), len(expectedColors))
	}

	for i, color := range expectedColors {
		if model.NoteColors[i] != color {
			t.Errorf("NoteColors[%d] = %q, want %q", i, model.NoteColors[i], color)
		}
	}
}
