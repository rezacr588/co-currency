package model

import "testing"

func TestGetCurrency(t *testing.T) {
	tests := []struct {
		code    string
		wantOk  bool
		wantName string
	}{
		{"USD", true, "US Dollar"},
		{"EUR", true, "Euro"},
		{"GBP", true, "British Pound"},
		{"INVALID", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			got, ok := GetCurrency(tt.code)
			if ok != tt.wantOk {
				t.Errorf("GetCurrency(%q) ok = %v, want %v", tt.code, ok, tt.wantOk)
			}
			if ok && got.Name != tt.wantName {
				t.Errorf("GetCurrency(%q).Name = %v, want %v", tt.code, got.Name, tt.wantName)
			}
		})
	}
}

func TestGetAllCurrencies(t *testing.T) {
	currencies := GetAllCurrencies()

	if len(currencies) == 0 {
		t.Error("GetAllCurrencies() returned empty slice")
	}

	// Check that currencies are sorted by priority
	for i := 1; i < len(currencies); i++ {
		if currencies[i-1].Priority > currencies[i].Priority {
			t.Errorf("Currencies not sorted by priority: %v > %v",
				currencies[i-1].Priority, currencies[i].Priority)
		}
	}

	// Check that USD is first (priority 1)
	if currencies[0].Code != "USD" {
		t.Errorf("First currency = %v, want USD", currencies[0].Code)
	}
}
