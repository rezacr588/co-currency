package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

const (
	reportOverviewModeMonthly   = "monthly"
	reportOverviewModeDateRange = "date_range"
)

// GetOverview returns the consolidated payload for the default monthly/date-range reports screen.
func (s *ReportsService) GetOverview(ctx context.Context, userID uuid.UUID, year, month int, fromDate, toDate, currency string) (*ReportsOverview, error) {
	mode := reportOverviewModeMonthly
	if fromDate != "" && toDate != "" {
		mode = reportOverviewModeDateRange
	}

	overview := &ReportsOverview{
		Mode: mode,
	}

	var currentCategory *CategoryReport

	group, groupCtx := errgroup.WithContext(ctx)

	group.Go(func() error {
		netWorth, err := s.GetNetWorthReport(groupCtx, userID, currency)
		if err != nil {
			return fmt.Errorf("getting net worth report: %w", err)
		}
		overview.NetWorth = netWorth
		return nil
	})

	group.Go(func() error {
		trends, err := s.GetTrendsReport(groupCtx, userID, 6, currency)
		if err != nil {
			return fmt.Errorf("getting trends report: %w", err)
		}
		overview.Trends = trends
		return nil
	})

	group.Go(func() error {
		forecast, err := s.GetForecast(groupCtx, userID, currency)
		if err != nil {
			return fmt.Errorf("getting forecast report: %w", err)
		}
		overview.Forecast = forecast
		return nil
	})

	group.Go(func() error {
		anomalies, err := s.GetSpendingAnomalies(groupCtx, userID, currency)
		if err != nil {
			return fmt.Errorf("getting anomaly report: %w", err)
		}
		overview.Anomalies = anomalies
		return nil
	})

	group.Go(func() error {
		cashFlow, err := s.GetCashFlowProjection(groupCtx, userID, currency, 30)
		if err != nil {
			return fmt.Errorf("getting cash flow report: %w", err)
		}
		overview.CashFlow = cashFlow
		return nil
	})

	switch mode {
	case reportOverviewModeDateRange:
		group.Go(func() error {
			report, err := s.GetDateRangeReport(groupCtx, userID, fromDate, toDate, currency)
			if err != nil {
				return fmt.Errorf("getting date range report: %w", err)
			}
			overview.DateRange = report
			currentCategory = buildCategoryReport(report.FromDate, report.ToDate, report.Currency, report.Expenses, report.Categories)
			return nil
		})
	default:
		group.Go(func() error {
			report, err := s.GetMonthlyReport(groupCtx, userID, year, month, currency)
			if err != nil {
				return fmt.Errorf("getting monthly report: %w", err)
			}
			overview.Monthly = report

			startDate, endDate := reportMonthBoundsForContext(groupCtx, year, time.Month(month))
			currentCategory = buildCategoryReport(
				startDate.In(ReportLocation(groupCtx)).Format("2006-01-02"),
				endDate.In(ReportLocation(groupCtx)).Format("2006-01-02"),
				report.Currency,
				report.Expenses,
				report.Categories,
			)
			return nil
		})

		group.Go(func() error {
			prevYear, prevMonth := previousReportMonth(year, month)
			report, err := s.GetMonthlyReport(groupCtx, userID, prevYear, prevMonth, currency)
			if err != nil {
				return fmt.Errorf("getting previous month report: %w", err)
			}
			overview.PreviousMonth = report
			return nil
		})
	}

	if err := group.Wait(); err != nil {
		return nil, err
	}

	overview.Category = currentCategory
	return overview, nil
}

func previousReportMonth(year, month int) (int, int) {
	if month <= 1 {
		return year - 1, 12
	}
	return year, month - 1
}

func buildCategoryReport(fromDate, toDate, currency string, total float64, categories []CategoryBreakdown) *CategoryReport {
	return &CategoryReport{
		FromDate:   fromDate,
		ToDate:     toDate,
		Currency:   currency,
		Total:      total,
		Categories: categories,
	}
}
