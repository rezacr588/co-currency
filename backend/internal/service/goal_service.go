package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrInvalidGoalType            = errors.New("invalid goal type")
	ErrInvalidGoalWorkflowStatus  = errors.New("invalid goal workflow status")
	ErrGoalContributionNotAllowed = errors.New("goal contributions are only available for financial goals")
)

// GoalService handles business logic for goals.
type GoalService struct {
	goalRepo *repository.GoalRepository
}

// NewGoalService creates a new GoalService
func NewGoalService(goalRepo *repository.GoalRepository) *GoalService {
	return &GoalService{
		goalRepo: goalRepo,
	}
}

// GetGoals retrieves all goals for a user
func (s *GoalService) GetGoals(ctx context.Context, userID uuid.UUID) ([]model.Goal, error) {
	goals, err := s.goalRepo.GetByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting goals: %w", err)
	}

	if goals == nil {
		goals = []model.Goal{}
	}

	return goals, nil
}

// GetGoal retrieves a specific goal
func (s *GoalService) GetGoal(ctx context.Context, userID, goalID uuid.UUID) (*model.Goal, error) {
	goal, err := s.goalRepo.GetByID(ctx, userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, repository.ErrGoalNotFound
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}
	return goal, nil
}

// CreateGoal creates a new goal
func (s *GoalService) CreateGoal(ctx context.Context, userID uuid.UUID, req *model.CreateGoalRequest) (*model.Goal, error) {
	// Validate request
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if req.TargetAmount <= 0 {
		return nil, errors.New("target_amount must be positive")
	}

	goalType := req.Type
	if goalType == "" {
		goalType = model.GoalTypeFinancial
	}
	if !isValidGoalType(goalType) {
		return nil, ErrInvalidGoalType
	}

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	unit := strings.TrimSpace(req.Unit)
	if goalType == model.GoalTypeFinancial {
		if currency == "" {
			return nil, errors.New("currency is required for financial goals")
		}
		if unit == "" {
			unit = currency
		}
	} else {
		if unit == "" {
			unit = "units"
		}
	}

	goal := &model.Goal{
		UserID:         userID,
		Name:           name,
		Type:           goalType,
		Description:    strings.TrimSpace(req.Description),
		TargetAmount:   req.TargetAmount,
		CurrentAmount:  0,
		Currency:       currency,
		Unit:           unit,
		Category:       strings.TrimSpace(req.Category),
		WorkflowStatus: model.GoalWorkflowStatusTodo,
	}
	if req.WorkflowStatus != "" {
		if !req.WorkflowStatus.IsValid() {
			return nil, ErrInvalidGoalWorkflowStatus
		}
		goal.WorkflowStatus = req.WorkflowStatus
	}
	if req.SortOrder != nil {
		goal.SortOrder = *req.SortOrder
	}

	// Parse deadline if provided
	deadlineText := strings.TrimSpace(req.Deadline)
	if deadlineText != "" {
		deadline, err := time.Parse("2006-01-02", deadlineText)
		if err != nil {
			return nil, errors.New("invalid deadline format, use YYYY-MM-DD")
		}
		goal.Deadline = &deadline
	}

	if err := s.goalRepo.Create(ctx, goal); err != nil {
		return nil, fmt.Errorf("creating goal: %w", err)
	}

	return goal, nil
}

// UpdateGoal updates an existing goal
func (s *GoalService) UpdateGoal(ctx context.Context, userID, goalID uuid.UUID, req *model.UpdateGoalRequest) (*model.Goal, error) {
	// Get existing goal
	goal, err := s.goalRepo.GetByID(ctx, userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, repository.ErrGoalNotFound
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}

	if req.Type != nil {
		goalType := *req.Type
		if goalType == "" {
			goalType = model.GoalTypeFinancial
		}
		if !isValidGoalType(goalType) {
			return nil, ErrInvalidGoalType
		}
		goal.Type = goalType
	}

	// Apply updates
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("name cannot be empty")
		}
		goal.Name = name
	}
	if req.Description != nil {
		goal.Description = strings.TrimSpace(*req.Description)
	}
	if req.TargetAmount != nil {
		if *req.TargetAmount <= 0 {
			return nil, errors.New("target_amount must be positive")
		}
		goal.TargetAmount = *req.TargetAmount
	}
	if req.Currency != nil {
		goal.Currency = strings.ToUpper(strings.TrimSpace(*req.Currency))
	}
	if req.Unit != nil {
		goal.Unit = strings.TrimSpace(*req.Unit)
	}
	if req.Category != nil {
		goal.Category = strings.TrimSpace(*req.Category)
	}
	if req.WorkflowStatus != nil {
		if !req.WorkflowStatus.IsValid() {
			return nil, ErrInvalidGoalWorkflowStatus
		}
		goal.WorkflowStatus = *req.WorkflowStatus
	}
	if req.SortOrder != nil {
		goal.SortOrder = *req.SortOrder
	}
	if req.Deadline != nil {
		deadlineText := strings.TrimSpace(*req.Deadline)
		if deadlineText == "" {
			goal.Deadline = nil
		} else {
			deadline, err := time.Parse("2006-01-02", deadlineText)
			if err != nil {
				return nil, errors.New("invalid deadline format, use YYYY-MM-DD")
			}
			goal.Deadline = &deadline
		}
	}

	if goal.Type == "" {
		goal.Type = model.GoalTypeFinancial
	}
	if goal.WorkflowStatus == "" {
		goal.WorkflowStatus = model.GoalWorkflowStatusTodo
	}
	if goal.IsCompleted() && goal.WorkflowStatus != model.GoalWorkflowStatusArchived {
		goal.WorkflowStatus = model.GoalWorkflowStatusDone
	}

	if goal.IsFinancial() {
		if strings.TrimSpace(goal.Currency) == "" {
			return nil, errors.New("currency is required for financial goals")
		}
		if strings.TrimSpace(goal.Unit) == "" {
			goal.Unit = goal.Currency
		}
	} else if strings.TrimSpace(goal.Unit) == "" {
		goal.Unit = "units"
	}

	if err := s.goalRepo.Update(ctx, goal); err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, repository.ErrGoalNotFound
		}
		return nil, fmt.Errorf("updating goal: %w", err)
	}

	return goal, nil
}

// DeleteGoal deletes a goal
func (s *GoalService) DeleteGoal(ctx context.Context, userID, goalID uuid.UUID) error {
	if err := s.goalRepo.Delete(ctx, userID, goalID); err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return repository.ErrGoalNotFound
		}
		return fmt.Errorf("deleting goal: %w", err)
	}
	return nil
}

// ContributeToGoal adds to a goal from the user's wallet
func (s *GoalService) ContributeToGoal(ctx context.Context, userID, goalID uuid.UUID, req *model.ContributeToGoalRequest) (*model.Goal, *model.Transaction, error) {
	// Validate request
	if req.Amount <= 0 {
		return nil, nil, errors.New("amount must be positive")
	}

	// Get goal to determine currency
	goal, err := s.goalRepo.GetByID(ctx, userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, nil, repository.ErrGoalNotFound
		}
		return nil, nil, fmt.Errorf("getting goal: %w", err)
	}
	if !goal.IsFinancial() || strings.TrimSpace(goal.Currency) == "" {
		return nil, nil, ErrGoalContributionNotAllowed
	}

	// Contribute from wallet
	updatedGoal, transaction, err := s.goalRepo.ContributeFromWallet(ctx, userID, goalID, req.Amount, goal.Currency)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, nil, repository.ErrInsufficientBalance
		}
		return nil, nil, fmt.Errorf("contributing to goal: %w", err)
	}
	if updatedGoal.IsCompleted() && updatedGoal.WorkflowStatus != model.GoalWorkflowStatusArchived {
		updatedGoal.WorkflowStatus = model.GoalWorkflowStatusDone
		if err := s.goalRepo.Update(ctx, updatedGoal); err != nil {
			return nil, nil, fmt.Errorf("syncing goal workflow status: %w", err)
		}
	}

	return updatedGoal, transaction, nil
}

func isValidGoalType(goalType model.GoalType) bool {
	for _, valid := range model.GoalTypes {
		if goalType == valid {
			return true
		}
	}
	return false
}
