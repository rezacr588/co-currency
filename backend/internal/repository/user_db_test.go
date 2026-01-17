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

	if ErrAccountLocked == nil {
		t.Error("ErrAccountLocked should not be nil")
	}

	if ErrInvalidResetToken == nil {
		t.Error("ErrInvalidResetToken should not be nil")
	}

	// Verify error messages
	if ErrUserNotFound.Error() != "user not found" {
		t.Errorf("Unexpected error message: %s", ErrUserNotFound.Error())
	}

	if ErrUserAlreadyExists.Error() != "user already exists" {
		t.Errorf("Unexpected error message: %s", ErrUserAlreadyExists.Error())
	}

	if ErrAccountLocked.Error() != "account is temporarily locked" {
		t.Errorf("Unexpected error message: %s", ErrAccountLocked.Error())
	}

	if ErrInvalidResetToken.Error() != "invalid or expired reset token" {
		t.Errorf("Unexpected error message: %s", ErrInvalidResetToken.Error())
	}
}

// Note: NewUserRepository requires a non-nil Database that has Pool() method
// Testing with nil database would cause a panic, so we skip this test
// In real usage, the repository should always be created with a valid database connection

// Test containsHelper function
func TestContainsHelper(t *testing.T) {
	testCases := []struct {
		s        string
		substr   string
		expected bool
	}{
		{"hello world", "world", true},
		{"hello world", "hello", true},
		{"hello world", "xyz", false},
		{"test", "test", true},
		{"testing", "test", true},
		{"test", "testing", false},
		{"ab", "abc", false},
	}

	for _, tc := range testCases {
		result := containsHelper(tc.s, tc.substr)
		if result != tc.expected {
			t.Errorf("containsHelper(%q, %q) = %v, expected %v", tc.s, tc.substr, result, tc.expected)
		}
	}
}

// Test isDuplicateKeyError with various error types
func TestIsDuplicateKeyError_WithErrors(t *testing.T) {
	testCases := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"duplicate key error", "duplicate key violation", true},
		{"postgres code 23505", "error code 23505", true},
		{"generic error", "something went wrong", false},
		{"empty error", "", false},
		{"contains 23505 at start", "23505: unique violation", true},
		{"contains duplicate at end", "failed: duplicate key", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var err error
			if tc.errMsg != "" {
				err = &testError{msg: tc.errMsg}
			}
			result := isDuplicateKeyError(err)
			if result != tc.expected {
				t.Errorf("isDuplicateKeyError(%q) = %v, expected %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

// testError is a simple error type for testing
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
