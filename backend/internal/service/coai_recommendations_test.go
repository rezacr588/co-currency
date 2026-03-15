package service

import "testing"

func findRecommendedAction(actions []string, target string) bool {
	for _, action := range actions {
		if action == target {
			return true
		}
	}
	return false
}

func TestBuildRecommendedActions_PrioritizesGuidedSetupActions(t *testing.T) {
	actions := buildRecommendedActions(coaiActionContext{
		PreferredCurrency:  "eur",
		RecentTransactions: 4,
		MonthlyExpenses:    420,
		TopCategory:        "food",
		BalanceCurrencies:  []string{"EUR", "USD"},
	})

	if len(actions) != 4 {
		t.Fatalf("expected truncated action list of 4 items, got %d", len(actions))
	}

	gotTypes := []string{
		actions[0].Type,
		actions[1].Type,
		actions[2].Type,
		actions[3].Type,
	}

	if !findRecommendedAction(gotTypes, "log_transaction") {
		t.Fatalf("expected log_transaction action, got %#v", gotTypes)
	}
	if !findRecommendedAction(gotTypes, "convert_currency") {
		t.Fatalf("expected convert_currency action, got %#v", gotTypes)
	}
	if !findRecommendedAction(gotTypes, "create_budget") {
		t.Fatalf("expected create_budget action, got %#v", gotTypes)
	}
	if !findRecommendedAction(gotTypes, "create_goal") {
		t.Fatalf("expected create_goal action, got %#v", gotTypes)
	}

	if actions[0].Prefill["currency"] != "EUR" {
		t.Fatalf("expected preferred currency prefill to be uppercased EUR, got %#v", actions[0].Prefill["currency"])
	}
}

func TestBuildRecommendedActions_UsesFollowUpActionsWhenSetupExists(t *testing.T) {
	actions := buildRecommendedActions(coaiActionContext{
		PreferredCurrency:  "USD",
		RecentTransactions: 3,
		MonthlyExpenses:    200,
		TopCategory:        "subscriptions",
		HasBudgets:         true,
		HasGoals:           true,
		HasSubscriptions:   true,
	})

	if len(actions) != 3 {
		t.Fatalf("expected 3 actions, got %d", len(actions))
	}

	gotTypes := []string{
		actions[0].Type,
		actions[1].Type,
		actions[2].Type,
	}

	if !findRecommendedAction(gotTypes, "log_transaction") {
		t.Fatalf("expected log_transaction action, got %#v", gotTypes)
	}
	if !findRecommendedAction(gotTypes, "review_subscriptions") {
		t.Fatalf("expected review_subscriptions action, got %#v", gotTypes)
	}
	if !findRecommendedAction(gotTypes, "open_report_detail") {
		t.Fatalf("expected open_report_detail action, got %#v", gotTypes)
	}
}
