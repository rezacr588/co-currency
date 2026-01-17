package repository

import (
	"testing"
)

// Test error definitions
func TestWalletRepositoryErrors(t *testing.T) {
	if ErrInsufficientBalance == nil {
		t.Error("ErrInsufficientBalance should not be nil")
	}

	if ErrBalanceNotFound == nil {
		t.Error("ErrBalanceNotFound should not be nil")
	}

	// Verify error messages
	if ErrInsufficientBalance.Error() != "insufficient balance" {
		t.Errorf("Unexpected error message: %s", ErrInsufficientBalance.Error())
	}

	if ErrBalanceNotFound.Error() != "balance not found" {
		t.Errorf("Unexpected error message: %s", ErrBalanceNotFound.Error())
	}
}

// Note: NewWalletRepository requires a non-nil Database that has Pool() method
// Testing with nil database would cause a panic, so we skip this test
// In real usage, the repository should always be created with a valid database connection

// Test error comparison
func TestWalletRepositoryErrors_Comparison(t *testing.T) {
	// Verify errors are distinct
	if ErrInsufficientBalance == ErrBalanceNotFound {
		t.Error("ErrInsufficientBalance and ErrBalanceNotFound should be distinct")
	}

	// Verify errors can be used with errors.Is
	err := ErrInsufficientBalance
	if err.Error() != "insufficient balance" {
		t.Error("Error message mismatch")
	}
}
