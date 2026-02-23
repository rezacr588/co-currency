package model

import (
	"time"

	"github.com/google/uuid"
)

type GoalType string

const (
	GoalTypeFinancial GoalType = "financial"
	GoalTypePersonal  GoalType = "personal"
	GoalTypeHealth    GoalType = "health"
	GoalTypeLearning  GoalType = "learning"
	GoalTypeCareer    GoalType = "career"
	GoalTypeHabit     GoalType = "habit"
	GoalTypeProject   GoalType = "project"
	GoalTypeOther     GoalType = "other"
)

// GoalTypes represents all supported goal types.
var GoalTypes = []GoalType{
	GoalTypeFinancial,
	GoalTypePersonal,
	GoalTypeHealth,
	GoalTypeLearning,
	GoalTypeCareer,
	GoalTypeHabit,
	GoalTypeProject,
	GoalTypeOther,
}

// Goal represents a flexible goal (financial or non-financial).
type Goal struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`
	Name          string     `json:"name"`
	Type          GoalType   `json:"type"`
	Description   string     `json:"description,omitempty"`
	TargetAmount  float64    `json:"target_amount"`
	CurrentAmount float64    `json:"current_amount"`
	Currency      string     `json:"currency,omitempty"`
	Unit          string     `json:"unit,omitempty"`
	Category      string     `json:"category,omitempty"`
	Deadline      *time.Time `json:"deadline,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// GoalProgress returns the progress percentage (0-100)
func (g *Goal) Progress() float64 {
	if g.TargetAmount <= 0 {
		return 0
	}
	progress := (g.CurrentAmount / g.TargetAmount) * 100
	if progress > 100 {
		return 100
	}
	return progress
}

// IsCompleted returns true if the goal has been reached
func (g *Goal) IsCompleted() bool {
	return g.CurrentAmount >= g.TargetAmount
}

// IsFinancial returns true when this goal is financial.
func (g *Goal) IsFinancial() bool {
	return g.Type == "" || g.Type == GoalTypeFinancial
}

// CreateGoalRequest represents a request to create a goal
type CreateGoalRequest struct {
	Type         GoalType `json:"type,omitempty"`
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	TargetAmount float64  `json:"target_amount"`
	Currency     string   `json:"currency,omitempty"`
	Unit         string   `json:"unit,omitempty"`
	Category     string   `json:"category,omitempty"`
	Deadline     string   `json:"deadline,omitempty"` // ISO date format
}

// UpdateGoalRequest represents a request to update a goal
type UpdateGoalRequest struct {
	Type         *GoalType `json:"type,omitempty"`
	Name         *string   `json:"name,omitempty"`
	Description  *string   `json:"description,omitempty"`
	TargetAmount *float64  `json:"target_amount,omitempty"`
	Currency     *string   `json:"currency,omitempty"`
	Unit         *string   `json:"unit,omitempty"`
	Category     *string   `json:"category,omitempty"`
	Deadline     *string   `json:"deadline,omitempty"` // ISO date format, empty string to remove
}

// ContributeToGoalRequest represents a request to contribute to a goal
type ContributeToGoalRequest struct {
	Amount float64 `json:"amount"`
}

// GoalCategory represents common goal categories
var GoalCategories = []string{
	"savings",
	"emergency_fund",
	"vacation",
	"home",
	"car",
	"education",
	"retirement",
	"investment",
	"debt_payoff",
	"health",
	"learning",
	"career",
	"habit",
	"personal",
	"project",
	"other",
}
