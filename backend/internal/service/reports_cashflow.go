package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// GetCashFlowProjection generates a day-by-day cash flow projection
func (s *ReportsService) GetCashFlowProjection(ctx context.Context, userID uuid.UUID, currency string, days int) (*CashFlowReport, error) {
	if days <= 0 {
		days = 30
	}
	if days > 90 {
		days = 90
	}

	// 1. Get current balance
	nw, err := s.GetNetWorthReport(ctx, userID, currency)
	if err != nil {
		return nil, fmt.Errorf("getting net worth: %w", err)
	}
	currentBalance := nw.TotalBalance

	// 2. Fetch recurring transactions
	var recurringTxs []model.RecurringTransaction
	if s.recurringRepo != nil {
		recurringTxs, err = s.recurringRepo.GetByUser(ctx, userID)
		if err != nil {
			recurringTxs = nil // graceful fallback
		}
	}

	// 3. Fetch active subscriptions
	var subscriptions []model.Subscription
	if s.subscriptionRepo != nil {
		subscriptions, err = s.subscriptionRepo.GetSubscriptions(ctx, userID)
		if err != nil {
			subscriptions = nil
		}
	}
	// Filter to active only
	var activeSubs []model.Subscription
	for _, sub := range subscriptions {
		if sub.Status == "active" {
			activeSubs = append(activeSubs, sub)
		}
	}

	// 4. Get last 90 days of transactions for historical averages
	now := time.Now()
	histStart := now.AddDate(0, 0, -90)
	filter := &model.TransactionFilter{
		FromDate: histStart.Format("2006-01-02"),
		ToDate:   now.Format("2006-01-02"),
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	// Calculate daily averages by day-of-week (0=Sunday..6=Saturday)
	// Only count non-recurring/non-subscription transactions for the baseline
	// to avoid double-counting known scheduled amounts
	dayIncome := [7]float64{}
	dayExpense := [7]float64{}

	// Pre-compute which transactions are from recurring/subscription sources
	// (source field is "manual" or "ai_receipt" for user-created, recurring executions have specific descriptions)
	for _, tx := range transactions {
		amount := tx.Amount
		if tx.Currency != currency {
			conversion, convErr := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if convErr == nil {
				amount = conversion.Result
			}
		}
		wd := int(tx.CreatedAt.Weekday())
		if tx.Type == "credit" {
			dayIncome[wd] += amount
		} else if tx.Type == "debit" {
			dayExpense[wd] += amount
		}
	}

	// Average per weekday (over ~13 weeks)
	weeks := float64(90) / 7.0
	avgDayIncome := [7]float64{}
	avgDayExpense := [7]float64{}
	for i := 0; i < 7; i++ {
		if weeks > 0 {
			avgDayIncome[i] = dayIncome[i] / weeks
			avgDayExpense[i] = dayExpense[i] / weeks
		}
	}

	// Estimate how much of the historical average is from known recurring/subscription sources
	// and subtract it so we only use the historical baseline for non-scheduled spending
	for _, rec := range recurringTxs {
		if !rec.IsActive {
			continue
		}
		recAmount := rec.Amount
		if rec.Currency != currency {
			conversion, convErr := s.exchangeService.Convert(ctx, rec.Currency, currency, rec.Amount)
			if convErr == nil {
				recAmount = conversion.Result
			}
		}
		switch rec.Frequency {
		case "daily":
			// Daily recurring contributes to every weekday
			for wd := 0; wd < 7; wd++ {
				if rec.Type == "credit" {
					avgDayIncome[wd] = math.Max(0, avgDayIncome[wd]-recAmount)
				} else {
					avgDayExpense[wd] = math.Max(0, avgDayExpense[wd]-recAmount)
				}
			}
		case "weekly":
			wd := int(rec.NextExecution.Weekday())
			if rec.Type == "credit" {
				avgDayIncome[wd] = math.Max(0, avgDayIncome[wd]-recAmount)
			} else {
				avgDayExpense[wd] = math.Max(0, avgDayExpense[wd]-recAmount)
			}
		case "monthly":
			// Monthly recurrings spread ~1/4.3 per weekday occurrence
			perWeekday := recAmount / (30.0 / 7.0)
			for wd := 0; wd < 7; wd++ {
				if rec.Type == "credit" {
					avgDayIncome[wd] = math.Max(0, avgDayIncome[wd]-perWeekday/7.0)
				} else {
					avgDayExpense[wd] = math.Max(0, avgDayExpense[wd]-perWeekday/7.0)
				}
			}
		}
	}
	for _, sub := range activeSubs {
		subAmount := sub.Amount
		if sub.Currency != currency {
			conversion, convErr := s.exchangeService.Convert(ctx, sub.Currency, currency, sub.Amount)
			if convErr == nil {
				subAmount = conversion.Result
			}
		}
		// Spread subscription cost across weekdays based on billing frequency
		var dailyEquivalent float64
		switch sub.BillingCycle {
		case "weekly":
			dailyEquivalent = subAmount / 7.0
		case "monthly":
			dailyEquivalent = subAmount / 30.0
		case "quarterly":
			dailyEquivalent = subAmount / 90.0
		case "yearly":
			dailyEquivalent = subAmount / 365.0
		}
		for wd := 0; wd < 7; wd++ {
			avgDayExpense[wd] = math.Max(0, avgDayExpense[wd]-dailyEquivalent)
		}
	}

	// 5. Build day-by-day projection
	projections := make([]CashFlowProjection, days)
	balance := currentBalance
	lowestBalance := currentBalance
	lowestDate := now.Format("2006-01-02")
	var dangerDate *string
	dangerZone := false

	var totalExpectedIncome, totalExpectedExpenses float64
	var totalRecurringIncome, totalRecurringExpense, totalSubscriptionCost float64

	for i := 0; i < days; i++ {
		day := now.AddDate(0, 0, i+1)
		dayStr := day.Format("2006-01-02")
		wd := int(day.Weekday())

		var dailyIncome, dailyExpense float64
		var events []CashFlowEvent

		// Add historical average as baseline
		histInc := avgDayIncome[wd]
		histExp := avgDayExpense[wd]

		// Check recurring transactions for this day
		for _, rec := range recurringTxs {
			if !rec.IsActive {
				continue
			}
			recAmount := rec.Amount
			if rec.Currency != currency {
				conversion, convErr := s.exchangeService.Convert(ctx, rec.Currency, currency, rec.Amount)
				if convErr == nil {
					recAmount = conversion.Result
				}
			}

			if matchesRecurringDate(rec, day) {
				desc := rec.Description
				if desc == "" {
					desc = rec.Category
				}
				if desc == "" {
					desc = "Recurring " + rec.Type
				}
				events = append(events, CashFlowEvent{
					Type:        "recurring",
					Description: desc,
					Amount:      recAmount,
					Category:    rec.Category,
				})
				if rec.Type == "credit" {
					dailyIncome += recAmount
					totalRecurringIncome += recAmount
				} else {
					dailyExpense += recAmount
					totalRecurringExpense += recAmount
				}
			}
		}

		// Check subscriptions for this day
		for _, sub := range activeSubs {
			subAmount := sub.Amount
			if sub.Currency != currency {
				conversion, convErr := s.exchangeService.Convert(ctx, sub.Currency, currency, sub.Amount)
				if convErr == nil {
					subAmount = conversion.Result
				}
			}

			if matchesSubscriptionDate(sub, day) {
				events = append(events, CashFlowEvent{
					Type:        "subscription",
					Description: sub.Name,
					Amount:      subAmount,
					Category:    sub.Category,
				})
				dailyExpense += subAmount
				totalSubscriptionCost += subAmount
			}
		}

		// Add historical average (non-recurring baseline)
		dailyIncome += histInc
		dailyExpense += histExp

		totalExpectedIncome += dailyIncome
		totalExpectedExpenses += dailyExpense

		balance = balance + dailyIncome - dailyExpense

		if balance < lowestBalance {
			lowestBalance = balance
			lowestDate = dayStr
		}
		if balance < 0 && !dangerZone {
			dangerZone = true
			d := dayStr
			dangerDate = &d
		}

		projections[i] = CashFlowProjection{
			Date:    dayStr,
			Balance: math.Round(balance*100) / 100,
			Income:  math.Round(dailyIncome*100) / 100,
			Expense: math.Round(dailyExpense*100) / 100,
			Events:  events,
		}
	}

	return &CashFlowReport{
		Currency:       currency,
		CurrentBalance: currentBalance,
		Projections:    projections,
		DaysProjected:  days,
		LowestBalance:  math.Round(lowestBalance*100) / 100,
		LowestDate:     lowestDate,
		DangerZone:     dangerZone,
		DangerDate:     dangerDate,
		Summary: CashFlowSummary{
			ExpectedIncome:   math.Round(totalExpectedIncome*100) / 100,
			ExpectedExpenses: math.Round(totalExpectedExpenses*100) / 100,
			NetProjected:     math.Round((totalExpectedIncome-totalExpectedExpenses)*100) / 100,
			RecurringIncome:  math.Round(totalRecurringIncome*100) / 100,
			RecurringExpense: math.Round(totalRecurringExpense*100) / 100,
			SubscriptionCost: math.Round(totalSubscriptionCost*100) / 100,
		},
	}, nil
}

// matchesRecurringDate checks if a recurring transaction falls on the given day
func matchesRecurringDate(rec model.RecurringTransaction, day time.Time) bool {
	next := rec.NextExecution
	switch rec.Frequency {
	case "daily":
		return true
	case "weekly":
		return next.Weekday() == day.Weekday()
	case "monthly":
		return matchesDayOfMonth(next.Day(), day)
	case "yearly":
		return matchesDayOfMonth(next.Day(), day) && next.Month() == day.Month()
	}
	return false
}

// matchesSubscriptionDate checks if a subscription billing falls on the given day
func matchesSubscriptionDate(sub model.Subscription, day time.Time) bool {
	billingDay := sub.NextBillingDate.Day()
	switch sub.BillingCycle {
	case "weekly":
		return sub.NextBillingDate.Weekday() == day.Weekday()
	case "monthly":
		return matchesDayOfMonth(billingDay, day)
	case "quarterly":
		monthDiff := (int(day.Month()) - int(sub.NextBillingDate.Month()) + 12) % 12
		return matchesDayOfMonth(billingDay, day) && monthDiff%3 == 0
	case "yearly":
		return matchesDayOfMonth(billingDay, day) && sub.NextBillingDate.Month() == day.Month()
	}
	return false
}

// matchesDayOfMonth checks if a target day-of-month matches the given date,
// clamping to the last day of the month for days like 29, 30, 31
func matchesDayOfMonth(targetDay int, day time.Time) bool {
	lastDay := time.Date(day.Year(), day.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if targetDay > lastDay {
		return day.Day() == lastDay
	}
	return day.Day() == targetDay
}

// GetSpendingAnomalies detects unusual spending patterns
func (s *ReportsService) GetSpendingAnomalies(ctx context.Context, userID uuid.UUID, currency string) (*AnomalyReport, error) {
	now := time.Now()
	startDate := now.AddDate(0, 0, -90)

	filter := &model.TransactionFilter{
		FromDate: startDate.Format("2006-01-02"),
		ToDate:   now.Format("2006-01-02"),
		Type:     "debit",
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	// Group by category and calculate stats
	// Convert all amounts once and cache them
	type convertedTx struct {
		tx       model.Transaction
		amount   float64
		category string
	}
	convertedTxs := make([]convertedTx, 0, len(transactions))
	for _, tx := range transactions {
		amount := tx.Amount
		if tx.Currency != currency {
			conversion, convErr := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if convErr == nil {
				amount = conversion.Result
			}
		}
		cat := tx.Category
		if cat == "" {
			cat = "other"
		}
		convertedTxs = append(convertedTxs, convertedTx{tx: tx, amount: amount, category: cat})
	}

	// Group by category and calculate stats
	type categoryStats struct {
		amounts []float64
		sum     float64
	}
	categoryData := make(map[string]*categoryStats)
	for _, ct := range convertedTxs {
		if categoryData[ct.category] == nil {
			categoryData[ct.category] = &categoryStats{}
		}
		categoryData[ct.category].amounts = append(categoryData[ct.category].amounts, ct.amount)
		categoryData[ct.category].sum += ct.amount
	}

	// Calculate mean and stddev per category
	type catAnalysis struct {
		mean   float64
		stddev float64
	}
	analyses := make(map[string]catAnalysis)
	for cat, stats := range categoryData {
		n := float64(len(stats.amounts))
		if n < 3 {
			continue // Need at least 3 data points
		}
		mean := stats.sum / n

		var variance float64
		for _, a := range stats.amounts {
			diff := a - mean
			variance += diff * diff
		}
		variance /= (n - 1) // sample variance (Bessel's correction)
		stddev := math.Sqrt(variance)

		analyses[cat] = catAnalysis{mean: mean, stddev: stddev}
	}

	// Check transactions from last 7 days for anomalies
	sevenDaysAgo := now.AddDate(0, 0, -7)
	anomalies := make([]SpendingAnomaly, 0)

	for _, ct := range convertedTxs {
		if ct.tx.CreatedAt.Before(sevenDaysAgo) {
			continue
		}

		analysis, ok := analyses[ct.category]
		if !ok || analysis.stddev == 0 {
			continue
		}

		threshold := analysis.mean + 2*analysis.stddev
		if ct.amount > threshold {
			deviation := ct.amount / analysis.mean
			desc := ct.tx.Description
			if desc == "" {
				desc = ct.category
			}

			anomalies = append(anomalies, SpendingAnomaly{
				TransactionID: ct.tx.ID.String(),
				Description:   desc,
				Amount:        math.Round(ct.amount*100) / 100,
				Currency:      currency,
				Category:      ct.category,
				Date:          ct.tx.CreatedAt.Format("2006-01-02"),
				AverageAmount: math.Round(analysis.mean*100) / 100,
				Deviation:     math.Round(deviation*10) / 10,
				Message:       fmt.Sprintf("Your %s spend of %.2f is %.1fx your average", ct.category, ct.amount, deviation),
			})
		}
	}

	// Sort by deviation (most anomalous first) and limit to 5
	sort.Slice(anomalies, func(i, j int) bool {
		return anomalies[i].Deviation > anomalies[j].Deviation
	})
	if len(anomalies) > 5 {
		anomalies = anomalies[:5]
	}

	return &AnomalyReport{
		Anomalies: anomalies,
		Period:    "last_7_days",
		Currency:  currency,
	}, nil
}
