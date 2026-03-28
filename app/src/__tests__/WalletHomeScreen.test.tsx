import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../constants/colors';
import { buildTheme } from '../theme';
import WalletHomeScreen from '../../app/(app)/(tabs)/index';
import { api } from '../api';

jest.mock('../components/navigation/AppSwitcherTrigger', () => ({
  AppSwitcherTrigger: () => null,
}));

jest.mock('../components/ui', () => {
  const React = require('react');
  const { View, Text, ScrollView } = require('react-native');

  return {
    Card: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
      <View testID={testID}>{children}</View>
    ),
    PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    ),
    PageScaffold: ({ children }: { children: React.ReactNode }) => <ScrollView>{children}</ScrollView>,
    SectionBlock: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {children}
      </View>
    ),
  };
});

jest.mock('../components/features/Dashboard', () => ({
  DashboardCharts: () => null,
}));

jest.mock('../constants/icons', () => ({
  StyledCategoryIcon: () => null,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Rez',
      preferred_currency: 'USD',
    },
  }),
}));

jest.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        wallet: 'Wallet',
        walletHomeSubtitle: 'Balances, activity, and AI guidance in one place.',
        totalBalance: 'Total Balance',
        balances: 'Balances',
        recentTransactions: 'Recent Transactions',
        walletCardDesc: 'Track balances and transactions',
        aiAdvisor: 'CoAI Chat',
        homeAiSubtitle: 'A compact brief and a single path into chat.',
        homeResumeChat: 'Resume your latest conversation',
        homeRecentActivitySubtitle: 'Your latest activity at a glance.',
        addTransaction: 'Add',
        convert: 'Convert',
        reports: 'Reports',
        chat: 'Chat',
        viewAll: 'View All',
      };

      return labels[key];
    },
  }),
}));

jest.mock('../hooks/useScreenLayout', () => ({
  useScreenLayout: () => ({
    width: 390,
    isCompactPhone: false,
    isDesktop: false,
    isTablet: false,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../api', () => ({
  api: {
    coai: {
      getBrief: jest.fn(),
    },
    chat: {
      listConversations: jest.fn(),
    },
    wallet: {
      getSummary: jest.fn(),
      getBalances: jest.fn(),
      getTransactions: jest.fn(),
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
        <WalletHomeScreen />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('WalletHomeScreen', () => {
  beforeEach(() => {
    jest.mocked(api.coai.getBrief).mockResolvedValue({
      brief: 'Dining spend is higher than last week.',
      currency: 'USD',
      context_snapshot: {
        total_balance: 4200,
        recent_transaction_count: 4,
        active_budget_count: 2,
        active_goal_count: 1,
        balance_currency_count: 2,
      },
      priorities: [],
    } as any);

    jest.mocked(api.chat.listConversations).mockResolvedValue({
      conversations: [{ id: 'conv-1', title: 'Weekly money review' }],
    } as any);

    jest.mocked(api.wallet.getSummary).mockResolvedValue({
      total_balance_usd: 4200,
    } as any);

    jest.mocked(api.wallet.getBalances).mockResolvedValue({
      balances: [
        { currency: 'USD', balance: 3200 },
        { currency: 'EUR', balance: 850 },
      ],
    } as any);

    jest.mocked(api.wallet.getTransactions).mockResolvedValue({
      transactions: [
        {
          id: 'tx-1',
          description: 'Coffee',
          category: 'food',
          created_at: '2026-03-28T09:00:00Z',
          type: 'debit',
          amount: 7.5,
          currency: 'USD',
        },
      ],
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the merged wallet home sections for balances, AI, and recent transactions', async () => {
    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId('wallet-home-hero')).toBeTruthy();
      expect(screen.getByTestId('wallet-home-balances')).toBeTruthy();
      expect(screen.getByTestId('wallet-home-ai-card')).toBeTruthy();
      expect(screen.getByTestId('wallet-home-transactions')).toBeTruthy();
      expect(screen.getByText('Dining spend is higher than last week.')).toBeTruthy();
      expect(screen.getByText('Coffee')).toBeTruthy();
      expect(screen.getByText('Weekly money review')).toBeTruthy();
    });
  });
});
