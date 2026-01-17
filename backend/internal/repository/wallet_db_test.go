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
