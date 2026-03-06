import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { useQuery } from '@tanstack/react-query';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { CashFlowProjectionCard } from '../CashFlowProjectionCard';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
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

const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('CashFlowProjectionCard', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T09:00:00.000Z'));
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        currency: 'USD',
        current_balance: 600,
        days_projected: 30,
        lowest_balance: 120,
        lowest_date: '2026-03-07',
        danger_zone: true,
        danger_date: '2026-03-07',
        summary: {
          expected_income: 700,
          expected_expenses: 540,
          net_projected: 160,
          recurring_income: 500,
          recurring_expense: 220,
          subscription_cost: 120,
        },
        projections: [
          {
            date: '2026-03-06',
            balance: 650,
            income: 500,
            expense: 100,
            events: [
              { type: 'recurring', direction: 'credit', description: 'Payroll', amount: 500, category: 'income' },
              { type: 'recurring', direction: 'credit', description: 'Bonus', amount: 120, category: 'income' },
              { type: 'subscription', direction: 'debit', description: 'Streaming', amount: 20, category: 'streaming' },
            ],
          },
          {
            date: '2026-03-07',
            balance: 120,
            income: 0,
            expense: 420,
            events: [
              { type: 'recurring', direction: 'debit', description: 'Rent', amount: 400, category: 'housing' },
            ],
          },
        ],
      },
      isPending: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('groups upcoming events by direction and shows relative date labels', () => {
    const screen = renderWithTheme(<CashFlowProjectionCard />);

    expect(screen.getByText('Incoming')).toBeTruthy();
    expect(screen.getByText('Outgoing')).toBeTruthy();
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText(/Day net/)).toBeTruthy();
    expect(screen.getByText('Subscription')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
