import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { useQuery } from '@tanstack/react-query';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { WeeklyReportView } from '../WeeklyReportView';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
        currentWeek: 'Current Week',
        thisWeek: 'This Week',
        expensesVsLastWeek: 'Expenses vs last week',
        totalIncome: 'Total Income',
        totalExpenses: 'Total Expenses',
        topCategories: 'Top Categories',
        weeklyInsights: 'Weekly Insights',
        actionItems: 'Action Items',
        previousWeek: 'Previous Week',
        nextWeek: 'Next Week',
        keyTakeaway: 'Key Takeaway',
        lowerExpenseThanLastWeek: 'lower expenses than last week',
        higherExpenseThanLastWeek: 'higher expenses than last week',
        currentWeekSnapshot: 'Current week snapshot',
        historicalWeekSnapshot: 'Historical week snapshot',
        historicalWeek: 'Historical week',
        topCategory: 'Top category',
        viewThisWeek: 'View this week',
        income: 'Income',
        expenses: 'Expenses',
        net: 'Net',
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

describe('WeeklyReportView', () => {
  beforeEach(() => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        week_start: '2026-03-02',
        week_end: '2026-03-08',
        total_spent: 320,
        total_income: 700,
        net_change: 380,
        top_categories: [
          { category: 'food', amount: 120, percentage: 37.5, count: 3 },
        ],
        compared_to_last: -12.5,
        insights: ['You spent less on food.'],
        action_items: ['Keep the same pace.'],
        currency: 'USD',
        generated_at: '2026-03-08T12:00:00Z',
      },
      isPending: false,
      isError: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens history filters from the weekly summary and top categories', () => {
    const onOpenHistory = jest.fn();
    const screen = renderWithTheme(<WeeklyReportView onOpenHistory={onOpenHistory} />);

    fireEvent.press(screen.getByText('View this week'));
    expect(onOpenHistory).toHaveBeenCalledWith({
      fromDate: '2026-03-02',
      toDate: '2026-03-08',
    });

    fireEvent.press(screen.getByText('food'));
    expect(onOpenHistory).toHaveBeenCalledWith({
      fromDate: '2026-03-02',
      toDate: '2026-03-08',
      category: 'food',
    });
  });
});
