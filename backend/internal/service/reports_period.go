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

// GetMonthlyReport generates a monthly financial summary
func (s *ReportsService) GetMonthlyReport(ctx context.Context, userID uuid.UUID, year, month int, currency string) (*MonthlyReport, error) {
	startDate, endDate := reportMonthBoundsForContext(ctx, year, time.Month(month))

	var income, expenses float64
	rateCache := make(map[string]float64)

	typeTotals, err := s.walletRepo.GetTypeTotalsByCurrency(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("getting transaction type totals: %w", err)
	}
	for _, row := range typeTotals {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			income += amount
		case model.TransactionTypeDebit:
			expenses += amount
		}
	}

	categoryRows, err := s.walletRepo.GetCategoryTotalsByCurrency(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("getting category totals: %w", err)
	}
	categoryMap := make(map[string]CategoryBreakdown)
	for _, row := range categoryRows {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		entry := categoryMap[row.Category]
		entry.Category = row.Category
		entry.Amount += amount
		entry.Count += row.Count
		categoryMap[row.Category] = entry
	}

	net := income - expenses
	savingsRate := 0.0
	if income > 0 {
		savingsRate = (net / income) * 100
	}

	categories := make([]CategoryBreakdown, 0, len(categoryMap))
	for _, entry := range categoryMap {
		percentage := 0.0
		if expenses > 0 {
			percentage = (entry.Amount / expenses) * 100
		}
		entry.Percentage = percentage
		categories = append(categories, entry)
	}

	// Sort categories by amount descending
	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Amount > categories[j].Amount
	})

	return &MonthlyReport{
		Year:       year,
		Month:      month,
		Currency:   currency,
		Income:     income,
		Expenses:   expenses,
		Net:        net,
		Savings:    savingsRate,
		Categories: categories,
	}, nil
}

// GetDateRangeReport generates a financial summary across an arbitrary date range
func (s *ReportsService) GetDateRangeReport(ctx context.Context, userID uuid.UUID, fromDate, toDate, currency string) (*DateRangeReport, error) {
	startDate, endDate, err := parseISODateRange(ctx, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	var income, expenses float64
	rateCache := make(map[string]float64)

	typeTotals, err := s.walletRepo.GetTypeTotalsByCurrency(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("getting transaction type totals: %w", err)
	}
	for _, row := range typeTotals {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			income += amount
		case model.TransactionTypeDebit:
			expenses += amount
		}
	}

	categoryRows, err := s.walletRepo.GetCategoryTotalsByCurrency(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("getting category totals: %w", err)
	}
	categoryMap := make(map[string]CategoryBreakdown)
	for _, row := range categoryRows {
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		entry := categoryMap[row.Category]
		entry.Category = row.Category
		entry.Amount += amount
		entry.Count += row.Count
		categoryMap[row.Category] = entry
	}

	net := income - expenses
	savingsRate := 0.0
	if income > 0 {
		savingsRate = (net / income) * 100
	}

	categories := make([]CategoryBreakdown, 0, len(categoryMap))
	for _, entry := range categoryMap {
		percentage := 0.0
		if expenses > 0 {
			percentage = (entry.Amount / expenses) * 100
		}
		entry.Percentage = percentage
		categories = append(categories, entry)
	}

	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Amount > categories[j].Amount
	})

	return &DateRangeReport{
		FromDate:   fromDate,
		ToDate:     toDate,
		Currency:   currency,
		Income:     income,
		Expenses:   expenses,
		Net:        net,
		Savings:    math.Round(savingsRate*10) / 10,
		Categories: categories,
	}, nil
}

// GetReportCoverage returns the available transaction history bounds for reports.
func (s *ReportsService) GetReportCoverage(ctx context.Context, userID uuid.UUID) (*ReportCoverage, error) {
	firstTx, lastTx, err := s.walletRepo.GetTransactionBounds(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting transaction bounds: %w", err)
	}

	coverage := &ReportCoverage{}
	if firstTx == nil || lastTx == nil {
		return coverage, nil
	}

	loc := ReportLocation(ctx)
	firstDate := firstTx.In(loc).Format("2006-01-02")
	lastDate := lastTx.In(loc).Format("2006-01-02")

	coverage.HasTransactions = true
	coverage.FirstTransactionDate = &firstDate
	coverage.LastTransactionDate = &lastDate

	return coverage, nil
}

// GetYearlyReport generates a yearly financial summary
// Uses aggregated queries instead of 12 separate monthly calls for better performance
func (s *ReportsService) GetYearlyReport(ctx context.Context, userID uuid.UUID, year int, currency string) (*YearlyReport, error) {
	loc := ReportLocation(ctx)
	tz := ReportTimeZone(ctx)
	
	// Calculate year boundaries
	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, loc)
	yearEnd := time.Date(year+1, 1, 1, 0, 0, 0, 0, loc).Add(-time.Nanosecond)

	// Single query for all monthly income/expense totals
	monthlyTypeTotals, err := s.walletRepo.GetMonthlyTypeTotalsByCurrency(ctx, userID, yearStart.UTC(), yearEnd.UTC(), tz)
	if err != nil {
		return nil, fmt.Errorf("getting monthly type totals: %w", err)
	}

	// Single query for all monthly category breakdowns
	monthlyCategoryTotals, err := s.walletRepo.GetMonthlyCategoryTotalsByCurrency(ctx, userID, yearStart.UTC(), yearEnd.UTC(), tz)
	if err != nil {
		return nil, fmt.Errorf("getting monthly category totals: %w", err)
	}

	rateCache := make(map[string]float64)

	// Build monthly income/expense maps
	type monthData struct {
		income   float64
		expenses float64
	}
	monthlyData := make(map[int]*monthData)
	for m := 1; m <= 12; m++ {
		monthlyData[m] = &monthData{}
	}

	for _, row := range monthlyTypeTotals {
		month := int(row.Period.Month())
		if month < 1 || month > 12 {
			continue
		}
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		switch row.Type {
		case model.TransactionTypeCredit:
			monthlyData[month].income += amount
		case model.TransactionTypeDebit:
			monthlyData[month].expenses += amount
		}
	}

	// Build monthly category maps
	type categoryEntry struct {
		amount float64
		count  int
	}
	monthlyCategories := make(map[int]map[string]*categoryEntry)
	for m := 1; m <= 12; m++ {
		monthlyCategories[m] = make(map[string]*categoryEntry)
	}

	for _, row := range monthlyCategoryTotals {
		month := int(row.Period.Month())
		if month < 1 || month > 12 {
			continue
		}
		amount := s.convertAmountWithRateCache(ctx, row.Total, row.Currency, currency, rateCache)
		if monthlyCategories[month][row.Category] == nil {
			monthlyCategories[month][row.Category] = &categoryEntry{}
		}
		monthlyCategories[month][row.Category].amount += amount
		monthlyCategories[month][row.Category].count += row.Count
	}

	// Assemble monthly reports
	var totalIncome, totalExpenses float64
	monthlyReports := make([]MonthlyReport, 12)

	for month := 1; month <= 12; month++ {
		data := monthlyData[month]
		income := data.income
		expenses := data.expenses
		net := income - expenses
		savingsRate := 0.0
		if income > 0 {
			savingsRate = (net / income) * 100
		}

		// Build categories slice
		categories := make([]CategoryBreakdown, 0)
		for cat, entry := range monthlyCategories[month] {
			percentage := 0.0
			if expenses > 0 {
				percentage = (entry.amount / expenses) * 100
			}
			categories = append(categories, CategoryBreakdown{
				Category:   cat,
				Amount:     entry.amount,
				Count:      entry.count,
				Percentage: percentage,
			})
		}

		monthlyReports[month-1] = MonthlyReport{
			Year:       year,
			Month:      month,
			Currency:   currency,
			Income:     income,
			Expenses:   expenses,
			Net:        net,
			Savings:    savingsRate,
			Categories: categories,
		}

		totalIncome += income
		totalExpenses += expenses
	}

	net := totalIncome - totalExpenses
	savingsRate := 0.0
	if totalIncome > 0 {
		savingsRate = (net / totalIncome) * 100
	}

	return &YearlyReport{
		Year:     year,
		Currency: currency,
		Income:   totalIncome,
		Expenses: totalExpenses,
		Net:      net,
		Savings:  savingsRate,
		Months:   monthlyReports,
	}, nil
}
