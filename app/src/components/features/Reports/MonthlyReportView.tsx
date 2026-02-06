import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, BarChart3, PieChart, TrendingUp, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { safeMax } from '../../../utils/dateRange';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import type { MonthlyReport, CategoryReport, TrendsReport, ForecastReport } from '../../../types/goal';

// Shared chart components
export function ComparisonBarChart({
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
      <View>
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <TrendingUp size={14} color="rgb(16, 185, 129)" />
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
      <View>
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <TrendingUp size={14} color="rgb(220, 38, 38)" style={{ transform: [{ rotate: '180deg' }] }} />
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

export function HorizontalBarChart({
  data,
  maxValue,
  labelKey,
  valueKey,
  formatValue,
}: {
  data: any[];
  maxValue: number;
  labelKey: string;
  valueKey: string;
  formatValue?: (value: number) => string;
}) {
  return (
    <View className="gap-3">
      {data.map((item, index) => {
        const value = item[valueKey];
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = CATEGORY_COLORS[item[labelKey]?.toLowerCase()] || 'rgb(212, 175, 55)';

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

export function TrendsChart({
  data,
  t,
}: {
  data: { period: string; income: number; expenses: number; net: number }[];
  t: (key: string) => string;
}) {
  if (!data || data.length === 0) return null;

  const maxValue = data.length > 0 ? Math.max(...data.map((d) => Math.max(d.income, d.expenses))) : 0;

  return (
    <View>
      <View className="flex-row items-end justify-between gap-2" style={{ height: 100 }}>
        {data.slice(-6).map((item, index) => {
          const incomeHeight = maxValue > 0 ? (item.income / maxValue) * 80 : 0;
          const expenseHeight = maxValue > 0 ? (item.expenses / maxValue) * 80 : 0;

          return (
            <View key={index} className="flex-1 items-center">
              <View className="flex-row gap-1 items-end" style={{ height: 80 }}>
                <View
                  className="w-2 rounded-t bg-success"
                  style={{ height: Math.max(incomeHeight, 2) }}
                />
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

interface MonthlyReportViewProps {
  year: number;
  month: number;
  fromDate?: string;
  toDate?: string;
  isTablet?: boolean;
  categoryCardWidth: number;
  categoryCols: number;
}

export function MonthlyReportView({
  year,
  month,
  fromDate,
  toDate,
  isTablet = false,
  categoryCardWidth,
  categoryCols,
}: MonthlyReportViewProps) {
  const { t } = useLanguage();

  const { data: monthlyReport, isPending: isLoadingMonthly, isError: isMonthlyError } = useQuery({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => api.reports.monthly(year, month),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryReport, isPending: isLoadingCategory } = useQuery({
    queryKey: ['reports', 'category', fromDate, toDate, year, month],
    queryFn: () => {
      if (fromDate && toDate) {
        return api.reports.category(fromDate, toDate);
      }
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      return api.reports.category(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendsReport, isPending: isLoadingTrends } = useQuery({
    queryKey: ['reports', 'trends', 6],
    queryFn: () => api.reports.trends(6),
    staleTime: 5 * 60 * 1000,
  });

  const { data: forecast, isPending: isLoadingForecast } = useQuery({
    queryKey: ['reports', 'forecast'],
    queryFn: () => api.reports.forecast(),
    staleTime: 5 * 60 * 1000,
  });

  const isPending = isLoadingMonthly || isLoadingCategory || isLoadingTrends || isLoadingForecast;

  if (isPending) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  if (isMonthlyError) {
    return (
      <View className="bg-card p-6 rounded-xl items-center">
        <AlertCircle size={48} color="rgb(220, 38, 38)" />
        <Text className="text-foreground font-semibold mt-4 text-lg">{t('failedToLoadReport')}</Text>
        <Text className="text-muted-foreground mt-2 text-center">{t('checkConnection')}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Monthly Summary Card */}
      {monthlyReport && (
        <View className="bg-card p-6 rounded-xl mb-6">
          <View className="flex-row items-center mb-4">
            <View className="bg-secondary p-2 rounded-lg mr-3">
              <Calendar size={20} color="rgb(148, 163, 184)" />
            </View>
            <Text className="text-foreground font-semibold">{t('monthlySummary')}</Text>
          </View>

          <ComparisonBarChart
            income={monthlyReport.income}
            expenses={monthlyReport.expenses}
            currency={monthlyReport.currency}
            t={t}
          />

          <View className="flex-row gap-4 mt-6">
            <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
              <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
              <Text
                className={`text-lg font-bold ${
                  monthlyReport.net >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {`${monthlyReport.net >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(monthlyReport.net), monthlyReport.currency)}`}
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

      {/* Forecast Card */}
      {forecast && (
        <View className="bg-card p-6 rounded-xl mb-6">
          <View className="flex-row items-center mb-4">
            <View className="bg-accent/20 p-2 rounded-lg mr-3">
              <TrendingUp size={20} color="rgb(212, 175, 55)" />
            </View>
            <Text className="text-foreground font-semibold">{t('forecast')}</Text>
          </View>

          {forecast.days_until_zero > 0 ? (
            <View className="gap-4">
              <View className="flex-row gap-4">
                <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                  <Text className="text-muted-foreground text-xs mb-1">{t('avgDaily')} {t('income')}</Text>
                  <Text className="text-success text-lg font-bold">
                    {formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                  </Text>
                </View>
                <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                  <Text className="text-muted-foreground text-xs mb-1">{t('avgDaily')} {t('expenses')}</Text>
                  <Text className="text-danger text-lg font-bold">
                    {formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                  </Text>
                </View>
              </View>

              {forecast.net_daily_flow < 0 && (
                <View className="bg-danger/10 border border-danger/30 p-4 rounded-xl flex-row items-center">
                  <AlertCircle size={20} color="rgb(220, 38, 38)" />
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-medium">{t('daysUntilZero')}</Text>
                    <Text className="text-danger text-xl font-bold">
                      {forecast.days_until_zero} {t('days')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text className="text-muted-foreground">{t('noForecastData')}</Text>
          )}
        </View>
      )}

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

          <View className="mb-6">
            <HorizontalBarChart
              data={categoryReport.categories.slice(0, 6)}
              maxValue={safeMax(categoryReport.categories.map((c) => c.amount))}
              labelKey="category"
              valueKey="amount"
              formatValue={(v) => formatCompactCurrency(v, categoryReport.currency)}
            />
          </View>

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
                    width: categoryCardWidth,
                    minWidth: categoryCols === 1 ? undefined : 200,
                  }}
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
      {!monthlyReport && !categoryReport && (
        <View className="bg-card p-8 rounded-xl items-center">
          <BarChart3 size={48} color="rgb(71, 71, 71)" />
          <Text className="text-foreground font-semibold mt-4 text-lg">{t('noDataAvailable')}</Text>
          <Text className="text-muted-foreground mt-2 text-center">
            {t('addTransaction')}
          </Text>
        </View>
      )}
    </View>
  );
}
