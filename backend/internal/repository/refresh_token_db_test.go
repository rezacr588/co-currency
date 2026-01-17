package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// Note: NewRefreshTokenRepository requires a non-nil Database that has Pool() method
// Testing with nil database would cause a panic, so we skip this test
// In real usage, the repository should always be created with a valid database connection

// Test error definitions
func TestRefreshTokenRepositoryErrors(t *testing.T) {
	if ErrRefreshTokenNotFound == nil {
		t.Error("ErrRefreshTokenNotFound should not be nil")
	}

	if ErrRefreshTokenExpired == nil {
		t.Error("ErrRefreshTokenExpired should not be nil")
	}

	// Verify error messages
	if ErrRefreshTokenNotFound.Error() != "refresh token not found" {
		t.Errorf("Unexpected error message: %s", ErrRefreshTokenNotFound.Error())
	}

	if ErrRefreshTokenExpired.Error() != "refresh token expired" {
		t.Errorf("Unexpected error message: %s", ErrRefreshTokenExpired.Error())
	}
}

// Test error comparison
func TestRefreshTokenRepositoryErrors_Comparison(t *testing.T) {
	// Verify errors are distinct
	if ErrRefreshTokenNotFound == ErrRefreshTokenExpired {
		t.Error("ErrRefreshTokenNotFound and ErrRefreshTokenExpired should be distinct")
	}
}

// Test hashToken function
func TestHashToken(t *testing.T) {
	// Same input should produce same hash
	token := "test-token-12345"
	hash1 := hashToken(token)
	hash2 := hashToken(token)

	if hash1 != hash2 {
		t.Error("Same token should produce same hash")
	}

	// Different inputs should produce different hashes
	hash3 := hashToken("different-token")
	if hash1 == hash3 {
		t.Error("Different tokens should produce different hashes")
	}

	// Hash should be a hex string (64 characters for SHA-256)
	if len(hash1) != 64 {
		t.Errorf("Expected hash length 64, got %d", len(hash1))
	}

	// Hash should only contain valid hex characters
	for _, c := range hash1 {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("Invalid character in hash: %c", c)
		}
	}
}

// Test hashToken with empty string
func TestHashToken_Empty(t *testing.T) {
	hash := hashToken("")

	// Empty string should still produce a valid hash
	if len(hash) != 64 {
		t.Errorf("Expected hash length 64 for empty string, got %d", len(hash))
	}
}

// Test hashToken with various inputs
func TestHashToken_VariousInputs(t *testing.T) {
	testCases := []string{
		"short",
		"this-is-a-longer-token-string",
		"special!@#$%^&*()characters",
		"unicode-日本語-token",
		uuid.New().String(),
	}

	for _, token := range testCases {
		hash := hashToken(token)
		if len(hash) != 64 {
			t.Errorf("Hash for %q has wrong length: %d", token, len(hash))
		}
	}
}

// Test RefreshToken struct
func TestRefreshToken_Structure(t *testing.T) {
	now := time.Now()
	expiresAt := now.Add(7 * 24 * time.Hour)

	rt := RefreshToken{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		TokenHash: "abc123def456",
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}

	if rt.ID == uuid.Nil {
		t.Error("Expected non-nil ID")
	}

	if rt.UserID == uuid.Nil {
		t.Error("Expected non-nil UserID")
	}

	if rt.TokenHash != "abc123def456" {
		t.Errorf("Expected TokenHash 'abc123def456', got %s", rt.TokenHash)
	}

	if rt.ExpiresAt != expiresAt {
		t.Errorf("ExpiresAt mismatch")
	}

	if rt.CreatedAt != now {
		t.Errorf("CreatedAt mismatch")
	}
}

// Test that hash is deterministic
func TestHashToken_Deterministic(t *testing.T) {
	token := "test-refresh-token"

	// Run multiple times to ensure determinism
	hashes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		hash := hashToken(token)
		hashes[hash] = true
	}

	// All hashes should be the same
	if len(hashes) != 1 {
		t.Errorf("Expected all hashes to be identical, got %d unique hashes", len(hashes))
	}
}
