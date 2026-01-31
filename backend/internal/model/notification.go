package model

import (
	"encoding/json"
	"time"
)

// PushToken represents a device's push notification token
type PushToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Token     string    `json:"token"`
	Platform  string    `json:"platform"` // ios, android, web
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NotificationPreferences represents user's notification settings
type NotificationPreferences struct {
	UserID        string    `json:"user_id"`
	BudgetAlerts  bool      `json:"budget_alerts"`
	LoanReminders bool      `json:"loan_reminders"`
	GoalUpdates   bool      `json:"goal_updates"`
	WeeklyRecap   bool      `json:"weekly_recap"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// NotificationHistory tracks sent notifications
type NotificationHistory struct {
	ID     string          `json:"id"`
	UserID string          `json:"user_id"`
	Type   string          `json:"type"`
	Title  string          `json:"title"`
	Body   string          `json:"body"`
	Data   json.RawMessage `json:"data,omitempty"`
	SentAt time.Time       `json:"sent_at"`
	Status string          `json:"status"` // sent, delivered, failed
}

// RegisterTokenRequest is the request to register a push token
type RegisterTokenRequest struct {
	Token    string `json:"token" validate:"required"`
	Platform string `json:"platform" validate:"required,oneof=ios android web"`
}

// UpdatePreferencesRequest is the request to update notification preferences
type UpdatePreferencesRequest struct {
	BudgetAlerts  *bool `json:"budget_alerts,omitempty"`
	LoanReminders *bool `json:"loan_reminders,omitempty"`
	GoalUpdates   *bool `json:"goal_updates,omitempty"`
	WeeklyRecap   *bool `json:"weekly_recap,omitempty"`
}

// NotificationType constants
const (
	NotificationTypeBudgetAlert   = "budget_alert"
	NotificationTypeBudgetWarning = "budget_warning"
	NotificationTypeLoanReminder  = "loan_reminder"
	NotificationTypeLoanOverdue   = "loan_overdue"
	NotificationTypeGoalReached   = "goal_reached"
	NotificationTypeGoalProgress  = "goal_progress"
	NotificationTypeWeeklyRecap   = "weekly_recap"
)

// PushMessage represents a message to send via push notification
type PushMessage struct {
	To       string                 `json:"to"`
	Title    string                 `json:"title"`
	Body     string                 `json:"body"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Sound    string                 `json:"sound,omitempty"`
	Badge    int                    `json:"badge,omitempty"`
	Priority string                 `json:"priority,omitempty"`
	ChannelID string                `json:"channelId,omitempty"`
}

// ExpoPushResponse represents the response from Expo push API
type ExpoPushResponse struct {
	Data []ExpoPushTicket `json:"data"`
}

// ExpoPushTicket represents a single push ticket from Expo
type ExpoPushTicket struct {
	Status  string `json:"status"` // ok or error
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}
