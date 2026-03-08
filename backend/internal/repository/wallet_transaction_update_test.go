package repository

import (
	"reflect"
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

func TestBuildTransactionUpdateBalanceDeltas_ReducesCreditByDifference(t *testing.T) {
	oldTx := &model.Transaction{
		Type:     model.TransactionTypeCredit,
		Amount:   1000,
		Currency: "USD",
	}

	deltas := buildTransactionUpdateBalanceDeltas(oldTx, model.TransactionTypeCredit, 950, "USD")

	expected := map[string]float64{"USD": -50}
	if !reflect.DeepEqual(deltas, expected) {
		t.Fatalf("expected deltas %v, got %v", expected, deltas)
	}
}

func TestBuildTransactionUpdateBalanceDeltas_ChangesCurrency(t *testing.T) {
	oldTx := &model.Transaction{
		Type:     model.TransactionTypeCredit,
		Amount:   120,
		Currency: "USD",
	}

	deltas := buildTransactionUpdateBalanceDeltas(oldTx, model.TransactionTypeCredit, 120, "EUR")

	expected := map[string]float64{
		"USD": -120,
		"EUR": 120,
	}
	if !reflect.DeepEqual(deltas, expected) {
		t.Fatalf("expected deltas %v, got %v", expected, deltas)
	}
}

func TestBuildTransactionUpdateBalanceDeltas_FlipsDebitToCredit(t *testing.T) {
	oldTx := &model.Transaction{
		Type:     model.TransactionTypeDebit,
		Amount:   75,
		Currency: "USD",
	}

	deltas := buildTransactionUpdateBalanceDeltas(oldTx, model.TransactionTypeCredit, 75, "USD")

	expected := map[string]float64{"USD": 150}
	if !reflect.DeepEqual(deltas, expected) {
		t.Fatalf("expected deltas %v, got %v", expected, deltas)
	}
}

func TestBuildTransactionUpdateBalanceDeltas_NoNetChange(t *testing.T) {
	oldTx := &model.Transaction{
		Type:     model.TransactionTypeDebit,
		Amount:   50,
		Currency: "USD",
	}

	deltas := buildTransactionUpdateBalanceDeltas(oldTx, model.TransactionTypeDebit, 50, "USD")

	if len(deltas) != 0 {
		t.Fatalf("expected no deltas, got %v", deltas)
	}
}
