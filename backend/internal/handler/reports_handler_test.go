package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
)

type reportsServiceStub struct {
	getOverviewFn func(ctx context.Context, userID uuid.UUID, year, month int, fromDate, toDate, currency string) (*service.ReportsOverview, error)
}

func (s *reportsServiceStub) GetOverview(ctx context.Context, userID uuid.UUID, year, month int, fromDate, toDate, currency string) (*service.ReportsOverview, error) {
	if s.getOverviewFn != nil {
		return s.getOverviewFn(ctx, userID, year, month, fromDate, toDate, currency)
	}
	return nil, nil
}

func (s *reportsServiceStub) GetMonthlyReport(context.Context, uuid.UUID, int, int, string) (*service.MonthlyReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetYearlyReport(context.Context, uuid.UUID, int, string) (*service.YearlyReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetDateRangeReport(context.Context, uuid.UUID, string, string, string) (*service.DateRangeReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetReportCoverage(context.Context, uuid.UUID) (*service.ReportCoverage, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetCategoryReport(context.Context, uuid.UUID, string, string, string) (*service.CategoryReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetTrendsReport(context.Context, uuid.UUID, int, string) (*service.TrendsReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetNetWorthReport(context.Context, uuid.UUID, string) (*service.NetWorthReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetForecast(context.Context, uuid.UUID, string) (*service.ForecastReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetInsights(context.Context, uuid.UUID, string) (*model.InsightResponse, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetHealthScore(context.Context, uuid.UUID, string) (*service.HealthScoreReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetCashFlowProjection(context.Context, uuid.UUID, string, int) (*service.CashFlowReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetSpendingAnomalies(context.Context, uuid.UUID, string) (*service.AnomalyReport, error) {
	return nil, nil
}

func (s *reportsServiceStub) GetWeeklyRecap(context.Context, uuid.UUID, string, *time.Time) (*service.WeeklyRecapReport, error) {
	return nil, nil
}

func withSpecificUser(req *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

func TestReportsHandler_GetOverview_MonthlyMode(t *testing.T) {
	userID := uuid.New()
	called := false
	handler := &ReportsHandler{
		reportsService: &reportsServiceStub{
			getOverviewFn: func(ctx context.Context, gotUserID uuid.UUID, year, month int, fromDate, toDate, currency string) (*service.ReportsOverview, error) {
				called = true
				if gotUserID != userID {
					t.Fatalf("expected user id %s, got %s", userID, gotUserID)
				}
				if year != 2025 || month != 4 {
					t.Fatalf("expected 2025-4, got %d-%d", year, month)
				}
				if fromDate != "" || toDate != "" {
					t.Fatalf("expected empty date range, got %q to %q", fromDate, toDate)
				}
				if currency != "EUR" {
					t.Fatalf("expected currency EUR, got %s", currency)
				}
				if service.ReportTimeZone(ctx) != "UTC" {
					t.Fatalf("expected report timezone UTC, got %s", service.ReportTimeZone(ctx))
				}

				return &service.ReportsOverview{
					Mode: "monthly",
					NetWorth: &service.NetWorthReport{
						Currency:     "EUR",
						TotalBalance: 1500,
					},
					Monthly: &service.MonthlyReport{
						Year:       2025,
						Month:      4,
						Currency:   "EUR",
						Income:     2000,
						Expenses:   1200,
						Net:        800,
						Savings:    40,
						Categories: []service.CategoryBreakdown{{Category: "food", Amount: 400, Percentage: 33.3, Count: 4}},
					},
				}, nil
			},
		},
	}

	req := withSpecificUser(httptest.NewRequest(http.MethodGet, "/api/v1/reports/overview?year=2025&month=4&currency=EUR&timezone=UTC", nil), userID)
	rr := httptest.NewRecorder()

	handler.GetOverview(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !called {
		t.Fatal("expected overview service to be called")
	}

	var got service.ReportsOverview
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Mode != "monthly" {
		t.Fatalf("expected monthly mode, got %s", got.Mode)
	}
	if got.NetWorth == nil || got.NetWorth.TotalBalance != 1500 {
		t.Fatalf("expected net worth total balance 1500, got %#v", got.NetWorth)
	}
	if got.Monthly == nil || got.Monthly.Month != 4 {
		t.Fatalf("expected monthly report for month 4, got %#v", got.Monthly)
	}
}

func TestReportsHandler_GetOverview_DateRangeModeDefaultsCurrency(t *testing.T) {
	userID := uuid.New()
	called := false
	handler := &ReportsHandler{
		reportsService: &reportsServiceStub{
			getOverviewFn: func(ctx context.Context, gotUserID uuid.UUID, year, month int, fromDate, toDate, currency string) (*service.ReportsOverview, error) {
				called = true
				if gotUserID != userID {
					t.Fatalf("expected user id %s, got %s", userID, gotUserID)
				}
				if fromDate != "2026-03-01" || toDate != "2026-03-15" {
					t.Fatalf("expected exact range, got %q to %q", fromDate, toDate)
				}
				if currency != "USD" {
					t.Fatalf("expected default currency USD, got %s", currency)
				}
				if service.ReportTimeZone(ctx) != "Europe/Istanbul" {
					t.Fatalf("expected report timezone Europe/Istanbul, got %s", service.ReportTimeZone(ctx))
				}

				return &service.ReportsOverview{
					Mode: "date_range",
					DateRange: &service.DateRangeReport{
						FromDate:   "2026-03-01",
						ToDate:     "2026-03-15",
						Currency:   "USD",
						Income:     500,
						Expenses:   320,
						Net:        180,
						Savings:    36,
						Categories: []service.CategoryBreakdown{{Category: "transport", Amount: 80, Percentage: 25, Count: 2}},
					},
					Category: &service.CategoryReport{
						FromDate:   "2026-03-01",
						ToDate:     "2026-03-15",
						Currency:   "USD",
						Total:      320,
						Categories: []service.CategoryBreakdown{{Category: "transport", Amount: 80, Percentage: 25, Count: 2}},
					},
				}, nil
			},
		},
	}

	req := withSpecificUser(httptest.NewRequest(http.MethodGet, "/api/v1/reports/overview?from_date=2026-03-01&to_date=2026-03-15&timezone=Europe/Istanbul", nil), userID)
	rr := httptest.NewRecorder()

	handler.GetOverview(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !called {
		t.Fatal("expected overview service to be called")
	}

	var got service.ReportsOverview
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Mode != "date_range" {
		t.Fatalf("expected date_range mode, got %s", got.Mode)
	}
	if got.DateRange == nil || got.DateRange.FromDate != "2026-03-01" || got.DateRange.ToDate != "2026-03-15" {
		t.Fatalf("expected matching date range, got %#v", got.DateRange)
	}
	if got.Category == nil || len(got.Category.Categories) != 1 {
		t.Fatalf("expected derived category report, got %#v", got.Category)
	}
}
