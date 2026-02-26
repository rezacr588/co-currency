package model

import (
	"time"

	"github.com/google/uuid"
)

type TodoItemType string

const (
	TodoItemTypeTask TodoItemType = "task"
	TodoItemTypeGoal TodoItemType = "goal"
)

type TodoStatus string

const (
	TodoStatusTodo       TodoStatus = "todo"
	TodoStatusInProgress TodoStatus = "in_progress"
	TodoStatusDone       TodoStatus = "done"
	TodoStatusArchived   TodoStatus = "archived"
)

var TodoStatuses = []TodoStatus{
	TodoStatusTodo,
	TodoStatusInProgress,
	TodoStatusDone,
	TodoStatusArchived,
}

func (s TodoStatus) IsValid() bool {
	for _, v := range TodoStatuses {
		if s == v {
			return true
		}
	}
	return false
}

// TodoItem is a unified list item for goals and tasks.
type TodoItem struct {
	ID            uuid.UUID    `json:"id"`
	Type          TodoItemType `json:"type"`
	GoalID        *uuid.UUID   `json:"goal_id,omitempty"`        // only for tasks linked to a goal
	TransactionID *uuid.UUID   `json:"transaction_id,omitempty"` // only for tasks linked to a transaction
	Title         string       `json:"title"`
	Description   string       `json:"description,omitempty"`
	Status        TodoStatus   `json:"status"`
	Priority      string       `json:"priority,omitempty"`
	SortOrder     float64      `json:"sort_order,omitempty"`
	DueDate       *time.Time   `json:"due_date,omitempty"`
	Progress      float64      `json:"progress,omitempty"` // mainly for goals
	GoalType      GoalType     `json:"goal_type,omitempty"`
	Category      string       `json:"category,omitempty"`
	Unit          string       `json:"unit,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type TodoSummary struct {
	Total      int `json:"total"`
	Todo       int `json:"todo"`
	InProgress int `json:"in_progress"`
	Done       int `json:"done"`
	Archived   int `json:"archived"`
}

type TodoListResponse struct {
	Summary TodoSummary `json:"summary"`
	Items   []TodoItem  `json:"items"`
}
