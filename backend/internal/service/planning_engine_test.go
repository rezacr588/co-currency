package service

import "testing"

func TestIsValidAutopilotTime(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"HH:MM accepted", "09:00", true},
		{"HH:MM:SS accepted", "09:00:00", true},
		{"midnight", "00:00:00", true},
		{"end of day", "23:59:59", true},
		// Go's time.Parse is lenient about leading zeros, so "9:00:00" and
		// "09:00:00" both parse. Postgres TIME is lenient too, so treating
		// them as equivalent matches what the DB ultimately stores.
		{"single-digit hour accepted", "9:00:00", true},
		{"24-hour wraparound rejected", "24:00:00", false},
		{"minutes overflow rejected", "12:60:00", false},
		{"seconds overflow rejected", "12:00:60", false},
		{"empty rejected", "", false},
		{"garbage rejected", "morning", false},
		{"12h suffix rejected", "9:00 AM", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isValidAutopilotTime(tc.input)
			if got != tc.want {
				t.Errorf("isValidAutopilotTime(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}
