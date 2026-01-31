package model

import (
	"time"

	"github.com/google/uuid"
)

// ChatConversation represents a chat conversation
type ChatConversation struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ChatMessage represents a message in a conversation
type ChatMessage struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	Role           string    `json:"role"` // "user" or "assistant"
	Content        string    `json:"content"`
	TokensUsed     int       `json:"tokens_used,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// ChatRequest represents a new chat message request
type ChatRequest struct {
	ConversationID string `json:"conversation_id,omitempty"`
	Message        string `json:"message"`
}

// ChatResponse represents the response from the AI
type ChatResponse struct {
	ConversationID string      `json:"conversation_id"`
	Message        ChatMessage `json:"message"`
	TokensUsed     int         `json:"tokens_used,omitempty"`
}

// ConversationWithMessages represents a conversation with its messages
type ConversationWithMessages struct {
	Conversation ChatConversation `json:"conversation"`
	Messages     []ChatMessage    `json:"messages"`
}

// FinancialContext represents the user's financial data for AI context
type FinancialContext struct {
	// User info
	UserName       string `json:"user_name"`
	PreferredCurrency string `json:"preferred_currency"`
	AccountAgeDays int    `json:"account_age_days"`

	// Balances
	TotalBalance       float64          `json:"total_balance"`
	Balances           []CurrencyBalance `json:"balances"`

	// Monthly overview
	MonthlyIncome      float64            `json:"monthly_income"`
	MonthlyExpenses    float64            `json:"monthly_expenses"`
	TopCategories      []CategorySpending `json:"top_categories"`

	// Budgets and Goals
	ActiveBudgets      []BudgetSummary    `json:"active_budgets"`
	SavingsGoals       []GoalSummary      `json:"savings_goals"`

	// Activity
	RecentTransactions    int                  `json:"recent_transactions"`
	RecentTransactionList []TransactionSummary `json:"recent_transaction_list"`

	// Patterns
	RecurringItems     []RecurringSummary `json:"recurring_items"`
	SpendingTrend      string             `json:"spending_trend"` // "increasing", "decreasing", "stable"
	LastMonthExpenses  float64            `json:"last_month_expenses"`

	// Loans and Debts
	ActiveLoans        []LoanSummaryForAI `json:"active_loans"`
	TotalDebt          float64            `json:"total_debt"`         // Money user owes
	TotalReceivable    float64            `json:"total_receivable"`   // Money owed to user
	NetDebtPosition    float64            `json:"net_debt_position"`  // Positive = net debtor

	// Context
	TodayDate          string `json:"today_date"`
	DaysUntilMonthEnd  int    `json:"days_until_month_end"`
}

// LoanSummaryForAI provides loan context for AI
type LoanSummaryForAI struct {
	Name            string  `json:"name"`
	Type            string  `json:"type"`  // "borrowed" or "lent"
	RemainingAmount float64 `json:"remaining_amount"`
	Currency        string  `json:"currency"`
	Counterparty    string  `json:"counterparty,omitempty"`
	DueDate         string  `json:"due_date,omitempty"`
}

// CurrencyBalance for multi-currency support
type CurrencyBalance struct {
	Currency string  `json:"currency"`
	Balance  float64 `json:"balance"`
}

// TransactionSummary for recent transactions context
type TransactionSummary struct {
	Date        string  `json:"date"`
	Type        string  `json:"type"` // credit/debit
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
}

// RecurringSummary for recurring transactions
type RecurringSummary struct {
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Frequency   string  `json:"frequency"`
	NextDate    string  `json:"next_date"`
	Type        string  `json:"type"` // income/expense
}

// CategorySpending for AI context
type CategorySpending struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

// BudgetSummary for AI context
type BudgetSummary struct {
	Category string  `json:"category"`
	Budget   float64 `json:"budget"`
	Spent    float64 `json:"spent"`
}

// GoalSummary for AI context
type GoalSummary struct {
	Name     string  `json:"name"`
	Target   float64 `json:"target"`
	Current  float64 `json:"current"`
	Progress float64 `json:"progress"`
}

// UserMemory represents a long-term memory about the user
type UserMemory struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Category  string    `json:"category"`  // "preference", "goal", "habit", "insight", "fact"
	Content   string    `json:"content"`   // The memory content
	Source    string    `json:"source"`    // "user_stated", "ai_inferred", "system"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConversationSummary for AI context about past conversations
type ConversationSummary struct {
	Title       string `json:"title"`
	Date        string `json:"date"`
	TopicsSummary string `json:"topics_summary"`
}
