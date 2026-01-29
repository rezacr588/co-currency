package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/model"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
)

// SubscriptionRepository handles subscription database operations
type SubscriptionRepository struct {
	db *Database
}

// NewSubscriptionRepository creates a new SubscriptionRepository
func NewSubscriptionRepository(db *Database) *SubscriptionRepository {
	return &SubscriptionRepository{db: db}
}

// GetSubscriptions returns all subscriptions for a user
func (r *SubscriptionRepository) GetSubscriptions(ctx context.Context, userID uuid.UUID) ([]model.Subscription, error) {
	query := `
		SELECT id, user_id, name, amount, currency, billing_cycle, category,
			   next_billing_date, status, reminder_days, notes, logo_url,
			   created_at, updated_at
		FROM subscriptions
		WHERE user_id = $1
		ORDER BY next_billing_date ASC`

	rows, err := r.db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying subscriptions: %w", err)
	}
	defer rows.Close()

	var subscriptions []model.Subscription
	for rows.Next() {
		var s model.Subscription
		var category, notes, logoURL *string
		err := rows.Scan(
			&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
			&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
			&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning subscription: %w", err)
		}
		if category != nil {
			s.Category = *category
		}
		if notes != nil {
			s.Notes = *notes
		}
		if logoURL != nil {
			s.LogoURL = *logoURL
		}
		subscriptions = append(subscriptions, s)
	}

	return subscriptions, nil
}

// GetSubscription returns a single subscription by ID
func (r *SubscriptionRepository) GetSubscription(ctx context.Context, userID, subscriptionID uuid.UUID) (*model.Subscription, error) {
	query := `
		SELECT id, user_id, name, amount, currency, billing_cycle, category,
			   next_billing_date, status, reminder_days, notes, logo_url,
			   created_at, updated_at
		FROM subscriptions
		WHERE id = $1 AND user_id = $2`

	var s model.Subscription
	var category, notes, logoURL *string
	err := r.db.pool.QueryRow(ctx, query, subscriptionID, userID).Scan(
		&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
		&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
		&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSubscriptionNotFound
		}
		return nil, fmt.Errorf("querying subscription: %w", err)
	}

	if category != nil {
		s.Category = *category
	}
	if notes != nil {
		s.Notes = *notes
	}
	if logoURL != nil {
		s.LogoURL = *logoURL
	}

	return &s, nil
}

// CreateSubscription creates a new subscription
func (r *SubscriptionRepository) CreateSubscription(ctx context.Context, userID uuid.UUID, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	nextBillingDate, err := time.Parse("2006-01-02", req.NextBillingDate)
	if err != nil {
		return nil, fmt.Errorf("invalid next_billing_date format: %w", err)
	}

	reminderDays := req.ReminderDays
	if reminderDays == 0 {
		reminderDays = 3 // Default 3 days reminder
	}

	query := `
		INSERT INTO subscriptions (user_id, name, amount, currency, billing_cycle, category,
								   next_billing_date, status, reminder_days, notes, logo_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
		RETURNING id, user_id, name, amount, currency, billing_cycle, category,
				  next_billing_date, status, reminder_days, notes, logo_url, created_at, updated_at`

	var s model.Subscription
	var category, notes, logoURL *string
	err = r.db.pool.QueryRow(ctx, query,
		userID, req.Name, req.Amount, req.Currency, req.BillingCycle,
		nilIfEmpty(req.Category), nextBillingDate, reminderDays,
		nilIfEmpty(req.Notes), nilIfEmpty(req.LogoURL),
	).Scan(
		&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
		&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
		&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating subscription: %w", err)
	}

	if category != nil {
		s.Category = *category
	}
	if notes != nil {
		s.Notes = *notes
	}
	if logoURL != nil {
		s.LogoURL = *logoURL
	}

	return &s, nil
}

// UpdateSubscription updates an existing subscription
func (r *SubscriptionRepository) UpdateSubscription(ctx context.Context, userID, subscriptionID uuid.UUID, req *model.UpdateSubscriptionRequest) (*model.Subscription, error) {
	// First verify the subscription exists and belongs to user
	existing, err := r.GetSubscription(ctx, userID, subscriptionID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Amount != nil {
		existing.Amount = *req.Amount
	}
	if req.Currency != nil {
		existing.Currency = *req.Currency
	}
	if req.BillingCycle != nil {
		existing.BillingCycle = *req.BillingCycle
	}
	if req.Category != nil {
		existing.Category = *req.Category
	}
	if req.NextBillingDate != nil {
		nextBillingDate, err := time.Parse("2006-01-02", *req.NextBillingDate)
		if err != nil {
			return nil, fmt.Errorf("invalid next_billing_date format: %w", err)
		}
		existing.NextBillingDate = nextBillingDate
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	if req.ReminderDays != nil {
		existing.ReminderDays = *req.ReminderDays
	}
	if req.Notes != nil {
		existing.Notes = *req.Notes
	}
	if req.LogoURL != nil {
		existing.LogoURL = *req.LogoURL
	}

	query := `
		UPDATE subscriptions
		SET name = $1, amount = $2, currency = $3, billing_cycle = $4, category = $5,
			next_billing_date = $6, status = $7, reminder_days = $8, notes = $9, logo_url = $10,
			updated_at = NOW()
		WHERE id = $11 AND user_id = $12
		RETURNING id, user_id, name, amount, currency, billing_cycle, category,
				  next_billing_date, status, reminder_days, notes, logo_url, created_at, updated_at`

	var s model.Subscription
	var category, notes, logoURL *string
	err = r.db.pool.QueryRow(ctx, query,
		existing.Name, existing.Amount, existing.Currency, existing.BillingCycle,
		nilIfEmpty(existing.Category), existing.NextBillingDate, existing.Status,
		existing.ReminderDays, nilIfEmpty(existing.Notes), nilIfEmpty(existing.LogoURL),
		subscriptionID, userID,
	).Scan(
		&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
		&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
		&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("updating subscription: %w", err)
	}

	if category != nil {
		s.Category = *category
	}
	if notes != nil {
		s.Notes = *notes
	}
	if logoURL != nil {
		s.LogoURL = *logoURL
	}

	return &s, nil
}

// DeleteSubscription deletes a subscription
func (r *SubscriptionRepository) DeleteSubscription(ctx context.Context, userID, subscriptionID uuid.UUID) error {
	result, err := r.db.pool.Exec(ctx,
		`DELETE FROM subscriptions WHERE id = $1 AND user_id = $2`,
		subscriptionID, userID,
	)
	if err != nil {
		return fmt.Errorf("deleting subscription: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

// GetUpcomingRenewals returns subscriptions renewing within the specified days
func (r *SubscriptionRepository) GetUpcomingRenewals(ctx context.Context, userID uuid.UUID, withinDays int) ([]model.Subscription, error) {
	query := `
		SELECT id, user_id, name, amount, currency, billing_cycle, category,
			   next_billing_date, status, reminder_days, notes, logo_url,
			   created_at, updated_at
		FROM subscriptions
		WHERE user_id = $1 
		  AND status = 'active'
		  AND next_billing_date <= CURRENT_DATE + $2::interval
		ORDER BY next_billing_date ASC`

	interval := fmt.Sprintf("%d days", withinDays)
	rows, err := r.db.pool.Query(ctx, query, userID, interval)
	if err != nil {
		return nil, fmt.Errorf("querying upcoming renewals: %w", err)
	}
	defer rows.Close()

	var subscriptions []model.Subscription
	for rows.Next() {
		var s model.Subscription
		var category, notes, logoURL *string
		err := rows.Scan(
			&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
			&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
			&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning subscription: %w", err)
		}
		if category != nil {
			s.Category = *category
		}
		if notes != nil {
			s.Notes = *notes
		}
		if logoURL != nil {
			s.LogoURL = *logoURL
		}
		subscriptions = append(subscriptions, s)
	}

	return subscriptions, nil
}

// GetSubscriptionSummary returns aggregated subscription costs
func (r *SubscriptionRepository) GetSubscriptionSummary(ctx context.Context, userID uuid.UUID, currency string) (*model.SubscriptionSummary, error) {
	// Get all subscriptions for the user
	subs, err := r.GetSubscriptions(ctx, userID)
	if err != nil {
		return nil, err
	}

	summary := &model.SubscriptionSummary{
		Currency:   currency,
		ByCategory: make(map[string]float64),
	}

	for _, s := range subs {
		switch s.Status {
		case "active":
			summary.ActiveCount++
			// Only count active subscriptions for cost
			monthlyAmount := s.GetMonthlyAmount()
			summary.TotalMonthly += monthlyAmount
			summary.TotalYearly += s.GetYearlyAmount()

			// Category breakdown
			cat := s.Category
			if cat == "" {
				cat = "other"
			}
			summary.ByCategory[cat] += monthlyAmount
		case "paused":
			summary.PausedCount++
		case "cancelled":
			summary.CancelledCount++
		}
	}

	return summary, nil
}

// GetSubscriptionsByStatus returns subscriptions filtered by status
func (r *SubscriptionRepository) GetSubscriptionsByStatus(ctx context.Context, userID uuid.UUID, status string) ([]model.Subscription, error) {
	query := `
		SELECT id, user_id, name, amount, currency, billing_cycle, category,
			   next_billing_date, status, reminder_days, notes, logo_url,
			   created_at, updated_at
		FROM subscriptions
		WHERE user_id = $1 AND status = $2
		ORDER BY next_billing_date ASC`

	rows, err := r.db.pool.Query(ctx, query, userID, status)
	if err != nil {
		return nil, fmt.Errorf("querying subscriptions by status: %w", err)
	}
	defer rows.Close()

	var subscriptions []model.Subscription
	for rows.Next() {
		var s model.Subscription
		var category, notes, logoURL *string
		err := rows.Scan(
			&s.ID, &s.UserID, &s.Name, &s.Amount, &s.Currency,
			&s.BillingCycle, &category, &s.NextBillingDate, &s.Status,
			&s.ReminderDays, &notes, &logoURL, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning subscription: %w", err)
		}
		if category != nil {
			s.Category = *category
		}
		if notes != nil {
			s.Notes = *notes
		}
		if logoURL != nil {
			s.LogoURL = *logoURL
		}
		subscriptions = append(subscriptions, s)
	}

	return subscriptions, nil
}

// CountActiveSubscriptions returns the count of active subscriptions for a user
func (r *SubscriptionRepository) CountActiveSubscriptions(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting subscriptions: %w", err)
	}
	return count, nil
}

// Helper function
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
