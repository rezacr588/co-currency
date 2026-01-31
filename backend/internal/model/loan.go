package model

import "time"

// LoanType represents whether money is borrowed or lent
type LoanType string

const (
	LoanTypeBorrowed LoanType = "borrowed" // Money you owe to others
	LoanTypeLent     LoanType = "lent"     // Money others owe to you
)

// LoanStatus represents the current state of a loan
type LoanStatus string

const (
	LoanStatusActive    LoanStatus = "active"
	LoanStatusPaidOff   LoanStatus = "paid_off"
	LoanStatusDefaulted LoanStatus = "defaulted"
	LoanStatusForgiven  LoanStatus = "forgiven"
)

// PaymentType represents the type of loan payment
type PaymentType string

const (
	PaymentTypePayment    PaymentType = "payment"
	PaymentTypeInterest   PaymentType = "interest"
	PaymentTypeForgiveness PaymentType = "forgiveness"
)

// Loan represents a debt or receivable
type Loan struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Type            LoanType   `json:"type"`
	Name            string     `json:"name"`
	Description     string     `json:"description,omitempty"`
	PrincipalAmount float64    `json:"principal_amount"`
	RemainingAmount float64    `json:"remaining_amount"`
	Currency        string     `json:"currency"`
	InterestRate    float64    `json:"interest_rate"`
	Counterparty    string     `json:"counterparty,omitempty"`
	DueDate         *time.Time `json:"due_date,omitempty"`
	Status          LoanStatus `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// LoanPayment represents a payment towards a loan
type LoanPayment struct {
	ID          string      `json:"id"`
	LoanID      string      `json:"loan_id"`
	Amount      float64     `json:"amount"`
	Currency    string      `json:"currency"`
	PaymentType PaymentType `json:"payment_type"`
	Notes       string      `json:"notes,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
}

// CreateLoanRequest is the request body for creating a loan
type CreateLoanRequest struct {
	Type            LoanType   `json:"type" validate:"required,oneof=borrowed lent"`
	Name            string     `json:"name" validate:"required,max=255"`
	Description     string     `json:"description,omitempty"`
	PrincipalAmount float64    `json:"principal_amount" validate:"required,gt=0"`
	Currency        string     `json:"currency" validate:"required,len=3"`
	InterestRate    float64    `json:"interest_rate,omitempty" validate:"gte=0,lte=100"`
	Counterparty    string     `json:"counterparty,omitempty" validate:"max=255"`
	DueDate         *time.Time `json:"due_date,omitempty"`
}

// UpdateLoanRequest is the request body for updating a loan
type UpdateLoanRequest struct {
	Name         string     `json:"name,omitempty" validate:"max=255"`
	Description  string     `json:"description,omitempty"`
	InterestRate *float64   `json:"interest_rate,omitempty" validate:"omitempty,gte=0,lte=100"`
	Counterparty string     `json:"counterparty,omitempty" validate:"max=255"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	Status       LoanStatus `json:"status,omitempty" validate:"omitempty,oneof=active paid_off defaulted forgiven"`
}

// CreatePaymentRequest is the request body for making a loan payment
type CreatePaymentRequest struct {
	Amount      float64     `json:"amount" validate:"required,gt=0"`
	PaymentType PaymentType `json:"payment_type" validate:"required,oneof=payment interest forgiveness"`
	Notes       string      `json:"notes,omitempty"`
}

// LoanSummary provides aggregate loan statistics
type LoanSummary struct {
	Currency          string  `json:"currency"`
	TotalBorrowed     float64 `json:"total_borrowed"`
	TotalLent         float64 `json:"total_lent"`
	RemainingBorrowed float64 `json:"remaining_borrowed"`
	RemainingLent     float64 `json:"remaining_lent"`
	NetDebt           float64 `json:"net_debt"` // Positive = you owe money, Negative = you're owed money
	ActiveLoansCount  int     `json:"active_loans_count"`
}
