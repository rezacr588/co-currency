package model

import (
	"encoding/json"
	"testing"
)

func TestUpdateTaskRequestTransactionIDJSON(t *testing.T) {
	t.Run("captures_non_empty_transaction_id", func(t *testing.T) {
		var req UpdateTaskRequest
		payload := []byte(`{"transaction_id":"11111111-1111-1111-1111-111111111111"}`)

		if err := json.Unmarshal(payload, &req); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}
		if req.TransactionID == nil {
			t.Fatalf("expected transaction_id pointer to be set")
		}
		if *req.TransactionID != "11111111-1111-1111-1111-111111111111" {
			t.Fatalf("unexpected transaction_id: %s", *req.TransactionID)
		}
	})

	t.Run("captures_empty_transaction_id_for_unlink", func(t *testing.T) {
		var req UpdateTaskRequest
		payload := []byte(`{"transaction_id":""}`)

		if err := json.Unmarshal(payload, &req); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}
		if req.TransactionID == nil {
			t.Fatalf("expected transaction_id pointer to be set for empty string")
		}
		if *req.TransactionID != "" {
			t.Fatalf("expected empty transaction_id, got: %q", *req.TransactionID)
		}
	})
}
