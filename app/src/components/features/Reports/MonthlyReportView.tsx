import { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { safeMax } from '../../../utils/dateRange';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import { CashFlowProjectionCard } from './CashFlowProjectionCard';
import { SpendingAnomalyCard } from './SpendingAnomalyCard';
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
  const theme = useTheme();
  const colors = theme.colors;
  const maxValue = Math.max(income, expenses);
  const incomePercent = maxValue > 0 ? (income / maxValue) * 100 : 0;
  const expensePercent = maxValue > 0 ? (expenses / maxValue) * 100 : 0;

  return (
    <View style={{ gap: 16 }}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TrendingUp size={14} color={colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>{t('income')}</Text>
          </View>
          <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
            {formatCompactCurrency(income, currency)}
          </Text>
        </View>
        <View style={{ height: 16, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
          <View
            style={{ height: '100%', borderRadius: 9999, backgroundColor: colors.success, width: `${incomePercent}%` }}
          />
        </View>
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TrendingUp size={14} color={colors.danger} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>{t('expenses')}</Text>
          </View>
          <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
            {formatCompactCurrency(expenses, currency)}
          </Text>
        </View>
        <View style={{ height: 16, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
          <View
            style={{ height: '100%', borderRadius: 9999, backgroundColor: colors.danger, width: `${expensePercent}%` }}
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
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{ gap: 12 }}>
      {data.map((item, index) => {
        const value = item[valueKey];
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = CATEGORY_COLORS[item[labelKey]?.toLowerCase()] || colors.accent;

        return (
          <View key={index}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, textTransform: 'capitalize' }}>{item[labelKey]}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                {formatValue ? formatValue(value) : value}
              </Text>
            </View>
            <View style={{ height: 12, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  borderRadius: 9999,
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
  const theme = useTheme();
  const colors = theme.colors;

  if (!data || data.length === 0) return null;
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => Math.max(d.income, d.expenses))) : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 100 }}>
        {data.slice(-6).map((item, index) => {
          const incomeHeight = maxValue > 0 ? (item.income / maxValue) * 80 : 0;
          const expenseHeight = maxValue > 0 ? (item.expenses / maxValue) * 80 : 0;

          return (
            <View key={index} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 80 }}>
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.success, height: Math.max(incomeHeight, 2) }}
                />
                <View
                  style={{ width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.danger, height: Math.max(expenseHeight, 2) }}
                />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                {item.period.split('-')[1] || item.period}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.success, marginRight: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.danger, marginRight: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
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
  const theme = useTheme();
  const colors = theme.colors;

  // Previous month for comparison
  const prevMonth = useMemo(() => {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
  }, [year, month]);

  const { data: monthlyReport, isPending: isLoadingMonthly, isError: isMonthlyError } = useQuery({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => api.reports.monthly(year, month),
    staleTime: 5 * 60 * 1000,
  });

  const { data: prevMonthReport } = useQuery({
    queryKey: ['reports', 'monthly', prevMonth.year, prevMonth.month],
    queryFn: () => api.reports.monthly(prevMonth.year, prevMonth.month),
    staleTime: 5 * 60 * 1000,
  });

  // Month-over-month expense comparison
  const expenseChange = useMemo(() => {
    if (!monthlyReport || !prevMonthReport || prevMonthReport.expenses <= 0) return null;
    return ((monthlyReport.expenses - prevMonthReport.expenses) / prevMonthReport.expenses) * 100;
  }, [monthlyReport, prevMonthReport]);

  const { data: categoryReport, isPending: isLoadingCategory, isError: isCategoryError } = useQuery({
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
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isMonthlyError) {
    return (
      <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
        <AlertCircle size={48} color={colors.danger} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('failedToLoadReport')}</Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>{t('checkConnection')}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Monthly Summary Card */}
      {monthlyReport && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
              <Calendar size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('monthlySummary')}</Text>
          </View>

          <ComparisonBarChart
            income={monthlyReport.income}
            expenses={monthlyReport.expenses}
            currency={monthlyReport.currency}
            t={t}
          />

          {/* Month-over-Month Comparison */}
          {expenseChange !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: expenseChange <= 0 ? colors.success + '33' : colors.danger + '33',
                }}
              >
                {expenseChange <= 0 ? (
                  <TrendingDown size={14} color={colors.success} />
                ) : (
                  <TrendingUp size={14} color={colors.danger} />
                )}
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                    marginLeft: 4,
                    color: expenseChange <= 0 ? colors.success : colors.danger,
                  }}
                >
                  {expenseChange > 0 ? '+' : ''}{formatNumber(expenseChange, 1)}% {t('vsLastMonth')}
                </Text>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
            <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('net')}</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Inter_700Bold',
                  color: monthlyReport.net >= 0 ? colors.success : colors.danger,
                }}
              >
                {`${monthlyReport.net >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(monthlyReport.net), monthlyReport.currency)}`}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('savingsRate')}</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Inter_700Bold',
                  color: monthlyReport.savings_rate >= 0 ? colors.success : colors.danger,
                }}
              >
                {formatNumber(monthlyReport.savings_rate, 1)}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Forecast Card */}
      {forecast && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
              <TrendingUp size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('forecast')}</Text>
          </View>

          {forecast.days_until_zero > 0 ? (
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('avgDaily')} {t('income')}</Text>
                  <Text style={{ color: colors.success, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('avgDaily')} {t('expenses')}</Text>
                  <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                  </Text>
                </View>
              </View>

              {forecast.net_daily_flow < 0 && (
                <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <AlertCircle size={20} color={colors.danger} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('daysUntilZero')}</Text>
                    <Text style={{ color: colors.danger, fontSize: 20, fontFamily: 'Inter_700Bold' }}>
                      {forecast.days_until_zero} {t('days')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.mutedForeground }}>{t('noForecastData')}</Text>
          )}
        </View>
      )}

      {/* Cash Flow Projection */}
      <CashFlowProjectionCard />

      {/* Spending Anomalies */}
      <SpendingAnomalyCard />

      {/* Trends Chart */}
      {trendsReport && trendsReport.trends && trendsReport.trends.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
              <BarChart3 size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('incomeVsExpenses')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8 }}>
              ({trendsReport.months} {t('months')})
            </Text>
          </View>
          <TrendsChart data={trendsReport.trends} t={t} />
        </View>
      )}

      {/* Category Breakdown */}
      {isCategoryError && (
        <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ color: colors.danger, fontSize: 14 }}>{t('failedToLoadCategories') || 'Failed to load category breakdown'}</Text>
        </View>
      )}
      {categoryReport && categoryReport.categories.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
              <PieChart size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('spendingByCategory')}</Text>
          </View>

          <View style={{ marginBottom: 24 }}>
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
              const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || colors.accent;
              return (
                <View
                  key={cat.category}
                  style={{
                    backgroundColor: colors.secondary + '4d',
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    borderRadius: 12,
                    width: categoryCardWidth,
                    minWidth: categoryCols === 1 ? undefined : 200,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StyledCategoryIcon
                        category={cat.category}
                        size={16}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, textTransform: 'capitalize', marginLeft: 8 }}>
                        {cat.category}
                      </Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                      {formatCompactCurrency(cat.amount, categoryReport.currency)}
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: colors.secondary, borderRadius: 9999, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: 9999,
                        width: `${cat.percentage}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                      {cat.count} {t('transactions')}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
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
        <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
          <BarChart3 size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('noDataAvailable')}</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
            {t('addTransaction')}
          </Text>
        </View>
      )}
    </View>
  );
}
