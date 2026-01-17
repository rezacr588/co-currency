package model

import (
	"time"

	"github.com/google/uuid"
)

// Budget represents a spending budget for a category
type Budget struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Category  string    `json:"category"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	Period    string    `json:"period"` // "monthly" or "yearly"
	Spent     float64   `json:"spent"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Remaining returns the remaining budget amount
func (b *Budget) Remaining() float64 {
	return b.Amount - b.Spent
}

// Progress returns the spending progress percentage (0-100+)
func (b *Budget) Progress() float64 {
	if b.Amount <= 0 {
		return 0
	}
	return (b.Spent / b.Amount) * 100
}

// IsOverBudget returns true if spending exceeds the budget
func (b *Budget) IsOverBudget() bool {
	return b.Spent > b.Amount
}

// IsNearLimit returns true if spending is at 80% or more of budget
func (b *Budget) IsNearLimit() bool {
	return b.Progress() >= 80
}

// CreateBudgetRequest represents a request to create a budget
type CreateBudgetRequest struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
	Period   string  `json:"period"` // "monthly" or "yearly"
}

// UpdateBudgetRequest represents a request to update a budget
type UpdateBudgetRequest struct {
	Amount *float64 `json:"amount,omitempty"`
	Period *string  `json:"period,omitempty"`
}

// BudgetPeriods are the valid budget periods
var BudgetPeriods = []string{"monthly", "yearly"}
