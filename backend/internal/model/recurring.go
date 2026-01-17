package model

import (
	"time"

	"github.com/google/uuid"
)

// RecurringTransaction represents a recurring transaction template
type RecurringTransaction struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	Type          string    `json:"type"` // "credit" or "debit"
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Category      string    `json:"category,omitempty"`
	Description   string    `json:"description,omitempty"`
	Frequency     string    `json:"frequency"` // "daily", "weekly", "monthly", "yearly"
	NextExecution time.Time `json:"next_execution"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CreateRecurringRequest represents a request to create a recurring transaction
type CreateRecurringRequest struct {
	Type          string `json:"type"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Category      string  `json:"category,omitempty"`
	Description   string  `json:"description,omitempty"`
	Frequency     string  `json:"frequency"`
	NextExecution string  `json:"next_execution"` // ISO date format
}

// UpdateRecurringRequest represents a request to update a recurring transaction
type UpdateRecurringRequest struct {
	Type          *string  `json:"type,omitempty"`
	Amount        *float64 `json:"amount,omitempty"`
	Category      *string  `json:"category,omitempty"`
	Description   *string  `json:"description,omitempty"`
	Frequency     *string  `json:"frequency,omitempty"`
	NextExecution *string  `json:"next_execution,omitempty"`
	IsActive      *bool    `json:"is_active,omitempty"`
}

// RecurringFrequencies are the valid frequencies
var RecurringFrequencies = []string{"daily", "weekly", "monthly", "yearly"}

// CalculateNextExecution calculates the next execution date based on frequency
func CalculateNextExecution(current time.Time, frequency string) time.Time {
	switch frequency {
	case "daily":
		return current.AddDate(0, 0, 1)
	case "weekly":
		return current.AddDate(0, 0, 7)
	case "monthly":
		return current.AddDate(0, 1, 0)
	case "yearly":
		return current.AddDate(1, 0, 0)
	default:
		return current.AddDate(0, 1, 0)
	}
}
