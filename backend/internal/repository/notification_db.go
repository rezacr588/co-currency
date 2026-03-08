package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rezacr588/currency-converter/internal/model"
)

type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

// RegisterToken registers or updates a push token for a user
func (r *NotificationRepository) RegisterToken(ctx context.Context, userID, token, platform string) (*model.PushToken, error) {
	query := `
		INSERT INTO push_tokens (user_id, token, platform)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, token)
		DO UPDATE SET platform = $3, is_active = true, updated_at = NOW()
		RETURNING id, user_id, token, platform, is_active, created_at, updated_at`

	var pt model.PushToken
	err := r.pool.QueryRow(ctx, query, userID, token, platform).Scan(
		&pt.ID,
		&pt.UserID,
		&pt.Token,
		&pt.Platform,
		&pt.IsActive,
		&pt.CreatedAt,
		&pt.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register token: %w", err)
	}
	return &pt, nil
}

// UnregisterToken deactivates a push token for a specific user
func (r *NotificationRepository) UnregisterToken(ctx context.Context, userID, token string) error {
	query := `UPDATE push_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND token = $2`
	result, err := r.pool.Exec(ctx, query, userID, token)
	if err != nil {
		return fmt.Errorf("failed to unregister token: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("token not found or does not belong to user")
	}
	return nil
}

// GetActiveTokensByUser returns all active push tokens for a user
func (r *NotificationRepository) GetActiveTokensByUser(ctx context.Context, userID string) ([]model.PushToken, error) {
	query := `
		SELECT id, user_id, token, platform, is_active, created_at, updated_at
		FROM push_tokens
		WHERE user_id = $1 AND is_active = true`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tokens: %w", err)
	}
	defer rows.Close()

	var tokens []model.PushToken
	for rows.Next() {
		var pt model.PushToken
		if err := rows.Scan(
			&pt.ID,
			&pt.UserID,
			&pt.Token,
			&pt.Platform,
			&pt.IsActive,
			&pt.CreatedAt,
			&pt.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan token: %w", err)
		}
		tokens = append(tokens, pt)
	}
	return tokens, nil
}

// GetPreferences returns notification preferences for a user
func (r *NotificationRepository) GetPreferences(ctx context.Context, userID string) (*model.NotificationPreferences, error) {
	query := `
		SELECT user_id, budget_alerts, loan_reminders, goal_updates, weekly_recap, created_at, updated_at
		FROM notification_preferences
		WHERE user_id = $1`

	var prefs model.NotificationPreferences
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&prefs.UserID,
		&prefs.BudgetAlerts,
		&prefs.LoanReminders,
		&prefs.GoalUpdates,
		&prefs.WeeklyRecap,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		// Create default preferences
		return r.CreateDefaultPreferences(ctx, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get preferences: %w", err)
	}
	return &prefs, nil
}

// CreateDefaultPreferences creates default notification preferences for a user
func (r *NotificationRepository) CreateDefaultPreferences(ctx context.Context, userID string) (*model.NotificationPreferences, error) {
	query := `
		INSERT INTO notification_preferences (user_id, budget_alerts, loan_reminders, goal_updates, weekly_recap)
		VALUES ($1, true, true, true, true)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = notification_preferences.updated_at
		RETURNING user_id, budget_alerts, loan_reminders, goal_updates, weekly_recap, created_at, updated_at`

	var prefs model.NotificationPreferences
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&prefs.UserID,
		&prefs.BudgetAlerts,
		&prefs.LoanReminders,
		&prefs.GoalUpdates,
		&prefs.WeeklyRecap,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create preferences: %w", err)
	}
	return &prefs, nil
}

// UpdatePreferences updates notification preferences
func (r *NotificationRepository) UpdatePreferences(ctx context.Context, userID string, req model.UpdatePreferencesRequest) (*model.NotificationPreferences, error) {
	// First ensure preferences exist
	_, err := r.GetPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	query := `UPDATE notification_preferences SET updated_at = NOW()`
	args := []interface{}{}
	argIndex := 1

	if req.BudgetAlerts != nil {
		query += fmt.Sprintf(", budget_alerts = $%d", argIndex)
		args = append(args, *req.BudgetAlerts)
		argIndex++
	}
	if req.LoanReminders != nil {
		query += fmt.Sprintf(", loan_reminders = $%d", argIndex)
		args = append(args, *req.LoanReminders)
		argIndex++
	}
	if req.GoalUpdates != nil {
		query += fmt.Sprintf(", goal_updates = $%d", argIndex)
		args = append(args, *req.GoalUpdates)
		argIndex++
	}
	if req.WeeklyRecap != nil {
		query += fmt.Sprintf(", weekly_recap = $%d", argIndex)
		args = append(args, *req.WeeklyRecap)
		argIndex++
	}

	query += fmt.Sprintf(" WHERE user_id = $%d", argIndex)
	args = append(args, userID)
	query += ` RETURNING user_id, budget_alerts, loan_reminders, goal_updates, weekly_recap, created_at, updated_at`

	var prefs model.NotificationPreferences
	err = r.pool.QueryRow(ctx, query, args...).Scan(
		&prefs.UserID,
		&prefs.BudgetAlerts,
		&prefs.LoanReminders,
		&prefs.GoalUpdates,
		&prefs.WeeklyRecap,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update preferences: %w", err)
	}
	return &prefs, nil
}

// LogNotification records a sent notification
func (r *NotificationRepository) LogNotification(ctx context.Context, userID, notifType, title, body string, data map[string]interface{}, status string) error {
	dataJSON, _ := json.Marshal(data)

	query := `
		INSERT INTO notification_history (user_id, type, title, body, data, status)
		VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := r.pool.Exec(ctx, query, userID, notifType, title, body, dataJSON, status)
	if err != nil {
		return fmt.Errorf("failed to log notification: %w", err)
	}
	return nil
}

// GetUsersWithBudgetAlerts returns user IDs that have budget alerts enabled
func (r *NotificationRepository) GetUsersWithBudgetAlerts(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT np.user_id
		FROM notification_preferences np
		JOIN push_tokens pt ON np.user_id = pt.user_id
		WHERE np.budget_alerts = true AND pt.is_active = true`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("failed to scan user ID: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, nil
}

// GetUsersWithLoanReminders returns user IDs that have loan reminders enabled
func (r *NotificationRepository) GetUsersWithLoanReminders(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT np.user_id
		FROM notification_preferences np
		JOIN push_tokens pt ON np.user_id = pt.user_id
		WHERE np.loan_reminders = true AND pt.is_active = true`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("failed to scan user ID: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, nil
}
