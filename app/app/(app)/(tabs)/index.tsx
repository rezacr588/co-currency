import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, User, DollarSign, PiggyBank, CreditCard, Lightbulb, Bot, PieChart, Sparkles } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useColors } from '../../../src/context/ThemeContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { StyledCategoryIcon } from '../../../src/constants/icons';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { CurrencyConverter } from '../../../src/components/features/CurrencyConverter';
import { WeeklyRecapCard } from '../../../src/components/features/WeeklyRecap';
import { DailyTipCard } from '../../../src/components/features/DailyTip';
import { HealthScoreCard } from '../../../src/components/features/HealthScore';
import { CollapsibleSection } from '../../../src/components/ui/CollapsibleSection';
import type { Goal, Budget } from '../../../src/types/goal';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

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
        title: `${t('topSpending') || 'Top spending'}: ${readable}`,
        detail: t('considerWeeklyLimit') || 'Consider setting a small weekly limit to stay on track.',
        tone: 'info',
      });
    }
  }

  if (totalGoals === 0) {
    insights.push({
      title: t('setFirstGoal') || 'Set your first goal',
      detail: t('simpleTargetHelps') || 'A simple target helps you see progress faster.',
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
                <Pressable hitSlop={4} style={{ cursor: 'pointer' }} className="bg-secondary border border-border p-2.5 rounded-full">
                  <User size={20} color={colors.secondaryForeground} />
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

        {/* Stats Grid - Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column */}
        <View
          style={{
            flexDirection: isTablet ? 'row' : 'column',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {/* Total Balance */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card border border-border p-5 rounded-xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground text-sm">{t('totalBalance')}</Text>
                <DollarSign size={18} color={colors.mutedForeground} />
              </View>
              {isPending ? (
                <Skeleton width={120} height={28} />
              ) : (
                <Text className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}
                </Text>
              )}
            </View>
          </View>

          {/* Income */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-card border border-border p-5 rounded-xl h-full">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-muted-foreground text-sm">{t('income')}</Text>
                  <TrendingUp size={18} color={colors.success} />
                </View>
                <Text className="text-2xl font-bold text-success">
                  {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">{t('thisMonth')}</Text>
              </View>
            </View>
          )}

          {/* Expenses */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-card border border-border p-5 rounded-xl h-full">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-muted-foreground text-sm">{t('expenses')}</Text>
                  <TrendingDown size={18} color={colors.danger} />
                </View>
                <Text className="text-2xl font-bold text-danger">
                  {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">{t('thisMonth')}</Text>
              </View>
            </View>
          )}

          {/* Goals Progress */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card border border-border p-5 rounded-xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground text-sm">{t('financialGoals')}</Text>
                <PiggyBank size={18} color={colors.mutedForeground} />
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {activeGoals} / {totalGoals}
              </Text>
              <Text className="text-xs text-muted-foreground mt-1">{t('activeGoals')}</Text>
            </View>
          </View>

          {/* Budget Status */}
          {budgets.length > 0 && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-card border border-border p-5 rounded-xl h-full">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-muted-foreground text-sm">{t('budgetStatus') || 'Budget'}</Text>
                  <PieChart size={18} color={budgetPercentage > 90 ? colors.danger : budgetPercentage > 70 ? colors.warning : colors.success} />
                </View>
                <Text className={`text-2xl font-bold ${budgetPercentage > 90 ? 'text-danger' : budgetPercentage > 70 ? 'text-warning' : 'text-success'}`}>
                  {budgetPercentage}%
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  {formatCompactCurrency(totalSpent, 'USD')} / {formatCompactCurrency(totalBudget, 'USD')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* AI Financial Advisor Card */}
        {aiStatus?.configured && (
          <Link href="/(app)/(tabs)/wallet/chat" asChild>
            <Pressable style={{ cursor: 'pointer' }}>
              <View
                style={{
                  backgroundColor: colors.accent,
                  borderWidth: 1,
                  borderColor: colors.accent + '4D',
                  padding: 20,
                  borderRadius: 12,
                  marginBottom: 24,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.overlay,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}
                  >
                    <Bot size={24} color={colors.primaryForeground} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.primaryForeground, fontWeight: 'bold', fontSize: 16 }}>
                      {t('aiAdvisor') || 'AI Financial Advisor'}
                    </Text>
                    <Text style={{ color: colors.primaryForeground + 'B3', fontSize: 14, marginTop: 2 }}>
                      {t('getPersonalizedAdvice') || 'Get personalized advice'}
                    </Text>
                  </View>
                  <ArrowRight size={20} color={colors.primaryForeground} />
                </View>
              </View>
            </Pressable>
          </Link>
        )}

        {/* Financial Health Score */}
        <View className="mb-6">
          <CollapsibleSection title={t('financialHealth') || 'Financial Health'} storageKey="dashboard_health">
            <HealthScoreCard compact />
          </CollapsibleSection>
        </View>

        {/* Daily Tip Card */}
        <View className="mb-6">
          <CollapsibleSection title={t('dailyTip') || 'Daily Tip'} storageKey="dashboard_tip">
            <DailyTipCard />
          </CollapsibleSection>
        </View>

        {/* Weekly Recap Card */}
        {aiStatus?.configured && (
          <View className="mb-6">
            <CollapsibleSection title={t('weeklyRecap') || 'Weekly Recap'} storageKey="dashboard_recap">
              <WeeklyRecapCard />
            </CollapsibleSection>
          </View>
        )}

        {/* Spending Forecast */}
        {forecast && forecast.avg_daily_spend > 0 && (
          <View className="mb-6">
            <CollapsibleSection title={t('spendingForecast') || 'Spending Forecast'} storageKey="dashboard_forecast">
              <View className="bg-card border border-border p-5 rounded-xl">
                <Text className="text-xs text-muted-foreground mb-4">{t('basedOnLast30Days') || 'Based on last 30 days'}</Text>
                <View className="flex-row justify-between">
                  <View className="items-center flex-1">
                    <Text className="text-xs text-muted-foreground">{t('dailySpend') || 'Daily Spend'}</Text>
                    <Text className="text-base font-semibold text-danger">
                      -{formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-xs text-muted-foreground">{t('dailyIncome') || 'Daily Income'}</Text>
                    <Text className="text-base font-semibold text-success">
                      +{formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-xs text-muted-foreground">{t('netFlow') || 'Net Flow'}</Text>
                    <Text className={`text-base font-semibold ${forecast.net_daily_flow >= 0 ? 'text-success' : 'text-danger'}`}>
                      {`${forecast.net_daily_flow >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(forecast.net_daily_flow), forecast.currency)}`}
                    </Text>
                  </View>
                </View>
                {forecast.net_daily_flow < 0 && forecast.days_until_zero > 0 && (
                  <View className="bg-danger/10 border border-danger/20 p-3 rounded-lg mt-4">
                    <Text className="text-danger text-sm font-medium text-center">
                      ⚠️ {t('balanceReachesZeroIn') || `At this rate, balance reaches zero in ${forecast.days_until_zero} days`}
                    </Text>
                  </View>
                )}
              </View>
            </CollapsibleSection>
          </View>
        )}

        {/* Insights */}
        <View className="mb-6">
          <CollapsibleSection title={t('insights') || 'Insights'} storageKey="dashboard_insights">
            <View className="bg-card border border-border p-5 rounded-xl">
              <View className="gap-3">
                {insights.length === 0 ? (
                  <View className="bg-muted border border-border p-4 rounded-lg">
                    <Text className="text-muted-foreground text-sm">
                      {t('addTransactionsForInsights') || 'Add a few transactions to unlock personalized insights.'}
                    </Text>
                  </View>
                ) : (
                  insights.slice(0, 3).map((insight, idx) => (
                    <View key={idx} className="bg-muted border border-border p-4 rounded-lg">
                      <View className="flex-row items-start">
                        <View
                          className={`w-2 h-2 rounded-full mt-1.5 mr-3 ${
                            insight.tone === 'warning'
                              ? 'bg-warning'
                              : insight.tone === 'success'
                                ? 'bg-success'
                                : 'bg-accent'
                          }`}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-foreground">{insight.title}</Text>
                          <Text className="text-xs text-muted-foreground mt-1">{insight.detail}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </CollapsibleSection>
        </View>

        {/* Currency Converter Widget */}
        <View className="mb-6">
          <CollapsibleSection title={t('currencyConverter') || 'Currency Converter'} storageKey="dashboard_converter">
            <View className="flex-row items-center justify-end mb-3">
              <Link href="/(app)/(tabs)/wallet/convert" asChild>
                <Pressable hitSlop={8} style={{ cursor: 'pointer', minHeight: 44, justifyContent: 'center' }} className="flex-row items-center">
                  <Text className="text-muted-foreground text-sm mr-1">{t('fullConverter') || 'Full converter'}</Text>
                  <ArrowRight size={14} color={colors.mutedForeground} />
                </Pressable>
              </Link>
            </View>
            <CurrencyConverter variant="full" showQuickSelect={false} />
          </CollapsibleSection>
        </View>

        {/* Two Column Layout for Desktop */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: 24,
          }}
        >
          {/* Left Column - Wallet Balances */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-semibold text-foreground">{t('walletBalances') || 'Wallet Balances'}</Text>
                <Link href="/(app)/(tabs)/wallet" asChild>
                  <Pressable hitSlop={8} style={{ cursor: 'pointer', minHeight: 44, justifyContent: 'center' }} className="flex-row items-center">
                    <Text className="text-muted-foreground text-sm mr-1">{t('viewAll')}</Text>
                    <ArrowRight size={14} color={colors.mutedForeground} />
                  </Pressable>
                </Link>
              </View>
              {isPending ? (
                <ActivityIndicator color={colors.mutedForeground} />
              ) : (
                <View className="gap-2">
                  {(summary?.balances || []).slice(0, isDesktop ? 5 : 3).map((balance) => (
                    <View
                      key={balance.currency}
                      className="bg-card border border-border p-4 rounded-lg flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <View className="bg-secondary p-2 rounded-md mr-3">
                          <Wallet size={18} color={colors.secondaryForeground} />
                        </View>
                        <Text className="text-base font-medium text-foreground">
                          {balance.currency}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-foreground">
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </Text>
                    </View>
                  ))}
                  {(summary?.balances || []).length === 0 && (
                    <View className="bg-card border border-border p-6 rounded-lg items-center">
                      <Wallet size={28} color={colors.subtleForeground} />
                      <Text className="text-muted-foreground mt-2 text-sm">{t('noBalancesYet') || 'No balances yet'}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Right Column - Recent Transactions */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold text-foreground">{t('recentTransactions')}</Text>
              <Link href="/(app)/(tabs)/wallet/history" asChild>
                <Pressable hitSlop={8} style={{ cursor: 'pointer', minHeight: 44, justifyContent: 'center' }} className="flex-row items-center">
                  <Text className="text-muted-foreground text-sm mr-1">{t('viewAll')}</Text>
                  <ArrowRight size={14} color={colors.mutedForeground} />
                </Pressable>
              </Link>
            </View>
            {isPending ? (
              <ActivityIndicator color={colors.mutedForeground} />
            ) : (
              <View className="gap-2">
                {(summary?.recent_transactions || []).slice(0, isDesktop ? 6 : 5).map((tx) => (
                  <View
                    key={tx.id}
                    className="bg-card border border-border p-4 rounded-lg flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1">
                      <View className="mr-3">
                        <StyledCategoryIcon
                          category={tx.category || 'other'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
                          {tx.description || tx.category || 'Transaction'}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {formatDate(tx.created_at)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`text-base font-semibold ml-2 ${
                        tx.type === 'credit' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {`${tx.type === 'credit' ? '+' : '-'}${formatCompactCurrency(tx.amount, tx.currency)}`}
                    </Text>
                  </View>
                ))}
                {(summary?.recent_transactions || []).length === 0 && (
                  <View className="bg-card border border-border p-6 rounded-lg items-center">
                    <CreditCard size={28} color={colors.subtleForeground} />
                    <Text className="text-muted-foreground mt-2 text-sm">{t('noTransactionsYet') || 'No transactions yet'}</Text>
                    <Link href="/(app)/(tabs)/add" asChild>
                      <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-4 py-2 rounded-lg mt-3">
                        <Text className="text-accent-foreground font-medium text-sm">{t('addTransaction')}</Text>
                      </Pressable>
                    </Link>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}
