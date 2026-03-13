import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { HealthScoreCard } from '../HealthScoreCard';
import { api } from '../../../../api';

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        financialHealth: 'Financial Health',
        overallFinancialWellness: 'Your overall financial wellness',
        viewFinancialHealthDetails: 'View Details',
        healthScoreHowItWorksAction: 'How this score works',
        healthScoreHowItWorksTitle: 'How this score works',
        healthScoreInlineExplainer: 'This score is a heuristic based on recent financial activity. It is not an external credit score.',
        scoreBreakdown: 'Score Breakdown',
        budgetAdherence: 'Spending vs income',
        savingsRate: 'Savings rate',
        goalProgress: 'Monthly cash surplus',
        consistency: 'Tracking consistency',
        billTiming: 'Cash-flow outlook',
        tipsToImprove: 'Tips to improve',
        healthScoreMethodologySummary: 'The score runs from 0 to 100 and combines five weighted signals from your recent financial activity.',
        healthScoreWeightsTitle: 'How the score is weighted',
        healthScoreWeightSpendingVsIncome: 'Spending vs income (25%)',
        healthScoreWeightSavingsRate: 'Savings rate (25%)',
        healthScoreWeightMonthlyCashSurplus: 'Monthly cash surplus (20%)',
        healthScoreWeightTrackingConsistency: 'Tracking consistency (15%)',
        healthScoreWeightCashFlowOutlook: 'Cash-flow outlook (15%)',
        healthScoreWindowsTitle: 'What time windows it uses',
        healthScoreWindowCurrentMonth: 'Current month: income, expenses, savings rate, and monthly cash surplus.',
        healthScoreWindowLast30Days: 'Last 30 days: tracking consistency from the number of days with at least one transaction.',
        healthScoreWindowPreviousMonth: 'Previous month: used only to classify the trend as improving, stable, or declining.',
        healthScoreTrendTitle: 'How trend is determined',
        healthScoreTrendExplanation: 'Trend compares this month’s savings rate with last month’s savings rate.',
        healthScoreProxyNoteTitle: 'Important note',
        healthScoreProxyNoteBody: 'Some parts are proxy measures today. Monthly cash surplus is based on whether this month is net positive or negative, and cash-flow outlook is based on forecast net daily flow.',
        improving: 'Improving',
        stable: 'Stable',
        excellent: 'Excellent',
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

jest.mock('../../../../api', () => ({
  api: {
    reports: {
      healthScore: jest.fn(),
    },
  },
}));

jest.mock('../../../ui/BottomSheet', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  const MockBottomSheet = React.forwardRef(function MockBottomSheet(
    props: { title?: string; children: React.ReactNode },
    ref: any
  ) {
    const { title, children } = props;
    const [isOpen, setIsOpen] = React.useState(false);

    React.useImperativeHandle(ref, () => ({
      expand: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }));

    if (!isOpen) {
      return null;
    }

    return (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    );
  });

  MockBottomSheet.displayName = 'MockBottomSheet';

  return {
    BottomSheet: MockBottomSheet,
  };
});

const theme = buildTheme(darkColors, true);

const healthScoreResponse = {
  score: 74,
  trend: 'improving' as const,
  components: {
    budget_adherence: 70,
    savings_rate: 42,
    goal_progress: 80,
    consistency: 60,
    bill_timing: 90,
  },
  tips: ['Keep going'],
};

function renderCard(ui: React.ReactElement) {
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

describe('HealthScoreCard', () => {
  beforeEach(() => {
    jest.mocked(api.reports.healthScore).mockResolvedValue(healthScoreResponse as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the compact details CTA and calls the provided handler', async () => {
    const onViewDetails = jest.fn();
    const screen = renderCard(<HealthScoreCard compact onViewDetails={onViewDetails} />);

    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeTruthy();
      expect(screen.getByText('74')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('View Details'));

    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('shows the renamed labels, inline explainer, and methodology sheet content', async () => {
    const screen = renderCard(<HealthScoreCard />);

    await waitFor(() => {
      expect(screen.getByText('Spending vs income')).toBeTruthy();
      expect(screen.getByText('Monthly cash surplus')).toBeTruthy();
      expect(screen.getByText('Cash-flow outlook')).toBeTruthy();
      expect(screen.getByText('This score is a heuristic based on recent financial activity. It is not an external credit score.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('How this score works'));

    await waitFor(() => {
      expect(screen.getAllByText('How this score works').length).toBeGreaterThan(1);
      expect(screen.getByText('Spending vs income (25%)')).toBeTruthy();
      expect(screen.getByText('What time windows it uses')).toBeTruthy();
      expect(screen.getByText('Trend compares this month’s savings rate with last month’s savings rate.')).toBeTruthy();
    });
  });
});
