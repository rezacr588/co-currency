package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	TransactionTypeCredit  = "credit"
	TransactionTypeDebit   = "debit"
	TransactionTypeConvert = "convert"
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
	Category        string          `json:"category,omitempty"`
	Icon            string          `json:"icon,omitempty"`
	AIExtractedData json.RawMessage `json:"ai_extracted_data,omitempty"`
	Description     string          `json:"description,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// TransactionRequest represents a manual transaction request
type TransactionRequest struct {
	Type           string  `json:"type"` // "credit" or "debit"
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`                  // Transaction currency (what you're paying/receiving in)
	WalletCurrency string  `json:"wallet_currency,omitempty"` // Wallet currency to use (defaults to Currency if not set)
	Category       string  `json:"category,omitempty"`
	Icon           string  `json:"icon,omitempty"`
	Description    string  `json:"description,omitempty"`
}

// UpdateTransactionRequest represents a request to update an existing transaction
type UpdateTransactionRequest struct {
	Type        string  `json:"type,omitempty"`
	Amount      float64 `json:"amount,omitempty"`
	Currency    string  `json:"currency,omitempty"`
	Category    string  `json:"category,omitempty"`
	Icon        string  `json:"icon,omitempty"`
	Description string  `json:"description,omitempty"`
}

// Category represents a transaction category
type Category struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id,omitempty"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon,omitempty"`
	Color     string    `json:"color,omitempty"`
	IsDefault bool      `json:"is_default"`
}

// DefaultCategories returns the default transaction categories
func DefaultCategories() []Category {
	return []Category{
		{Name: "food", Icon: "🍔", Color: "#ef4444", IsDefault: true},
		{Name: "transportation", Icon: "🚗", Color: "#f97316", IsDefault: true},
		{Name: "entertainment", Icon: "🎬", Color: "#eab308", IsDefault: true},
		{Name: "shopping", Icon: "🛒", Color: "#22c55e", IsDefault: true},
		{Name: "bills", Icon: "📄", Color: "#3b82f6", IsDefault: true},
		{Name: "income", Icon: "💰", Color: "#10b981", IsDefault: true},
		{Name: "transfer", Icon: "↔️", Color: "#8b5cf6", IsDefault: true},
		{Name: "other", Icon: "📦", Color: "#6b7280", IsDefault: true},
	}
}

// TransactionFilter represents filter options for transactions
type TransactionFilter struct {
	Search        string `json:"search,omitempty"`
	Category      string `json:"category,omitempty"`
	Type          string `json:"type,omitempty"`
	Currency      string `json:"currency,omitempty"`
	FromDate      string `json:"from_date,omitempty"`
	ToDate        string `json:"to_date,omitempty"`
	FromTimestamp string `json:"from_ts,omitempty"`
	ToTimestamp   string `json:"to_ts,omitempty"`
}

// ConvertBalanceRequest represents a currency conversion request
type ConvertBalanceRequest struct {
	FromCurrency string  `json:"from_currency"`
	ToCurrency   string  `json:"to_currency"`
	Amount       float64 `json:"amount"`
}

// ConvertBalanceResponse represents the result of a balance conversion
type ConvertBalanceResponse struct {
	FromCurrency string       `json:"from_currency"`
	ToCurrency   string       `json:"to_currency"`
	FromAmount   float64      `json:"from_amount"`
	ToAmount     float64      `json:"to_amount"`
	Rate         float64      `json:"rate"`
	Transaction  *Transaction `json:"transaction"`
}

// WalletSummary provides an overview of a user's wallet
type WalletSummary struct {
	TotalBalanceUSD    float64         `json:"total_balance_usd"`
	Balances           []WalletBalance `json:"balances"`
	RecentTransactions []Transaction   `json:"recent_transactions,omitempty"`
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
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`                  // Transaction currency (parsed from receipt)
	WalletCurrency string  `json:"wallet_currency,omitempty"` // Wallet currency to credit/debit (for cross-currency)
	Type           string  `json:"type"`
	Description    string  `json:"description"`
}

// InsightResponse represents AI-generated financial insights
type InsightResponse struct {
	Advice      string   `json:"advice"`
	ActionItems []string `json:"action_items"`
	Sentiment   string   `json:"sentiment"` // "positive", "neutral", "negative"
}

// IntentResult represents a lightweight intent classification
type IntentResult struct {
	Intent string `json:"intent"` // "transaction", "recurring", "goal_contribution", "convert", "rate", "none"
}

// SmartParseResult represents enhanced AI parsing with action type detection
type SmartParseResult struct {
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Type         string  `json:"type"` // "credit" or "debit"
	Description  string  `json:"description"`
	Category     string  `json:"category"`                // Inferred category (food, transportation, etc.)
	ActionType   string  `json:"action_type"`             // "transaction", "recurring", "goal_contribution", "convert", "rate", or "none"
	Frequency    string  `json:"frequency,omitempty"`     // For recurring: "daily", "weekly", "monthly", "yearly"
	GoalName     string  `json:"goal_name,omitempty"`     // For goal contributions
	FromCurrency string  `json:"from_currency,omitempty"` // For convert/rate: source currency
	ToCurrency   string  `json:"to_currency,omitempty"`   // For convert/rate: target currency
	Confidence   float64 `json:"confidence"`
	RawText      string  `json:"raw_text,omitempty"`
}

// ApplyRecurringRequest represents a request to create a recurring transaction from AI parse
type ApplyRecurringRequest struct {
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Type        string  `json:"type"` // "credit" or "debit"
	Description string  `json:"description"`
	Category    string  `json:"category,omitempty"`
	Frequency   string  `json:"frequency"` // "daily", "weekly", "monthly", "yearly"
}

// ApplyGoalContributionRequest represents a request to contribute to a goal from AI parse
type ApplyGoalContributionRequest struct {
	Amount   float64 `json:"amount"`
	GoalID   string  `json:"goal_id"`
	GoalName string  `json:"goal_name,omitempty"` // Used if goal_id not provided to search
}
