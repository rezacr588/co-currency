import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, DollarSign, PiggyBank, CreditCard, Bot, PieChart, BarChart3, Target, Shield } from 'lucide-react-native';
import styled, { useTheme } from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useReportTimeZone } from '../../../src/hooks/useReportTimeZone';
import { formatCompactCurrency, formatDate, formatTransactionAmount } from '../../../src/utils/format';
import { StyledCategoryIcon } from '../../../src/constants/icons';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { PageHeader, PageScaffold } from '../../../src/components/ui';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { CurrencyConverter } from '../../../src/components/features/CurrencyConverter';
import { WeeklyRecapCard } from '../../../src/components/features/WeeklyRecap';
import { SpendingAnomalyCard } from '../../../src/components/features/Reports/SpendingAnomalyCard';
import { CalendarHeatMap, useHeatMapData } from '../../../src/components/features/CalendarHeatMap';
import { useToast } from '../../../src/components/ui/Toast';
import { SmartAdviceCard } from '../../../src/components/features/SmartAdvice';
import { QuickNotesCard } from '../../../src/components/features/Notes';
import { FinancialNewsCard } from '../../../src/components/features/News';
import { HealthScoreCard } from '../../../src/components/features/HealthScore';
import { RealValueCard } from '../../../src/components/features/RealValue';
import { CollapsibleSection } from '../../../src/components/ui/CollapsibleSection';
import { H2, H3, BodyMedium, Caption } from '../../../src/components/ui/styled';
import type { Goal, Budget } from '../../../src/types/goal';
import { resolveResponsiveToken } from '../../../src/theme';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';

// ─── Styled Components ───────────────────────────────────────
const StatCard = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
`;

const StatRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
`;

const IconCircle = styled.View<{ $bg?: string }>`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  background-color: ${({ theme, $bg }) => $bg || theme.colors.secondary};
  align-items: center;
  justify-content: center;
`;

const AICardGradient = styled(LinearGradient)`
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  margin-bottom: ${({ theme }) => theme.spacing.xxl}px;
`;

const ChipButton = styled.View`
  background-color: rgba(0, 0, 0, 0.2);
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  padding-vertical: ${({ theme }) => theme.spacing.sm - 2}px;
  border-radius: ${({ theme }) => theme.radii.full}px;
  flex-direction: row;
  align-items: center;
`;

const BalanceRow = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const TransactionRow = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const EmptyCard = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.xxl}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
  align-items: center;
`;

const ForecastCard = styled.View`
  background-color: ${({ theme }) => theme.colors.card};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
`;

const InsightCard = styled.View`
  background-color: ${({ theme }) => theme.colors.muted};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
`;

const InsightDot = styled.View<{ $tone: string }>`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin-top: 6px;
  margin-right: ${({ theme }) => (theme.isRTL ? 0 : theme.spacing.md)}px;
  margin-left: ${({ theme }) => (theme.isRTL ? theme.spacing.md : 0)}px;
  background-color: ${({ $tone, theme }) =>
    $tone === 'warning' ? theme.colors.warning
      : $tone === 'success' ? theme.colors.success
        : theme.colors.accent};
`;

const SectionSpacing = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.xxl}px;
`;

const ErrorBanner = styled.View`
  background-color: ${({ theme }) => theme.colors.dangerMuted};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.danger + '33'};
`;

// ─── Component ───────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const theme = useTheme();
  const { reportTimeZone } = useReportTimeZone();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { width, isDesktop, isTablet } = useScreenLayout();
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const pageGutter = resolveResponsiveToken(theme.layout.pageGutter, width);
  const contentWidth = Math.min(width, 1280);
  const availableWidth = contentWidth - pageGutter * 2;
  const statsGap = theme.spacing.md;
  const statsCols = isDesktop ? 4 : isTablet ? 2 : 1;
  const statsCardWidth =
    statsCols === 1 ? availableWidth : (availableWidth - statsGap * (statsCols - 1)) / statsCols;

  const { data: summary, isPending, isError: isSummaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: monthlyReport, isError: isMonthlyError, refetch: refetchMonthly } = useQuery({
    queryKey: ['reports', 'monthly', reportTimeZone],
    queryFn: () => api.reports.monthly(undefined, undefined, undefined, reportTimeZone),
    staleTime: 2 * 60 * 1000,
  });

  const { data: goalsData, isError: isGoalsError, refetch: refetchGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
    staleTime: 2 * 60 * 1000,
  });
  const goals: Goal[] | undefined = goalsData?.goals;

  const { data: budgetsData, isError: isBudgetsError, refetch: refetchBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
    staleTime: 2 * 60 * 1000,
  });
  const budgets: Budget[] = budgetsData?.budgets || [];

  const { data: forecast } = useQuery({
    queryKey: ['forecast', reportTimeZone],
    queryFn: () => api.reports.forecast(undefined, reportTimeZone),
    staleTime: 5 * 60 * 1000,
  });

  const heatMap = useHeatMapData(reportTimeZone);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSummary(),
      refetchMonthly(),
      refetchGoals(),
      refetchBudgets(),
    ]);
    setRefreshing(false);
  }, [refetchSummary, refetchMonthly, refetchGoals, refetchBudgets]);

  const handleOpenHealthScoreDetails = useCallback(() => {
    router.push({
      pathname: '/(app)/(tabs)/reports',
      params: { period: 'all_time' },
    });
  }, [router]);

  const totalGoals = goals?.length || 0;
  const activeGoals = goals?.filter((g) => g.current_amount < g.target_amount).length || 0;

  const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spent || 0), 0);
  const budgetPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  type Insight = { title: string; detail: string; tone: 'warning' | 'success' | 'info' };
  const insights: Insight[] = [];

  if (monthlyReport?.income && monthlyReport?.expenses) {
    const income = monthlyReport.income;
    const expenses = monthlyReport.expenses;
    if (expenses > income) {
      insights.push({
        title: t('spendingExceedsIncome') || 'Spending exceeds income',
        detail: t('spentMoreThanEarned') || `You spent ${formatCompactCurrency(expenses - income, monthlyReport.currency)} more than you earned this month.`,
        tone: 'warning',
      });
    } else if (income > 0) {
      const savingsRate = (income - expenses) / income;
      insights.push({
        title: `${t('savingsRate') || 'Savings rate'}: ${Math.round(savingsRate * 100)}%`,
        detail: savingsRate < 0.2
          ? (t('nudgeSavings') || 'Try nudging this toward 20% by trimming one category.')
          : (t('keepSavingsPace') || 'Nice work — keep this pace to grow your savings.'),
        tone: savingsRate < 0.2 ? 'info' : 'success',
      });
    }
  }

  const topCategory = useMemo(() => {
    if (!summary?.recent_transactions?.length) return null;
    const categoryCounts = summary.recent_transactions
      .filter((tx: any) => tx?.type === 'debit' && tx?.category)
      .reduce((acc: Record<string, number>, tx: any) => {
        acc[tx.category] = (acc[tx.category] || 0) + 1;
        return acc;
      }, {});
    return Object.keys(categoryCounts).sort(
      (a, b) => categoryCounts[b] - categoryCounts[a]
    )[0] || null;
  }, [summary]);

  if (topCategory) {
    const readable = topCategory.replace(/_/g, ' ');
    insights.push({
      title: `${t('topSpending') || 'Top spending'}: ${readable}`,
      detail: t('considerWeeklyLimit') || 'Consider setting a small weekly limit to stay on track.',
      tone: 'info',
    });
  }

  if (totalGoals === 0) {
    insights.push({
      title: t('setFirstGoal') || 'Set your first goal',
      detail: t('simpleTargetHelps') || 'A simple target helps you see progress faster.',
      tone: 'info',
    });
  }

  return (
    <PageScaffold
      scroll
      maxWidth={1280}
      contentContainerStyle={{
        paddingBottom: bottomPadding,
      }}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <PageHeader
          title={t('dashboard')}
          subtitle={user?.name ? `${t('welcomeBack')} ${user.name}` : (t('welcomeBack') || 'Welcome back')}
          actions={!isDesktop ? <AppSwitcherTrigger variant="header_inline" /> : undefined}
        />

        {/* Error State */}
        {(isSummaryError || isMonthlyError || isGoalsError || isBudgetsError) && (
          <ErrorBanner>
            <BodyMedium $color={theme.colors.danger}>{t('failedToLoad') || 'Failed to load data'}</BodyMedium>
            <Caption $color={theme.colors.danger + 'B3'} style={{ marginTop: 4 }}>
              {isSummaryError && isMonthlyError
                ? (t('failedToLoadDashboard') || 'Could not load your dashboard data. Please check your connection.')
                : isSummaryError
                  ? (t('failedToLoadBalance') || 'Could not load balance information.')
                  : isBudgetsError
                    ? (t('failedToLoadBudgets') || 'Could not load budget data.')
                    : (t('checkConnection') || 'Please check your connection and try again.')}
            </Caption>
            <Pressable
              onPress={() => {
                if (isSummaryError) refetchSummary();
                if (isMonthlyError) refetchMonthly();
                if (isGoalsError) refetchGoals();
                if (isBudgetsError) refetchBudgets();
              }}
              style={{
                backgroundColor: theme.colors.danger + '33',
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.md,
                marginTop: theme.spacing.md,
                alignSelf: 'flex-start',
              }}
            >
              <BodyMedium $color={theme.colors.danger}>{t('retry') || 'Retry'}</BodyMedium>
            </Pressable>
          </ErrorBanner>
        )}

        {/* Spending Anomaly Alert */}
        <SpendingAnomalyCard compact />

        {/* Spending Calendar Heat Map */}
        <SectionSpacing>
          <CollapsibleSection title={t('spendingCalendar') || 'Spending Calendar'} storageKey="dashboard_heatmap">
            {heatMap.isPending ? <Skeleton width="100%" height={200} /> : (
              <CalendarHeatMap
                data={heatMap.data}
                weeks={12}
                currency={heatMap.currency}
                onDayPress={(date, amount) => {
                  if (amount > 0) showToast(`${date}: ${formatCompactCurrency(amount, heatMap.currency)} ${t('spentOnDate') || 'spent'}`, 'info');
                }}
              />
            )}
          </CollapsibleSection>
        </SectionSpacing>

        {/* Stats Grid */}
        <View
          style={{
            flexDirection: statsCols > 1 ? 'row' : 'column',
            flexWrap: 'wrap',
            gap: statsGap,
            marginBottom: theme.spacing.xxl,
          }}
        >
          {/* Total Balance */}
          <View style={{ width: statsCardWidth, minWidth: isDesktop ? 200 : undefined }}>
            <StatCard style={theme.shadows.sm}>
              <StatRow>
                <Caption>{t('totalBalance')}</Caption>
                <IconCircle>
                  <DollarSign size={16} color={theme.colors.mutedForeground} />
                </IconCircle>
              </StatRow>
              {isPending ? (
                <Skeleton width={120} height={28} />
              ) : (
                <H2>{formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}</H2>
              )}
            </StatCard>
          </View>

          {/* Income */}
          {monthlyReport && (
            <View style={{ width: statsCardWidth, minWidth: isDesktop ? 200 : undefined }}>
              <StatCard style={theme.shadows.sm}>
                <StatRow>
                  <Caption>{t('income')}</Caption>
                  <IconCircle $bg={theme.colors.successMuted}>
                    <TrendingUp size={16} color={theme.colors.success} />
                  </IconCircle>
                </StatRow>
                <H2 $color={theme.colors.success}>
                  {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                </H2>
                <Caption style={{ marginTop: 4 }}>{t('thisMonth')}</Caption>
              </StatCard>
            </View>
          )}

          {/* Expenses */}
          {monthlyReport && (
            <View style={{ width: statsCardWidth, minWidth: isDesktop ? 200 : undefined }}>
              <StatCard style={theme.shadows.sm}>
                <StatRow>
                  <Caption>{t('expenses')}</Caption>
                  <IconCircle $bg={theme.colors.dangerMuted}>
                    <TrendingDown size={16} color={theme.colors.danger} />
                  </IconCircle>
                </StatRow>
                <H2 $color={theme.colors.danger}>
                  {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                </H2>
                <Caption style={{ marginTop: 4 }}>{t('thisMonth')}</Caption>
              </StatCard>
            </View>
          )}

          {/* Goals Progress */}
          <View style={{ width: statsCardWidth, minWidth: isDesktop ? 200 : undefined }}>
            <StatCard style={theme.shadows.sm}>
              <StatRow>
                <Caption>{t('financialGoals')}</Caption>
                <IconCircle>
                  <PiggyBank size={16} color={theme.colors.mutedForeground} />
                </IconCircle>
              </StatRow>
              <H2>{activeGoals} / {totalGoals}</H2>
              <Caption style={{ marginTop: 4 }}>{t('activeGoals')}</Caption>
            </StatCard>
          </View>

          {/* Budget Status */}
          {budgets.length > 0 && (
            <View style={{ width: statsCardWidth, minWidth: isDesktop ? 200 : undefined }}>
              <StatCard style={theme.shadows.sm}>
                <StatRow>
                  <Caption>{t('budgetStatus') || 'Budget'}</Caption>
                  <IconCircle $bg={budgetPercentage > 90 ? theme.colors.dangerMuted : budgetPercentage > 70 ? theme.colors.warningMuted : theme.colors.successMuted}>
                    <PieChart size={16} color={budgetPercentage > 90 ? theme.colors.danger : budgetPercentage > 70 ? theme.colors.warning : theme.colors.success} />
                  </IconCircle>
                </StatRow>
                <H2 $color={budgetPercentage > 90 ? theme.colors.danger : budgetPercentage > 70 ? theme.colors.warning : theme.colors.success}>
                  {budgetPercentage}%
                </H2>
                <Caption style={{ marginTop: 4 }}>
                  {formatCompactCurrency(totalSpent, 'USD')} / {formatCompactCurrency(totalBudget, 'USD')}
                </Caption>
              </StatCard>
            </View>
          )}
        </View>

        {/* AI Financial Advisor Card */}
        {aiStatus?.configured && (
          <AICardGradient
            colors={[theme.colors.primary, theme.colors.primaryHover] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={theme.shadows.glow(theme.colors.primary)}
          >
            <Link href="/(app)/(tabs)/wallet/chat" asChild>
              <Pressable style={({ pressed }) => [pressed && { opacity: 0.85 }]} accessibilityLabel={t('aiAdvisor') || 'AI Financial Advisor'} accessibilityRole="button">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 48, height: 48,
                      borderRadius: theme.radii.lg,
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: theme.spacing.lg,
                    }}
                  >
                    <Bot size={24} color={theme.colors.accentForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <BodyMedium $color={theme.colors.accentForeground} style={{ fontFamily: theme.typography.h3.fontFamily, fontSize: 16 }}>
                      {t('aiAdvisor') || 'AI Financial Advisor'}
                    </BodyMedium>
                    <Caption $color={theme.colors.accentForeground + 'B3'}>
                      {t('getPersonalizedAdvice') || 'Get personalized advice'}
                    </Caption>
                  </View>
                  <ArrowRight size={20} color={theme.colors.accentForeground} />
                </View>
              </Pressable>
            </Link>
            {/* Quick Action Chips */}
            <View style={{ flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <Link href={{ pathname: '/(app)/(tabs)/wallet/chat', params: { prompt: 'Analyze my spending this month' } }} asChild>
                <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <ChipButton>
                    <BarChart3 size={12} color={theme.colors.accentForeground} />
                    <Caption $color={theme.colors.accentForeground} style={{ marginLeft: 4 }}>
                      {t('analyzeSpending') || 'Analyze spending'}
                    </Caption>
                  </ChipButton>
                </Pressable>
              </Link>
              <Link href={{ pathname: '/(app)/(tabs)/wallet/chat', params: { prompt: 'How am I doing with my budgets?' } }} asChild>
                <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <ChipButton>
                    <PieChart size={12} color={theme.colors.accentForeground} />
                    <Caption $color={theme.colors.accentForeground} style={{ marginLeft: 4 }}>
                      {t('budgetCheck') || 'Budget check'}
                    </Caption>
                  </ChipButton>
                </Pressable>
              </Link>
              <Link href={{ pathname: '/(app)/(tabs)/wallet/chat', params: { prompt: 'Give me advice on reaching my goals faster' } }} asChild>
                <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <ChipButton>
                    <Target size={12} color={theme.colors.accentForeground} />
                    <Caption $color={theme.colors.accentForeground} style={{ marginLeft: 4 }}>
                      {t('goalAdvice') || 'Goal advice'}
                    </Caption>
                  </ChipButton>
                </Pressable>
              </Link>
              <Link href={{ pathname: '/(app)/(tabs)/wallet/chat', params: { prompt: 'Analyze my purchasing power and suggest how to protect my wealth from inflation' } }} asChild>
                <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <ChipButton>
                    <Shield size={12} color={theme.colors.accentForeground} />
                    <Caption $color={theme.colors.accentForeground} style={{ marginLeft: 4 }}>
                      {t('wealthProtection') || 'Wealth protection'}
                    </Caption>
                  </ChipButton>
                </Pressable>
              </Link>
            </View>
          </AICardGradient>
        )}

        {/* Real Value - Purchasing Power (always visible) */}
        <SectionSpacing>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
            <H3 style={{ fontSize: 16 }}>{t('realValue') || 'Real Value'}</H3>
            <Link href="/(app)/real-value" asChild>
              <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
                <Caption style={{ marginRight: 4 }}>{t('viewRealValueDetails') || 'View Details'}</Caption>
                <ArrowRight size={14} color={theme.colors.mutedForeground} />
              </Pressable>
            </Link>
          </View>
          <RealValueCard compact />
        </SectionSpacing>

        {/* Financial Health Score */}
        <SectionSpacing>
          <CollapsibleSection title={t('financialHealth') || 'Financial Health'} storageKey="dashboard_health">
            <HealthScoreCard compact onViewDetails={handleOpenHealthScoreDetails} />
          </CollapsibleSection>
        </SectionSpacing>

        {/* Smart AI Advice */}
        <SectionSpacing>
          <CollapsibleSection title={t('smartAdvice') || 'AI Advisor'} storageKey="dashboard_advice">
            <SmartAdviceCard />
          </CollapsibleSection>
        </SectionSpacing>

        {/* Quick Notes */}
        <SectionSpacing>
          <CollapsibleSection title={t('quickNotes') || 'Quick Notes'} storageKey="dashboard_notes">
            <QuickNotesCard />
          </CollapsibleSection>
        </SectionSpacing>

        {/* Weekly Recap Card */}
        {aiStatus?.configured && (
          <SectionSpacing>
            <CollapsibleSection title={t('weeklyRecap') || 'Weekly Recap'} storageKey="dashboard_recap">
              <WeeklyRecapCard />
            </CollapsibleSection>
          </SectionSpacing>
        )}

        {/* Financial News */}
        <SectionSpacing>
          <CollapsibleSection title={t('financialNews') || 'Financial News'} storageKey="dashboard_news" defaultCollapsed>
            <FinancialNewsCard />
          </CollapsibleSection>
        </SectionSpacing>

        {/* Spending Forecast */}
        {forecast && forecast.avg_daily_spend > 0 && (
          <SectionSpacing>
            <CollapsibleSection title={t('spendingForecast') || 'Spending Forecast'} storageKey="dashboard_forecast">
              <ForecastCard style={theme.shadows.sm}>
                <Caption style={{ marginBottom: theme.spacing.md }}>{t('basedOnLast30Days') || 'Based on last 30 days'}</Caption>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Caption>{t('dailySpend') || 'Daily Spend'}</Caption>
                    <BodyMedium $color={theme.colors.danger}>
                      -{formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                    </BodyMedium>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Caption>{t('dailyIncome') || 'Daily Income'}</Caption>
                    <BodyMedium $color={theme.colors.success}>
                      +{formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                    </BodyMedium>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Caption>{t('netFlow') || 'Net Flow'}</Caption>
                    <BodyMedium $color={forecast.net_daily_flow >= 0 ? theme.colors.success : theme.colors.danger}>
                      {`${forecast.net_daily_flow >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(forecast.net_daily_flow), forecast.currency)}`}
                    </BodyMedium>
                  </View>
                </View>
                {forecast.net_daily_flow < 0 && forecast.days_until_zero > 0 && (
                  <View style={{
                    backgroundColor: theme.colors.dangerMuted,
                    borderWidth: 1, borderColor: theme.colors.danger + '33',
                    padding: theme.spacing.md, borderRadius: theme.radii.md,
                    marginTop: theme.spacing.lg,
                  }}>
                    <Caption $color={theme.colors.danger} style={{ textAlign: 'center', fontFamily: theme.typography.bodyMedium.fontFamily }}>
                      {t('balanceReachesZeroIn') || `At this rate, balance reaches zero in ${forecast.days_until_zero} days`}
                    </Caption>
                  </View>
                )}
              </ForecastCard>
            </CollapsibleSection>
          </SectionSpacing>
        )}

        {/* Insights */}
        <SectionSpacing>
          <CollapsibleSection title={t('insights') || 'Insights'} storageKey="dashboard_insights">
            <ForecastCard style={theme.shadows.sm}>
              <View style={{ gap: theme.spacing.md }}>
                {insights.length === 0 ? (
                  <InsightCard>
                    <Caption>{t('addTransactionsForInsights') || 'Add a few transactions to unlock personalized insights.'}</Caption>
                  </InsightCard>
                ) : (
                  insights.slice(0, 3).map((insight, idx) => (
                    <InsightCard key={idx}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <InsightDot $tone={insight.tone} />
                        <View style={{ flex: 1 }}>
                          <BodyMedium style={{ fontSize: 13 }}>{insight.title}</BodyMedium>
                          <Caption style={{ marginTop: 4 }}>{insight.detail}</Caption>
                        </View>
                      </View>
                    </InsightCard>
                  ))
                )}
              </View>
            </ForecastCard>
          </CollapsibleSection>
        </SectionSpacing>

        {/* CoAI Widget */}
        <SectionSpacing>
          <CollapsibleSection title={t('currencyConverter') || 'CoAI'} storageKey="dashboard_converter">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: theme.spacing.md }}>
              <Link href="/(app)/(tabs)/wallet/convert" asChild>
                <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
                  <Caption style={{ marginRight: 4 }}>{t('fullConverter') || 'Full converter'}</Caption>
                  <ArrowRight size={14} color={theme.colors.mutedForeground} />
                </Pressable>
              </Link>
            </View>
            <CurrencyConverter variant="full" showQuickSelect={false} />
          </CollapsibleSection>
        </SectionSpacing>

        {/* Two Column Layout for Desktop */}
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: theme.spacing.xxl }}>
          {/* Left Column - Wallet Balances */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <SectionSpacing>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
                <H3 style={{ fontSize: 16 }}>{t('walletBalances') || 'Wallet Balances'}</H3>
                <Link href="/(app)/(tabs)/wallet" asChild>
                  <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
                    <Caption style={{ marginRight: 4 }}>{t('viewAll')}</Caption>
                    <ArrowRight size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                </Link>
              </View>
              {isPending ? (
                <ActivityIndicator color={theme.colors.mutedForeground} />
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  {(summary?.balances || []).slice(0, isDesktop ? 5 : 3).map((balance) => (
                    <BalanceRow key={balance.currency} style={theme.shadows.sm}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconCircle style={{ marginRight: theme.spacing.md }}>
                          <Wallet size={16} color={theme.colors.secondaryForeground} />
                        </IconCircle>
                        <BodyMedium numberOfLines={1}>{balance.currency}</BodyMedium>
                      </View>
                      <BodyMedium numberOfLines={1} style={{ fontFamily: theme.typography.h3.fontFamily }}>
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </BodyMedium>
                    </BalanceRow>
                  ))}
                  {(summary?.balances || []).length === 0 && (
                    <EmptyCard>
                      <Wallet size={28} color={theme.colors.subtleForeground} />
                      <Caption style={{ marginTop: theme.spacing.sm }}>{t('noBalancesYet') || 'No balances yet'}</Caption>
                    </EmptyCard>
                  )}
                </View>
              )}
            </SectionSpacing>
          </View>

          {/* Right Column - Recent Transactions */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
              <H3 style={{ fontSize: 16 }}>{t('recentTransactions')}</H3>
              <Link href="/(app)/(tabs)/wallet/history" asChild>
                <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
                  <Caption style={{ marginRight: 4 }}>{t('viewAll')}</Caption>
                  <ArrowRight size={14} color={theme.colors.mutedForeground} />
                </Pressable>
              </Link>
            </View>
            {isPending ? (
              <ActivityIndicator color={theme.colors.mutedForeground} />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {(summary?.recent_transactions || []).slice(0, isDesktop ? 6 : 5).map((tx) => (
                  <TransactionRow key={tx.id} style={theme.shadows.sm}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ marginRight: theme.spacing.md }}>
                        <StyledCategoryIcon category={tx.category || 'other'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <BodyMedium numberOfLines={1} style={{ fontSize: 13 }}>
                          {tx.description || tx.category || 'Transaction'}
                        </BodyMedium>
                        <Caption>{formatDate(tx.created_at)}</Caption>
                      </View>
                    </View>
                    <BodyMedium
                      $color={tx.type === 'credit' ? theme.colors.success : theme.colors.danger}
                      style={{ marginLeft: theme.spacing.sm, fontFamily: theme.typography.h3.fontFamily }}
                    >
                      {formatTransactionAmount(tx)}
                    </BodyMedium>
                  </TransactionRow>
                ))}
                {(summary?.recent_transactions || []).length === 0 && (
                  <EmptyCard>
                    <CreditCard size={28} color={theme.colors.subtleForeground} />
                    <Caption style={{ marginTop: theme.spacing.sm }}>{t('noTransactionsYet') || 'No transactions yet'}</Caption>
                    <Link href={'/transaction-create' as any} asChild>
                      <Pressable style={{
                        backgroundColor: theme.colors.primary,
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.sm,
                        borderRadius: theme.radii.md,
                        marginTop: theme.spacing.md,
                      }}>
                        <BodyMedium $color={theme.colors.primaryForeground}>{t('addTransaction')}</BodyMedium>
                      </Pressable>
                    </Link>
                  </EmptyCard>
                )}
              </View>
            )}
          </View>
        </View>
    </PageScaffold>
  );
}
