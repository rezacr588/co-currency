package service

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// SubscriptionService handles subscription business logic
type SubscriptionService struct {
	subscriptionRepo *repository.SubscriptionRepository
}

// NewSubscriptionService creates a new SubscriptionService
func NewSubscriptionService(subscriptionRepo *repository.SubscriptionRepository) *SubscriptionService {
	return &SubscriptionService{subscriptionRepo: subscriptionRepo}
}

// GetSubscriptions returns all subscriptions for a user
func (s *SubscriptionService) GetSubscriptions(ctx context.Context, userID uuid.UUID) ([]model.Subscription, error) {
	return s.subscriptionRepo.GetSubscriptions(ctx, userID)
}

// GetSubscription returns a single subscription
func (s *SubscriptionService) GetSubscription(ctx context.Context, userID, subscriptionID uuid.UUID) (*model.Subscription, error) {
	return s.subscriptionRepo.GetSubscription(ctx, userID, subscriptionID)
}

// CreateSubscription creates a new subscription with validation
func (s *SubscriptionService) CreateSubscription(ctx context.Context, userID uuid.UUID, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	// Validate required fields
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}
	if req.Currency == "" {
		return nil, fmt.Errorf("currency is required")
	}
	if req.BillingCycle == "" {
		return nil, fmt.Errorf("billing_cycle is required")
	}
	if req.NextBillingDate == "" {
		return nil, fmt.Errorf("next_billing_date is required")
	}

	// Validate billing cycle
	if !slices.Contains(model.SubscriptionBillingCycles, req.BillingCycle) {
		return nil, fmt.Errorf("invalid billing_cycle: must be one of %v", model.SubscriptionBillingCycles)
	}

	// Validate category if provided
	if req.Category != "" && !slices.Contains(model.SubscriptionCategories, req.Category) {
		return nil, fmt.Errorf("invalid category: must be one of %v", model.SubscriptionCategories)
	}

	return s.subscriptionRepo.CreateSubscription(ctx, userID, req)
}

// UpdateSubscription updates an existing subscription with validation
func (s *SubscriptionService) UpdateSubscription(ctx context.Context, userID, subscriptionID uuid.UUID, req *model.UpdateSubscriptionRequest) (*model.Subscription, error) {
	// Validate billing cycle if provided
	if req.BillingCycle != nil && !slices.Contains(model.SubscriptionBillingCycles, *req.BillingCycle) {
		return nil, fmt.Errorf("invalid billing_cycle: must be one of %v", model.SubscriptionBillingCycles)
	}

	// Validate status if provided
	if req.Status != nil && !slices.Contains(model.SubscriptionStatuses, *req.Status) {
		return nil, fmt.Errorf("invalid status: must be one of %v", model.SubscriptionStatuses)
	}

	// Validate category if provided
	if req.Category != nil && *req.Category != "" && !slices.Contains(model.SubscriptionCategories, *req.Category) {
		return nil, fmt.Errorf("invalid category: must be one of %v", model.SubscriptionCategories)
	}

	// Validate amount if provided
	if req.Amount != nil && *req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	return s.subscriptionRepo.UpdateSubscription(ctx, userID, subscriptionID, req)
}

// DeleteSubscription deletes a subscription
func (s *SubscriptionService) DeleteSubscription(ctx context.Context, userID, subscriptionID uuid.UUID) error {
	return s.subscriptionRepo.DeleteSubscription(ctx, userID, subscriptionID)
}

// GetUpcomingRenewals returns subscriptions renewing soon
func (s *SubscriptionService) GetUpcomingRenewals(ctx context.Context, userID uuid.UUID, withinDays int) ([]model.Subscription, error) {
	if withinDays <= 0 {
		withinDays = 7 // Default to 7 days
	}
	return s.subscriptionRepo.GetUpcomingRenewals(ctx, userID, withinDays)
}

// GetSubscriptionSummary returns cost analysis
func (s *SubscriptionService) GetSubscriptionSummary(ctx context.Context, userID uuid.UUID, currency string) (*model.SubscriptionSummary, error) {
	if currency == "" {
		currency = "USD"
	}
	return s.subscriptionRepo.GetSubscriptionSummary(ctx, userID, currency)
}

// GetBillingCycles returns available billing cycles
func (s *SubscriptionService) GetBillingCycles() []string {
	return model.SubscriptionBillingCycles
}

// GetCategories returns available subscription categories
func (s *SubscriptionService) GetCategories() []string {
	return model.SubscriptionCategories
}

// CountActiveSubscriptions returns the count of active subscriptions
func (s *SubscriptionService) CountActiveSubscriptions(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.subscriptionRepo.CountActiveSubscriptions(ctx, userID)
}
