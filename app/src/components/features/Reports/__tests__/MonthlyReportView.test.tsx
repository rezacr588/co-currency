import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { MonthlyReportView } from '../MonthlyReportView';
import { api } from '../../../../api';

jest.mock('../../../../api', () => ({
  api: {
    reports: {
      overview: jest.fn(),
      monthly: jest.fn(),
      dateRange: jest.fn(),
      category: jest.fn(),
      trends: jest.fn(),
      forecast: jest.fn(),
      anomalies: jest.fn(),
      cashflow: jest.fn(),
      networth: jest.fn(),
    },
  },
}));

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
        selectedRangeSummary: 'Selected Range Summary',
        selectedRangeAnalysis: 'Custom range analysis',
        monthlySummary: 'Monthly Summary',
        failedToLoadReport: 'Failed to load report',
        checkConnection: 'Check connection',
        retry: 'Retry',
        noDataAvailable: 'No data available',
        addTransaction: 'Add a transaction',
        net: 'Net',
        savingsRate: 'Savings Rate',
        expensesVsLastMonth: 'Expenses vs last month',
        spendingByCategory: 'Spending By Category',
        transactions: 'transactions',
        topCategory: 'Top category',
        incomeVsExpenses: 'Income vs Expenses',
        months: 'months',
        spendingAnomalies: 'Spending Anomalies',
        unusualSpending: 'Unusual spending detected this week',
        timesYourAverage: 'avg',
        categoryAvg: 'Category avg',
        showMore: 'Show more',
        showLess: 'Show less',
        forecast: 'Forecast',
        avgDaily: 'Avg daily',
        income: 'Income',
        expenses: 'Expenses',
        daysUntilZero: 'Days until zero',
        days: 'days',
        noForecastData: 'No forecast data',
        cashFlowProjection: 'Cash Flow Projection',
        daysProjected: 'days projected',
        healthy: 'Healthy',
        low: 'Low',
        negative: 'Negative',
        dangerZone: 'Danger Zone',
        closestRiskDay: 'Closest risk day',
        expectedIncome: 'Expected Income',
        expectedExpenses: 'Expected Expenses',
        lowestBalance: 'Lowest Balance',
        netProjected: 'Net Projected',
        recurringBreakdown: 'Recurring Breakdown',
        recurringIncome: 'Recurring Income',
        recurringExpense: 'Recurring Expenses',
        subscriptionCost: 'Subscriptions',
        upcomingEvents: 'Upcoming Events',
        incomingSection: 'Incoming',
        outgoingSection: 'Outgoing',
        dayNetImpact: 'Day net',
        subscriptionLabel: 'Subscription',
        today: 'Today',
        tomorrow: 'Tomorrow',
        netPositiveThisPeriod: 'Net positive this period',
        netNegativeThisPeriod: 'Net negative this period',
      };

      return labels[key] || key;
    },
  }),
}));

jest.mock('../../../../hooks/useReportTimeZone', () => ({
  useReportTimeZone: () => ({
    reportTimeZone: 'Europe/Istanbul',
  }),
}));

jest.mock('../../../../constants/icons', () => ({
  CATEGORY_COLORS: {
    food: '#ef4444',
    transport: '#22c55e',
  },
  StyledCategoryIcon: () => null,
}));

jest.mock('../../../ui', () => {
  const { Text: MockText, View: MockView } = require('react-native');

  return {
    Card: ({ children, ...props }: any) => (
      <MockView {...props}>{children}</MockView>
    ),
    ReportErrorCard: ({ title, message }: any) => (
      <MockView>
        <MockText>{title}</MockText>
        {message ? <MockText>{message}</MockText> : null}
      </MockView>
    ),
  };
});

jest.mock('../charts', () => ({
  ComparisonBarChart: () => {
    const { Text: MockText } = require('react-native');
    return <MockText>Comparison Chart</MockText>;
  },
  HorizontalBarChart: ({ data }: { data: Array<unknown> }) => {
    const { Text: MockText } = require('react-native');
    return <MockText>{`Horizontal Chart ${data.length}`}</MockText>;
  },
  TrendsChart: ({ data }: { data: Array<unknown> }) => {
    const { Text: MockText } = require('react-native');
    return <MockText>{`Trends Chart ${data.length}`}</MockText>;
  },
}));

jest.mock('../ReportHeadlineCard', () => ({
  ReportHeadlineCard: ({ summary, caption }: { summary: string; caption: string }) => {
    const { Text: MockText } = require('react-native');
    return (
      <>
        <MockText>{summary}</MockText>
        <MockText>{caption}</MockText>
      </>
    );
  },
}));

const theme = buildTheme(darkColors, true);

function renderView(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('MonthlyReportView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the overview query as the single monthly data source', async () => {
    jest.mocked(api.reports.overview).mockResolvedValue({
      mode: 'monthly',
      networth: {
        currency: 'USD',
        total_balance: 2400,
        balances: [],
      },
      monthly: {
        year: 2026,
        month: 3,
        currency: 'USD',
        income: 1800,
        expenses: 900,
        net: 900,
        savings_rate: 50,
        categories: [
          { category: 'food', amount: 320, percentage: 35.6, count: 4 },
        ],
      },
      date_range: null,
      previous_month: {
        year: 2026,
        month: 2,
        currency: 'USD',
        income: 1700,
        expenses: 1000,
        net: 700,
        savings_rate: 41.2,
        categories: [],
      },
      category: {
        from_date: '2026-03-01',
        to_date: '2026-03-31',
        currency: 'USD',
        total: 900,
        categories: [
          { category: 'food', amount: 320, percentage: 35.6, count: 4 },
        ],
      },
      trends: {
        currency: 'USD',
        months: 6,
        trends: [
          { period: '2026-01', income: 1200, expenses: 850, net: 350 },
          { period: '2026-02', income: 1700, expenses: 1000, net: 700 },
          { period: '2026-03', income: 1800, expenses: 900, net: 900 },
        ],
      },
      forecast: {
        currency: 'USD',
        current_balance: 2400,
        avg_daily_spend: 30,
        avg_daily_income: 60,
        net_daily_flow: 30,
        days_until_zero: 0,
      },
      anomalies: {
        currency: 'USD',
        anomalies: [
          {
            transaction_id: 'txn-1',
            description: 'Groceries',
            amount: 120,
            currency: 'USD',
            category: 'food',
            date: '2026-03-05',
            average_amount: 55,
            deviation: 2.2,
          },
        ],
      },
      cashflow: {
        currency: 'USD',
        current_balance: 2400,
        days_projected: 30,
        lowest_balance: 1800,
        lowest_date: '2026-03-18',
        danger_zone: false,
        summary: {
          expected_income: 800,
          expected_expenses: 600,
          net_projected: 200,
          recurring_income: 500,
          recurring_expense: 300,
          subscription_cost: 60,
        },
        projections: [
          {
            date: '2026-03-06',
            balance: 2400,
            income: 500,
            expense: 100,
            events: [],
          },
          {
            date: '2026-03-07',
            balance: 2350,
            income: 0,
            expense: 50,
            events: [],
          },
        ],
      },
    } as any);

    const screen = renderView(
      <MonthlyReportView
        year={2026}
        month={3}
        categoryCardWidth={320}
        categoryCols={1}
      />
    );

    await waitFor(() => {
      expect(api.reports.overview).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText('Monthly Summary').length).toBeGreaterThan(0);
    });

    expect(api.reports.overview).toHaveBeenCalledWith({
      year: 2026,
      month: 3,
      fromDate: undefined,
      toDate: undefined,
      timeZone: 'Europe/Istanbul',
    });
    expect(api.reports.monthly).not.toHaveBeenCalled();
    expect(api.reports.dateRange).not.toHaveBeenCalled();
    expect(api.reports.category).not.toHaveBeenCalled();
    expect(api.reports.trends).not.toHaveBeenCalled();
    expect(api.reports.forecast).not.toHaveBeenCalled();
    expect(api.reports.anomalies).not.toHaveBeenCalled();
    expect(api.reports.cashflow).not.toHaveBeenCalled();
    expect(api.reports.networth).not.toHaveBeenCalled();

    expect(screen.getByText('Spending By Category')).toBeTruthy();
    expect(screen.getByText('food')).toBeTruthy();
    expect(screen.getByText('Spending Anomalies')).toBeTruthy();
    expect(screen.getByText('Cash Flow Projection')).toBeTruthy();
    expect(screen.getByText('Forecast')).toBeTruthy();
  });

  it('uses the overview query for date range mode too', async () => {
    jest.mocked(api.reports.overview).mockResolvedValue({
      mode: 'date_range',
      networth: {
        currency: 'USD',
        total_balance: 1800,
        balances: [],
      },
      monthly: null,
      date_range: {
        from_date: '2026-03-01',
        to_date: '2026-03-15',
        currency: 'USD',
        income: 900,
        expenses: 420,
        net: 480,
        savings_rate: 53.3,
        categories: [
          { category: 'transport', amount: 120, percentage: 28.6, count: 3 },
        ],
      },
      previous_month: null,
      category: {
        from_date: '2026-03-01',
        to_date: '2026-03-15',
        currency: 'USD',
        total: 420,
        categories: [
          { category: 'transport', amount: 120, percentage: 28.6, count: 3 },
        ],
      },
      trends: {
        currency: 'USD',
        months: 6,
        trends: [{ period: '2026-03', income: 900, expenses: 420, net: 480 }],
      },
      forecast: null,
      anomalies: { currency: 'USD', anomalies: [] },
      cashflow: { currency: 'USD', current_balance: 1800, days_projected: 30, lowest_balance: 1600, lowest_date: '2026-03-15', danger_zone: false, summary: { expected_income: 0, expected_expenses: 0, net_projected: 0, recurring_income: 0, recurring_expense: 0, subscription_cost: 0 }, projections: [] },
    } as any);

    const screen = renderView(
      <MonthlyReportView
        year={2026}
        month={3}
        fromDate="2026-03-01"
        toDate="2026-03-15"
        categoryCardWidth={320}
        categoryCols={1}
      />
    );

    await waitFor(() => {
      expect(api.reports.overview).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Selected Range Summary')).toBeTruthy();
    });

    expect(api.reports.overview).toHaveBeenCalledWith({
      year: 2026,
      month: 3,
      fromDate: '2026-03-01',
      toDate: '2026-03-15',
      timeZone: 'Europe/Istanbul',
    });
    expect(api.reports.monthly).not.toHaveBeenCalled();
    expect(api.reports.dateRange).not.toHaveBeenCalled();
    expect(api.reports.category).not.toHaveBeenCalled();

    expect(screen.getByText('transport')).toBeTruthy();
    expect(screen.getByText('Income vs Expenses')).toBeTruthy();
  });
});
