import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import ReportsScreen from '../../../../../app/(app)/(tabs)/reports';
import { api } from '../../../../api';

const mockPush = jest.fn();
let mockSearchParams: { period?: string | string[] } = {};

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
        reportsAndStats: 'Reports & Statistics',
        analyticsTimeZone: 'Analytics Time Zone',
        analyticsTimeZoneTurkish: 'Turkish Time',
        activeReportView: 'Active View',
        dailyReport: 'Daily',
        weeklyReport: 'Weekly',
        monthlyReport: 'Monthly',
        yearlyReport: 'Yearly',
        allTime: 'All Time',
        selectDateRange: 'Select date range',
        previousYear: 'Previous year',
        nextYear: 'Next year',
        thisMonth: 'This Month',
        lastMonth: 'Last Month',
        threeMonths: '3 Months',
        sixMonths: '6 Months',
        thisYear: 'This Year',
        close: 'Close',
        total: 'Total',
        netWorth: 'Net Worth',
      };

      return labels[key] || key;
    },
  }),
}));

jest.mock('../../../../hooks/useReportTimeZone', () => ({
  useReportTimeZone: () => ({
    reportTimeZone: 'Europe/Istanbul',
    reportTimeZoneLabel: 'Turkish Time',
  }),
}));

jest.mock('../../../navigation/AppSwitcherTrigger', () => ({
  AppSwitcherTrigger: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('../index', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    ReportPeriodTabs: ({ selected, onSelect }: { selected: string; onSelect: (period: string) => void }) => (
      <View>
        {['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map((period) => (
          <Pressable key={period} onPress={() => onSelect(period)}>
            <Text>{period}</Text>
          </Pressable>
        ))}
        <Text testID="selected-period">{selected}</Text>
      </View>
    ),
    DailyReportView: () => <Text>Daily mock</Text>,
    WeeklyReportView: () => <Text>Weekly mock</Text>,
    MonthlyReportView: ({ year, month }: { year: number; month: number }) => (
      <Text>{`Monthly ${year}-${month}`}</Text>
    ),
    DateRangeSelector: () => <Text>Date range selector mock</Text>,
    YearlyReportView: ({ onSelectMonth }: { onSelectMonth?: (selection: { year: number; month: number }) => void }) => (
      <Pressable onPress={() => onSelectMonth?.({ year: 2025, month: 4 })}>
        <Text>Open April 2025</Text>
      </Pressable>
    ),
    AllTimeReportView: () => <Text>All-time mock</Text>,
  };
});

jest.mock('../../../../api', () => ({
  api: {
    reports: {
      networth: jest.fn(),
    },
  },
}));

const theme = buildTheme(darkColors, true);

function renderScreen() {
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
      <ThemeProvider theme={theme}>
        <ReportsScreen />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T12:00:00.000Z'));
    mockSearchParams = {};
    jest.mocked(api.reports.networth).mockResolvedValue({
      total_balance: 1200,
      currency: 'USD',
      balances: [],
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('shows the timezone context and switches yearly drill-down into monthly state', async () => {
    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Turkish Time')).toBeTruthy();
      expect(screen.getAllByText('March 2026').length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByText('yearly'));
    fireEvent.press(screen.getByText('Open April 2025'));

    await waitFor(() => {
      expect(screen.getByText('Monthly 2025-4')).toBeTruthy();
      expect(screen.getAllByText('April 2025').length).toBeGreaterThan(0);
    });
  });

  it('opens the all-time view when period=all_time is provided in the route params', async () => {
    mockSearchParams = { period: 'all_time' };
    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId('selected-period').props.children).toBe('all_time');
      expect(screen.getByText('All-time mock')).toBeTruthy();
    });
  });
});
