import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ArrowRight, User, DollarSign, PiggyBank, Lightbulb, Bot, PieChart } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency } from '../../../src/utils/format';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { WeeklyRecapCard } from '../../../src/components/features/WeeklyRecap';
import { DailyTipCard } from '../../../src/components/features/DailyTip';
import { HealthScoreCard } from '../../../src/components/features/HealthScore';
import type { Goal, Budget } from '../../../src/types/goal';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  // Calculate grid item widths for mobile layouts
  const containerPadding = isDesktop ? 32 : 16;
  const gridGap = isDesktop ? 12 : 8;
  const availableWidth = width - containerPadding * 2;
  // Stats grid: 2 columns with 1 gap on mobile
  const mobileItemWidth = (availableWidth - gridGap) / 2;

  const { data: summary, isPending, isError: isSummaryError } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
  });

  const { data: monthlyReport, isError: isMonthlyError } = useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => api.reports.monthly(),
  });

  const { data: goalsData, isError: isGoalsError } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });
  const goals: Goal[] | undefined = goalsData?.goals;

  const { data: budgetsData, isError: isBudgetsError } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
  });
  const budgets: Budget[] = budgetsData?.budgets || [];

  const { data: forecast } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.reports.forecast(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.ai.getStatus(),
  });

  // Calculate stats
  const totalGoals = goals?.length || 0;
  const activeGoals = goals?.filter((g) => g.current_amount < g.target_amount).length || 0;

  // Calculate budget stats
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
        title: 'Spending exceeds income',
        detail: `You spent ${formatCompactCurrency(expenses - income, monthlyReport.currency)} more than you earned this month.`,
        tone: 'warning',
      });
    } else if (income > 0) {
      const savingsRate = (income - expenses) / income;
      insights.push({
        title: `Savings rate: ${Math.round(savingsRate * 100)}%`,
        detail: savingsRate < 0.2
          ? 'Try nudging this toward 20% by trimming one category.'
          : 'Nice work — keep this pace to grow your savings.',
        tone: savingsRate < 0.2 ? 'info' : 'success',
      });
    }
  }

  if (summary?.recent_transactions?.length) {
    const categoryCounts = summary.recent_transactions
      .filter((tx: any) => tx?.type === 'debit' && tx?.category)
      .reduce((acc: Record<string, number>, tx: any) => {
        acc[tx.category] = (acc[tx.category] || 0) + 1;
        return acc;
      }, {});
    const topCategory = Object.keys(categoryCounts).sort(
      (a, b) => categoryCounts[b] - categoryCounts[a]
    )[0];
    if (topCategory) {
      const readable = topCategory.replace(/_/g, ' ');
      insights.push({
        title: `Top spending: ${readable}`,
        detail: 'Consider setting a small weekly limit to stay on track.',
        tone: 'info',
      });
    }
  }

  if (totalGoals === 0) {
    insights.push({
      title: 'Set your first goal',
      detail: 'A simple target helps you see progress faster.',
      tone: 'info',
    });
  }


  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: isDesktop ? 1400 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
          paddingBottom: bottomPadding,
        }}
      >
        {/* Error State */}
        {(isSummaryError || isMonthlyError || isGoalsError || isBudgetsError) && (
          <View className="bg-danger-muted border border-danger/20 p-4 rounded-xl mb-4">
            <Text className="text-danger font-medium">{t('failedToLoad')}</Text>
            <Text className="text-danger/70 text-sm mt-1">
              {t('checkConnection') || 'Please check your connection and try again.'}
            </Text>
          </View>
        )}

        {/* Mobile Header - Only show on mobile */}
        {!isDesktop && (
          <View className="mb-6">
            {/* Logo Row */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-primary">CoFinance</Text>
              <Link href="/(app)/profile" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="bg-secondary border border-border p-2.5 rounded-full">
                  <User size={20} color="#a1a1aa" />
                </Pressable>
              </Link>
            </View>
            {/* Welcome Row */}
            <View>
              <Text className="text-muted-foreground text-sm">{t('welcomeBack')}</Text>
              <Text className="text-xl font-bold text-foreground">{user?.name}</Text>
            </View>
          </View>
        )}

        {/* Stats Grid - Desktop: 4+ columns, Tablet: 2 columns, Mobile: 2 columns compact */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: isDesktop ? 12 : 8,
            marginBottom: isDesktop ? 24 : 16,
          }}
        >
          {/* Total Balance */}
          <View style={{ width: isDesktop ? undefined : mobileItemWidth, flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 200 : undefined }}>
            <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl h-full`}>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-muted-foreground text-xs">{t('totalBalance')}</Text>
                <DollarSign size={14} color="#71717a" />
              </View>
              {isPending ? (
                <Skeleton width={80} height={22} />
              ) : (
                <Text className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold text-foreground`}>
                  {formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}
                </Text>
              )}
            </View>
          </View>

          {/* Income */}
          {monthlyReport && (
            <View style={{ width: isDesktop ? undefined : mobileItemWidth, flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 200 : undefined }}>
              <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl h-full`}>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-muted-foreground text-xs">{t('income')}</Text>
                  <TrendingUp size={14} color="#22c55e" />
                </View>
                <Text className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold text-success`}>
                  {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                </Text>
              </View>
            </View>
          )}

          {/* Expenses */}
          {monthlyReport && (
            <View style={{ width: isDesktop ? undefined : mobileItemWidth, flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 200 : undefined }}>
              <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl h-full`}>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-muted-foreground text-xs">{t('expenses')}</Text>
                  <TrendingDown size={14} color="#ef4444" />
                </View>
                <Text className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold text-danger`}>
                  {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                </Text>
              </View>
            </View>
          )}

          {/* Goals Progress */}
          <View style={{ width: isDesktop ? undefined : mobileItemWidth, flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 200 : undefined }}>
            <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl h-full`}>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-muted-foreground text-xs">{t('financialGoals')}</Text>
                <PiggyBank size={14} color="#71717a" />
              </View>
              <Text className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold text-foreground`}>
                {activeGoals} / {totalGoals}
              </Text>
            </View>
          </View>

          {/* Budget Status */}
          {budgets.length > 0 && (
            <View style={{ width: isDesktop ? undefined : mobileItemWidth, flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 200 : undefined }}>
              <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl h-full`}>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-muted-foreground text-xs">{t('budgetStatus') || 'Budget'}</Text>
                  <PieChart size={14} color={budgetPercentage > 90 ? '#ef4444' : budgetPercentage > 70 ? '#f59e0b' : '#22c55e'} />
                </View>
                <Text className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold ${budgetPercentage > 90 ? 'text-danger' : budgetPercentage > 70 ? 'text-warning' : 'text-success'}`}>
                  {budgetPercentage}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* AI Financial Advisor Card - Compact on mobile */}
        {aiStatus?.configured && (
          <Link href="/(app)/(tabs)/wallet/chat" asChild>
            <Pressable style={{ cursor: 'pointer' }}>
              <View
                style={{
                  backgroundColor: '#d4af37',
                  borderWidth: 1,
                  borderColor: 'rgba(212, 175, 55, 0.3)',
                  padding: isDesktop ? 20 : 12,
                  borderRadius: 12,
                  marginBottom: isDesktop ? 24 : 12,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: isDesktop ? 48 : 36,
                      height: isDesktop ? 48 : 36,
                      borderRadius: 10,
                      backgroundColor: 'rgba(0, 0, 0, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: isDesktop ? 16 : 10,
                    }}
                  >
                    <Bot size={isDesktop ? 24 : 18} color="#09090b" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: '#09090b', fontWeight: 'bold', fontSize: isDesktop ? 16 : 14 }}>
                      {t('aiAdvisor') || 'AI Financial Advisor'}
                    </Text>
                    <Text style={{ color: 'rgba(9, 9, 11, 0.7)', fontSize: 12 }}>
                      Get personalized advice
                    </Text>
                  </View>
                  <ArrowRight size={18} color="#09090b" />
                </View>
              </View>
            </Pressable>
          </Link>
        )}

        {/* Financial Health Score */}
        <View className={isDesktop ? 'mb-6' : 'mb-4'}>
          <HealthScoreCard compact />
        </View>

        {/* Daily Tip Card */}
        <View className={isDesktop ? 'mb-6' : 'mb-4'}>
          <DailyTipCard />
        </View>

        {/* Weekly Recap Card */}
        {aiStatus?.configured && (
          <View className={isDesktop ? 'mb-6' : 'mb-4'}>
            <WeeklyRecapCard />
          </View>
        )}

        {/* Spending Forecast - Compact on mobile */}
        {forecast && forecast.avg_daily_spend > 0 && (
          <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl ${isDesktop ? 'mb-6' : 'mb-4'}`}>
            <View className="flex-row items-center mb-3">
              <View className={`${isDesktop ? 'w-10 h-10' : 'w-8 h-8'} rounded-full bg-secondary items-center justify-center mr-2`}>
                {forecast.net_daily_flow >= 0 ? (
                  <TrendingUp size={isDesktop ? 20 : 16} color="#22c55e" />
                ) : (
                  <TrendingDown size={isDesktop ? 20 : 16} color="#ef4444" />
                )}
              </View>
              <View>
                <Text className="text-sm font-semibold text-foreground">Spending Forecast</Text>
                <Text className="text-xs text-muted-foreground">Last 30 days</Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-xs text-muted-foreground">Spend/day</Text>
                <Text className="text-sm font-semibold text-danger">
                  -{formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-xs text-muted-foreground">Income/day</Text>
                <Text className="text-sm font-semibold text-success">
                  +{formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-xs text-muted-foreground">Net</Text>
                <Text className={`text-sm font-semibold ${forecast.net_daily_flow >= 0 ? 'text-success' : 'text-danger'}`}>
                  {forecast.net_daily_flow >= 0 ? '+' : ''}{formatCompactCurrency(forecast.net_daily_flow, forecast.currency)}
                </Text>
              </View>
            </View>
            {forecast.net_daily_flow < 0 && forecast.days_until_zero > 0 && (
              <View className="bg-danger/10 border border-danger/20 p-2 rounded-lg mt-3">
                <Text className="text-danger text-xs font-medium text-center">
                  ⚠️ Balance reaches zero in {forecast.days_until_zero} days
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Insights - Compact on mobile */}
        <View className={`bg-card border border-border ${isDesktop ? 'p-5' : 'p-3'} rounded-xl ${isDesktop ? 'mb-6' : 'mb-4'}`}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`${isDesktop ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-secondary items-center justify-center mr-2`}>
                <Lightbulb size={isDesktop ? 18 : 14} color="#a1a1aa" />
              </View>
              <Text className="text-sm font-semibold text-foreground">Insights</Text>
            </View>
          </View>
          <View className="gap-2">
            {insights.length === 0 ? (
              <View className="bg-muted border border-border p-3 rounded-lg">
                <Text className="text-muted-foreground text-xs">
                  Add transactions to unlock insights.
                </Text>
              </View>
            ) : (
              insights.slice(0, isDesktop ? 3 : 2).map((insight, idx) => (
                <View key={idx} className="bg-muted border border-border p-2.5 rounded-lg">
                  <View className="flex-row items-start">
                    <View
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 mr-2 ${
                        insight.tone === 'warning'
                          ? 'bg-warning'
                          : insight.tone === 'success'
                            ? 'bg-success'
                            : 'bg-accent'
                      }`}
                    />
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-foreground">{insight.title}</Text>
                      <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>{insight.detail}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>

    </SafeAreaView>
  );
}
