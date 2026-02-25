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

// Task represents a user task that can optionally be linked to a goal and/or transaction.
type Task struct {
	ID            uuid.UUID    `json:"id"`
	UserID        uuid.UUID    `json:"user_id"`
	GoalID        *uuid.UUID   `json:"goal_id,omitempty"`
	TransactionID *uuid.UUID   `json:"transaction_id,omitempty"`
	Title         string       `json:"title"`
	Description   string       `json:"description,omitempty"`
	Status        TaskStatus   `json:"status"`
	Priority      TaskPriority `json:"priority"`
	DueDate       *time.Time   `json:"due_date,omitempty"`
	CompletedAt   *time.Time   `json:"completed_at,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type CreateTaskRequest struct {
	GoalID        string       `json:"goal_id,omitempty"`
	TransactionID string       `json:"transaction_id,omitempty"`
	Title         string       `json:"title"`
	Description   string       `json:"description,omitempty"`
	Status        TaskStatus   `json:"status,omitempty"`
	Priority      TaskPriority `json:"priority,omitempty"`
	DueDate       string       `json:"due_date,omitempty"` // YYYY-MM-DD
}

type UpdateTaskRequest struct {
	GoalID        *string       `json:"goal_id,omitempty"`        // empty string unlinks from goal
	TransactionID *string       `json:"transaction_id,omitempty"` // empty string unlinks from transaction
	Title         *string       `json:"title,omitempty"`
	Description   *string       `json:"description,omitempty"`
	Status        *TaskStatus   `json:"status,omitempty"`
	Priority      *TaskPriority `json:"priority,omitempty"`
	DueDate       *string       `json:"due_date,omitempty"` // YYYY-MM-DD, empty string removes due date
}

type TaskListFilter struct {
	GoalID        *uuid.UUID
	TransactionID *uuid.UUID
	Status        TaskStatus
	Priority      TaskPriority
}
