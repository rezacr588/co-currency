package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var validCoAIFocusAreas = map[string]struct{}{
	"spending":      {},
	"saving":        {},
	"budgeting":     {},
	"debt":          {},
	"subscriptions": {},
	"general":       {},
}

type CoAIService struct {
	userRepo         *repository.UserRepository
	walletRepo       *repository.WalletRepository
	goalRepo         *repository.GoalRepository
	budgetRepo       *repository.BudgetRepository
	subscriptionRepo *repository.SubscriptionRepository
	reportsService   *ReportsService
	adviceService    *AdviceService
	wealthService    *WealthService
}

func NewCoAIService(
	userRepo *repository.UserRepository,
	walletRepo *repository.WalletRepository,
	goalRepo *repository.GoalRepository,
	budgetRepo *repository.BudgetRepository,
	subscriptionRepo *repository.SubscriptionRepository,
	reportsService *ReportsService,
	adviceService *AdviceService,
	wealthService *WealthService,
) *CoAIService {
	return &CoAIService{
		userRepo:         userRepo,
		walletRepo:       walletRepo,
		goalRepo:         goalRepo,
		budgetRepo:       budgetRepo,
		subscriptionRepo: subscriptionRepo,
		reportsService:   reportsService,
		adviceService:    adviceService,
		wealthService:    wealthService,
	}
}

func (s *CoAIService) GetPreferences(ctx context.Context, userID uuid.UUID) (*model.CoAIPreferences, error) {
	if s.userRepo == nil {
		return nil, fmt.Errorf("user repository not configured")
	}
	return s.userRepo.GetCoAIPreferences(ctx, userID)
}

func (s *CoAIService) UpdatePreferences(ctx context.Context, userID uuid.UUID, req model.UpdateCoAIPreferencesRequest) (*model.CoAIPreferences, error) {
	if s.userRepo == nil {
		return nil, fmt.Errorf("user repository not configured")
	}

	if req.PreferredCurrency != nil {
		preferredCurrency := strings.ToUpper(strings.TrimSpace(*req.PreferredCurrency))
		if preferredCurrency == "" {
			preferredCurrency = "USD"
		}
		req.PreferredCurrency = &preferredCurrency
	}

	if req.FocusAreas != nil {
		sanitized := sanitizeFocusAreas(*req.FocusAreas)
		req.FocusAreas = &sanitized
	}

	return s.userRepo.UpdateCoAIPreferences(ctx, userID, req)
}

func (s *CoAIService) GetBrief(ctx context.Context, userID uuid.UUID) (*model.CoAIBriefResponse, error) {
	prefs, err := s.GetPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	currency := prefs.PreferredCurrency
	if currency == "" {
		currency = "USD"
	}

	response := &model.CoAIBriefResponse{
		GeneratedAt: time.Now().UTC(),
		Currency:    currency,
		Priorities:  []model.CoAIPriority{},
		Alerts:      []model.CoAIAlert{},
	}

	var (
		balances       []model.WalletBalance
		budgets        []model.Budget
		goals          []model.Goal
		subscriptions  []model.Subscription
		monthlyReport  *MonthlyReport
		netWorthReport *NetWorthReport
		weeklyRecap    *WeeklyRecapReport
		anomalyReport  *AnomalyReport
		wealthOverview *model.WealthOverview
	)

	if s.walletRepo != nil {
		balances, _ = s.walletRepo.GetBalances(ctx, userID)
		response.ContextSnapshot.BalanceCurrencyCount = len(balances)
		response.ContextSnapshot.RecentTransactionCount = s.countRecentTransactions(ctx, userID)
	}
	if s.budgetRepo != nil {
		budgets, _ = s.budgetRepo.GetByUser(ctx, userID)
		response.ContextSnapshot.ActiveBudgetCount = len(budgets)
	}
	if s.goalRepo != nil {
		goals, _ = s.goalRepo.GetByUser(ctx, userID)
		response.ContextSnapshot.ActiveGoalCount = len(goals)
	}
	if s.subscriptionRepo != nil {
		subscriptions, _ = s.subscriptionRepo.GetSubscriptions(ctx, userID)
		response.ContextSnapshot.ActiveSubscriptionCount = countActiveSubscriptions(subscriptions)
	}
	if s.reportsService != nil {
		monthlyReport, _ = s.reportsService.GetMonthlyReport(ctx, userID, ReportNowForContext(ctx).Year(), int(ReportNowForContext(ctx).Month()), currency)
		netWorthReport, _ = s.reportsService.GetNetWorthReport(ctx, userID, currency)
		weeklyRecap, _ = s.reportsService.GetWeeklyRecap(ctx, userID, currency, nil)
		anomalyReport, _ = s.reportsService.GetSpendingAnomalies(ctx, userID, currency)
	}
	if s.wealthService != nil {
		wealthOverview, _ = s.wealthService.GetOverview(ctx, userID, currency)
	}

	if netWorthReport != nil {
		response.ContextSnapshot.TotalBalance = netWorthReport.TotalBalance
	}
	response.Brief = s.buildBrief(ctx, userID, prefs, monthlyReport, weeklyRecap, wealthOverview)
	response.Priorities = buildPriorities(monthlyReport, budgets, goals, response.ContextSnapshot.ActiveSubscriptionCount)
	response.Alerts = buildAlerts(anomalyReport, budgets, subscriptions, wealthOverview)
	response.RecommendedActions = buildRecommendedActions(
		buildBriefActionContext(
			currency,
			response.ContextSnapshot.RecentTransactionCount,
			monthlyReport,
			balances,
			budgets,
			goals,
			subscriptions,
		),
	)

	if len(response.Priorities) == 0 && response.ContextSnapshot.RecentTransactionCount == 0 {
		response.Priorities = []model.CoAIPriority{
			{
				ID:          "setup-first-transaction",
				Title:       "Add your first transaction",
				Description: "CoAI needs one real money event before it can start guiding you.",
				TargetRoute: "/transaction-create",
			},
			{
				ID:          "setup-first-budget",
				Title:       "Create one budget",
				Description: "A single budget is enough for CoAI to start highlighting risks.",
				TargetRoute: "/(app)/budgets",
			},
		}
	}

	return response, nil
}

func (s *CoAIService) buildBrief(
	ctx context.Context,
	userID uuid.UUID,
	prefs *model.CoAIPreferences,
	monthlyReport *MonthlyReport,
	weeklyRecap *WeeklyRecapReport,
	wealthOverview *model.WealthOverview,
) string {
	if monthlyReport == nil || (monthlyReport.Income == 0 && monthlyReport.Expenses == 0) {
		return "CoAI is ready. Add a few transactions, one budget, and one goal so it can start giving you proactive guidance."
	}

	parts := []string{}
	if monthlyReport.Income > 0 && monthlyReport.Expenses > monthlyReport.Income {
		parts = append(parts, fmt.Sprintf("You spent %.0f %s more than you earned this month.", monthlyReport.Expenses-monthlyReport.Income, monthlyReport.Currency))
	} else if monthlyReport.Income > 0 {
		parts = append(parts, fmt.Sprintf("You are running a %.0f %s monthly surplus right now.", monthlyReport.Net, monthlyReport.Currency))
	} else {
		parts = append(parts, fmt.Sprintf("You have logged %.0f %s of spending this month.", monthlyReport.Expenses, monthlyReport.Currency))
	}

	if weeklyRecap != nil && weeklyRecap.TotalSpent > 0 {
		changeLabel := "steady"
		if weeklyRecap.ComparedToLast > 10 {
			changeLabel = "up"
		} else if weeklyRecap.ComparedToLast < -10 {
			changeLabel = "down"
		}
		parts = append(parts, fmt.Sprintf("Weekly spend is %s versus last week, with %.0f %s spent so far.", changeLabel, weeklyRecap.TotalSpent, weeklyRecap.Currency))
	}

	if wealthOverview != nil && wealthOverview.ErosionAmount > 0 {
		parts = append(parts, fmt.Sprintf("Your purchasing power slipped by %.2f %s over the last month.", wealthOverview.ErosionAmount, wealthOverview.Currency))
	}

	if s.adviceService != nil {
		if advice, err := s.adviceService.GetAdvice(ctx, userID, focusAreaLanguageHint(prefs), false); err == nil && advice != nil && advice.Detail != "" {
			parts = append(parts, advice.Detail)
		}
	}

	if len(parts) > 3 {
		parts = parts[:3]
	}

	return strings.Join(parts, " ")
}

func (s *CoAIService) countRecentTransactions(ctx context.Context, userID uuid.UUID) int {
	if s.walletRepo == nil {
		return 0
	}
	transactions, err := s.walletRepo.GetTransactions(ctx, userID, 20, 0)
	if err != nil {
		return 0
	}
	return len(transactions)
}

func sanitizeFocusAreas(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, raw := range values {
		normalized := strings.ToLower(strings.TrimSpace(raw))
		if _, ok := validCoAIFocusAreas[normalized]; !ok {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	if len(result) == 0 {
		return []string{"general"}
	}
	return result
}

func focusAreaLanguageHint(prefs *model.CoAIPreferences) string {
	if prefs == nil || len(prefs.FocusAreas) == 0 {
		return "English"
	}
	return "English"
}

func countActiveSubscriptions(subscriptions []model.Subscription) int {
	count := 0
	for _, subscription := range subscriptions {
		if subscription.Status == "active" {
			count++
		}
	}
	return count
}

func buildBriefActionContext(
	currency string,
	recentTransactionCount int,
	monthlyReport *MonthlyReport,
	balances []model.WalletBalance,
	budgets []model.Budget,
	goals []model.Goal,
	subscriptions []model.Subscription,
) coaiActionContext {
	topCategory := ""
	monthlyExpenses := 0.0
	if monthlyReport != nil {
		monthlyExpenses = monthlyReport.Expenses
		if len(monthlyReport.Categories) > 0 {
			topCategory = monthlyReport.Categories[0].Category
		}
	}

	balanceCurrencies := make([]string, 0, len(balances))
	for _, balance := range balances {
		if balance.Currency == "" {
			continue
		}
		balanceCurrencies = append(balanceCurrencies, strings.ToUpper(balance.Currency))
	}

	return coaiActionContext{
		PreferredCurrency:  currency,
		RecentTransactions: recentTransactionCount,
		MonthlyExpenses:    monthlyExpenses,
		TopCategory:        topCategory,
		BalanceCurrencies:  balanceCurrencies,
		HasBudgets:         len(budgets) > 0,
		HasGoals:           len(goals) > 0,
		HasSubscriptions:   countActiveSubscriptions(subscriptions) > 0,
	}
}

func buildPriorities(monthlyReport *MonthlyReport, budgets []model.Budget, goals []model.Goal, activeSubscriptionCount int) []model.CoAIPriority {
	priorities := make([]model.CoAIPriority, 0, 3)

	if monthlyReport != nil && monthlyReport.Income > 0 && monthlyReport.Expenses > monthlyReport.Income {
		priorities = append(priorities, model.CoAIPriority{
			ID:          "cashflow",
			Title:       "Stabilize monthly cash flow",
			Description: fmt.Sprintf("Expenses are %.0f %s above income this month.", monthlyReport.Expenses-monthlyReport.Income, monthlyReport.Currency),
			TargetRoute: "/(app)/(tabs)/reports?period=monthly",
		})
	}

	for _, budget := range budgets {
		if budget.IsOverBudget() || budget.IsNearLimit() {
			priorities = append(priorities, model.CoAIPriority{
				ID:          "budget-" + budget.Category,
				Title:       "Watch your " + budget.Category + " budget",
				Description: fmt.Sprintf("%.0f%% of the budget is already used.", budget.Progress()),
				TargetRoute: "/(app)/budgets",
			})
			break
		}
	}

	for _, goal := range goals {
		if goal.IsCompleted() {
			continue
		}
		priorities = append(priorities, model.CoAIPriority{
			ID:          "goal-" + goal.ID.String(),
			Title:       "Keep " + goal.Name + " moving",
			Description: fmt.Sprintf("Progress is %.0f%% toward the target.", goal.Progress()),
			TargetRoute: "/(app)/(tabs)/goals",
		})
		break
	}

	if activeSubscriptionCount > 0 && len(priorities) < 3 {
		priorities = append(priorities, model.CoAIPriority{
			ID:          "subscriptions",
			Title:       "Review recurring spend",
			Description: "Recurring subscriptions are part of your fixed monthly baseline.",
			TargetRoute: "/(app)/subscriptions",
		})
	}

	if len(priorities) > 3 {
		priorities = priorities[:3]
	}

	return priorities
}

func buildAlerts(anomalyReport *AnomalyReport, budgets []model.Budget, subscriptions []model.Subscription, wealthOverview *model.WealthOverview) []model.CoAIAlert {
	alerts := make([]model.CoAIAlert, 0, 4)

	if anomalyReport != nil {
		for _, anomaly := range anomalyReport.Anomalies {
			alerts = append(alerts, model.CoAIAlert{
				ID:          "anomaly-" + anomaly.TransactionID,
				Type:        "spending_anomaly",
				Title:       "Unusual spending spotted",
				Description: anomaly.Message,
				Severity:    "warning",
				TargetRoute: "/(app)/(tabs)/reports?period=monthly",
			})
			if len(alerts) >= 2 {
				break
			}
		}
	}

	for _, budget := range budgets {
		if !budget.IsOverBudget() && !budget.IsNearLimit() {
			continue
		}
		severity := "info"
		title := "Budget getting tight"
		if budget.IsOverBudget() {
			severity = "warning"
			title = "Budget exceeded"
		}
		alerts = append(alerts, model.CoAIAlert{
			ID:          "budget-alert-" + budget.Category,
			Type:        "budget",
			Title:       title,
			Description: fmt.Sprintf("%s is at %.0f%% of plan.", budget.Category, budget.Progress()),
			Severity:    severity,
			TargetRoute: "/(app)/budgets",
		})
		break
	}

	for _, subscription := range subscriptions {
		if subscription.Status != "active" {
			continue
		}
		if time.Until(subscription.NextBillingDate).Hours() > 24*7 || time.Until(subscription.NextBillingDate).Hours() < 0 {
			continue
		}
		alerts = append(alerts, model.CoAIAlert{
			ID:          "subscription-" + subscription.ID.String(),
			Type:        "subscription",
			Title:       "Subscription renewing soon",
			Description: fmt.Sprintf("%s renews on %s.", subscription.Name, subscription.NextBillingDate.Format("Jan 2")),
			Severity:    "info",
			TargetRoute: "/(app)/subscriptions",
		})
		break
	}

	if wealthOverview != nil && wealthOverview.ErosionAmount > 0 {
		alerts = append(alerts, model.CoAIAlert{
			ID:          "wealth-erosion",
			Type:        "purchasing_power",
			Title:       "Purchasing power is slipping",
			Description: wealthOverview.Headline,
			Severity:    "warning",
			TargetRoute: "/(app)/real-value",
		})
	}

	if len(alerts) > 4 {
		alerts = alerts[:4]
	}

	return alerts
}
