package model

import (
	"time"

	"github.com/google/uuid"
)

// SpaceRole defines member roles in a shared space
type SpaceRole string

const (
	SpaceRoleOwner  SpaceRole = "owner"
	SpaceRoleAdmin  SpaceRole = "admin"
	SpaceRoleMember SpaceRole = "member"
)

// SpaceType defines the type of shared space
type SpaceType string

const (
	SpaceTypeCouple    SpaceType = "couple"
	SpaceTypeFamily    SpaceType = "family"
	SpaceTypeRoommates SpaceType = "roommates"
	SpaceTypeTrip      SpaceType = "trip"
	SpaceTypeProject   SpaceType = "project"
	SpaceTypeCustom    SpaceType = "custom"
)

// SharedSpace represents a collaborative financial space
type SharedSpace struct {
	ID          uuid.UUID         `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Type        SpaceType         `json:"type"`
	Currency    string            `json:"currency"`
	IconEmoji   string            `json:"icon_emoji,omitempty"`
	Settings    SpaceSettings     `json:"settings"`
	CreatedBy   uuid.UUID         `json:"created_by"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	MemberCount int               `json:"member_count,omitempty"`
	Members     []SpaceMember     `json:"members,omitempty"`
}

// SpaceSettings contains configuration for a shared space
type SpaceSettings struct {
	AllowMemberInvites   bool    `json:"allow_member_invites"`
	RequireApproval      bool    `json:"require_approval"`
	DefaultSplitMethod   string  `json:"default_split_method"` // equal, percentage, shares
	NotifyOnExpense      bool    `json:"notify_on_expense"`
	NotifyOnSettlement   bool    `json:"notify_on_settlement"`
	MonthlyBudgetLimit   float64 `json:"monthly_budget_limit,omitempty"`
	AutoSettlementDay    int     `json:"auto_settlement_day,omitempty"` // Day of month, 0 = disabled
}

// SpaceMember represents a member of a shared space
type SpaceMember struct {
	ID        uuid.UUID `json:"id"`
	SpaceID   uuid.UUID `json:"space_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      SpaceRole `json:"role"`
	Nickname  string    `json:"nickname,omitempty"`
	JoinedAt  time.Time `json:"joined_at"`
	InvitedBy uuid.UUID `json:"invited_by,omitempty"`
	// Computed fields
	UserName   string  `json:"user_name,omitempty"`
	UserEmail  string  `json:"user_email,omitempty"`
	AvatarURL  string  `json:"avatar_url,omitempty"`
	Balance    float64 `json:"balance,omitempty"` // Positive = owed, Negative = owes
}

// SpaceInvite represents an invitation to join a space
type SpaceInvite struct {
	ID          uuid.UUID  `json:"id"`
	SpaceID     uuid.UUID  `json:"space_id"`
	InviterID   uuid.UUID  `json:"inviter_id"`
	InviteeEmail string    `json:"invitee_email"`
	InviteeID   *uuid.UUID `json:"invitee_id,omitempty"` // Set if user already exists
	Code        string     `json:"code"`
	Role        SpaceRole  `json:"role"`
	ExpiresAt   time.Time  `json:"expires_at"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	RejectedAt  *time.Time `json:"rejected_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	// Computed
	SpaceName   string `json:"space_name,omitempty"`
	InviterName string `json:"inviter_name,omitempty"`
}

// SharedExpense represents a group expense in a space
type SharedExpense struct {
	ID           uuid.UUID       `json:"id"`
	SpaceID      uuid.UUID       `json:"space_id"`
	PaidByUserID uuid.UUID       `json:"paid_by_user_id"`
	Amount       float64         `json:"amount"`
	Currency     string          `json:"currency"`
	Description  string          `json:"description"`
	Category     string          `json:"category,omitempty"`
	SplitMethod  string          `json:"split_method"` // equal, percentage, shares, exact
	Splits       []ExpenseSplit  `json:"splits"`
	ReceiptURL   string          `json:"receipt_url,omitempty"`
	Notes        string          `json:"notes,omitempty"`
	ExpenseDate  time.Time       `json:"expense_date"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	// Computed
	PaidByName string `json:"paid_by_name,omitempty"`
}

// ExpenseSplit represents a member's share of an expense
type ExpenseSplit struct {
	ID         uuid.UUID `json:"id"`
	ExpenseID  uuid.UUID `json:"expense_id"`
	UserID     uuid.UUID `json:"user_id"`
	Amount     float64   `json:"amount"`
	Percentage float64   `json:"percentage,omitempty"`
	Shares     int       `json:"shares,omitempty"`
	IsPaid     bool      `json:"is_paid"`
	PaidAt     *time.Time `json:"paid_at,omitempty"`
	// Computed
	UserName string `json:"user_name,omitempty"`
}

// Settlement represents a payment between members
type Settlement struct {
	ID          uuid.UUID  `json:"id"`
	SpaceID     uuid.UUID  `json:"space_id"`
	FromUserID  uuid.UUID  `json:"from_user_id"`
	ToUserID    uuid.UUID  `json:"to_user_id"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"`
	Method      string     `json:"method,omitempty"` // cash, bank_transfer, paypal, venmo, etc.
	Notes       string     `json:"notes,omitempty"`
	SettledAt   time.Time  `json:"settled_at"`
	ConfirmedAt *time.Time `json:"confirmed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	// Computed
	FromUserName string `json:"from_user_name,omitempty"`
	ToUserName   string `json:"to_user_name,omitempty"`
}

// SharedBudget represents a collaborative budget for a space
type SharedBudget struct {
	ID           uuid.UUID `json:"id"`
	SpaceID      uuid.UUID `json:"space_id"`
	Name         string    `json:"name"`
	Category     string    `json:"category,omitempty"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"`
	Period       string    `json:"period"` // weekly, monthly, yearly
	StartDate    time.Time `json:"start_date"`
	EndDate      *time.Time `json:"end_date,omitempty"`
	CreatedBy    uuid.UUID `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	// Computed
	Spent      float64 `json:"spent,omitempty"`
	Remaining  float64 `json:"remaining,omitempty"`
	Percentage float64 `json:"percentage,omitempty"`
}

// BalanceSummary represents the balance between members in a space
type BalanceSummary struct {
	SpaceID    uuid.UUID       `json:"space_id"`
	TotalOwed  float64         `json:"total_owed"`
	TotalOwes  float64         `json:"total_owes"`
	NetBalance float64         `json:"net_balance"`
	Balances   []MemberBalance `json:"balances"`
	Simplify   []Settlement    `json:"simplify,omitempty"` // Simplified settlements
}

// MemberBalance represents a user's balance with another member
type MemberBalance struct {
	UserID   uuid.UUID `json:"user_id"`
	UserName string    `json:"user_name"`
	Balance  float64   `json:"balance"` // Positive = they owe you
}

// SpaceActivity represents an activity in the space feed
type SpaceActivity struct {
	ID         uuid.UUID              `json:"id"`
	SpaceID    uuid.UUID              `json:"space_id"`
	UserID     uuid.UUID              `json:"user_id"`
	Type       string                 `json:"type"` // expense_added, settlement, member_joined, budget_updated
	RefID      uuid.UUID              `json:"ref_id,omitempty"`
	Message    string                 `json:"message"`
	Data       map[string]interface{} `json:"data,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
	// Computed
	UserName  string `json:"user_name,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

// CreateSpaceRequest for creating a new space
type CreateSpaceRequest struct {
	Name        string        `json:"name" validate:"required,min=2,max=100"`
	Description string        `json:"description,omitempty" validate:"max=500"`
	Type        SpaceType     `json:"type" validate:"required"`
	Currency    string        `json:"currency" validate:"required,len=3"`
	IconEmoji   string        `json:"icon_emoji,omitempty"`
	Settings    SpaceSettings `json:"settings,omitempty"`
}

// CreateExpenseRequest for adding a shared expense
type CreateExpenseRequest struct {
	Amount       float64              `json:"amount" validate:"required,gt=0"`
	Currency     string               `json:"currency" validate:"required,len=3"`
	Description  string               `json:"description" validate:"required,min=2,max=255"`
	Category     string               `json:"category,omitempty"`
	SplitMethod  string               `json:"split_method" validate:"required,oneof=equal percentage shares exact"`
	Splits       []CreateSplitRequest `json:"splits,omitempty"`
	ReceiptURL   string               `json:"receipt_url,omitempty"`
	Notes        string               `json:"notes,omitempty"`
	ExpenseDate  time.Time            `json:"expense_date"`
}

// CreateSplitRequest for specifying how to split an expense
type CreateSplitRequest struct {
	UserID     uuid.UUID `json:"user_id" validate:"required"`
	Amount     float64   `json:"amount,omitempty"`
	Percentage float64   `json:"percentage,omitempty"`
	Shares     int       `json:"shares,omitempty"`
}

// CreateSettlementRequest for recording a settlement
type CreateSettlementRequest struct {
	ToUserID uuid.UUID `json:"to_user_id" validate:"required"`
	Amount   float64   `json:"amount" validate:"required,gt=0"`
	Currency string    `json:"currency" validate:"required,len=3"`
	Method   string    `json:"method,omitempty"`
	Notes    string    `json:"notes,omitempty"`
}

// InviteMemberRequest for inviting someone to a space
type InviteMemberRequest struct {
	Email string    `json:"email" validate:"required,email"`
	Role  SpaceRole `json:"role" validate:"required,oneof=admin member"`
}
