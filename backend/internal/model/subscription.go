package model

import (
	"time"

	"github.com/google/uuid"
)

// Subscription represents a recurring subscription/service
type Subscription struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	Name            string     `json:"name"`
	Amount          float64    `json:"amount"`
	Currency        string     `json:"currency"`
	BillingCycle    string     `json:"billing_cycle"` // weekly, monthly, quarterly, yearly
	Category        string     `json:"category"`      // streaming, software, gaming, fitness, utilities, etc.
	NextBillingDate time.Time  `json:"next_billing_date"`
	Status          string     `json:"status"` // active, paused, cancelled
	ReminderDays    int        `json:"reminder_days"`
	Notes           string     `json:"notes,omitempty"`
	LogoURL         string     `json:"logo_url,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// SubscriptionSummary contains aggregated subscription costs
type SubscriptionSummary struct {
	TotalMonthly    float64 `json:"total_monthly"`
	TotalYearly     float64 `json:"total_yearly"`
	ActiveCount     int     `json:"active_count"`
	PausedCount     int     `json:"paused_count"`
	CancelledCount  int     `json:"cancelled_count"`
	Currency        string  `json:"currency"`
	ByCategory      map[string]float64 `json:"by_category"`
}

// CreateSubscriptionRequest represents a request to create a subscription
type CreateSubscriptionRequest struct {
	Name            string  `json:"name"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	BillingCycle    string  `json:"billing_cycle"`
	Category        string  `json:"category,omitempty"`
	NextBillingDate string  `json:"next_billing_date"` // ISO date format
	ReminderDays    int     `json:"reminder_days,omitempty"`
	Notes           string  `json:"notes,omitempty"`
	LogoURL         string  `json:"logo_url,omitempty"`
}

// UpdateSubscriptionRequest represents a request to update a subscription
type UpdateSubscriptionRequest struct {
	Name            *string  `json:"name,omitempty"`
	Amount          *float64 `json:"amount,omitempty"`
	Currency        *string  `json:"currency,omitempty"`
	BillingCycle    *string  `json:"billing_cycle,omitempty"`
	Category        *string  `json:"category,omitempty"`
	NextBillingDate *string  `json:"next_billing_date,omitempty"`
	Status          *string  `json:"status,omitempty"`
	ReminderDays    *int     `json:"reminder_days,omitempty"`
	Notes           *string  `json:"notes,omitempty"`
	LogoURL         *string  `json:"logo_url,omitempty"`
}

// SubscriptionBillingCycles are the valid billing cycles
var SubscriptionBillingCycles = []string{"weekly", "monthly", "quarterly", "yearly"}

// SubscriptionStatuses are the valid statuses
var SubscriptionStatuses = []string{"active", "paused", "cancelled"}

// SubscriptionCategories are the predefined categories
var SubscriptionCategories = []string{
	"streaming",
	"software",
	"gaming",
	"fitness",
	"utilities",
	"news_media",
	"cloud_storage",
	"education",
	"food_delivery",
	"shopping",
	"finance",
	"productivity",
	"other",
}

// GetMonthlyAmount calculates the monthly cost based on billing cycle
func (s *Subscription) GetMonthlyAmount() float64 {
	switch s.BillingCycle {
	case "weekly":
		return s.Amount * 4.33 // Average weeks per month
	case "monthly":
		return s.Amount
	case "quarterly":
		return s.Amount / 3
	case "yearly":
		return s.Amount / 12
	default:
		return s.Amount
	}
}

// GetYearlyAmount calculates the yearly cost based on billing cycle
func (s *Subscription) GetYearlyAmount() float64 {
	switch s.BillingCycle {
	case "weekly":
		return s.Amount * 52
	case "monthly":
		return s.Amount * 12
	case "quarterly":
		return s.Amount * 4
	case "yearly":
		return s.Amount
	default:
		return s.Amount * 12
	}
}

// CalculateNextBillingDate calculates the next billing date based on cycle
func CalculateNextBillingDate(current time.Time, cycle string) time.Time {
	switch cycle {
	case "weekly":
		return current.AddDate(0, 0, 7)
	case "monthly":
		return current.AddDate(0, 1, 0)
	case "quarterly":
		return current.AddDate(0, 3, 0)
	case "yearly":
		return current.AddDate(1, 0, 0)
	default:
		return current.AddDate(0, 1, 0)
	}
}
