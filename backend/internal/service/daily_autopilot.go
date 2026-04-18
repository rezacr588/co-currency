package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// DailyAutopilotService handles daily financial health scans and proposal generation
type DailyAutopilotService struct {
	agentRepo           *repository.AgentPlanRepository
	walletService       *WalletService
	goalService         *GoalService
	budgetService       *BudgetService
	recurringService    *RecurringService
	subscriptionService *SubscriptionService
	loanService         *LoanService
	planEngine          *PlanningEngineService
}

// NewDailyAutopilotService creates a new daily autopilot service
func NewDailyAutopilotService(
	agentRepo *repository.AgentPlanRepository,
	walletService *WalletService,
	goalService *GoalService,
	budgetService *BudgetService,
	recurringService *RecurringService,
	subscriptionService *SubscriptionService,
	loanService *LoanService,
	planEngine *PlanningEngineService,
) *DailyAutopilotService {
	return &DailyAutopilotService{
		agentRepo:           agentRepo,
		walletService:       walletService,
		goalService:         goalService,
		budgetService:       budgetService,
		recurringService:    recurringService,
		subscriptionService: subscriptionService,
		loanService:         loanService,
		planEngine:          planEngine,
	}
}

// AutopilotAnalysis contains the results of a daily financial health scan
type AutopilotAnalysis struct {
	UserID             uuid.UUID                      `json:"user_id"`
	Date               time.Time                      `json:"date"`
	UpcomingBills      []UpcomingBill                 `json:"upcoming_bills"`
	BalancePredictions []BalancePrediction            `json:"balance_predictions"`
	GoalOpportunities  []GoalOpportunity              `json:"goal_opportunities"`
	Recommendations    []model.AgentRecommendedAction `json:"recommendations"`
	RequiresAttention  bool                           `json:"requires_attention"`
	AttentionReason    string                         `json:"attention_reason,omitempty"`
}

// UpcomingBill represents a detected upcoming payment
type UpcomingBill struct {
	Type        string    `json:"type"` // recurring, subscription, loan_payment
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	DueDate     time.Time `json:"due_date"`
	DaysUntil   int       `json:"days_until"`
	IsOverdue   bool      `json:"is_overdue"`
	CanAutomate bool      `json:"can_automate"`
}

// BalancePrediction represents predicted balance state
type BalancePrediction struct {
	Currency          string  `json:"currency"`
	CurrentBalance    float64 `json:"current_balance"`
	PredictedIn7Days  float64 `json:"predicted_in_7days"`
	PredictedIn30Days float64 `json:"predicted_in_30days"`
	TrendDirection    string  `json:"trend_direction"` // increasing, decreasing, stable
	RiskLevel         string  `json:"risk_level"`      // low, medium, high
	RiskReason        string  `json:"risk_reason,omitempty"`
}

// GoalOpportunity represents a detected opportunity to contribute to a goal
type GoalOpportunity struct {
	GoalID           uuid.UUID `json:"goal_id"`
	GoalName         string    `json:"goal_name"`
	CurrentAmount    float64   `json:"current_amount"`
	TargetAmount     float64   `json:"target_amount"`
	SuggestedAmount  float64   `json:"suggested_amount"`
	Currency         string    `json:"currency"`
	Reasoning        string    `json:"reasoning"`
	CanAfford        bool      `json:"can_afford"`
	ImpactOnBalance  float64   `json:"impact_on_balance"`
	MonthsToDeadline int       `json:"months_to_deadline"`
}

// RunDailyScan executes a financial health scan for a user
func (s *DailyAutopilotService) RunDailyScan(ctx context.Context, userID uuid.UUID) (*AutopilotAnalysis, error) {
	log.Info().Str("user_id", userID.String()).Msg("Starting daily autopilot scan")

	analysis := &AutopilotAnalysis{
		UserID: userID,
		Date:   time.Now(),
	}

	// Check if user has agent enabled
	config, err := s.agentRepo.GetConfig(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent config: %w", err)
	}

	if config == nil || !config.Enabled {
		log.Info().Str("user_id", userID.String()).Msg("Agent not enabled for user")
		return nil, nil
	}

	// Run scans sequentially for simplicity
	bills, err := s.detectUpcomingBills(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Msg("Upcoming bills scan failed")
	} else {
		analysis.UpcomingBills = bills
	}

	predictions, err := s.predictBalances(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Msg("Balance prediction failed")
	} else {
		analysis.BalancePredictions = predictions
	}

	opportunities, err := s.findGoalOpportunities(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Msg("Goal opportunities scan failed")
	} else {
		analysis.GoalOpportunities = opportunities
	}

	recommendations := s.generateRecommendations(analysis)
	analysis.Recommendations = recommendations

	s.assessAttentionRequired(analysis)

	if err := s.storeResults(ctx, analysis); err != nil {
		log.Warn().Err(err).Msg("Failed to store autopilot results")
	}

	log.Info().
		Str("user_id", userID.String()).
		Int("bills", len(analysis.UpcomingBills)).
		Int("opportunities", len(analysis.GoalOpportunities)).
		Int("recommendations", len(analysis.Recommendations)).
		Bool("requires_attention", analysis.RequiresAttention).
		Msg("Daily autopilot scan complete")

	return analysis, nil
}

// detectUpcomingBills finds bills due in the next 7 days
func (s *DailyAutopilotService) detectUpcomingBills(ctx context.Context, userID uuid.UUID) ([]UpcomingBill, error) {
	bills := []UpcomingBill{}

	if s.recurringService == nil {
		return bills, nil
	}

	now := time.Now()
	sevenDaysFromNow := now.AddDate(0, 0, 7)

	recurring, err := s.recurringService.GetRecurring(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recurring transactions: %w", err)
	}

	for _, r := range recurring {
		if !r.IsActive {
			continue
		}

		// Use NextExecution as the due date
		nextDue := r.NextExecution
		if nextDue.After(now) && nextDue.Before(sevenDaysFromNow) {
			bills = append(bills, UpcomingBill{
				Type:        "recurring",
				ID:          r.ID,
				Name:        r.Description,
				Amount:      r.Amount,
				Currency:    r.Currency,
				DueDate:     nextDue,
				DaysUntil:   int(nextDue.Sub(now).Hours() / 24),
				IsOverdue:   false,
				CanAutomate: true,
			})
		}
	}

	if s.subscriptionService != nil {
		subscriptions, err := s.subscriptionService.GetSubscriptions(ctx, userID)
		if err == nil {
			for _, sub := range subscriptions {
				if sub.Status != "active" {
					continue
				}

				nextBilling := calculateNextDueDate(sub.CreatedAt, sub.BillingCycle)
				if nextBilling.After(now) && nextBilling.Before(sevenDaysFromNow) {
					bills = append(bills, UpcomingBill{
						Type:        "subscription",
						ID:          sub.ID,
						Name:        sub.Name,
						Amount:      sub.Amount,
						Currency:    sub.Currency,
						DueDate:     nextBilling,
						DaysUntil:   int(nextBilling.Sub(now).Hours() / 24),
						IsOverdue:   false,
						CanAutomate: false,
					})
				}
			}
		}
	}

	return bills, nil
}

// predictBalances forecasts balance trends for next 7 and 30 days
func (s *DailyAutopilotService) predictBalances(ctx context.Context, userID uuid.UUID) ([]BalancePrediction, error) {
	predictions := []BalancePrediction{}

	if s.walletService == nil {
		return predictions, nil
	}

	balances, err := s.walletService.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get balances: %w", err)
	}

	for _, balance := range balances {
		prediction := BalancePrediction{
			Currency:       balance.Currency,
			CurrentBalance: balance.Balance,
		}

		// Simple prediction: assume 5% monthly decline (placeholder for ML integration)
		dailyDecline := balance.Balance * 0.05 / 30.0

		prediction.PredictedIn7Days = balance.Balance - (dailyDecline * 7)
		prediction.PredictedIn30Days = balance.Balance - (dailyDecline * 30)

		if dailyDecline < 0.01 {
			prediction.TrendDirection = "stable"
		} else {
			prediction.TrendDirection = "decreasing"
		}

		if prediction.PredictedIn7Days < 0 {
			prediction.RiskLevel = "high"
			prediction.RiskReason = "Balance predicted to go negative within 7 days"
		} else if prediction.PredictedIn7Days < balance.Balance*0.2 {
			prediction.RiskLevel = "medium"
			prediction.RiskReason = "Balance predicted to drop below 20% of current level"
		} else {
			prediction.RiskLevel = "low"
		}

		predictions = append(predictions, prediction)
	}

	return predictions, nil
}

// findGoalOpportunities identifies goals that could benefit from contributions
func (s *DailyAutopilotService) findGoalOpportunities(ctx context.Context, userID uuid.UUID) ([]GoalOpportunity, error) {
	opportunities := []GoalOpportunity{}

	if s.goalService == nil || s.walletService == nil {
		return opportunities, nil
	}

	goals, err := s.goalService.GetGoals(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get goals: %w", err)
	}

	balances, err := s.walletService.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get balances: %w", err)
	}

	balanceMap := make(map[string]float64)
	for _, b := range balances {
		balanceMap[b.Currency] = b.Balance
	}

	for _, goal := range goals {
		// Skip completed goals (check WorkflowStatus)
		if goal.WorkflowStatus == model.GoalWorkflowStatusDone {
			continue
		}

		remaining := goal.TargetAmount - goal.CurrentAmount
		if remaining <= 0 {
			continue
		}

		// Calculate months to deadline
		monthsToDeadline := 0
		if goal.Deadline != nil {
			monthsToDeadline = int(goal.Deadline.Sub(time.Now()).Hours() / 24 / 30)
		}

		availableBalance := balanceMap[goal.Currency]
		suggestedAmount := availableBalance * 0.05 // Default 5%

		if monthsToDeadline > 0 && monthsToDeadline < 12 {
			monthlyNeed := remaining / float64(monthsToDeadline)
			if monthlyNeed < availableBalance*0.10 {
				suggestedAmount = monthlyNeed
			}
		}

		canAfford := suggestedAmount > 0 && availableBalance > suggestedAmount*2.0

		if canAfford && suggestedAmount >= 1.0 {
			opportunities = append(opportunities, GoalOpportunity{
				GoalID:           goal.ID,
				GoalName:         goal.Name,
				CurrentAmount:    goal.CurrentAmount,
				TargetAmount:     goal.TargetAmount,
				SuggestedAmount:  suggestedAmount,
				Currency:         goal.Currency,
				CanAfford:        canAfford,
				ImpactOnBalance:  suggestedAmount / availableBalance,
				MonthsToDeadline: monthsToDeadline,
				Reasoning:        fmt.Sprintf("Contributing %.2f keeps your goal on track", suggestedAmount),
			})
		}
	}

	return opportunities, nil
}

// generateRecommendations creates actionable recommendations based on analysis
func (s *DailyAutopilotService) generateRecommendations(analysis *AutopilotAnalysis) []model.AgentRecommendedAction {
	recommendations := []model.AgentRecommendedAction{}

	// Recommend bill payments
	for _, bill := range analysis.UpcomingBills {
		if bill.CanAutomate && bill.DaysUntil <= 3 {
			recommendations = append(recommendations, model.AgentRecommendedAction{
				Type:        "recurring_payment",
				Title:       fmt.Sprintf("Pay %s", bill.Name),
				Description: fmt.Sprintf("Bill of %.2f %s due in %d days. Due %s.", bill.Amount, bill.Currency, bill.DaysUntil, bill.DueDate.Format("Jan 2")),
				Impact:      bill.Amount,
				Currency:    bill.Currency,
				Urgency:     "high",
			})
		}
	}

	// Recommend goal contributions
	for _, opp := range analysis.GoalOpportunities {
		if opp.CanAfford {
			recommendations = append(recommendations, model.AgentRecommendedAction{
				Type:        "goal_contribution",
				Title:       fmt.Sprintf("Contribute to %s", opp.GoalName),
				Description: fmt.Sprintf("Suggested contribution: %.2f %s. %s", opp.SuggestedAmount, opp.Currency, opp.Reasoning),
				Impact:      opp.SuggestedAmount,
				Currency:    opp.Currency,
				Urgency:     "medium",
			})
		}
	}

	// Warn about high-risk balances
	for _, pred := range analysis.BalancePredictions {
		if pred.RiskLevel == "high" {
			recommendations = append(recommendations, model.AgentRecommendedAction{
				Type:        "alert",
				Title:       fmt.Sprintf("Review %s spending", pred.Currency),
				Description: fmt.Sprintf("Balance predicted to drop to %.2f in 7 days. %s", pred.PredictedIn7Days, pred.RiskReason),
				Impact:      pred.CurrentBalance - pred.PredictedIn7Days,
				Currency:    pred.Currency,
				Urgency:     "high",
			})
		}
	}

	return recommendations
}

// assessAttentionRequired determines if the user should receive a push
// notification for this scan. Thresholds are deliberately conservative: we only
// notify for problems the user must act on, not for opportunities. Goal
// opportunities are surfaced in the results + plans UI but never drive a push.
func (s *DailyAutopilotService) assessAttentionRequired(analysis *AutopilotAnalysis) {
	for _, pred := range analysis.BalancePredictions {
		if pred.RiskLevel == "high" {
			analysis.RequiresAttention = true
			analysis.AttentionReason = "Potential balance shortfall detected"
			return
		}
	}

	for _, bill := range analysis.UpcomingBills {
		// Only flag when the user actually has to act: overdue, or due soon
		// without autopay. Routine automated bills don't page the user.
		if bill.IsOverdue {
			analysis.RequiresAttention = true
			analysis.AttentionReason = "One or more bills are overdue"
			return
		}
		if bill.DaysUntil <= 2 && !bill.CanAutomate {
			analysis.RequiresAttention = true
			analysis.AttentionReason = "Manual bills due within 2 days"
			return
		}
	}
}

// storeResults saves the autopilot analysis to the database
func (s *DailyAutopilotService) storeResults(ctx context.Context, analysis *AutopilotAnalysis) error {
	// Get or create today's result
	result, err := s.agentRepo.GetOrCreateAutopilotResult(ctx, analysis.UserID, analysis.Date)
	if err != nil {
		return fmt.Errorf("failed to get/create autopilot result: %w", err)
	}

	// Convert analysis data to interface{} slices for JSONB storage
	billsJSON, _ := json.Marshal(analysis.UpcomingBills)
	predsJSON, _ := json.Marshal(analysis.BalancePredictions)
	oppsJSON, _ := json.Marshal(analysis.GoalOpportunities)

	var billsSlice []interface{}
	var predsMap map[string]interface{}
	var oppsSlice []interface{}

	json.Unmarshal(billsJSON, &billsSlice)
	json.Unmarshal(predsJSON, &predsMap)
	json.Unmarshal(oppsJSON, &oppsSlice)

	// Update result
	result.Status = "completed"
	result.UpcomingBills = billsSlice
	result.BalancePredictions = predsMap
	result.GoalOpportunities = oppsSlice
	result.ProposedActions = len(analysis.Recommendations)
	result.PendingApprovals = len(analysis.Recommendations)

	return s.agentRepo.UpdateAutopilotResult(ctx, result)
}

// Helper functions

func calculateNextDueDate(start time.Time, frequency string) time.Time {
	now := time.Now()

	switch frequency {
	case "daily":
		return now.AddDate(0, 0, 1)
	case "weekly":
		return now.AddDate(0, 0, 7)
	case "biweekly":
		return now.AddDate(0, 0, 14)
	case "monthly":
		return now.AddDate(0, 1, 0)
	case "quarterly":
		return now.AddDate(0, 3, 0)
	case "yearly":
		return now.AddDate(1, 0, 0)
	default:
		return now.AddDate(0, 1, 0)
	}
}
