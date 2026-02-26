package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// ReportsService handles business logic for financial reports
type ReportsService struct {
	walletRepo       *repository.WalletRepository
	exchangeService  *ExchangeService
	aiService        *AIService
	recurringRepo    *repository.RecurringRepository
	subscriptionRepo *repository.SubscriptionRepository
}

// NewReportsService creates a new ReportsService
func NewReportsService(walletRepo *repository.WalletRepository, exchangeService *ExchangeService, aiService *AIService, recurringRepo *repository.RecurringRepository, subscriptionRepo *repository.SubscriptionRepository) *ReportsService {
	return &ReportsService{
		walletRepo:       walletRepo,
		exchangeService:  exchangeService,
		aiService:        aiService,
		recurringRepo:    recurringRepo,
		subscriptionRepo: subscriptionRepo,
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
	WeekStart      string              `json:"week_start"` // ISO 8601 date, e.g. "2026-02-02"
	WeekEnd        string              `json:"week_end"`   // ISO 8601 date, e.g. "2026-02-08"
	TotalSpent     float64             `json:"total_spent"`
	TotalIncome    float64             `json:"total_income"`
	NetChange      float64             `json:"net_change"`
	TopCategories  []CategoryBreakdown `json:"top_categories"`
	ComparedToLast float64             `json:"compared_to_last"` // Percentage change
	Insights       []string            `json:"insights"`
	ActionItems    []string            `json:"action_items"`
	Currency       string              `json:"currency"`
	GeneratedAt    time.Time           `json:"generated_at"`
}

func parseISODateRange(fromDate, toDate string) (time.Time, time.Time, error) {
	from, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid from_date format (expected YYYY-MM-DD): %w", err)
	}
	to, err := time.Parse("2006-01-02", toDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid to_date format (expected YYYY-MM-DD): %w", err)
	}
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, 1).Add(-time.Nanosecond)
	return start, end, nil
}

func (s *ReportsService) convertAmountWithRateCache(ctx context.Context, amount float64, fromCurrency, toCurrency string, rateCache map[string]float64) float64 {
	if amount == 0 || fromCurrency == "" || toCurrency == "" || fromCurrency == toCurrency || s.exchangeService == nil {
		return amount
	}
	cacheKey := fromCurrency + "->" + toCurrency
	if cachedRate, ok := rateCache[cacheKey]; ok {
		if cachedRate <= 0 {
			return amount
		}
		return amount * cachedRate
	}

	conversion, err := s.exchangeService.Convert(ctx, fromCurrency, toCurrency, 1.0)
	if err != nil {
		rateCache[cacheKey] = 0
		return amount
	}
	rate := conversion.Result
	if rate <= 0 {
		rate = conversion.Rate
	}
	if rate <= 0 {
		rateCache[cacheKey] = 0
		return amount
	}
	rateCache[cacheKey] = rate
	return amount * rate
}

// GetMonthlyReport generates a monthly financial summary
func (s *ReportsService) GetMonthlyReport(ctx context.Context, userID uuid.UUID, year, month int, currency string) (*MonthlyReport, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Nanosecond)

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
	startDate, endDate, err := parseISODateRange(fromDate, toDate)
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
	now := time.Now()
	trends := make([]TrendData, months)

	// Calculate full date range for all months
	currentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	rangeStart := currentMonth.AddDate(0, -(months - 1), 0)
	rangeEnd := currentMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

	monthlyRows, err := s.walletRepo.GetMonthlyTypeTotalsByCurrency(ctx, userID, rangeStart, rangeEnd)
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
	endDate := time.Now()
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
	dayCount, err := s.walletRepo.CountActiveTransactionDays(ctx, userID, thirtyDaysAgo.UTC(), now.UTC())
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

// CashFlowProjection represents a single day's projected cash flow
type CashFlowProjection struct {
	Date    string          `json:"date"`
	Balance float64         `json:"balance"`
	Income  float64         `json:"income"`
	Expense float64         `json:"expense"`
	Events  []CashFlowEvent `json:"events,omitempty"`
}

// CashFlowEvent represents a known future financial event
type CashFlowEvent struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category,omitempty"`
}

// CashFlowReport represents a full cash flow projection report
type CashFlowReport struct {
	Currency       string               `json:"currency"`
	CurrentBalance float64              `json:"current_balance"`
	Projections    []CashFlowProjection `json:"projections"`
	DaysProjected  int                  `json:"days_projected"`
	LowestBalance  float64              `json:"lowest_balance"`
	LowestDate     string               `json:"lowest_date"`
	DangerZone     bool                 `json:"danger_zone"`
	DangerDate     *string              `json:"danger_date,omitempty"`
	Summary        CashFlowSummary      `json:"summary"`
}

// CashFlowSummary summarizes the projected period
type CashFlowSummary struct {
	ExpectedIncome   float64 `json:"expected_income"`
	ExpectedExpenses float64 `json:"expected_expenses"`
	NetProjected     float64 `json:"net_projected"`
	RecurringIncome  float64 `json:"recurring_income"`
	RecurringExpense float64 `json:"recurring_expense"`
	SubscriptionCost float64 `json:"subscription_cost"`
}

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

// SpendingAnomaly represents a transaction that deviates significantly from the norm
type SpendingAnomaly struct {
	TransactionID string  `json:"transaction_id"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Category      string  `json:"category"`
	Date          string  `json:"date"`
	AverageAmount float64 `json:"average_amount"`
	Deviation     float64 `json:"deviation"`
	Message       string  `json:"message"`
}

// AnomalyReport contains detected spending anomalies
type AnomalyReport struct {
	Anomalies []SpendingAnomaly `json:"anomalies"`
	Period    string            `json:"period"`
	Currency  string            `json:"currency"`
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
