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

// GetYearlyReport generates a yearly financial summary
func (s *ReportsService) GetYearlyReport(ctx context.Context, userID uuid.UUID, year int, currency string) (*YearlyReport, error) {
	var totalIncome, totalExpenses float64
	var monthlyReports []MonthlyReport

	for month := 1; month <= 12; month++ {
		report, err := s.GetMonthlyReport(ctx, userID, year, month, currency)
		if err != nil {
			return nil, err
		}

		totalIncome += report.Income
		totalExpenses += report.Expenses
		monthlyReports = append(monthlyReports, *report)
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
