import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  MessageCircle,
  Plus,
  Wallet,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../../src/api';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { DashboardCharts } from '../../../src/components/features/Dashboard';
import { Card, PageHeader, PageScaffold, SectionBlock } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatTransactionAmount,
  getCurrencyDisplay,
  getTransactionCurrency,
} from '../../../src/utils/format';
import { StyledCategoryIcon } from '../../../src/constants/icons';
import { STALE_FREQUENT, STALE_REALTIME } from '../../../src/config/queryConfig';

function QuickAction({
  icon: Icon,
  label,
  onPress,
  color,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          gap: 8,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={color || theme.colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.foreground,
          fontFamily: theme.typography.bodyMedium.fontFamily,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default memo(function WalletHomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { width, isCompactPhone, isDesktop, isTablet } = useScreenLayout();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: briefData,
    isPending: isLoadingBrief,
    isError: briefError,
    refetch: refetchBrief,
  } = useQuery({
    queryKey: ['coai-brief'],
    queryFn: () => api.coai.getBrief(),
    staleTime: STALE_FREQUENT,
  });

  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
    staleTime: STALE_REALTIME,
  });

  const { data: summary, isPending: isLoadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
  });

  const { data: balancesData, isPending: isLoadingBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  const { data: transactionsData, isPending: isLoadingTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => api.wallet.getTransactions(10),
  });

  const balances = balancesData?.balances || [];
  const transactions = transactionsData?.transactions || [];
  const recentConversation = conversationsData?.conversations?.[0];
  const snapshot = briefData?.context_snapshot;
  const hasSetupData = Boolean(
    snapshot &&
      (snapshot.recent_transaction_count > 0 ||
        snapshot.active_budget_count > 0 ||
        snapshot.active_goal_count > 0 ||
        snapshot.total_balance > 0)
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning') || 'Good morning';
    if (hour < 18) return t('goodAfternoon') || 'Good afternoon';
    return t('goodEvening') || 'Good evening';
  }, [t]);

  const heroCurrency = summary ? 'USD' : briefData?.currency || user?.preferred_currency || 'USD';
  const heroBalance = summary?.total_balance_usd ?? snapshot?.total_balance ?? 0;
  const displayedBalances = balances.slice(0, isDesktop ? 6 : 4);
  const actionColumns = width < 375 ? 2 : 4;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBrief(),
      refetchConversations(),
      refetchSummary(),
      refetchBalances(),
      refetchTransactions(),
    ]);
    setRefreshing(false);
  }, [refetchBalances, refetchBrief, refetchConversations, refetchSummary, refetchTransactions]);

  const quickActions = [
    {
      label: t('addTransaction') || 'Add',
      icon: Plus,
      onPress: () => router.push('/(app)/(tabs)/add' as any),
      color: theme.colors.primary,
    },
    {
      label: t('convert') || 'Convert',
      icon: ArrowLeftRight,
      onPress: () => router.push('/(app)/(tabs)/wallet/convert' as any),
      color: theme.colors.secondaryForeground,
    },
    {
      label: t('reports') || 'Reports',
      icon: BarChart3,
      onPress: () => router.push('/(app)/(tabs)/reports' as any),
      color: theme.colors.secondaryForeground,
    },
    {
      label: t('chat') || 'Chat',
      icon: MessageCircle,
      onPress: () => router.push('/(app)/coai-chat' as any),
      color: theme.colors.accent,
    },
  ];

  return (
    <PageScaffold
      scroll
      maxWidth={1120}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />,
      }}
    >
      <PageHeader
        title={t('wallet') || 'Wallet'}
        subtitle={t('walletHomeSubtitle') || 'Balances, activity, and AI guidance in one place.'}
        actions={<AppSwitcherTrigger variant="header_inline" />}
      />

      <View
        testID="wallet-home-hero"
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.xl,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.xl,
          marginBottom: theme.spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: 13 }}>
              {greeting + (user?.name ? `, ${user.name}` : '')}
            </Text>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontSize: 14,
                marginTop: 8,
                fontFamily: theme.typography.bodyMedium.fontFamily,
              }}
            >
              {t('totalBalance') || 'Total Balance'}
            </Text>
            {isLoadingSummary && isLoadingBrief ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.mutedForeground}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              />
            ) : (
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontSize: isCompactPhone ? 30 : 34,
                  fontFamily: theme.typography.h1.fontFamily,
                  marginTop: 4,
                  lineHeight: isCompactPhone ? 38 : 42,
                }}
              >
                {formatCurrency(heroBalance, heroCurrency)}
              </Text>
            )}
          </View>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={24} color={theme.colors.secondaryForeground} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
          {snapshot?.recent_transaction_count ? (
            <View style={{ backgroundColor: theme.colors.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>
                {(t('recentTransactions') || 'Recent Transactions') + ` · ${snapshot.recent_transaction_count}`}
              </Text>
            </View>
          ) : null}
          {snapshot?.active_goal_count ? (
            <View style={{ backgroundColor: theme.colors.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>
                {(t('goals') || 'Goals') + ` · ${snapshot.active_goal_count}`}
              </Text>
            </View>
          ) : null}
          {snapshot?.active_budget_count ? (
            <View style={{ backgroundColor: theme.colors.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>
                {(t('budgets') || 'Budgets') + ` · ${snapshot.active_budget_count}`}
              </Text>
            </View>
          ) : null}
          {snapshot?.balance_currency_count ? (
            <View style={{ backgroundColor: theme.colors.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>
                {`${snapshot.balance_currency_count} ${(snapshot.balance_currency_count === 1 ? 'currency' : 'currencies')}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          marginBottom: 28,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {quickActions.map((action) => (
          <View
            key={action.label}
            style={{
              width: actionColumns === 2 ? '46%' : 'auto',
              flex: actionColumns === 4 ? 1 : undefined,
            }}
          >
            <QuickAction {...action} />
          </View>
        ))}
      </View>

      <SectionBlock
        title={t('balances') || 'Balances'}
        subtitle={t('walletCardDesc') || 'Track balances and transactions'}
      >
        <View testID="wallet-home-balances" style={{ gap: 14 }}>
          {isLoadingBalances ? (
            <Card>
              <ActivityIndicator size="small" color={theme.colors.accent} />
            </Card>
          ) : displayedBalances.length === 0 ? (
            <Card>
              <Text style={{ color: theme.colors.mutedForeground }}>
                {t('noBalances') || 'No balances yet. Add a transaction to get started.'}
              </Text>
            </Card>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {displayedBalances.map((balance) => {
                  const display = getCurrencyDisplay(balance.currency);
                  return (
                    <View
                      key={balance.currency}
                      style={{
                        flexGrow: 1,
                        width: isCompactPhone ? '47%' : undefined,
                        minWidth: isCompactPhone ? undefined : 150,
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{display.flag || '🌐'}</Text>
                      <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, marginTop: 8 }}>
                        {balance.currency}
                      </Text>
                      <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/wallet' as any)}
                style={({ pressed }) => [{ alignSelf: 'flex-start' }, pressed && { opacity: 0.72 }]}
              >
                <Text style={{ color: theme.colors.primary, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  {t('viewAll') || 'View All'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </SectionBlock>

      <SectionBlock
        title={t('aiAdvisor') || 'CoAI Chat'}
        subtitle={t('homeAiSubtitle') || 'A compact brief and a single path into chat.'}
      >
        <Card testID="wallet-home-ai-card">
          {briefError ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <AlertTriangle size={18} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  {t('homeAiUnavailable') || 'AI insight is unavailable right now.'}
                </Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                  {t('homeAiUnavailableDesc') || 'Chat is still available if you want to ask something directly.'}
                </Text>
              </View>
            </View>
          ) : isLoadingBrief && !briefData ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 22 }}>
                {briefData?.brief || (t('homeAiFallback') || 'Open CoAI chat to review your latest balances, spending, and priorities.')}
              </Text>
              {briefData?.priorities?.[0]?.target_route ? (
                <Pressable
                  onPress={() => router.push(briefData.priorities[0].target_route as any)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.backgroundSecondary,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    },
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <View style={{ flex: 1, marginEnd: 12 }}>
                    <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }} numberOfLines={1}>
                      {briefData.priorities[0].title}
                    </Text>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                      {briefData.priorities[0].description}
                    </Text>
                  </View>
                  <ArrowRight size={16} color={theme.colors.mutedForeground} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => router.push({ pathname: '/(app)/coai-chat', params: recentConversation ? { conversationId: recentConversation.id } : undefined } as any)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: theme.colors.secondary,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={{ flex: 1, marginEnd: 12 }}>
                  <Text style={{ color: theme.colors.secondaryForeground, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                    {recentConversation ? (recentConversation.title || (t('chat') || 'Chat')) : (t('chat') || 'Chat')}
                  </Text>
                  <Text style={{ color: theme.colors.secondaryForeground, opacity: 0.82, fontSize: 12, marginTop: 2 }}>
                    {recentConversation
                      ? (t('homeResumeChat') || 'Resume your latest conversation')
                      : (t('homeOpenChat') || 'Open CoAI chat')}
                  </Text>
                </View>
                <ArrowRight size={16} color={theme.colors.secondaryForeground} />
              </Pressable>
            </View>
          )}
        </Card>
      </SectionBlock>

      <SectionBlock
        title={t('recentTransactions') || 'Recent Transactions'}
        subtitle={t('homeRecentActivitySubtitle') || 'Your latest activity at a glance.'}
      >
        <View testID="wallet-home-transactions" style={{ gap: 12 }}>
          {isLoadingTransactions ? (
            <Card>
              <ActivityIndicator size="small" color={theme.colors.accent} />
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <Text style={{ color: theme.colors.mutedForeground }}>
                {t('noTransactions') || 'No transactions yet.'}
              </Text>
            </Card>
          ) : (
            transactions.slice(0, 5).map((tx) => (
              <Card key={tx.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <StyledCategoryIcon category={tx.category || 'other'} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }} numberOfLines={1}>
                      {tx.description || tx.category || 'Transaction'}
                    </Text>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {formatDate(tx.created_at, { month: 'short', day: 'numeric' })}
                      {tx.category ? ` · ${tx.category}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        color: tx.type === 'credit' ? theme.colors.success : theme.colors.danger,
                        fontFamily: theme.typography.bodyMedium.fontFamily,
                      }}
                    >
                      {formatTransactionAmount(tx)}
                    </Text>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                      {getTransactionCurrency(tx)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
          {transactions.length > 0 ? (
            <Pressable
              onPress={() => router.push('/(app)/(tabs)/wallet/history' as any)}
              style={({ pressed }) => [{ alignSelf: 'flex-start' }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: theme.colors.primary, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                {t('viewAll') || 'View All'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </SectionBlock>

      {hasSetupData && (isDesktop || isTablet) ? (
        <SectionBlock
          title={t('financialOverview') || 'Financial Overview'}
          subtitle={t('financialOverviewSubtitle') || 'Quick insights from your recent activity'}
        >
          <DashboardCharts currency={briefData?.currency || user?.preferred_currency || 'USD'} />
        </SectionBlock>
      ) : null}
    </PageScaffold>
  );
});
