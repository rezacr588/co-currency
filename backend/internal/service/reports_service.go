package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// ReportsService handles business logic for financial reports
type ReportsService struct {
	walletRepo      *repository.WalletRepository
	exchangeService *ExchangeService
	aiService       *AIService
}

// NewReportsService creates a new ReportsService
func NewReportsService(walletRepo *repository.WalletRepository, exchangeService *ExchangeService, aiService *AIService) *ReportsService {
	return &ReportsService{
		walletRepo:      walletRepo,
		exchangeService: exchangeService,
		aiService:       aiService,
	}
}

// MonthlyReport represents a monthly financial summary
type MonthlyReport struct {
	Year       int                 `json:"year"`
	Month      int                 `json:"month"`
	Currency   string              `json:"currency"`
	Income     float64             `json:"income"`
	Expenses   float64             `json:"expenses"`
	Net        float64             `json:"net"`
	Savings    float64             `json:"savings_rate"` // Percentage of income saved
	Categories []CategoryBreakdown `json:"categories"`
}

// YearlyReport represents a yearly financial summary
type YearlyReport struct {
	Year     int             `json:"year"`
	Currency string          `json:"currency"`
	Income   float64         `json:"income"`
	Expenses float64         `json:"expenses"`
	Net      float64         `json:"net"`
	Savings  float64         `json:"savings_rate"`
	Months   []MonthlyReport `json:"months"`
}

// CategoryBreakdown represents spending by category
type CategoryBreakdown struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
	Count      int     `json:"count"`
}

// CategoryReport represents category-wise spending
type CategoryReport struct {
	FromDate   string              `json:"from_date"`
	ToDate     string              `json:"to_date"`
	Currency   string              `json:"currency"`
	Total      float64             `json:"total"`
	Categories []CategoryBreakdown `json:"categories"`
}

// TrendData represents a single data point in trend
type TrendData struct {
	Period   string  `json:"period"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
	Net      float64 `json:"net"`
}

// TrendsReport represents income/expense trends over time
type TrendsReport struct {
	Currency string      `json:"currency"`
	Months   int         `json:"months"`
	Trends   []TrendData `json:"trends"`
}

// BalanceBreakdown represents balance in a currency
type BalanceBreakdown struct {
	Currency      string  `json:"currency"`
	Balance       float64 `json:"balance"`
	BalanceInBase float64 `json:"balance_in_base"`
	Percentage    float64 `json:"percentage"`
}

// GoalProgress represents progress towards goals
type GoalProgress struct {
	Name          string  `json:"name"`
	TargetAmount  float64 `json:"target_amount"`
	CurrentAmount float64 `json:"current_amount"`
	Currency      string  `json:"currency"`
	Progress      float64 `json:"progress"`
}

// NetWorthReport represents overall financial position
type NetWorthReport struct {
	Currency     string             `json:"currency"`
	TotalBalance float64            `json:"total_balance"`
	Balances     []BalanceBreakdown `json:"balances"`
	Goals        []GoalProgress     `json:"goals,omitempty"`
}

// ForecastReport represents financial projections
type ForecastReport struct {
	Currency          string    `json:"currency"`
	CurrentBalance    float64   `json:"current_balance"`
	AvgDailySpend     float64   `json:"avg_daily_spend"`
	AvgDailyIncome    float64   `json:"avg_daily_income"`
	NetDailyFlow      float64   `json:"net_daily_flow"`
	DaysUntilZero     int       `json:"days_until_zero"`      // -1 if net flow is positive
	EstimatedZeroDate *time.Time `json:"estimated_zero_date,omitempty"`
}

// GetMonthlyReport generates a monthly financial summary
func (s *ReportsService) GetMonthlyReport(ctx context.Context, userID uuid.UUID, year, month int, currency string) (*MonthlyReport, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

	// Get all transactions for the month
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, nil, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	var income, expenses float64
	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)

	for _, tx := range transactions {
		if tx.CreatedAt.Before(startDate) || tx.CreatedAt.After(endDate) {
			continue
		}

		// Convert amount to target currency if needed
		amount := tx.Amount
		if tx.Currency != currency {
			conversion, err := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if err == nil {
				amount = conversion.Result
			}
		}

		switch tx.Type {
		case "credit":
			income += amount
		case "debit":
			expenses += amount
			
			category := tx.Category
			if category == "" {
				category = "other"
			}
			categoryTotals[category] += amount
			categoryCounts[category]++
		}
	}

	net := income - expenses
	savingsRate := 0.0
	if income > 0 {
		savingsRate = (net / income) * 100
	}

	categories := make([]CategoryBreakdown, 0, len(categoryTotals))
	for cat, amount := range categoryTotals {
		percentage := 0.0
		if expenses > 0 {
			percentage = (amount / expenses) * 100
		}
		categories = append(categories, CategoryBreakdown{
			Category:   cat,
			Amount:     amount,
			Percentage: percentage,
			Count:      categoryCounts[cat],
		})
	}

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

// GetCategoryReport generates a category-wise spending report
func (s *ReportsService) GetCategoryReport(ctx context.Context, userID uuid.UUID, fromDate, toDate, currency string) (*CategoryReport, error) {
	startTime, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return nil, fmt.Errorf("invalid from_date format (expected YYYY-MM-DD): %w", err)
	}
	endTime, err := time.Parse("2006-01-02", toDate)
	if err != nil {
		return nil, fmt.Errorf("invalid to_date format (expected YYYY-MM-DD): %w", err)
	}
	endTime = endTime.Add(24*time.Hour - time.Second)

	// Get all transactions
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, nil, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)
	var total float64

	for _, tx := range transactions {
		if tx.CreatedAt.Before(startTime) || tx.CreatedAt.After(endTime) {
			continue
		}
		if tx.Type != "debit" {
			continue
		}

		// Convert amount to target currency if needed
		amount := tx.Amount
		if tx.Currency != currency {
			conversion, err := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if err == nil {
				amount = conversion.Result
			}
		}

		category := tx.Category
		if category == "" {
			category = "other"
		}

		categoryTotals[category] += amount
		categoryCounts[category]++
		total += amount
	}

	categories := make([]CategoryBreakdown, 0, len(categoryTotals))
	for cat, amount := range categoryTotals {
		percentage := 0.0
		if total > 0 {
			percentage = (amount / total) * 100
		}
		categories = append(categories, CategoryBreakdown{
			Category:   cat,
			Amount:     amount,
			Percentage: percentage,
			Count:      categoryCounts[cat],
		})
	}

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
	now := time.Now()
	trends := make([]TrendData, months)

	// Get all transactions
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, nil, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	for i := 0; i < months; i++ {
		monthOffset := months - 1 - i
		targetMonth := now.AddDate(0, -monthOffset, 0)
		startDate := time.Date(targetMonth.Year(), targetMonth.Month(), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

		var income, expenses float64

		for _, tx := range transactions {
			if tx.CreatedAt.Before(startDate) || tx.CreatedAt.After(endDate) {
				continue
			}

			// Convert amount to target currency if needed
			amount := tx.Amount
			if tx.Currency != currency {
				conversion, err := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
				if err == nil {
					amount = conversion.Result
				}
			}

			switch tx.Type {
			case "credit":
				income += amount
			case "debit":
				expenses += amount
			}
		}

		trends[i] = TrendData{
			Period:   startDate.Format("2006-01"),
			Income:   income,
			Expenses: expenses,
			Net:      income - expenses,
		}
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
		if b.Balance <= 0 {
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
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, nil, 10000, 0)
	if err != nil {
		return nil, err
	}

	var totalIncome, totalExpenses float64
	for _, tx := range transactions {
		if tx.CreatedAt.Before(startDate) || tx.CreatedAt.After(endDate) {
			continue
		}

		amount := tx.Amount
		if tx.Currency != currency {
			conversion, err := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if err == nil {
				amount = conversion.Result
			}
		}

		if tx.Type == "credit" {
			totalIncome += amount
		} else if tx.Type == "debit" {
			totalExpenses += amount
		}
	}

	// 3. Calculate averages
	avgDailySpend := totalExpenses / 30.0
	avgDailyIncome := totalIncome / 30.0
	netDailyFlow := avgDailyIncome - avgDailySpend

	daysUntilZero := -1
	var estimatedZeroDate *time.Time

	if netDailyFlow < 0 && nw.TotalBalance > 0 {
		// Calculate how many days until balance reaches zero
		daysUntilZero = int(nw.TotalBalance / (-netDailyFlow))
		zeroDate := time.Now().AddDate(0, 0, daysUntilZero)
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
