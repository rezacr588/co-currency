import type {
  MonthlyReport,
  YearlyReport,
  CategoryReport,
  TrendsReport,
  NetWorthReport,
  InsightResponse,
} from '../types/goal';
import { fetchAPI } from './base';
import { buildQuery } from './utils';

export const reports = {
  monthly: (year?: number, month?: number, currency?: string) =>
    fetchAPI<MonthlyReport>(
      `/reports/monthly${buildQuery({
        year: year || undefined,
        month: month || undefined,
        currency,
      })}`
    ),
  yearly: (year?: number, currency?: string) =>
    fetchAPI<YearlyReport>(
      `/reports/yearly${buildQuery({
        year: year || undefined,
        currency,
      })}`
    ),
  category: (fromDate?: string, toDate?: string, currency?: string) =>
    fetchAPI<CategoryReport>(
      `/reports/category${buildQuery({
        from_date: fromDate,
        to_date: toDate,
        currency,
      })}`
    ),
  trends: (months?: number, currency?: string) =>
    fetchAPI<TrendsReport>(
      `/reports/trends${buildQuery({
        months: months || undefined,
        currency,
      })}`
    ),
  networth: (currency?: string) =>
    fetchAPI<NetWorthReport>(`/reports/networth${buildQuery({ currency })}`),
  forecast: (currency?: string) =>
    fetchAPI<{
      currency: string;
      current_balance: number;
      avg_daily_spend: number;
      avg_daily_income: number;
      net_daily_flow: number;
      days_until_zero: number;
      estimated_zero_date?: string;
    }>(`/reports/forecast${buildQuery({ currency })}`),
  insights: (currency?: string) =>
    fetchAPI<InsightResponse>(`/reports/insights${buildQuery({ currency })}`),
  healthScore: (currency?: string) =>
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
    }>(`/reports/health-score${buildQuery({ currency })}`),
  weeklyRecap: (currency?: string, date?: string) =>
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
    }>(`/reports/weekly-recap${buildQuery({ currency, date })}`),
};
