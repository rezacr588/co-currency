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

// RecurringService handles business logic for recurring transactions
type RecurringService struct {
	recurringRepo *repository.RecurringRepository
}

// NewRecurringService creates a new RecurringService
func NewRecurringService(recurringRepo *repository.RecurringRepository) *RecurringService {
	return &RecurringService{
		recurringRepo: recurringRepo,
	}
}

// GetRecurring retrieves all recurring transactions for a user
func (s *RecurringService) GetRecurring(ctx context.Context, userID uuid.UUID) ([]model.RecurringTransaction, error) {
	recurring, err := s.recurringRepo.GetByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting recurring transactions: %w", err)
	}

	if recurring == nil {
		recurring = []model.RecurringTransaction{}
	}

	return recurring, nil
}

// GetRecurringByID retrieves a specific recurring transaction
func (s *RecurringService) GetRecurringByID(ctx context.Context, userID, recurringID uuid.UUID) (*model.RecurringTransaction, error) {
	recurring, err := s.recurringRepo.GetByID(ctx, userID, recurringID)
	if err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			return nil, errors.New("recurring transaction not found")
		}
		return nil, fmt.Errorf("getting recurring transaction: %w", err)
	}
	return recurring, nil
}

// CreateRecurring creates a new recurring transaction
func (s *RecurringService) CreateRecurring(ctx context.Context, userID uuid.UUID, req *model.CreateRecurringRequest) (*model.RecurringTransaction, error) {
	// Validate request
	if req.Type != "credit" && req.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}
	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if req.Currency == "" {
		return nil, errors.New("currency is required")
	}
	if !isValidFrequency(req.Frequency) {
		return nil, errors.New("frequency must be 'daily', 'weekly', 'monthly', or 'yearly'")
	}
	if req.NextExecution == "" {
		return nil, errors.New("next_execution is required")
	}

	nextExecution, err := time.Parse("2006-01-02", req.NextExecution)
	if err != nil {
		return nil, errors.New("invalid next_execution format, use YYYY-MM-DD")
	}

	recurring := &model.RecurringTransaction{
		UserID:        userID,
		Type:          req.Type,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Category:      req.Category,
		Description:   req.Description,
		Frequency:     req.Frequency,
		NextExecution: nextExecution,
	}

	if err := s.recurringRepo.Create(ctx, recurring); err != nil {
		return nil, fmt.Errorf("creating recurring transaction: %w", err)
	}

	return recurring, nil
}

// UpdateRecurring updates an existing recurring transaction
func (s *RecurringService) UpdateRecurring(ctx context.Context, userID, recurringID uuid.UUID, req *model.UpdateRecurringRequest) (*model.RecurringTransaction, error) {
	// Get existing recurring
	recurring, err := s.recurringRepo.GetByID(ctx, userID, recurringID)
	if err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			return nil, errors.New("recurring transaction not found")
		}
		return nil, fmt.Errorf("getting recurring transaction: %w", err)
	}

	// Apply updates
	if req.Type != nil {
		if *req.Type != "credit" && *req.Type != "debit" {
			return nil, errors.New("type must be 'credit' or 'debit'")
		}
		recurring.Type = *req.Type
	}
	if req.Amount != nil {
		if *req.Amount <= 0 {
			return nil, errors.New("amount must be positive")
		}
		recurring.Amount = *req.Amount
	}
	if req.Category != nil {
		recurring.Category = *req.Category
	}
	if req.Description != nil {
		recurring.Description = *req.Description
	}
	if req.Frequency != nil {
		if !isValidFrequency(*req.Frequency) {
			return nil, errors.New("frequency must be 'daily', 'weekly', 'monthly', or 'yearly'")
		}
		recurring.Frequency = *req.Frequency
	}
	if req.NextExecution != nil {
		nextExecution, err := time.Parse("2006-01-02", *req.NextExecution)
		if err != nil {
			return nil, errors.New("invalid next_execution format, use YYYY-MM-DD")
		}
		recurring.NextExecution = nextExecution
	}
	if req.IsActive != nil {
		recurring.IsActive = *req.IsActive
	}

	if err := s.recurringRepo.Update(ctx, recurring); err != nil {
		return nil, fmt.Errorf("updating recurring transaction: %w", err)
	}

	return recurring, nil
}

// DeleteRecurring deletes a recurring transaction
func (s *RecurringService) DeleteRecurring(ctx context.Context, userID, recurringID uuid.UUID) error {
	if err := s.recurringRepo.Delete(ctx, userID, recurringID); err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			return errors.New("recurring transaction not found")
		}
		return fmt.Errorf("deleting recurring transaction: %w", err)
	}
	return nil
}

// ExecuteRecurring manually executes a recurring transaction
func (s *RecurringService) ExecuteRecurring(ctx context.Context, userID, recurringID uuid.UUID) (*model.Transaction, *model.RecurringTransaction, error) {
	// Get the recurring transaction
	recurring, err := s.recurringRepo.GetByID(ctx, userID, recurringID)
	if err != nil {
		if errors.Is(err, repository.ErrRecurringNotFound) {
			return nil, nil, errors.New("recurring transaction not found")
		}
		return nil, nil, fmt.Errorf("getting recurring transaction: %w", err)
	}

	if !recurring.IsActive {
		return nil, nil, errors.New("recurring transaction is not active")
	}

	// Execute the transaction
	transaction, err := s.recurringRepo.ExecuteAndScheduleNext(ctx, recurring)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, nil, errors.New("insufficient balance")
		}
		return nil, nil, fmt.Errorf("executing recurring transaction: %w", err)
	}

	// Get updated recurring with new next_execution
	updatedRecurring, _ := s.recurringRepo.GetByID(ctx, userID, recurringID)

	return transaction, updatedRecurring, nil
}

func isValidFrequency(freq string) bool {
	for _, f := range model.RecurringFrequencies {
		if f == freq {
			return true
		}
	}
	return false
}
