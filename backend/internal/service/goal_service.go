package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// GoalService handles business logic for financial goals
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
			return nil, errors.New("goal not found")
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}
	return goal, nil
}

// CreateGoal creates a new goal
func (s *GoalService) CreateGoal(ctx context.Context, userID uuid.UUID, req *model.CreateGoalRequest) (*model.Goal, error) {
	// Validate request
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	if req.TargetAmount <= 0 {
		return nil, errors.New("target_amount must be positive")
	}
	if req.Currency == "" {
		return nil, errors.New("currency is required")
	}

	goal := &model.Goal{
		UserID:        userID,
		Name:          req.Name,
		TargetAmount:  req.TargetAmount,
		CurrentAmount: 0,
		Currency:      req.Currency,
		Category:      req.Category,
	}

	// Parse deadline if provided
	if req.Deadline != "" {
		deadline, err := time.Parse("2006-01-02", req.Deadline)
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
			return nil, errors.New("goal not found")
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}

	// Apply updates
	if req.Name != nil && *req.Name != "" {
		goal.Name = *req.Name
	}
	if req.TargetAmount != nil {
		if *req.TargetAmount <= 0 {
			return nil, errors.New("target_amount must be positive")
		}
		goal.TargetAmount = *req.TargetAmount
	}
	if req.Category != nil {
		goal.Category = *req.Category
	}
	if req.Deadline != nil {
		if *req.Deadline == "" {
			goal.Deadline = nil
		} else {
			deadline, err := time.Parse("2006-01-02", *req.Deadline)
			if err != nil {
				return nil, errors.New("invalid deadline format, use YYYY-MM-DD")
			}
			goal.Deadline = &deadline
		}
	}

	if err := s.goalRepo.Update(ctx, goal); err != nil {
		return nil, fmt.Errorf("updating goal: %w", err)
	}

	return goal, nil
}

// DeleteGoal deletes a goal
func (s *GoalService) DeleteGoal(ctx context.Context, userID, goalID uuid.UUID) error {
	if err := s.goalRepo.Delete(ctx, userID, goalID); err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return errors.New("goal not found")
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
			return nil, nil, errors.New("goal not found")
		}
		return nil, nil, fmt.Errorf("getting goal: %w", err)
	}

	// Contribute from wallet
	updatedGoal, transaction, err := s.goalRepo.ContributeFromWallet(ctx, userID, goalID, req.Amount, goal.Currency)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, nil, errors.New("insufficient balance")
		}
		return nil, nil, fmt.Errorf("contributing to goal: %w", err)
	}

	return updatedGoal, transaction, nil
}
