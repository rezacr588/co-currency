package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// GetCategoryReport generates a category-wise spending report
func (s *ReportsService) GetCategoryReport(ctx context.Context, userID uuid.UUID, fromDate, toDate, currency string) (*CategoryReport, error) {
	startDate, endDate, err := parseISODateRange(ctx, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	categoryRows, err := s.walletRepo.GetCategoryTotalsByCurrency(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("getting category totals: %w", err)
	}

	categoryMap := make(map[string]CategoryBreakdown)
	rateCache := make(map[string]float64)
	var total float64

	for _, row := range categoryRows {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		entry := categoryMap[row.Category]
		entry.Category = row.Category
		entry.Amount += amount
		entry.Count += row.Count
		categoryMap[row.Category] = entry
		total += amount
	}

	categories := make([]CategoryBreakdown, 0, len(categoryMap))
	for _, entry := range categoryMap {
		percentage := 0.0
		if total > 0 {
			percentage = (entry.Amount / total) * 100
		}
		entry.Percentage = percentage
		categories = append(categories, entry)
	}

	// Sort categories by amount descending
	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Amount > categories[j].Amount
	})

	return &CategoryReport{
		FromDate:   fromDate,
		ToDate:     toDate,
		Currency:   currency,
		Total:      total,
		Categories: categories,
	}, nil
}

// GetTrendsReport generates income/expense trends over time
func (s *ReportsService) GetTrendsReport(ctx context.Context, userID uuid.UUID, months int, currency string) (*TrendsReport, error) {
	if months <= 0 {
		months = 1
	}
	loc := ReportLocation(ctx)
	now := ReportNowForContext(ctx)
	trends := make([]TrendData, months)

	// Calculate full date range for all months
	currentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	rangeStart := currentMonth.AddDate(0, -(months - 1), 0)
	rangeEnd := currentMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

	monthlyRows, err := s.walletRepo.GetMonthlyTypeTotalsByCurrency(ctx, userID, rangeStart.UTC(), rangeEnd.UTC(), ReportTimeZone(ctx))
	if err != nil {
		return nil, fmt.Errorf("getting monthly transaction totals: %w", err)
	}

	monthIndex := make(map[string]int, months)
	for i := 0; i < months; i++ {
		monthStart := rangeStart.AddDate(0, i, 0)
		period := monthStart.Format("2006-01")
		monthIndex[period] = i
		trends[i] = TrendData{Period: period}
	}

	rateCache := make(map[string]float64)
	for _, row := range monthlyRows {
		period := row.Period.Format("2006-01")
		idx, ok := monthIndex[period]
		if !ok {
			continue
		}
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			trends[idx].Income += amount
		case model.TransactionTypeDebit:
			trends[idx].Expenses += amount
		}
	}

	for i := range trends {
		trends[i].Net = trends[i].Income - trends[i].Expenses
	}

	return &TrendsReport{
		Currency: currency,
		Months:   months,
		Trends:   trends,
	}, nil
}

// GetNetWorthReport generates a net worth summary
func (s *ReportsService) GetNetWorthReport(ctx context.Context, userID uuid.UUID, currency string) (*NetWorthReport, error) {
	// Get all balances
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting balances: %w", err)
	}

	var totalBalance float64
	balanceBreakdowns := make([]BalanceBreakdown, 0, len(balances))

	for _, b := range balances {
		if b.Balance == 0 {
			continue
		}

		balanceInBase := b.Balance
		if b.Currency != currency {
			conversion, err := s.exchangeService.Convert(ctx, b.Currency, currency, b.Balance)
			if err == nil {
				balanceInBase = conversion.Result
			}
		}

		totalBalance += balanceInBase
		balanceBreakdowns = append(balanceBreakdowns, BalanceBreakdown{
			Currency:      b.Currency,
			Balance:       b.Balance,
			BalanceInBase: balanceInBase,
		})
	}

	// Calculate percentages
	for i := range balanceBreakdowns {
		if totalBalance > 0 {
			balanceBreakdowns[i].Percentage = (balanceBreakdowns[i].BalanceInBase / totalBalance) * 100
		}
	}

	return &NetWorthReport{
		Currency:     currency,
		TotalBalance: totalBalance,
		Balances:     balanceBreakdowns,
	}, nil
}

// GetForecast generates financial projections based on recent activity (last 30 days)
func (s *ReportsService) GetForecast(ctx context.Context, userID uuid.UUID, currency string) (*ForecastReport, error) {
	// 1. Get current total balance in target currency
	nw, err := s.GetNetWorthReport(ctx, userID, currency)
	if err != nil {
		return nil, err
	}

	// 2. Get last 30 days of transactions
	endDate := ReportNowForContext(ctx)
	startDate := endDate.AddDate(0, 0, -30)

	totals, err := s.walletRepo.GetTypeTotalsByCurrency(ctx, userID, startDate.UTC(), endDate.UTC())
	if err != nil {
		return nil, fmt.Errorf("getting forecast transaction totals: %w", err)
	}

	var totalIncome, totalExpenses float64
	rateCache := make(map[string]float64)
	for _, row := range totals {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		if row.Type == model.TransactionTypeCredit {
			totalIncome += amount
		} else if row.Type == model.TransactionTypeDebit {
			totalExpenses += amount
		}
	}

	// 3. Calculate averages using full elapsed days in range
	daysDivisor := 30.0
	avgDailySpend := totalExpenses / daysDivisor
	avgDailyIncome := totalIncome / daysDivisor
	netDailyFlow := avgDailyIncome - avgDailySpend

	daysUntilZero := -1
	var estimatedZeroDate *time.Time

	if netDailyFlow < 0 && nw.TotalBalance > 0 {
		// Calculate how many days until balance reaches zero
		daysUntilZero = int(nw.TotalBalance / (-netDailyFlow))
		zeroDate := reportDayStartForContext(ctx, endDate).AddDate(0, 0, daysUntilZero)
		estimatedZeroDate = &zeroDate
	}

	return &ForecastReport{
		Currency:          currency,
		CurrentBalance:    nw.TotalBalance,
		AvgDailySpend:     avgDailySpend,
		AvgDailyIncome:    avgDailyIncome,
		NetDailyFlow:      netDailyFlow,
		DaysUntilZero:     daysUntilZero,
		EstimatedZeroDate: estimatedZeroDate,
	}, nil
}
