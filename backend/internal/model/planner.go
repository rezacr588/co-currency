package model

import "github.com/google/uuid"

type PlannerColumn struct {
	Status TodoStatus `json:"status"`
	Items  []TodoItem `json:"items"`
}

type PlannerBoardResponse struct {
	Columns []PlannerColumn `json:"columns"`
	Summary TodoSummary     `json:"summary"`
}

type MovePlannerItemRequest struct {
	Status    TodoStatus `json:"status"`
	SortOrder float64    `json:"sort_order"`
}

type GoalFundingRequired struct {
	GoalID    uuid.UUID `json:"goal_id"`
	Remaining float64   `json:"remaining"`
	Currency  string    `json:"currency"`
	Message   string    `json:"message"`
	ErrorCode string    `json:"error_code"`
}
