package model

import (
	"time"

	"github.com/google/uuid"
)

type TaskStatus string

const (
	TaskStatusTodo       TaskStatus = "todo"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusDone       TaskStatus = "done"
	TaskStatusArchived   TaskStatus = "archived"
)

var TaskStatuses = []TaskStatus{
	TaskStatusTodo,
	TaskStatusInProgress,
	TaskStatusDone,
	TaskStatusArchived,
}

func (s TaskStatus) IsValid() bool {
	for _, v := range TaskStatuses {
		if s == v {
			return true
		}
	}
	return false
}

type TaskPriority string

const (
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"
)

var TaskPriorities = []TaskPriority{
	TaskPriorityLow,
	TaskPriorityMedium,
	TaskPriorityHigh,
}

func (p TaskPriority) IsValid() bool {
	for _, v := range TaskPriorities {
		if p == v {
			return true
		}
	}
	return false
}

type TaskReminderMode string

const (
	TaskReminderModeOff        TaskReminderMode = "off"
	TaskReminderModeAggressive TaskReminderMode = "aggressive"
)

var TaskReminderModes = []TaskReminderMode{
	TaskReminderModeOff,
	TaskReminderModeAggressive,
}

func (m TaskReminderMode) IsValid() bool {
	for _, v := range TaskReminderModes {
		if m == v {
			return true
		}
	}
	return false
}

type TaskSubtask struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

// Task represents a user task that can optionally be linked to a goal and/or transaction.
type Task struct {
	ID                   uuid.UUID        `json:"id"`
	UserID               uuid.UUID        `json:"user_id"`
	GoalID               *uuid.UUID       `json:"goal_id,omitempty"`
	TransactionID        *uuid.UUID       `json:"transaction_id,omitempty"`
	Title                string           `json:"title"`
	Description          string           `json:"description,omitempty"`
	Status               TaskStatus       `json:"status"`
	Priority             TaskPriority     `json:"priority"`
	SortOrder            float64          `json:"sort_order"`
	Subtasks             []TaskSubtask    `json:"subtasks,omitempty"`
	DueDate              *time.Time       `json:"due_date,omitempty"`
	ReminderMode         TaskReminderMode `json:"reminder_mode"`
	ReminderNextAt       *time.Time       `json:"reminder_next_at,omitempty"`
	AutoLedgerEnabled    bool             `json:"auto_ledger_enabled"`
	LedgerType           string           `json:"ledger_type,omitempty"` // credit/debit
	LedgerAmount         *float64         `json:"ledger_amount,omitempty"`
	LedgerCurrency       string           `json:"ledger_currency,omitempty"`
	LedgerWalletCurrency string           `json:"ledger_wallet_currency,omitempty"`
	LedgerCategory       string           `json:"ledger_category,omitempty"`
	LedgerDescription    string           `json:"ledger_description,omitempty"`
	CompletedAt          *time.Time       `json:"completed_at,omitempty"`
	CreatedAt            time.Time        `json:"created_at"`
	UpdatedAt            time.Time        `json:"updated_at"`
}

type CreateTaskRequest struct {
	GoalID               string           `json:"goal_id,omitempty"`
	TransactionID        string           `json:"transaction_id,omitempty"`
	Title                string           `json:"title"`
	Description          string           `json:"description,omitempty"`
	Status               TaskStatus       `json:"status,omitempty"`
	Priority             TaskPriority     `json:"priority,omitempty"`
	SortOrder            *float64         `json:"sort_order,omitempty"`
	Subtasks             []TaskSubtask    `json:"subtasks,omitempty"`
	DueDate              string           `json:"due_date,omitempty"` // YYYY-MM-DD
	ReminderMode         TaskReminderMode `json:"reminder_mode,omitempty"`
	AutoLedgerEnabled    bool             `json:"auto_ledger_enabled,omitempty"`
	LedgerType           string           `json:"ledger_type,omitempty"`
	LedgerAmount         *float64         `json:"ledger_amount,omitempty"`
	LedgerCurrency       string           `json:"ledger_currency,omitempty"`
	LedgerWalletCurrency string           `json:"ledger_wallet_currency,omitempty"`
	LedgerCategory       string           `json:"ledger_category,omitempty"`
	LedgerDescription    string           `json:"ledger_description,omitempty"`
}

type UpdateTaskRequest struct {
	GoalID               *string           `json:"goal_id,omitempty"`        // empty string unlinks from goal
	TransactionID        *string           `json:"transaction_id,omitempty"` // empty string unlinks from transaction
	Title                *string           `json:"title,omitempty"`
	Description          *string           `json:"description,omitempty"`
	Status               *TaskStatus       `json:"status,omitempty"`
	Priority             *TaskPriority     `json:"priority,omitempty"`
	SortOrder            *float64          `json:"sort_order,omitempty"`
	Subtasks             *[]TaskSubtask    `json:"subtasks,omitempty"`
	DueDate              *string           `json:"due_date,omitempty"` // YYYY-MM-DD, empty string removes due date
	ReminderMode         *TaskReminderMode `json:"reminder_mode,omitempty"`
	AutoLedgerEnabled    *bool             `json:"auto_ledger_enabled,omitempty"`
	LedgerType           *string           `json:"ledger_type,omitempty"`
	LedgerAmount         *float64          `json:"ledger_amount,omitempty"`
	LedgerCurrency       *string           `json:"ledger_currency,omitempty"`
	LedgerWalletCurrency *string           `json:"ledger_wallet_currency,omitempty"`
	LedgerCategory       *string           `json:"ledger_category,omitempty"`
	LedgerDescription    *string           `json:"ledger_description,omitempty"`
}

type TaskListFilter struct {
	GoalID        *uuid.UUID
	TransactionID *uuid.UUID
	Status        TaskStatus
	Priority      TaskPriority
}
