package repository

import (
	"testing"
)

// Test error helper functions
func TestContains(t *testing.T) {
	testCases := []struct {
		s        string
		substr   string
		expected bool
	}{
		{"hello world", "world", true},
		{"hello world", "hello", true},
		{"hello world", "xyz", false},
		{"", "", true},
		{"hello", "", true},
		{"", "hello", false},
		{"test", "test", true},
		{"testing", "test", true},
		{"test", "testing", false},
		{"duplicate key", "duplicate key", true},
		{"23505", "23505", true},
		{"error 23505 occurred", "23505", true},
	}

	for _, tc := range testCases {
		result := contains(tc.s, tc.substr)
		if result != tc.expected {
			t.Errorf("contains(%q, %q) = %v, expected %v", tc.s, tc.substr, result, tc.expected)
		}
	}
}

func TestIsDuplicateKeyError(t *testing.T) {
	testCases := []struct {
		err      error
		expected bool
	}{
		{nil, false},
	}

	for _, tc := range testCases {
		result := isDuplicateKeyError(tc.err)
		if result != tc.expected {
			t.Errorf("isDuplicateKeyError(%v) = %v, expected %v", tc.err, result, tc.expected)
		}
	}
}

// Test error definitions
func TestUserRepositoryErrors(t *testing.T) {
	if ErrUserNotFound == nil {
		t.Error("ErrUserNotFound should not be nil")
	}

	if ErrUserAlreadyExists == nil {
		t.Error("ErrUserAlreadyExists should not be nil")
	}

	// Verify error messages
	if ErrUserNotFound.Error() != "user not found" {
		t.Errorf("Unexpected error message: %s", ErrUserNotFound.Error())
	}

	if ErrUserAlreadyExists.Error() != "user already exists" {
		t.Errorf("Unexpected error message: %s", ErrUserAlreadyExists.Error())
	}
}
