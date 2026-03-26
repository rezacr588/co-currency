package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// GetInsights generates AI-powered insights
func (s *ReportsService) GetInsights(ctx context.Context, userID uuid.UUID, currency string) (*model.InsightResponse, error) {
	if s.aiService == nil || !s.aiService.IsConfigured() {
		return nil, fmt.Errorf("AI service not configured")
	}

	forecast, err := s.GetForecast(ctx, userID, currency)
	if err != nil {
		return nil, err
	}

	return s.aiService.GetInsights(ctx, forecast)
}

// GetHealthScore calculates the user's financial health score
func (s *ReportsService) GetHealthScore(ctx context.Context, userID uuid.UUID, currency string) (*HealthScoreReport, error) {
	// Get current month's report
	now := ReportNowForContext(ctx)
	currentReport, err := s.GetMonthlyReport(ctx, userID, now.Year(), int(now.Month()), currency)
	if err != nil {
		return nil, err
	}

	// Get last month's report for trend calculation
	lastMonth := now.AddDate(0, -1, 0)
	lastMonthReport, _ := s.GetMonthlyReport(ctx, userID, lastMonth.Year(), int(lastMonth.Month()), currency)

	// Get forecast data
	forecast, _ := s.GetForecast(ctx, userID, currency)

	// Calculate components

	// 1. Budget Adherence (25% weight) - simplified: based on spending consistency
	budgetAdherence := 75.0 // Default score
	if currentReport.Expenses > 0 && currentReport.Income > 0 {
		spendingRatio := currentReport.Expenses / currentReport.Income
		if spendingRatio <= 0.5 {
			budgetAdherence = 100.0
		} else if spendingRatio <= 0.7 {
			budgetAdherence = 85.0
		} else if spendingRatio <= 0.9 {
			budgetAdherence = 70.0
		} else if spendingRatio <= 1.0 {
			budgetAdherence = 50.0
		} else {
			budgetAdherence = 25.0
		}
	}

	// 2. Savings Rate (25% weight)
	savingsRate := 0.0
	if currentReport.Income > 0 {
		savingsRate = currentReport.Savings
		if savingsRate < 0 {
			savingsRate = 0
		} else if savingsRate > 100 {
			savingsRate = 100
		}
	}

	// 3. Goal Progress (20% weight) - simplified based on net income
	goalProgress := 50.0 // Default
	if currentReport.Net > 0 {
		goalProgress = 80.0
	} else if currentReport.Net == 0 {
		goalProgress = 50.0
	} else {
		goalProgress = 30.0
	}

	// 4. Consistency (15% weight) - based on transaction frequency
	consistency := 50.0
	thirtyDaysAgo := now.AddDate(0, 0, -30)
	dayCount, err := s.walletRepo.CountActiveTransactionDays(ctx, userID, thirtyDaysAgo.UTC(), now.UTC(), ReportTimeZone(ctx))
	if err == nil && dayCount > 0 {
		if dayCount >= 20 {
			consistency = 100.0
		} else if dayCount >= 15 {
			consistency = 80.0
		} else if dayCount >= 10 {
			consistency = 60.0
		} else if dayCount >= 5 {
			consistency = 40.0
		} else {
			consistency = 20.0
		}
	}

	// 5. Bill Timing (15% weight) - based on cash flow
	billTiming := 70.0 // Default
	if forecast != nil && forecast.NetDailyFlow > 0 {
		billTiming = 90.0
	} else if forecast != nil && forecast.NetDailyFlow < 0 {
		billTiming = 40.0
	}

	// Calculate overall score (weighted average)
	overallScore := int(
		(budgetAdherence * 0.25) +
			(savingsRate * 0.25) +
			(goalProgress * 0.20) +
			(consistency * 0.15) +
			(billTiming * 0.15),
	)

	// Determine trend
	trend := "stable"
	if lastMonthReport != nil && currentReport.Income > 0 && lastMonthReport.Income > 0 {
		currentSavingsRate := (currentReport.Income - currentReport.Expenses) / currentReport.Income
		lastSavingsRate := (lastMonthReport.Income - lastMonthReport.Expenses) / lastMonthReport.Income
		diff := currentSavingsRate - lastSavingsRate
		if diff > 0.05 {
			trend = "improving"
		} else if diff < -0.05 {
			trend = "declining"
		}
	}

	// Generate tips based on components
	tips := []string{}
	if savingsRate < 20 {
		tips = append(tips, "Try to save at least 20% of your income each month")
	}
	if budgetAdherence < 70 {
		tips = append(tips, "Consider creating budgets to track spending by category")
	}
	if consistency < 60 {
		tips = append(tips, "Track transactions more regularly for better insights")
	}
	if billTiming < 60 {
		tips = append(tips, "Your spending exceeds income - review non-essential expenses")
	}
	if goalProgress < 50 {
		tips = append(tips, "Set financial goals to stay motivated")
	}

	// Limit to 3 tips
	if len(tips) > 3 {
		tips = tips[:3]
	}

	return &HealthScoreReport{
		Score: overallScore,
		Trend: trend,
		Components: HealthScoreComponents{
			BudgetAdherence: budgetAdherence,
			SavingsRate:     savingsRate,
			GoalProgress:    goalProgress,
			Consistency:     consistency,
			BillTiming:      billTiming,
		},
		Tips: tips,
	}, nil
}

// GetWeeklyRecap generates a weekly financial summary with AI insights
func (s *ReportsService) GetWeeklyRecap(ctx context.Context, userID uuid.UUID, currency string, referenceDate *time.Time) (*WeeklyRecapReport, error) {
	loc := ReportLocation(ctx)
	now := ReportNowForContext(ctx)
	if referenceDate != nil {
		now = referenceDate.In(loc)
	}

	// Calculate ISO 8601 week boundaries (Monday-Sunday)
	weekday := now.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	daysSinceMonday := int(weekday) - 1
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-daysSinceMonday, 0, 0, 0, 0, loc)
	weekEnd := weekStart.AddDate(0, 0, 7).Add(-time.Nanosecond)

	prevWeekStart := weekStart.AddDate(0, 0, -7)
	prevWeekEnd := weekStart.Add(-time.Nanosecond)

	currentTypeTotals, err := s.walletRepo.GetTypeTotalsByCurrency(ctx, userID, weekStart.UTC(), weekEnd.UTC())
	if err != nil {
		return nil, err
	}

	var thisWeekIncome, thisWeekExpenses float64
	rateCache := make(map[string]float64)
	for _, row := range currentTypeTotals {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			thisWeekIncome += amount
		case model.TransactionTypeDebit:
			thisWeekExpenses += amount
		}
	}

	categoryRows, err := s.walletRepo.GetCategoryTotalsByCurrency(ctx, userID, weekStart.UTC(), weekEnd.UTC())
	if err != nil {
		return nil, err
	}

	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)
	for _, row := range categoryRows {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		categoryTotals[row.Category] += amount
		categoryCounts[row.Category] += row.Count
	}

	var lastWeekExpenses float64
	previousTypeTotals, err := s.walletRepo.GetTypeTotalsByCurrency(ctx, userID, prevWeekStart.UTC(), prevWeekEnd.UTC())
	if err != nil {
		return nil, err
	}
	for _, row := range previousTypeTotals {
		if row.Type != model.TransactionTypeDebit {
			continue
		}
		lastWeekExpenses += s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
	}

	// Calculate percentage change
	comparedToLast := 0.0
	if lastWeekExpenses > 0 {
		comparedToLast = ((thisWeekExpenses - lastWeekExpenses) / lastWeekExpenses) * 100
	}

	// Build top categories
	topCategories := make([]CategoryBreakdown, 0)
	for cat, amount := range categoryTotals {
		percentage := 0.0
		if thisWeekExpenses > 0 {
			percentage = (amount / thisWeekExpenses) * 100
		}
		topCategories = append(topCategories, CategoryBreakdown{
			Category:   cat,
			Amount:     amount,
			Percentage: percentage,
			Count:      categoryCounts[cat],
		})
	}

	// Sort by amount (simple bubble sort for small slice)
	for i := 0; i < len(topCategories); i++ {
		for j := i + 1; j < len(topCategories); j++ {
			if topCategories[j].Amount > topCategories[i].Amount {
				topCategories[i], topCategories[j] = topCategories[j], topCategories[i]
			}
		}
	}

	// Limit to top 5
	if len(topCategories) > 5 {
		topCategories = topCategories[:5]
	}

	// Generate insights
	insights := []string{}
	netChange := thisWeekIncome - thisWeekExpenses

	if netChange > 0 {
		insights = append(insights, fmt.Sprintf("You saved %.0f%% of your income this week", (netChange/thisWeekIncome)*100))
	} else if netChange < 0 {
		insights = append(insights, "Your spending exceeded income this week")
	}

	if comparedToLast < -10 {
		insights = append(insights, fmt.Sprintf("Spending down %.0f%% from last week - great job!", -comparedToLast))
	} else if comparedToLast > 10 {
		insights = append(insights, fmt.Sprintf("Spending up %.0f%% from last week", comparedToLast))
	}

	if len(topCategories) > 0 {
		insights = append(insights, fmt.Sprintf("Top spending category: %s", topCategories[0].Category))
	}

	// Generate action items
	actionItems := []string{}
	if comparedToLast > 20 {
		actionItems = append(actionItems, "Review this week's expenses to identify areas to cut back")
	}
	if len(topCategories) > 0 && topCategories[0].Percentage > 40 {
		actionItems = append(actionItems, fmt.Sprintf("Consider setting a budget for %s", topCategories[0].Category))
	}
	if thisWeekExpenses > thisWeekIncome {
		actionItems = append(actionItems, "Focus on increasing income or reducing expenses")
	}

	return &WeeklyRecapReport{
		WeekStart:      reportDateStringInLocation(weekStart, loc),
		WeekEnd:        reportDateStringInLocation(weekEnd, loc),
		TotalSpent:     thisWeekExpenses,
		TotalIncome:    thisWeekIncome,
		NetChange:      netChange,
		TopCategories:  topCategories,
		ComparedToLast: comparedToLast,
		Insights:       insights,
		ActionItems:    actionItems,
		Currency:       currency,
		GeneratedAt:    now,
	}, nil
}
