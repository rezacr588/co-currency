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
	loc := ReportLocation(ctx)
	now := ReportNowForContext(ctx)
	histStart := now.AddDate(0, 0, -90)
	weekdayRows, err := s.walletRepo.GetWeekdayTypeTotalsByCurrency(ctx, userID, histStart.UTC(), now.UTC(), ReportTimeZone(ctx))
	if err != nil {
		return nil, fmt.Errorf("getting weekday transaction totals: %w", err)
	}

	// Calculate daily averages by day-of-week (0=Sunday..6=Saturday)
	dayIncome := [7]float64{}
	dayExpense := [7]float64{}
	rateCache := make(map[string]float64)
	for _, row := range weekdayRows {
		if row.Weekday < 0 || row.Weekday > 6 {
			continue
		}
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			dayIncome[row.Weekday] += amount
		case model.TransactionTypeDebit:
			dayExpense[row.Weekday] += amount
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
		recAmount := s.convertAmountWithRateCache(ctx, rec.Amount, rec.Currency, currency, rateCache)
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
			wd := int(reportWeekdayInLocation(rec.NextExecution, loc))
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
		subAmount := s.convertAmountWithRateCache(ctx, sub.Amount, sub.Currency, currency, rateCache)
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
	projectionStart := reportDayStartInLocation(now, loc)
	lowestDate := reportDateStringInLocation(projectionStart, loc)
	var dangerDate *string
	dangerZone := false

	var totalExpectedIncome, totalExpectedExpenses float64
	var totalRecurringIncome, totalRecurringExpense, totalSubscriptionCost float64

	for i := 0; i < days; i++ {
		day := projectionStart.AddDate(0, 0, i+1)
		dayStr := reportDateStringInLocation(day, loc)
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
			recAmount := s.convertAmountWithRateCache(ctx, rec.Amount, rec.Currency, currency, rateCache)

			if matchesRecurringDate(rec, day, loc) {
				desc := rec.Description
				if desc == "" {
					desc = rec.Category
				}
				if desc == "" {
					desc = "Recurring " + rec.Type
				}
				events = append(events, CashFlowEvent{
					Type:        "recurring",
					Direction:   rec.Type,
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
			subAmount := s.convertAmountWithRateCache(ctx, sub.Amount, sub.Currency, currency, rateCache)

			if matchesSubscriptionDate(sub, day, loc) {
				events = append(events, CashFlowEvent{
					Type:        "subscription",
					Direction:   "debit",
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
func matchesRecurringDate(rec model.RecurringTransaction, day time.Time, locs ...*time.Location) bool {
	loc := reportsLocation
	if len(locs) > 0 && locs[0] != nil {
		loc = locs[0]
	}

	next := reportDayStartInLocation(rec.NextExecution, loc)
	day = reportDayStartInLocation(day, loc)
	if day.Before(next) {
		return false
	}
	switch rec.Frequency {
	case "daily":
		return reportDayDiffInLocation(next, day, loc) >= 0
	case "weekly":
		return reportDayDiffInLocation(next, day, loc)%7 == 0
	case "monthly":
		return reportMonthDiffInLocation(next, day, loc) >= 0 && matchesDayOfMonth(next.Day(), day)
	case "yearly":
		return day.In(loc).Year() >= next.In(loc).Year() &&
			matchesDayOfMonth(next.Day(), day) &&
			next.In(loc).Month() == day.In(loc).Month()
	}
	return false
}

// matchesSubscriptionDate checks if a subscription billing falls on the given day
func matchesSubscriptionDate(sub model.Subscription, day time.Time, locs ...*time.Location) bool {
	loc := reportsLocation
	if len(locs) > 0 && locs[0] != nil {
		loc = locs[0]
	}

	nextBilling := reportDayStartInLocation(sub.NextBillingDate, loc)
	day = reportDayStartInLocation(day, loc)
	if day.Before(nextBilling) {
		return false
	}

	billingDay := nextBilling.Day()
	switch sub.BillingCycle {
	case "weekly":
		return reportDayDiffInLocation(nextBilling, day, loc)%7 == 0
	case "monthly":
		return matchesDayOfMonth(billingDay, day)
	case "quarterly":
		monthDiff := reportMonthDiffInLocation(nextBilling, day, loc)
		return matchesDayOfMonth(billingDay, day) && monthDiff%3 == 0
	case "yearly":
		return day.In(loc).Year() >= nextBilling.In(loc).Year() &&
			matchesDayOfMonth(billingDay, day) &&
			nextBilling.In(loc).Month() == day.In(loc).Month()
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
	loc := ReportLocation(ctx)
	now := ReportNowForContext(ctx)
	baselineStart := now.AddDate(0, 0, -90)
	recentStart := now.AddDate(0, 0, -7)

	statsRows, err := s.walletRepo.GetCategorySpendingStatsByCurrency(ctx, userID, baselineStart.UTC(), now.UTC())
	if err != nil {
		return nil, fmt.Errorf("getting category spending stats: %w", err)
	}

	recentTransactions, err := s.walletRepo.GetRecentDebitTransactions(ctx, userID, recentStart.UTC(), now.UTC())
	if err != nil {
		return nil, fmt.Errorf("getting recent debit transactions: %w", err)
	}

	type categoryStats struct {
		count      int
		sum        float64
		sumSquares float64
	}
	rateCache := make(map[string]float64)
	categoryData := make(map[string]*categoryStats)
	for _, row := range statsRows {
		entry := categoryData[row.Category]
		if entry == nil {
			entry = &categoryStats{}
			categoryData[row.Category] = entry
		}
		factor := s.convertAmountWithRateCache(ctx, 1, row.Currency, currency, rateCache)
		entry.count += row.Count
		entry.sum += s.convertAmountWithRateCache(ctx, row.Sum, row.Currency, currency, rateCache)
		entry.sumSquares += row.SumSquares * factor * factor
	}

	// Calculate mean and stddev per category
	type catAnalysis struct {
		mean   float64
		stddev float64
	}
	analyses := make(map[string]catAnalysis)
	for cat, stats := range categoryData {
		n := float64(stats.count)
		if n < 3 {
			continue // Need at least 3 data points
		}
		mean := stats.sum / n
		varianceNumerator := stats.sumSquares - ((stats.sum * stats.sum) / n)
		if varianceNumerator < 0 {
			varianceNumerator = 0
		}
		variance := varianceNumerator / (n - 1) // sample variance (Bessel's correction)
		stddev := math.Sqrt(variance)

		analyses[cat] = catAnalysis{mean: mean, stddev: stddev}
	}

	anomalies := make([]SpendingAnomaly, 0)

	for _, tx := range recentTransactions {
		analysis, ok := analyses[tx.Category]
		if !ok || analysis.stddev == 0 {
			continue
		}

		amount := s.convertAmountWithRateCache(ctx, tx.Amount, tx.Currency, currency, rateCache)
		threshold := analysis.mean + 2*analysis.stddev
		if amount > threshold {
			deviation := amount / analysis.mean
			desc := tx.Description
			if desc == "" {
				desc = tx.Category
			}

			anomalies = append(anomalies, SpendingAnomaly{
				TransactionID: tx.ID.String(),
				Description:   desc,
				Amount:        math.Round(amount*100) / 100,
				Currency:      currency,
				Category:      tx.Category,
				Date:          reportDateStringInLocation(tx.CreatedAt, loc),
				AverageAmount: math.Round(analysis.mean*100) / 100,
				Deviation:     math.Round(deviation*10) / 10,
				Message:       fmt.Sprintf("Your %s spend of %.2f is %.1fx your average", tx.Category, amount, deviation),
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
