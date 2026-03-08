package service

import (
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

func TestNormalizedTransactionCurrencies(t *testing.T) {
	req := &model.TransactionRequest{
		Currency:       " usd ",
		WalletCurrency: " eur ",
	}

	currency, walletCurrency := normalizedTransactionCurrencies(req)

	if currency != "USD" {
		t.Fatalf("expected normalized transaction currency USD, got %q", currency)
	}
	if walletCurrency != "EUR" {
		t.Fatalf("expected normalized wallet currency EUR, got %q", walletCurrency)
	}
}

func TestNormalizedTransactionCurrencies_DefaultsWalletCurrency(t *testing.T) {
	req := &model.TransactionRequest{
		Currency: " try ",
	}

	currency, walletCurrency := normalizedTransactionCurrencies(req)

	if currency != "TRY" {
		t.Fatalf("expected normalized transaction currency TRY, got %q", currency)
	}
	if walletCurrency != "TRY" {
		t.Fatalf("expected wallet currency to default to TRY, got %q", walletCurrency)
	}
}

func TestNormalizedConversionCurrencies(t *testing.T) {
	req := &model.ConvertBalanceRequest{
		FromCurrency: " usd ",
		ToCurrency:   " jpy ",
	}

	fromCurrency, toCurrency := normalizedConversionCurrencies(req)

	if fromCurrency != "USD" {
		t.Fatalf("expected normalized from currency USD, got %q", fromCurrency)
	}
	if toCurrency != "JPY" {
		t.Fatalf("expected normalized to currency JPY, got %q", toCurrency)
	}
}

func TestNormalizeUpdateTransactionRequest(t *testing.T) {
	req := &model.UpdateTransactionRequest{
		Currency: " eur ",
	}

	normalizeUpdateTransactionRequest(req)

	if req.Currency != "EUR" {
		t.Fatalf("expected normalized update currency EUR, got %q", req.Currency)
	}
}
