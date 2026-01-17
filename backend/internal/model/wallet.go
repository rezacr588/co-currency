package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// WalletBalance represents a user's balance in a specific currency
type WalletBalance struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Currency  string    `json:"currency"`
	Balance   float64   `json:"balance"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Transaction represents a wallet transaction
type Transaction struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	Type            string          `json:"type"` // "credit", "debit", "convert"
	Amount          float64         `json:"amount"`
	Currency        string          `json:"currency"`
	ToAmount        *float64        `json:"to_amount,omitempty"`
	ToCurrency      *string         `json:"to_currency,omitempty"`
	Rate            *float64        `json:"rate,omitempty"`
	Source          string          `json:"source"` // "manual", "ai_receipt", "ai_invoice"
	AIExtractedData json.RawMessage `json:"ai_extracted_data,omitempty"`
	Description     string          `json:"description,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// TransactionRequest represents a manual transaction request
type TransactionRequest struct {
	Type        string  `json:"type"`        // "credit" or "debit"
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Description string  `json:"description,omitempty"`
}

// ConvertBalanceRequest represents a currency conversion request
type ConvertBalanceRequest struct {
	FromCurrency string  `json:"from_currency"`
	ToCurrency   string  `json:"to_currency"`
	Amount       float64 `json:"amount"`
}

// ConvertBalanceResponse represents the result of a balance conversion
type ConvertBalanceResponse struct {
	FromCurrency string  `json:"from_currency"`
	ToCurrency   string  `json:"to_currency"`
	FromAmount   float64 `json:"from_amount"`
	ToAmount     float64 `json:"to_amount"`
	Rate         float64 `json:"rate"`
	Transaction  *Transaction `json:"transaction"`
}

// WalletSummary provides an overview of a user's wallet
type WalletSummary struct {
	Balances         []WalletBalance `json:"balances"`
	RecentTransactions []Transaction `json:"recent_transactions,omitempty"`
}

// AIParseResult represents the result of AI parsing a receipt/invoice
type AIParseResult struct {
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Type        string  `json:"type"` // "credit" or "debit"
	Description string  `json:"description"`
	Confidence  float64 `json:"confidence"`
	RawText     string  `json:"raw_text,omitempty"`
}

// ApplyParsedRequest represents a request to apply an AI-parsed result
type ApplyParsedRequest struct {
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Type        string  `json:"type"`
	Description string  `json:"description"`
}
