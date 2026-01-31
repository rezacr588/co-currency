package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

const (
	expoPushURL = "https://exp.host/--/api/v2/push/send"
)

type NotificationService struct {
	repo       *repository.NotificationRepository
	budgetRepo *repository.BudgetRepository
	loanRepo   *repository.LoanRepository
	httpClient *http.Client
}

func NewNotificationService(
	repo *repository.NotificationRepository,
	budgetRepo *repository.BudgetRepository,
	loanRepo *repository.LoanRepository,
) *NotificationService {
	return &NotificationService{
		repo:       repo,
		budgetRepo: budgetRepo,
		loanRepo:   loanRepo,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// RegisterToken registers a push token for a user
func (s *NotificationService) RegisterToken(ctx context.Context, userID, token, platform string) (*model.PushToken, error) {
	return s.repo.RegisterToken(ctx, userID, token, platform)
}

// UnregisterToken unregisters a push token for a specific user
func (s *NotificationService) UnregisterToken(ctx context.Context, userID, token string) error {
	return s.repo.UnregisterToken(ctx, userID, token)
}

// GetPreferences returns notification preferences for a user
func (s *NotificationService) GetPreferences(ctx context.Context, userID string) (*model.NotificationPreferences, error) {
	return s.repo.GetPreferences(ctx, userID)
}

// UpdatePreferences updates notification preferences
func (s *NotificationService) UpdatePreferences(ctx context.Context, userID string, req model.UpdatePreferencesRequest) (*model.NotificationPreferences, error) {
	return s.repo.UpdatePreferences(ctx, userID, req)
}

// SendPushNotification sends a push notification to a user
func (s *NotificationService) SendPushNotification(ctx context.Context, userID, title, body string, data map[string]interface{}, notifType string) error {
	// Get user's active tokens
	tokens, err := s.repo.GetActiveTokensByUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get tokens: %w", err)
	}

	if len(tokens) == 0 {
		log.Debug().Str("user_id", userID).Msg("No active push tokens for user")
		return nil
	}

	// Send to each token
	for _, token := range tokens {
		msg := model.PushMessage{
			To:       token.Token,
			Title:    title,
			Body:     body,
			Data:     data,
			Sound:    "default",
			Priority: "high",
		}

		// Set channel ID for Android based on notification type
		switch notifType {
		case model.NotificationTypeBudgetAlert, model.NotificationTypeBudgetWarning:
			msg.ChannelID = "budget-alerts"
		case model.NotificationTypeLoanReminder, model.NotificationTypeLoanOverdue:
			msg.ChannelID = "loan-reminders"
		default:
			msg.ChannelID = "default"
		}

		if err := s.sendToExpo(ctx, msg); err != nil {
			log.Warn().Err(err).Str("token", token.Token[:20]+"...").Msg("Failed to send push notification")
			// Log as failed
			s.repo.LogNotification(ctx, userID, notifType, title, body, data, "failed")
			continue
		}

		// Log success
		s.repo.LogNotification(ctx, userID, notifType, title, body, data, "sent")
	}

	return nil
}

// sendToExpo sends a push notification via Expo's push API
func (s *NotificationService) sendToExpo(ctx context.Context, msg model.PushMessage) error {
	// Skip development tokens - return error to indicate skip
	if len(msg.To) > 4 && msg.To[:4] == "dev-" {
		log.Debug().Str("token", msg.To).Msg("Skipping development token")
		return fmt.Errorf("development token cannot receive push notifications")
	}

	// Validate Expo push token format
	if len(msg.To) < 20 || msg.To[:17] != "ExponentPushToken" {
		log.Debug().Str("token", msg.To).Msg("Invalid Expo push token format")
		return nil
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", expoPushURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Encoding", "gzip, deflate")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expo API returned status %d", resp.StatusCode)
	}

	var pushResp model.ExpoPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&pushResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// Check for errors in tickets
	for _, ticket := range pushResp.Data {
		if ticket.Status == "error" {
			log.Warn().
				Str("error", ticket.Details.Error).
				Str("message", ticket.Message).
				Msg("Expo push error")
			return fmt.Errorf("expo error: %s", ticket.Details.Error)
		}
	}

	return nil
}

// CheckBudgetAlerts checks all users' budgets and sends alerts if needed
func (s *NotificationService) CheckBudgetAlerts(ctx context.Context) (int, error) {
	if s.budgetRepo == nil {
		return 0, nil
	}

	// Get users with budget alerts enabled
	userIDs, err := s.repo.GetUsersWithBudgetAlerts(ctx)
	if err != nil {
		return 0, err
	}

	alertsSent := 0
	for _, userID := range userIDs {
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			log.Warn().Err(err).Str("user_id", userID).Msg("Invalid user ID")
			continue
		}

		// Get user's budgets
		budgets, err := s.budgetRepo.GetByUser(ctx, userUUID)
		if err != nil {
			log.Warn().Err(err).Str("user_id", userID).Msg("Failed to get budgets")
			continue
		}

		for _, budget := range budgets {
			if budget.Amount <= 0 {
				continue
			}

			percentage := (budget.Spent / budget.Amount) * 100

			// Alert at 80% and 100%
			if percentage >= 100 {
				title := "Budget Exceeded!"
				body := fmt.Sprintf("You've exceeded your %s budget (%.0f%% spent)", budget.Category, percentage)
				data := map[string]interface{}{
					"type":       model.NotificationTypeBudgetAlert,
					"budget_id":  budget.ID,
					"category":   budget.Category,
					"percentage": percentage,
				}
				if err := s.SendPushNotification(ctx, userID, title, body, data, model.NotificationTypeBudgetAlert); err != nil {
					log.Warn().Err(err).Msg("Failed to send budget alert")
				} else {
					alertsSent++
				}
			} else if percentage >= 80 {
				title := "Budget Warning"
				body := fmt.Sprintf("You've used %.0f%% of your %s budget", percentage, budget.Category)
				data := map[string]interface{}{
					"type":       model.NotificationTypeBudgetWarning,
					"budget_id":  budget.ID,
					"category":   budget.Category,
					"percentage": percentage,
				}
				if err := s.SendPushNotification(ctx, userID, title, body, data, model.NotificationTypeBudgetWarning); err != nil {
					log.Warn().Err(err).Msg("Failed to send budget warning")
				} else {
					alertsSent++
				}
			}
		}
	}

	return alertsSent, nil
}

// CheckLoanReminders checks for upcoming loan due dates and sends reminders
func (s *NotificationService) CheckLoanReminders(ctx context.Context) (int, error) {
	if s.loanRepo == nil {
		return 0, nil
	}

	// Get users with loan reminders enabled
	userIDs, err := s.repo.GetUsersWithLoanReminders(ctx)
	if err != nil {
		return 0, err
	}

	remindersSent := 0
	now := time.Now()

	for _, userID := range userIDs {
		// Get loans due within 7 days
		loans, err := s.loanRepo.GetUpcomingDue(ctx, userID, 7)
		if err != nil {
			log.Warn().Err(err).Str("user_id", userID).Msg("Failed to get upcoming loans")
			continue
		}

		for _, loan := range loans {
			if loan.DueDate == nil {
				continue
			}

			daysUntilDue := int(loan.DueDate.Sub(now).Hours() / 24)

			var title, body string
			var notifType string

			if daysUntilDue < 0 {
				// Overdue
				title = "Loan Overdue!"
				body = fmt.Sprintf("%s is %d days overdue (%.2f %s remaining)", loan.Name, -daysUntilDue, loan.RemainingAmount, loan.Currency)
				notifType = model.NotificationTypeLoanOverdue
			} else if daysUntilDue == 0 {
				// Due today
				title = "Loan Due Today"
				body = fmt.Sprintf("%s is due today (%.2f %s remaining)", loan.Name, loan.RemainingAmount, loan.Currency)
				notifType = model.NotificationTypeLoanReminder
			} else if daysUntilDue <= 3 {
				// Due within 3 days
				title = "Loan Due Soon"
				body = fmt.Sprintf("%s is due in %d days (%.2f %s remaining)", loan.Name, daysUntilDue, loan.RemainingAmount, loan.Currency)
				notifType = model.NotificationTypeLoanReminder
			} else {
				continue // Only notify for loans due within 3 days
			}

			data := map[string]interface{}{
				"type":           notifType,
				"loan_id":        loan.ID,
				"loan_name":      loan.Name,
				"days_until_due": daysUntilDue,
			}

			if err := s.SendPushNotification(ctx, userID, title, body, data, notifType); err != nil {
				log.Warn().Err(err).Msg("Failed to send loan reminder")
			} else {
				remindersSent++
			}
		}
	}

	return remindersSent, nil
}
