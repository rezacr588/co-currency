package service

import (
	"context"
	"fmt"
	"sort"
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
	Currency          string     `json:"currency"`
	CurrentBalance    float64    `json:"current_balance"`
	AvgDailySpend     float64    `json:"avg_daily_spend"`
	AvgDailyIncome    float64    `json:"avg_daily_income"`
	NetDailyFlow      float64    `json:"net_daily_flow"`
	DaysUntilZero     int        `json:"days_until_zero"` // -1 if net flow is positive
	EstimatedZeroDate *time.Time `json:"estimated_zero_date,omitempty"`
}

// HealthScoreComponents represents individual score components
type HealthScoreComponents struct {
	BudgetAdherence float64 `json:"budget_adherence"`
	SavingsRate     float64 `json:"savings_rate"`
	GoalProgress    float64 `json:"goal_progress"`
	Consistency     float64 `json:"consistency"`
	BillTiming      float64 `json:"bill_timing"`
}

// HealthScoreReport represents the financial health score
type HealthScoreReport struct {
	Score      int                   `json:"score"`
	Trend      string                `json:"trend"` // "improving", "stable", "declining"
	Components HealthScoreComponents `json:"components"`
	Tips       []string              `json:"tips"`
}

// WeeklyRecapReport represents a weekly financial summary
type WeeklyRecapReport struct {
	WeekStart      string             `json:"week_start"`      // ISO 8601 date, e.g. "2026-02-02"
	WeekEnd        string             `json:"week_end"`        // ISO 8601 date, e.g. "2026-02-08"
	TotalSpent     float64            `json:"total_spent"`
	TotalIncome    float64            `json:"total_income"`
	NetChange      float64            `json:"net_change"`
	TopCategories  []CategoryBreakdown `json:"top_categories"`
	ComparedToLast float64            `json:"compared_to_last"` // Percentage change
	Insights       []string           `json:"insights"`
	ActionItems    []string           `json:"action_items"`
	Currency       string             `json:"currency"`
	GeneratedAt    time.Time          `json:"generated_at"`
}

// GetMonthlyReport generates a monthly financial summary
func (s *ReportsService) GetMonthlyReport(ctx context.Context, userID uuid.UUID, year, month int, currency string) (*MonthlyReport, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

	// Get transactions for the month using date filters
	filter := &model.TransactionFilter{
		FromDate: startDate.Format("2006-01-02"),
		ToDate:   endDate.Format("2006-01-02"),
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	var income, expenses float64
	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)

	for _, tx := range transactions {

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
	_, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return nil, fmt.Errorf("invalid from_date format (expected YYYY-MM-DD): %w", err)
	}
	_, err = time.Parse("2006-01-02", toDate)
	if err != nil {
		return nil, fmt.Errorf("invalid to_date format (expected YYYY-MM-DD): %w", err)
	}

	// Get transactions within date range
	filter := &model.TransactionFilter{
		FromDate: fromDate,
		ToDate:   toDate,
		Type:     "debit",
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)
	var total float64

	for _, tx := range transactions {
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
	now := time.Now()
	trends := make([]TrendData, months)

	// Calculate full date range for all months
	oldestMonth := now.AddDate(0, -(months-1), 0)
	rangeStart := time.Date(oldestMonth.Year(), oldestMonth.Month(), 1, 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0).Add(-time.Second)

	// Get transactions for the full range
	filter := &model.TransactionFilter{
		FromDate: rangeStart.Format("2006-01-02"),
		ToDate:   rangeEnd.Format("2006-01-02"),
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
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
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	filter := &model.TransactionFilter{
		FromDate: startDate.Format("2006-01-02"),
		ToDate:   endDate.Format("2006-01-02"),
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, err
	}

	var totalIncome, totalExpenses float64
	for _, tx := range transactions {

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

	// 3. Calculate averages using full elapsed days in range
	activeDays := int(endDate.Sub(startDate).Hours()/24) + 1
	if activeDays < 1 {
		activeDays = 1
	}
	daysDivisor := float64(activeDays)
	avgDailySpend := totalExpenses / daysDivisor
	avgDailyIncome := totalIncome / daysDivisor
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

// GetHealthScore calculates the user's financial health score
func (s *ReportsService) GetHealthScore(ctx context.Context, userID uuid.UUID, currency string) (*HealthScoreReport, error) {
	// Get current month's report
	now := time.Now()
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
	consistencyFilter := &model.TransactionFilter{
		FromDate: thirtyDaysAgo.Format("2006-01-02"),
		ToDate:   now.Format("2006-01-02"),
	}
	transactions, _, _ := s.walletRepo.GetTransactionsFiltered(ctx, userID, consistencyFilter, 10000, 0)
	if len(transactions) > 0 {
		// Count unique days with transactions in last 30 days
		activeDays := make(map[string]bool)
		for _, tx := range transactions {
			activeDays[tx.CreatedAt.Format("2006-01-02")] = true
		}
		dayCount := len(activeDays)
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
	now := time.Now().UTC()
	if referenceDate != nil {
		now = referenceDate.UTC()
	}

	// Calculate ISO 8601 week boundaries (Monday–Sunday)
	weekday := now.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	daysSinceMonday := int(weekday) - 1
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-daysSinceMonday, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)
	weekEnd = time.Date(weekEnd.Year(), weekEnd.Month(), weekEnd.Day(), 23, 59, 59, 0, time.UTC)

	prevWeekStart := weekStart.AddDate(0, 0, -7)
	prevWeekEnd := weekStart.Add(-time.Second) // Sunday 23:59:59 of previous week

	// Get transactions for both weeks
	filter := &model.TransactionFilter{
		FromDate: prevWeekStart.Format("2006-01-02"),
		ToDate:   weekEnd.Format("2006-01-02"),
	}
	transactions, _, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, 10000, 0)
	if err != nil {
		return nil, err
	}

	// Calculate this week's totals
	var thisWeekIncome, thisWeekExpenses float64
	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)

	for _, tx := range transactions {
		if tx.CreatedAt.Before(weekStart) || tx.CreatedAt.After(weekEnd) {
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
			thisWeekIncome += amount
		} else if tx.Type == "debit" {
			thisWeekExpenses += amount
			category := tx.Category
			if category == "" {
				category = "other"
			}
			categoryTotals[category] += amount
			categoryCounts[category]++
		}
	}

	// Calculate last week's totals for comparison
	var lastWeekExpenses float64
	for _, tx := range transactions {
		if tx.CreatedAt.Before(prevWeekStart) || tx.CreatedAt.After(prevWeekEnd) {
			continue
		}

		amount := tx.Amount
		if tx.Currency != currency {
			conversion, err := s.exchangeService.Convert(ctx, tx.Currency, currency, tx.Amount)
			if err == nil {
				amount = conversion.Result
			}
		}

		if tx.Type == "debit" {
			lastWeekExpenses += amount
		}
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
		WeekStart:      weekStart.Format("2006-01-02"),
		WeekEnd:        weekEnd.Format("2006-01-02"),
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
