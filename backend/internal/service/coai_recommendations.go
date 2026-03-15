package service

import (
	"fmt"
	"math"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
)

type coaiActionContext struct {
	PreferredCurrency  string
	RecentTransactions int
	MonthlyExpenses    float64
	TopCategory        string
	BalanceCurrencies  []string
	HasBudgets         bool
	HasGoals           bool
	HasSubscriptions   bool
}

func buildRecommendedActions(ctx coaiActionContext) []model.RecommendedAction {
	currency := strings.ToUpper(strings.TrimSpace(ctx.PreferredCurrency))
	if currency == "" {
		currency = "USD"
	}

	actions := make([]model.RecommendedAction, 0, 5)

	actions = append(actions, model.RecommendedAction{
		ID:          "log-transaction",
		Type:        "log_transaction",
		Title:       "Log a transaction",
		Description: "Capture your next expense or income so CoAI has fresh context.",
		CTALabel:    "Add transaction",
		TargetRoute: "/transaction-create",
		Prefill: map[string]interface{}{
			"type":     "debit",
			"currency": currency,
		},
		RequiresConfirmation: true,
	})

	if len(ctx.BalanceCurrencies) >= 2 {
		actions = append(actions, model.RecommendedAction{
			ID:          "convert-currency",
			Type:        "convert_currency",
			Title:       "Convert currency",
			Description: "Move money between wallet currencies with a guided confirmation step.",
			CTALabel:    "Open converter",
			TargetRoute: "/(app)/(tabs)/wallet/convert",
			Prefill: map[string]interface{}{
				"amount": ctx.defaultConvertAmount(),
				"from":   ctx.BalanceCurrencies[0],
				"to":     ctx.BalanceCurrencies[1],
			},
			RequiresConfirmation: true,
		})
	}

	if !ctx.HasBudgets {
		category := ctx.normalizedTopCategory()
		actions = append(actions, model.RecommendedAction{
			ID:          "create-budget",
			Type:        "create_budget",
			Title:       "Create a budget",
			Description: "Turn your recent spending into a monthly guardrail.",
			CTALabel:    "Start budget",
			TargetRoute: "/(app)/budgets",
			Prefill: map[string]interface{}{
				"category":  category,
				"amount":    ctx.suggestedBudgetAmount(),
				"currency":  currency,
				"period":    "monthly",
				"open_form": "1",
			},
			RequiresConfirmation: true,
		})
	}

	if !ctx.HasGoals {
		actions = append(actions, model.RecommendedAction{
			ID:          "create-goal",
			Type:        "create_goal",
			Title:       "Create a savings goal",
			Description: "Give CoAI a target so it can keep your plan moving.",
			CTALabel:    "Create goal",
			TargetRoute: "/(app)/(tabs)/goals",
			Prefill: map[string]interface{}{
				"name":          "Emergency Fund",
				"target_amount": ctx.suggestedGoalAmount(),
				"currency":      currency,
				"category":      "emergency_fund",
				"open_form":     "1",
			},
			RequiresConfirmation: true,
		})
	}

	if ctx.HasSubscriptions {
		actions = append(actions, model.RecommendedAction{
			ID:                   "review-subscriptions",
			Type:                 "review_subscriptions",
			Title:                "Review subscriptions",
			Description:          "Check recurring services before they quietly raise your baseline spend.",
			CTALabel:             "Review subscriptions",
			TargetRoute:          "/(app)/subscriptions",
			RequiresConfirmation: true,
		})
	}

	if ctx.RecentTransactions > 0 {
		actions = append(actions, model.RecommendedAction{
			ID:                   "open-report-detail",
			Type:                 "open_report_detail",
			Title:                "Open report detail",
			Description:          "See the monthly trends behind CoAI's recommendations.",
			CTALabel:             "Open reports",
			TargetRoute:          "/(app)/(tabs)/reports",
			Prefill:              map[string]interface{}{"period": "monthly"},
			RequiresConfirmation: true,
		})
	}

	if len(actions) > 4 {
		actions = actions[:4]
	}

	return actions
}

func buildRecommendedActionsFromFinancialContext(fctx *model.FinancialContext, hasSubscriptions bool) []model.RecommendedAction {
	if fctx == nil {
		return buildRecommendedActions(coaiActionContext{PreferredCurrency: "USD"})
	}

	balanceCurrencies := make([]string, 0, len(fctx.Balances))
	for _, balance := range fctx.Balances {
		if strings.TrimSpace(balance.Currency) == "" {
			continue
		}
		balanceCurrencies = append(balanceCurrencies, strings.ToUpper(balance.Currency))
	}

	topCategory := ""
	if len(fctx.TopCategories) > 0 {
		topCategory = fctx.TopCategories[0].Category
	}

	return buildRecommendedActions(coaiActionContext{
		PreferredCurrency:  fctx.PreferredCurrency,
		RecentTransactions: fctx.RecentTransactions,
		MonthlyExpenses:    fctx.MonthlyExpenses,
		TopCategory:        topCategory,
		BalanceCurrencies:  balanceCurrencies,
		HasBudgets:         len(fctx.ActiveBudgets) > 0,
		HasGoals:           len(fctx.SavingsGoals) > 0,
		HasSubscriptions:   hasSubscriptions,
	})
}

func (c coaiActionContext) normalizedTopCategory() string {
	category := strings.TrimSpace(strings.ToLower(c.TopCategory))
	if category == "" {
		return "food"
	}
	return category
}

func (c coaiActionContext) suggestedBudgetAmount() int {
	base := c.MonthlyExpenses * 0.25
	if base < 100 {
		base = 100
	}
	return int(math.Ceil(base/25.0) * 25)
}

func (c coaiActionContext) suggestedGoalAmount() int {
	base := c.MonthlyExpenses * 3
	if base < 1000 {
		base = 1000
	}
	return int(math.Ceil(base/100.0) * 100)
}

func (c coaiActionContext) defaultConvertAmount() string {
	amount := 100.0
	if c.MonthlyExpenses > 0 {
		amount = math.Min(250, math.Max(50, c.MonthlyExpenses/10))
	}
	return fmt.Sprintf("%.0f", amount)
}
