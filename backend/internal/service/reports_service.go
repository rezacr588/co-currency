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
	walletRepo       reportsWalletRepository
	exchangeService  reportsExchangeService
	aiService        reportsAIService
	recurringRepo    reportsRecurringRepository
	subscriptionRepo reportsSubscriptionRepository
}

type reportsWalletRepository interface {
	GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error)
	GetTransactionBounds(ctx context.Context, userID uuid.UUID) (*time.Time, *time.Time, error)
	GetTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedTypeTotal, error)
	GetCategoryTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedCategoryTotal, error)
	GetMonthlyTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyTypeTotal, error)
	GetMonthlyCategoryTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyCategoryTotal, error)
	CountActiveTransactionDays(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) (int, error)
	GetWeekdayTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedWeekdayTypeTotal, error)
	GetCategorySpendingStatsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.CategorySpendingStat, error)
	GetRecentDebitTransactions(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.RecentDebitTransaction, error)
}

type reportsExchangeService interface {
	Convert(ctx context.Context, from, to string, amount float64) (*model.ConversionResult, error)
}

type reportsAIService interface {
	IsConfigured() bool
	GetInsights(ctx context.Context, report *ForecastReport) (*model.InsightResponse, error)
}

type reportsRecurringRepository interface {
	GetByUser(ctx context.Context, userID uuid.UUID) ([]model.RecurringTransaction, error)
}

type reportsSubscriptionRepository interface {
	GetSubscriptions(ctx context.Context, userID uuid.UUID) ([]model.Subscription, error)
}

var _ reportsWalletRepository = (*repository.WalletRepository)(nil)
var _ reportsExchangeService = (*ExchangeService)(nil)
var _ reportsAIService = (*AIService)(nil)
var _ reportsRecurringRepository = (*repository.RecurringRepository)(nil)
var _ reportsSubscriptionRepository = (*repository.SubscriptionRepository)(nil)

// NewReportsService creates a new ReportsService
func NewReportsService(walletRepo *repository.WalletRepository, exchangeService *ExchangeService, aiService *AIService, recurringRepo *repository.RecurringRepository, subscriptionRepo *repository.SubscriptionRepository) *ReportsService {
	var walletRepoAPI reportsWalletRepository
	if walletRepo != nil {
		walletRepoAPI = walletRepo
	}

	var exchangeServiceAPI reportsExchangeService
	if exchangeService != nil {
		exchangeServiceAPI = exchangeService
	}

	var aiServiceAPI reportsAIService
	if aiService != nil {
		aiServiceAPI = aiService
	}

	var recurringRepoAPI reportsRecurringRepository
	if recurringRepo != nil {
		recurringRepoAPI = recurringRepo
	}

	var subscriptionRepoAPI reportsSubscriptionRepository
	if subscriptionRepo != nil {
		subscriptionRepoAPI = subscriptionRepo
	}

	return &ReportsService{
		walletRepo:       walletRepoAPI,
		exchangeService:  exchangeServiceAPI,
		aiService:        aiServiceAPI,
		recurringRepo:    recurringRepoAPI,
		subscriptionRepo: subscriptionRepoAPI,
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

// DateRangeReport represents a financial summary across an arbitrary date range
type DateRangeReport struct {
	FromDate   string              `json:"from_date"`
	ToDate     string              `json:"to_date"`
	Currency   string              `json:"currency"`
	Income     float64             `json:"income"`
	Expenses   float64             `json:"expenses"`
	Net        float64             `json:"net"`
	Savings    float64             `json:"savings_rate"`
	Categories []CategoryBreakdown `json:"categories"`
}

// ReportCoverage describes the user transaction history available for reports.
type ReportCoverage struct {
	HasTransactions      bool    `json:"has_transactions"`
	FirstTransactionDate *string `json:"first_transaction_date,omitempty"`
	LastTransactionDate  *string `json:"last_transaction_date,omitempty"`
}

// ReportsOverview bundles the default monthly/date-range report payloads for the app.
type ReportsOverview struct {
	Mode          string           `json:"mode"`
	NetWorth      *NetWorthReport  `json:"networth"`
	Monthly       *MonthlyReport   `json:"monthly,omitempty"`
	DateRange     *DateRangeReport `json:"date_range,omitempty"`
	PreviousMonth *MonthlyReport   `json:"previous_month,omitempty"`
	Category      *CategoryReport  `json:"category"`
	Trends        *TrendsReport    `json:"trends"`
	Forecast      *ForecastReport  `json:"forecast"`
	Anomalies     *AnomalyReport   `json:"anomalies"`
	CashFlow      *CashFlowReport  `json:"cashflow"`
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
	Direction   string  `json:"direction,omitempty"`
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

func parseISODateRange(ctx context.Context, fromDate, toDate string) (time.Time, time.Time, error) {
	loc := ReportLocation(ctx)

	from, err := time.ParseInLocation("2006-01-02", fromDate, loc)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid from_date format (expected YYYY-MM-DD): %w", err)
	}
	to, err := time.ParseInLocation("2006-01-02", toDate, loc)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid to_date format (expected YYYY-MM-DD): %w", err)
	}
	return reportDayStartInLocation(from, loc).UTC(), reportDayEndInLocation(to, loc).UTC(), nil
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
