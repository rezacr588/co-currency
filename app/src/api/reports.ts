import type {
  MonthlyReport,
  YearlyReport,
  CategoryReport,
  DateRangeReport,
  ReportCoverage,
  TrendsReport,
  NetWorthReport,
  ReportsOverviewResponse,
  InsightResponse,
  CashFlowReport,
  AnomalyReport,
} from '../types/goal';
import { fetchAPI } from './base';
import { buildQuery } from './utils';

export const reports = {
  overview: (params: {
    year?: number;
    month?: number;
    fromDate?: string;
    toDate?: string;
    currency?: string;
    timeZone?: string;
  }) =>
    fetchAPI<ReportsOverviewResponse>(
      `/reports/overview${buildQuery({
        year: params.year || undefined,
        month: params.month || undefined,
        from_date: params.fromDate,
        to_date: params.toDate,
        currency: params.currency,
        timezone: params.timeZone,
      })}`
    ),
  monthly: (year?: number, month?: number, currency?: string, timeZone?: string) =>
    fetchAPI<MonthlyReport>(
      `/reports/monthly${buildQuery({
        year: year || undefined,
        month: month || undefined,
        currency,
        timezone: timeZone,
      })}`
    ),
  yearly: (year?: number, currency?: string, timeZone?: string) =>
    fetchAPI<YearlyReport>(
      `/reports/yearly${buildQuery({
        year: year || undefined,
        currency,
        timezone: timeZone,
      })}`
    ),
  dateRange: (fromDate: string, toDate: string, currency?: string, timeZone?: string) =>
    fetchAPI<DateRangeReport>(
      `/reports/date-range${buildQuery({ from_date: fromDate, to_date: toDate, currency, timezone: timeZone })}`
    ),
  coverage: (timeZone?: string) =>
    fetchAPI<ReportCoverage>(`/reports/coverage${buildQuery({ timezone: timeZone })}`),
  category: (fromDate?: string, toDate?: string, currency?: string, timeZone?: string) =>
    fetchAPI<CategoryReport>(
      `/reports/category${buildQuery({
        from_date: fromDate,
        to_date: toDate,
        currency,
        timezone: timeZone,
      })}`
    ),
  trends: (months?: number, currency?: string, timeZone?: string) =>
    fetchAPI<TrendsReport>(
      `/reports/trends${buildQuery({
        months: months || undefined,
        currency,
        timezone: timeZone,
      })}`
    ),
  networth: (currency?: string) =>
    fetchAPI<NetWorthReport>(`/reports/networth${buildQuery({ currency })}`),
  forecast: (currency?: string, timeZone?: string) =>
    fetchAPI<{
      currency: string;
      current_balance: number;
      avg_daily_spend: number;
      avg_daily_income: number;
      net_daily_flow: number;
      days_until_zero: number;
      estimated_zero_date?: string;
    }>(`/reports/forecast${buildQuery({ currency, timezone: timeZone })}`),
  insights: (currency?: string, timeZone?: string) =>
    fetchAPI<InsightResponse>(`/reports/insights${buildQuery({ currency, timezone: timeZone })}`),
  healthScore: (currency?: string, timeZone?: string) =>
    fetchAPI<{
      score: number;
      trend: 'improving' | 'stable' | 'declining';
      components: {
        budget_adherence: number;
        savings_rate: number;
        goal_progress: number;
        consistency: number;
        bill_timing: number;
      };
      tips: string[];
    }>(`/reports/health-score${buildQuery({ currency, timezone: timeZone })}`),
  weeklyRecap: (currency?: string, date?: string, timeZone?: string) =>
    fetchAPI<{
      week_start: string;
      week_end: string;
      total_spent: number;
      total_income: number;
      net_change: number;
      top_categories: { category: string; amount: number; percentage: number; count: number }[];
      compared_to_last: number;
      insights: string[];
      action_items: string[];
      currency: string;
      generated_at: string;
    }>(`/reports/weekly-recap${buildQuery({ currency, date, timezone: timeZone })}`),
  cashflow: (days?: number, currency?: string, timeZone?: string) =>
    fetchAPI<CashFlowReport>(
      `/reports/cashflow${buildQuery({ days: days || undefined, currency, timezone: timeZone })}`
    ),
  anomalies: (currency?: string, timeZone?: string) =>
    fetchAPI<AnomalyReport>(`/reports/anomalies${buildQuery({ currency, timezone: timeZone })}`),
};
