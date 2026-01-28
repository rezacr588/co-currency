import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Wallet, Calendar, ArrowUp, ArrowDown } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground } from '../../../src/constants/icons';

// Simple bar chart component using View widths
function HorizontalBarChart({
  data,
  maxValue,
  labelKey,
  valueKey,
  colorKey,
  formatValue,
}: {
  data: any[];
  maxValue: number;
  labelKey: string;
  valueKey: string;
  colorKey?: string;
  formatValue?: (value: number) => string;
}) {
  return (
    <View className="gap-3">
      {data.map((item, index) => {
        const value = item[valueKey];
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = colorKey ? item[colorKey] : CATEGORY_COLORS[item[labelKey]?.toLowerCase()] || 'rgb(212, 175, 55)';

        return (
          <View key={index}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-foreground text-sm capitalize">{item[labelKey]}</Text>
              <Text className="text-muted-foreground text-sm">
                {formatValue ? formatValue(value) : value}
              </Text>
            </View>
            <View className="h-3 bg-secondary rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Comparison bar chart for income vs expenses
function ComparisonBarChart({
  income,
  expenses,
  currency,
  t,
}: {
  income: number;
  expenses: number;
  currency: string;
  t: (key: string) => string;
}) {
  const maxValue = Math.max(income, expenses);
  const incomePercent = maxValue > 0 ? (income / maxValue) * 100 : 0;
  const expensePercent = maxValue > 0 ? (expenses / maxValue) * 100 : 0;

  return (
    <View className="gap-4">
      {/* Income Bar */}
      <View>
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <ArrowUp size={14} color="rgb(16, 185, 129)" />
            <Text className="text-foreground text-sm ml-1">{t('income')}</Text>
          </View>
          <Text className="text-success text-sm font-medium">
            {formatCompactCurrency(income, currency)}
          </Text>
        </View>
        <View className="h-4 bg-secondary rounded-full overflow-hidden">
          <View
            className="h-full rounded-full bg-success"
            style={{ width: `${incomePercent}%` }}
          />
        </View>
      </View>

      {/* Expenses Bar */}
      <View>
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <ArrowDown size={14} color="rgb(220, 38, 38)" />
            <Text className="text-foreground text-sm ml-1">{t('expenses')}</Text>
          </View>
          <Text className="text-danger text-sm font-medium">
            {formatCompactCurrency(expenses, currency)}
          </Text>
        </View>
        <View className="h-4 bg-secondary rounded-full overflow-hidden">
          <View
            className="h-full rounded-full bg-danger"
            style={{ width: `${expensePercent}%` }}
          />
        </View>
      </View>
    </View>
  );
}

// Donut/Ring chart placeholder using nested Views
function RingChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let currentAngle = 0;

  return (
    <View className="items-center">
      <View
        style={{ width: 160, height: 160 }}
        className="relative items-center justify-center"
      >
        {/* Background ring */}
        <View
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 20,
            borderColor: '#27272a',
            position: 'absolute',
          }}
        />
        {/* Simplified visualization - show percentages as stacked bars around center */}
        <View className="absolute items-center justify-center">
          <Text className="text-muted-foreground text-xs">{centerLabel}</Text>
          <Text className="text-foreground text-lg font-bold">{centerValue}</Text>
        </View>
      </View>
      {/* Legend */}
      <View className="flex-row flex-wrap justify-center gap-3 mt-4">
        {segments.slice(0, 4).map((segment, index) => (
          <View key={index} className="flex-row items-center">
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: segment.color }}
              className="mr-1"
            />
            <Text className="text-muted-foreground text-xs">
              {segment.label} ({formatNumber((segment.value / total) * 100, 0)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Trends mini line chart using bars
function TrendsChart({
  data,
  t,
}: {
  data: { period: string; income: number; expenses: number; net: number }[];
  t: (key: string) => string;
}) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expenses)));

  return (
    <View>
      <View className="flex-row items-end justify-between gap-2" style={{ height: 100 }}>
        {data.slice(-6).map((item, index) => {
          const incomeHeight = maxValue > 0 ? (item.income / maxValue) * 80 : 0;
          const expenseHeight = maxValue > 0 ? (item.expenses / maxValue) * 80 : 0;

          return (
            <View key={index} className="flex-1 items-center">
              <View className="flex-row gap-1 items-end" style={{ height: 80 }}>
                {/* Income bar */}
                <View
                  className="w-2 rounded-t bg-success"
                  style={{ height: Math.max(incomeHeight, 2) }}
                />
                {/* Expense bar */}
                <View
                  className="w-2 rounded-t bg-danger"
                  style={{ height: Math.max(expenseHeight, 2) }}
                />
              </View>
              <Text className="text-muted-foreground text-xs mt-1">
                {item.period.split('-')[1] || item.period}
              </Text>
            </View>
          );
        })}
      </View>
      {/* Legend */}
      <View className="flex-row justify-center gap-4 mt-3">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-success mr-1" />
          <Text className="text-muted-foreground text-xs">{t('income')}</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-danger mr-1" />
          <Text className="text-muted-foreground text-xs">{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const { data: monthlyReport, isPending: isLoadingMonthly } = useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => api.reports.monthly(),
  });

  const { data: categoryReport, isPending: isLoadingCategory } = useQuery({
    queryKey: ['reports', 'category'],
    queryFn: () => api.reports.category(),
  });

  const { data: networth, isPending: isLoadingNetworth } = useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.reports.networth(),
  });

  const { data: trendsReport, isPending: isLoadingTrends } = useQuery({
    queryKey: ['reports', 'trends'],
    queryFn: () => api.reports.trends(6),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
    setRefreshing(false);
  };

  const isPending = isLoadingMonthly || isLoadingCategory || isLoadingNetworth || isLoadingTrends;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-3xl font-bold text-foreground mb-6">{t('reportsAndStats')}</Text>

        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : (
          <>
            {/* Top Row: Net Worth and Monthly Summary */}
            <View style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: 16,
              marginBottom: 24,
            }}>
              {/* Net Worth Card */}
              {networth && (
                <View className="bg-card p-6 rounded-xl" style={{ flex: isTablet ? 1 : undefined }}>
                  <View className="flex-row items-center mb-4">
                    <View className="bg-accent/20 p-2 rounded-lg mr-3">
                      <Wallet size={20} color="rgb(212, 175, 55)" />
                    </View>
                    <Text className="text-muted-foreground">{t('netWorth')}</Text>
                  </View>
                  <Text className="text-4xl font-bold text-accent mb-4">
                    {formatCompactCurrency(networth.total_balance, networth.currency)}
                  </Text>

                  {/* Balance Distribution */}
                  {networth.balances && networth.balances.length > 0 && (
                    <View className="mt-2">
                      <Text className="text-muted-foreground text-sm mb-3">{t('balanceDistribution')}</Text>
                      <RingChart
                        segments={networth.balances.slice(0, 5).map((b) => ({
                          value: b.balance_in_base,
                          color: CATEGORY_COLORS[b.currency.toLowerCase()] || '#d4af37',
                          label: b.currency,
                        }))}
                        centerLabel={t('total')}
                        centerValue={formatCompactCurrency(networth.total_balance, networth.currency)}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Monthly Summary */}
              {monthlyReport && (
                <View className="bg-card p-6 rounded-xl" style={{ flex: isTablet ? 1 : undefined }}>
                  <View className="flex-row items-center mb-4">
                    <View className="bg-secondary p-2 rounded-lg mr-3">
                      <Calendar size={20} color="rgb(148, 163, 184)" />
                    </View>
                    <Text className="text-muted-foreground">{t('monthlySummary')}</Text>
                  </View>

                  {/* Income vs Expenses Chart */}
                  <ComparisonBarChart
                    income={monthlyReport.income}
                    expenses={monthlyReport.expenses}
                    currency={monthlyReport.currency}
                    t={t}
                  />

                  {/* Net & Savings Rate */}
                  <View className="flex-row gap-4 mt-6">
                    <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                      <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
                      <Text
                        className={`text-lg font-bold ${
                          monthlyReport.net >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {monthlyReport.net >= 0 ? '+' : ''}
                        {formatCompactCurrency(monthlyReport.net, monthlyReport.currency)}
                      </Text>
                    </View>
                    <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                      <Text className="text-muted-foreground text-xs mb-1">{t('savingsRate')}</Text>
                      <Text
                        className={`text-lg font-bold ${
                          monthlyReport.savings_rate >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatNumber(monthlyReport.savings_rate, 1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Trends Chart */}
            {trendsReport && trendsReport.trends && trendsReport.trends.length > 0 && (
              <View className="bg-card p-6 rounded-xl mb-6">
                <View className="flex-row items-center mb-4">
                  <View className="bg-secondary p-2 rounded-lg mr-3">
                    <BarChart3 size={20} color="rgb(148, 163, 184)" />
                  </View>
                  <Text className="text-foreground font-semibold">{t('incomeVsExpenses')}</Text>
                  <Text className="text-muted-foreground text-sm ml-2">
                    ({trendsReport.months} {t('months')})
                  </Text>
                </View>
                <TrendsChart data={trendsReport.trends} t={t} />
              </View>
            )}

            {/* Category Breakdown */}
            {categoryReport && categoryReport.categories.length > 0 && (
              <View className="bg-card p-6 rounded-xl">
                <View className="flex-row items-center mb-4">
                  <View className="bg-secondary p-2 rounded-lg mr-3">
                    <PieChart size={20} color="rgb(148, 163, 184)" />
                  </View>
                  <Text className="text-foreground font-semibold">{t('spendingByCategory')}</Text>
                </View>

                {/* Horizontal Bar Chart for Categories */}
                <View className="mb-6">
                  <HorizontalBarChart
                    data={categoryReport.categories.slice(0, 6)}
                    maxValue={Math.max(...categoryReport.categories.map((c) => c.amount))}
                    labelKey="category"
                    valueKey="amount"
                    formatValue={(v) => formatCompactCurrency(v, categoryReport.currency)}
                  />
                </View>

                {/* Category Cards Grid */}
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 16,
                }}>
                  {categoryReport.categories.slice(0, 6).map((cat) => {
                    const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || 'rgb(212, 175, 55)';
                    return (
                      <View
                        key={cat.category}
                        className="bg-secondary/30 border border-border p-4 rounded-xl"
                        style={{
                          width: isDesktop ? '31%' : isTablet ? '48%' : '100%',
                          minWidth: isDesktop ? 200 : undefined,
                        } as any}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="flex-row items-center">
                            <StyledCategoryIcon
                              category={cat.category}
                              size={16}
                              backgroundOpacity={0.15}
                              borderRadius={6}
                              padding={6}
                            />
                            <Text className="font-medium text-foreground capitalize ml-2">
                              {cat.category}
                            </Text>
                          </View>
                          <Text className="text-foreground font-semibold">
                            {formatCompactCurrency(cat.amount, categoryReport.currency)}
                          </Text>
                        </View>
                        <View className="h-2 bg-secondary rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: categoryColor,
                            }}
                          />
                        </View>
                        <View className="flex-row justify-between mt-2">
                          <Text className="text-muted-foreground text-sm">
                            {cat.count} {t('transactions')}
                          </Text>
                          <Text className="text-muted-foreground text-sm">
                            {formatNumber(cat.percentage, 1)}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Empty State */}
            {!monthlyReport && !categoryReport && !networth && (
              <View className="bg-card p-8 rounded-xl items-center">
                <BarChart3 size={48} color="rgb(71, 71, 71)" />
                <Text className="text-foreground font-semibold mt-4 text-lg">{t('noDataAvailable')}</Text>
                <Text className="text-muted-foreground mt-2 text-center">
                  {t('addTransaction')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
