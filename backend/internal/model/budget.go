package model

import (
	"math"
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

// BudgetResponse extends Budget with computed dynamic fields
type BudgetResponse struct {
	Budget
	Remaining      float64   `json:"remaining"`
	Progress       float64   `json:"progress"`
	IsOverBudget   bool      `json:"is_over_budget"`
	IsNearLimit    bool      `json:"is_near_limit"`
	DailyAllowance float64   `json:"daily_allowance"`
	RemainingDays  int       `json:"remaining_days"`
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
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

// PeriodDates returns the start and end dates for the current budget period
func (b *Budget) PeriodDates() (start, end time.Time) {
	now := time.Now()
	loc := now.Location()

	switch b.Period {
	case "monthly":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		// End is the first day of next month minus 1 nanosecond (last moment of current month)
		end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	case "yearly":
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		end = time.Date(now.Year(), 12, 31, 23, 59, 59, 999999999, loc)
	default:
		// Default to monthly
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	}
	return
}

// RemainingDays returns the number of days remaining in the current period (including today)
func (b *Budget) RemainingDays() int {
	now := time.Now()
	_, end := b.PeriodDates()

	// Calculate days remaining (including today)
	// Truncate to start of day for accurate day counting
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endDay := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())

	days := int(endDay.Sub(today).Hours()/24) + 1 // +1 to include today
	if days < 1 {
		days = 1 // At minimum, return 1 to avoid division by zero
	}
	return days
}

// DailyAllowance calculates how much the user can spend per day
// based on remaining budget and remaining days in the period.
// Formula: daily_allowance = remaining_budget / remaining_days
// This allows unspent amounts to carry over to remaining days.
func (b *Budget) DailyAllowance() float64 {
	remaining := b.Remaining()
	if remaining <= 0 {
		return 0
	}

	days := b.RemainingDays()
	allowance := remaining / float64(days)

	// Round to 2 decimal places
	return math.Round(allowance*100) / 100
}

// ToBudgetResponse converts a Budget to a BudgetResponse with all computed fields
func (b *Budget) ToBudgetResponse() BudgetResponse {
	start, end := b.PeriodDates()
	return BudgetResponse{
		Budget:         *b,
		Remaining:      b.Remaining(),
		Progress:       b.Progress(),
		IsOverBudget:   b.IsOverBudget(),
		IsNearLimit:    b.IsNearLimit(),
		DailyAllowance: b.DailyAllowance(),
		RemainingDays:  b.RemainingDays(),
		PeriodStart:    start,
		PeriodEnd:      end,
	}
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
