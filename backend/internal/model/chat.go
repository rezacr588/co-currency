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
	TotalBalance       float64            `json:"total_balance"`
	MonthlyIncome      float64            `json:"monthly_income"`
	MonthlyExpenses    float64            `json:"monthly_expenses"`
	TopCategories      []CategorySpending `json:"top_categories"`
	ActiveBudgets      []BudgetSummary    `json:"active_budgets"`
	SavingsGoals       []GoalSummary      `json:"savings_goals"`
	RecentTransactions int                `json:"recent_transactions"`
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
