package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// BudgetService handles business logic for budgets
type BudgetService struct {
	budgetRepo *repository.BudgetRepository
}

// NewBudgetService creates a new BudgetService
func NewBudgetService(budgetRepo *repository.BudgetRepository) *BudgetService {
	return &BudgetService{
		budgetRepo: budgetRepo,
	}
}

// GetBudgets retrieves all budgets for a user with calculated spent amounts
func (s *BudgetService) GetBudgets(ctx context.Context, userID uuid.UUID) ([]model.Budget, error) {
	budgets, err := s.budgetRepo.GetByUserWithSpent(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting budgets: %w", err)
	}

	if budgets == nil {
		budgets = []model.Budget{}
	}

	return budgets, nil
}

// GetBudget retrieves a specific budget
func (s *BudgetService) GetBudget(ctx context.Context, userID, budgetID uuid.UUID) (*model.Budget, error) {
	budget, err := s.budgetRepo.GetByID(ctx, userID, budgetID)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, errors.New("budget not found")
		}
		return nil, fmt.Errorf("getting budget: %w", err)
	}

	// Calculate spent amount
	spent, err := s.budgetRepo.CalculateSpent(ctx, userID, budget.Category, budget.Currency, budget.Period)
	if err != nil {
		return nil, fmt.Errorf("calculating spent: %w", err)
	}
	budget.Spent = spent

	return budget, nil
}

// CreateBudget creates a new budget
func (s *BudgetService) CreateBudget(ctx context.Context, userID uuid.UUID, req *model.CreateBudgetRequest) (*model.Budget, error) {
	// Validate request
	if req.Category == "" {
		return nil, errors.New("category is required")
	}
	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if req.Currency == "" {
		return nil, errors.New("currency is required")
	}
	if req.Period == "" {
		req.Period = "monthly"
	}
	if req.Period != "monthly" && req.Period != "yearly" {
		return nil, errors.New("period must be 'monthly' or 'yearly'")
	}

	budget := &model.Budget{
		UserID:   userID,
		Category: req.Category,
		Amount:   req.Amount,
		Currency: req.Currency,
		Period:   req.Period,
	}

	if err := s.budgetRepo.Create(ctx, budget); err != nil {
		if errors.Is(err, repository.ErrBudgetExists) {
			return nil, errors.New("budget already exists for this category and period")
		}
		return nil, fmt.Errorf("creating budget: %w", err)
	}

	// Calculate current spent
	spent, err := s.budgetRepo.CalculateSpent(ctx, userID, budget.Category, budget.Currency, budget.Period)
	if err == nil {
		budget.Spent = spent
	}

	return budget, nil
}

// UpdateBudget updates an existing budget
func (s *BudgetService) UpdateBudget(ctx context.Context, userID, budgetID uuid.UUID, req *model.UpdateBudgetRequest) (*model.Budget, error) {
	// Get existing budget
	budget, err := s.budgetRepo.GetByID(ctx, userID, budgetID)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, errors.New("budget not found")
		}
		return nil, fmt.Errorf("getting budget: %w", err)
	}

	// Apply updates
	if req.Amount != nil {
		if *req.Amount <= 0 {
			return nil, errors.New("amount must be positive")
		}
		budget.Amount = *req.Amount
	}
	if req.Period != nil {
		if *req.Period != "monthly" && *req.Period != "yearly" {
			return nil, errors.New("period must be 'monthly' or 'yearly'")
		}
		budget.Period = *req.Period
	}

	if err := s.budgetRepo.Update(ctx, budget); err != nil {
		return nil, fmt.Errorf("updating budget: %w", err)
	}

	// Recalculate spent
	spent, err := s.budgetRepo.CalculateSpent(ctx, userID, budget.Category, budget.Currency, budget.Period)
	if err == nil {
		budget.Spent = spent
	}

	return budget, nil
}

// DeleteBudget deletes a budget
func (s *BudgetService) DeleteBudget(ctx context.Context, userID, budgetID uuid.UUID) error {
	if err := s.budgetRepo.Delete(ctx, userID, budgetID); err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return errors.New("budget not found")
		}
		return fmt.Errorf("deleting budget: %w", err)
	}
	return nil
}
