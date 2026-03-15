package model

import "time"

type RecommendedAction struct {
	ID                   string                 `json:"id"`
	Type                 string                 `json:"type"`
	Title                string                 `json:"title"`
	Description          string                 `json:"description"`
	CTALabel             string                 `json:"cta_label"`
	TargetRoute          string                 `json:"target_route"`
	Prefill              map[string]interface{} `json:"prefill,omitempty"`
	RequiresConfirmation bool                   `json:"requires_confirmation"`
}

type CoAIPriority struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	TargetRoute string `json:"target_route,omitempty"`
}

type CoAIAlert struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	TargetRoute string `json:"target_route,omitempty"`
}

type CoAIContextSnapshot struct {
	TotalBalance            float64 `json:"total_balance"`
	BalanceCurrencyCount    int     `json:"balance_currency_count"`
	RecentTransactionCount  int     `json:"recent_transaction_count"`
	ActiveBudgetCount       int     `json:"active_budget_count"`
	ActiveGoalCount         int     `json:"active_goal_count"`
	ActiveSubscriptionCount int     `json:"active_subscription_count"`
}

type CoAIBriefResponse struct {
	GeneratedAt        time.Time           `json:"generated_at"`
	Currency           string              `json:"currency"`
	Brief              string              `json:"brief"`
	Priorities         []CoAIPriority      `json:"priorities"`
	Alerts             []CoAIAlert         `json:"alerts"`
	RecommendedActions []RecommendedAction `json:"recommended_actions"`
	ContextSnapshot    CoAIContextSnapshot `json:"context_snapshot"`
}

type CoAIPreferences struct {
	UserID                 string    `json:"user_id"`
	PreferredCurrency      string    `json:"preferred_currency"`
	FocusAreas             []string  `json:"focus_areas"`
	WeeklyBriefEnabled     bool      `json:"weekly_brief_enabled"`
	ProactiveAlertsEnabled bool      `json:"proactive_alerts_enabled"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type UpdateCoAIPreferencesRequest struct {
	PreferredCurrency      *string   `json:"preferred_currency,omitempty"`
	FocusAreas             *[]string `json:"focus_areas,omitempty"`
	WeeklyBriefEnabled     *bool     `json:"weekly_brief_enabled,omitempty"`
	ProactiveAlertsEnabled *bool     `json:"proactive_alerts_enabled,omitempty"`
}
