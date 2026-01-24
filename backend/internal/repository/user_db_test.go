package repository

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsDuplicateKeyError(t *testing.T) {
	testCases := []struct {
		name     string
		err      error
		expected bool
	}{
		{"nil error", nil, false},
		{"non-pg error", errors.New("something went wrong"), false},
		{"unique violation", &pgconn.PgError{Code: uniqueViolationCode}, true},
		{"other pg error", &pgconn.PgError{Code: "23503"}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := isDuplicateKeyError(tc.err)
			if result != tc.expected {
				t.Errorf("isDuplicateKeyError(%v) = %v, expected %v", tc.err, result, tc.expected)
			}
		})
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
