package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestParseTaskDate(t *testing.T) {
	t.Run("accepts yyyy_mm_dd", func(t *testing.T) {
		dueDate, err := parseTaskDate("2026-03-01")
		if err != nil {
			t.Fatalf("parseTaskDate returned error: %v", err)
		}
		if dueDate == nil {
			t.Fatalf("expected parsed due date, got nil")
		}

		if dueDate.Format("2006-01-02") != "2026-03-01" {
			t.Fatalf("unexpected due date: %s", dueDate.Format(time.RFC3339))
		}
	})

	t.Run("rejects iso_timestamp", func(t *testing.T) {
		_, err := parseTaskDate("2026-03-01T10:00:00Z")
		if err == nil {
			t.Fatalf("expected error for non-YYYY-MM-DD date")
		}
	})

	t.Run("allows_empty", func(t *testing.T) {
		dueDate, err := parseTaskDate("")
		if err != nil {
			t.Fatalf("parseTaskDate returned error: %v", err)
		}
		if dueDate != nil {
			t.Fatalf("expected nil due date for empty input")
		}
	})
}

func TestParseAndValidateTransactionID(t *testing.T) {
	svc := &TaskService{}
	userID := uuid.New()

	t.Run("allows_empty_transaction_id", func(t *testing.T) {
		transactionID, err := svc.parseAndValidateTransactionID(context.Background(), userID, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if transactionID != nil {
			t.Fatalf("expected nil transaction id for empty input")
		}
	})

	t.Run("rejects_invalid_uuid", func(t *testing.T) {
		_, err := svc.parseAndValidateTransactionID(context.Background(), userID, "not-a-uuid")
		if err == nil {
			t.Fatalf("expected invalid transaction id error")
		}
		if err.Error() != "invalid transaction_id format" {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("requires_wallet_repo_for_non_empty_id", func(t *testing.T) {
		_, err := svc.parseAndValidateTransactionID(
			context.Background(),
			userID,
			"11111111-1111-1111-1111-111111111111",
		)
		if err == nil {
			t.Fatalf("expected error when wallet repo is missing")
		}
		if err.Error() != "wallet repository is not configured" {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
