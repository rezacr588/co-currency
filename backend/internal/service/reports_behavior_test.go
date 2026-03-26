package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

type reportsWalletRepoStub struct {
	getBalancesFn                    func(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error)
	getTransactionBoundsFn           func(ctx context.Context, userID uuid.UUID) (*time.Time, *time.Time, error)
	getTypeTotalsByCurrencyFn        func(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedTypeTotal, error)
	getCategoryTotalsByCurrencyFn    func(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedCategoryTotal, error)
	getMonthlyTypeTotalsFn           func(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyTypeTotal, error)
	getMonthlyCategoryTotalsFn       func(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyCategoryTotal, error)
	countActiveTransactionDaysFn     func(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) (int, error)
	getWeekdayTypeTotalsByCurrencyFn func(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedWeekdayTypeTotal, error)
	getCategorySpendingStatsFn       func(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.CategorySpendingStat, error)
	getRecentDebitTransactionsFn     func(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.RecentDebitTransaction, error)
}

func (s *reportsWalletRepoStub) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	if s.getBalancesFn != nil {
		return s.getBalancesFn(ctx, userID)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetTransactionBounds(ctx context.Context, userID uuid.UUID) (*time.Time, *time.Time, error) {
	if s.getTransactionBoundsFn != nil {
		return s.getTransactionBoundsFn(ctx, userID)
	}
	return nil, nil, nil
}

func (s *reportsWalletRepoStub) GetTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedTypeTotal, error) {
	if s.getTypeTotalsByCurrencyFn != nil {
		return s.getTypeTotalsByCurrencyFn(ctx, userID, from, to)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetCategoryTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.AggregatedCategoryTotal, error) {
	if s.getCategoryTotalsByCurrencyFn != nil {
		return s.getCategoryTotalsByCurrencyFn(ctx, userID, from, to)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetMonthlyTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyTypeTotal, error) {
	if s.getMonthlyTypeTotalsFn != nil {
		return s.getMonthlyTypeTotalsFn(ctx, userID, from, to, timeZone)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetMonthlyCategoryTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedMonthlyCategoryTotal, error) {
	if s.getMonthlyCategoryTotalsFn != nil {
		return s.getMonthlyCategoryTotalsFn(ctx, userID, from, to, timeZone)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) CountActiveTransactionDays(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) (int, error) {
	if s.countActiveTransactionDaysFn != nil {
		return s.countActiveTransactionDaysFn(ctx, userID, from, to, timeZone)
	}
	return 0, nil
}

func (s *reportsWalletRepoStub) GetWeekdayTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]repository.AggregatedWeekdayTypeTotal, error) {
	if s.getWeekdayTypeTotalsByCurrencyFn != nil {
		return s.getWeekdayTypeTotalsByCurrencyFn(ctx, userID, from, to, timeZone)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetCategorySpendingStatsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.CategorySpendingStat, error) {
	if s.getCategorySpendingStatsFn != nil {
		return s.getCategorySpendingStatsFn(ctx, userID, from, to)
	}
	return nil, nil
}

func (s *reportsWalletRepoStub) GetRecentDebitTransactions(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]repository.RecentDebitTransaction, error) {
	if s.getRecentDebitTransactionsFn != nil {
		return s.getRecentDebitTransactionsFn(ctx, userID, from, to)
	}
	return nil, nil
}

type reportsExchangeServiceStub struct {
	rates map[string]float64
}

func (s *reportsExchangeServiceStub) Convert(_ context.Context, from, to string, amount float64) (*model.ConversionResult, error) {
	key := strings.ToUpper(from) + "->" + strings.ToUpper(to)
	rate := s.rates[key]
	if rate == 0 {
		rate = 1
	}
	return &model.ConversionResult{
		From:   from,
		To:     to,
		Amount: amount,
		Result: amount * rate,
		Rate:   rate,
	}, nil
}

type reportsRecurringRepoStub struct {
	items []model.RecurringTransaction
}

func (s *reportsRecurringRepoStub) GetByUser(context.Context, uuid.UUID) ([]model.RecurringTransaction, error) {
	return s.items, nil
}

type reportsSubscriptionRepoStub struct {
	items []model.Subscription
}

func (s *reportsSubscriptionRepoStub) GetSubscriptions(context.Context, uuid.UUID) ([]model.Subscription, error) {
	return s.items, nil
}

func TestGetWeeklyRecap_UsesAggregateQueriesAndCurrencyConversion(t *testing.T) {
	userID := uuid.New()
	ctx := WithReportTimeZone(context.Background(), "UTC")
	referenceDate := time.Date(2026, time.March, 12, 12, 0, 0, 0, time.UTC)

	weekStart := time.Date(2026, time.March, 9, 0, 0, 0, 0, time.UTC)
	weekEnd := time.Date(2026, time.March, 15, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)
	prevWeekStart := weekStart.AddDate(0, 0, -7)
	prevWeekEnd := weekStart.Add(-time.Nanosecond)

	repoStub := &reportsWalletRepoStub{
		getTypeTotalsByCurrencyFn: func(_ context.Context, _ uuid.UUID, from, to time.Time) ([]repository.AggregatedTypeTotal, error) {
			switch {
			case from.Equal(weekStart) && to.Equal(weekEnd):
				return []repository.AggregatedTypeTotal{
					{Type: model.TransactionTypeCredit, Currency: "USD", Total: 1000},
					{Type: model.TransactionTypeDebit, Currency: "USD", Total: 300},
					{Type: model.TransactionTypeDebit, Currency: "EUR", Total: 50},
				}, nil
			case from.Equal(prevWeekStart) && to.Equal(prevWeekEnd):
				return []repository.AggregatedTypeTotal{
					{Type: model.TransactionTypeDebit, Currency: "USD", Total: 500},
				}, nil
			default:
				return nil, nil
			}
		},
		getCategoryTotalsByCurrencyFn: func(_ context.Context, _ uuid.UUID, from, to time.Time) ([]repository.AggregatedCategoryTotal, error) {
			if from.Equal(weekStart) && to.Equal(weekEnd) {
				return []repository.AggregatedCategoryTotal{
					{Category: "food", Currency: "USD", Total: 300, Count: 2},
					{Category: "travel", Currency: "EUR", Total: 50, Count: 1},
				}, nil
			}
			return nil, nil
		},
	}

	svc := &ReportsService{
		walletRepo:      repoStub,
		exchangeService: &reportsExchangeServiceStub{rates: map[string]float64{"EUR->USD": 2}},
	}

	report, err := svc.GetWeeklyRecap(ctx, userID, "USD", &referenceDate)
	if err != nil {
		t.Fatalf("GetWeeklyRecap failed: %v", err)
	}

	if report.TotalIncome != 1000 {
		t.Fatalf("TotalIncome = %v, want 1000", report.TotalIncome)
	}
	if report.TotalSpent != 400 {
		t.Fatalf("TotalSpent = %v, want 400", report.TotalSpent)
	}
	if report.ComparedToLast != -20 {
		t.Fatalf("ComparedToLast = %v, want -20", report.ComparedToLast)
	}
	if len(report.TopCategories) != 2 {
		t.Fatalf("TopCategories len = %d, want 2", len(report.TopCategories))
	}
	if report.TopCategories[0].Category != "food" || report.TopCategories[0].Amount != 300 {
		t.Fatalf("unexpected first category: %+v", report.TopCategories[0])
	}
	if report.TopCategories[1].Category != "travel" || report.TopCategories[1].Amount != 100 {
		t.Fatalf("unexpected second category: %+v", report.TopCategories[1])
	}
}

func TestGetSpendingAnomalies_UsesAggregatedBaselineWithoutTruncation(t *testing.T) {
	userID := uuid.New()
	now := time.Date(2026, time.March, 12, 12, 0, 0, 0, time.UTC)
	ctx := WithReportTimeZone(context.Background(), "UTC")

	repoStub := &reportsWalletRepoStub{
		getCategorySpendingStatsFn: func(_ context.Context, _ uuid.UUID, _ time.Time, _ time.Time) ([]repository.CategorySpendingStat, error) {
			return []repository.CategorySpendingStat{
				{Category: "food", Currency: "USD", Count: 4, Sum: 200, SumSquares: 10200},
				{Category: "shopping", Currency: "USD", Count: 2, Sum: 40, SumSquares: 800},
			}, nil
		},
		getRecentDebitTransactionsFn: func(_ context.Context, _ uuid.UUID, _ time.Time, _ time.Time) ([]repository.RecentDebitTransaction, error) {
			return []repository.RecentDebitTransaction{
				{
					ID:          uuid.MustParse("11111111-1111-1111-1111-111111111111"),
					Amount:      90,
					Currency:    "USD",
					Category:    "food",
					Description: "Dinner out",
					CreatedAt:   now.Add(-24 * time.Hour),
				},
			}, nil
		},
	}

	svc := &ReportsService{
		walletRepo:      repoStub,
		exchangeService: &reportsExchangeServiceStub{rates: map[string]float64{}},
	}

	report, err := svc.GetSpendingAnomalies(ctx, userID, "USD")
	if err != nil {
		t.Fatalf("GetSpendingAnomalies failed: %v", err)
	}

	if len(report.Anomalies) != 1 {
		t.Fatalf("Anomalies len = %d, want 1", len(report.Anomalies))
	}
	if report.Anomalies[0].TransactionID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("unexpected anomaly ID: %s", report.Anomalies[0].TransactionID)
	}
	if report.Anomalies[0].AverageAmount != 50 {
		t.Fatalf("AverageAmount = %v, want 50", report.Anomalies[0].AverageAmount)
	}
	if report.Anomalies[0].Deviation != 1.8 {
		t.Fatalf("Deviation = %v, want 1.8", report.Anomalies[0].Deviation)
	}
}

func TestGetCashFlowProjection_UsesWeekdayAggregates(t *testing.T) {
	userID := uuid.New()
	ctx := WithReportTimeZone(context.Background(), "UTC")

	rows := make([]repository.AggregatedWeekdayTypeTotal, 0, 14)
	for weekday := 0; weekday < 7; weekday++ {
		rows = append(rows,
			repository.AggregatedWeekdayTypeTotal{Weekday: weekday, Type: model.TransactionTypeCredit, Currency: "USD", Total: 70},
			repository.AggregatedWeekdayTypeTotal{Weekday: weekday, Type: model.TransactionTypeDebit, Currency: "USD", Total: 35},
		)
	}

	repoStub := &reportsWalletRepoStub{
		getBalancesFn: func(_ context.Context, _ uuid.UUID) ([]model.WalletBalance, error) {
			return []model.WalletBalance{
				{Currency: "USD", Balance: 1000},
			}, nil
		},
		getWeekdayTypeTotalsByCurrencyFn: func(_ context.Context, _ uuid.UUID, _ time.Time, _ time.Time, _ string) ([]repository.AggregatedWeekdayTypeTotal, error) {
			return rows, nil
		},
	}

	svc := &ReportsService{
		walletRepo:       repoStub,
		exchangeService:  &reportsExchangeServiceStub{rates: map[string]float64{}},
		recurringRepo:    &reportsRecurringRepoStub{},
		subscriptionRepo: &reportsSubscriptionRepoStub{},
	}

	report, err := svc.GetCashFlowProjection(ctx, userID, "USD", 3)
	if err != nil {
		t.Fatalf("GetCashFlowProjection failed: %v", err)
	}

	if report.CurrentBalance != 1000 {
		t.Fatalf("CurrentBalance = %v, want 1000", report.CurrentBalance)
	}
	if len(report.Projections) != 3 {
		t.Fatalf("Projections len = %d, want 3", len(report.Projections))
	}
	if report.Projections[0].Income != 5.44 {
		t.Fatalf("Day 1 income = %v, want 5.44", report.Projections[0].Income)
	}
	if report.Projections[0].Expense != 2.72 {
		t.Fatalf("Day 1 expense = %v, want 2.72", report.Projections[0].Expense)
	}
	if report.DangerZone {
		t.Fatalf("DangerZone = true, want false")
	}
}

func TestGetCachedOrStaticAdvice_ReturnsCachedAdviceWhenAvailable(t *testing.T) {
	userID := uuid.New()
	service := NewAdviceService(nil, nil, nil, nil, nil, nil)

	expected := &model.PersonalizedAdvice{Title: "Cached tip", Detail: "Already generated"}
	service.cache.Set(service.cacheKey(userID, "en"), expected, time.Hour)

	advice := service.GetCachedOrStaticAdvice(userID, "en")
	if advice == nil {
		t.Fatal("expected advice, got nil")
	}
	if advice.Title != expected.Title || advice.Detail != expected.Detail {
		t.Fatalf("unexpected advice: %+v", advice)
	}
}
