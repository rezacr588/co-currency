import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, BarChart3, PieChart, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { buildDateKey, getDaysInMonth, safeMax } from '../../../utils/dateRange';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { CATEGORY_COLORS, StyledCategoryIcon } from '../../../constants/icons';
import { SkeletonCard, SkeletonList } from '../../ui/Skeleton';
import { ReportErrorCard } from '../../ui';
import { CashFlowProjectionCard } from './CashFlowProjectionCard';
import { SpendingAnomalyCard } from './SpendingAnomalyCard';
import { ReportHeadlineCard } from './ReportHeadlineCard';
import { ComparisonBarChart, HorizontalBarChart, TrendsChart } from './charts';
import { REPORT_LAYOUT } from './reportConstants';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
import type { ReportHistoryTarget } from './reportUX';
import type { MonthlyReport, DateRangeReport } from '../../../types/goal';

interface MonthlyReportState {
  mode: 'monthly' | 'date_range';
  data?: MonthlyReport | DateRangeReport;
}

function buildMonthlyState(
  isDateRangeMode: boolean,
  monthlyData?: MonthlyReport,
  dateRangeData?: DateRangeReport
): MonthlyReportState {
  if (isDateRangeMode) {
    return { mode: 'date_range', data: dateRangeData };
  }
  return { mode: 'monthly', data: monthlyData };
}

interface MonthlyReportViewProps {
  year: number;
  month: number;
  fromDate?: string;
  toDate?: string;
  summaryTitle?: string;
  isTablet?: boolean;
  categoryCardWidth: number;
  categoryCols: number;
  onOpenHistory?: (target: ReportHistoryTarget) => void;
  showHeadline?: boolean;
}

export function MonthlyReportView({
  year,
  month,
  fromDate,
  toDate,
  summaryTitle,
  isTablet = false,
  categoryCardWidth,
  categoryCols,
  onOpenHistory,
  showHeadline = true,
}: MonthlyReportViewProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  const isDateRangeMode = !!(fromDate && toDate);

  // Previous month for comparison (only used in single-month mode)
  const prevMonth = useMemo(() => {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
  }, [year, month]);

  // Date range report (used when fromDate & toDate are provided)
  const { data: dateRangeReport, isPending: isLoadingDateRange, isError: isDateRangeError, refetch: refetchDateRange } = useQuery({
    queryKey: ['reports', 'date-range', fromDate, toDate, reportTimeZone],
    queryFn: () => api.reports.dateRange(fromDate!, toDate!, undefined, reportTimeZone),
    enabled: isDateRangeMode,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  // Monthly report (used in single-month mode)
  const { data: monthlyReportRaw, isPending: isLoadingMonthly, isError: isMonthlyError, refetch: refetchMonthly } = useQuery({
    queryKey: ['reports', 'monthly', year, month, reportTimeZone],
    queryFn: () => api.reports.monthly(year, month, undefined, reportTimeZone),
    enabled: !isDateRangeMode,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  // Unified report data
  const reportState = buildMonthlyState(isDateRangeMode, monthlyReportRaw, dateRangeReport);
  const monthlyReport = reportState.data;
  const isReportError = reportState.mode === 'date_range' ? isDateRangeError : isMonthlyError;

  const { data: prevMonthReport } = useQuery({
    queryKey: ['reports', 'monthly', prevMonth.year, prevMonth.month, reportTimeZone],
    queryFn: () => api.reports.monthly(prevMonth.year, prevMonth.month, undefined, reportTimeZone),
    enabled: !isDateRangeMode,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  // Month-over-month expense comparison (only in single-month mode)
  const expenseChange = useMemo(() => {
    if (isDateRangeMode) return null;
    if (!monthlyReport || !prevMonthReport || prevMonthReport.expenses <= 0) return null;
    return ((monthlyReport.expenses - prevMonthReport.expenses) / prevMonthReport.expenses) * 100;
  }, [monthlyReport, prevMonthReport, isDateRangeMode]);

  // Category data from date-range report or separate query
  const { data: categoryReportSeparate, isPending: isLoadingCategory, isError: isCategoryError, refetch: refetchCategory } = useQuery({
    queryKey: ['reports', 'category', fromDate, toDate, year, month, reportTimeZone],
    queryFn: () => {
      if (fromDate && toDate) {
        return api.reports.category(fromDate, toDate, undefined, reportTimeZone);
      }
      return api.reports.category(
        buildDateKey(year, month, 1),
        buildDateKey(year, month, getDaysInMonth(year, month)),
        undefined,
        reportTimeZone
      );
    },
    enabled: !isDateRangeMode,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  // Use categories from date-range report when available, otherwise from separate query
  const categoryReport = isDateRangeMode && dateRangeReport
    ? { categories: dateRangeReport.categories, currency: dateRangeReport.currency, from_date: dateRangeReport.from_date, to_date: dateRangeReport.to_date, total: dateRangeReport.expenses }
    : categoryReportSeparate;

  const { data: trendsReport, isPending: isLoadingTrends } = useQuery({
    queryKey: ['reports', 'trends', 6, reportTimeZone],
    queryFn: () => api.reports.trends(6, undefined, reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const { data: forecast, isPending: isLoadingForecast } = useQuery({
    queryKey: ['reports', 'forecast', reportTimeZone],
    queryFn: () => api.reports.forecast(undefined, reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const isSummaryLoading = isDateRangeMode ? isLoadingDateRange : isLoadingMonthly;
  const isPending = isSummaryLoading || isLoadingCategory || isLoadingTrends || isLoadingForecast;
  const effectiveSummaryTitle = summaryTitle || (isDateRangeMode ? (t('selectedRangeSummary') || 'Selected Range Summary') : t('monthlySummary'));
  const rangeTarget = useMemo(() => {
    if (categoryReport?.from_date && categoryReport?.to_date) {
      return {
        fromDate: categoryReport.from_date,
        toDate: categoryReport.to_date,
      };
    }

    if (fromDate && toDate) {
      return { fromDate, toDate };
    }

    return {
      fromDate: buildDateKey(year, month, 1),
      toDate: buildDateKey(year, month, getDaysInMonth(year, month)),
    };
  }, [categoryReport?.from_date, categoryReport?.to_date, fromDate, month, toDate, year]);
  const headlineSummary = useMemo(() => {
    if (!monthlyReport) {
      return t('noDataAvailable');
    }

    const netLabel = monthlyReport.net >= 0
      ? `${t('netPositiveThisPeriod') || 'Net positive this period'}: +${formatCompactCurrency(Math.abs(monthlyReport.net), monthlyReport.currency)}`
      : `${t('netNegativeThisPeriod') || 'Net negative this period'}: -${formatCompactCurrency(Math.abs(monthlyReport.net), monthlyReport.currency)}`;

    if (categoryReport?.categories?.[0]) {
      return `${netLabel} | ${t('topCategory') || 'Top category'}: ${categoryReport.categories[0].category}`;
    }

    return netLabel;
  }, [categoryReport?.categories, monthlyReport, t]);

  if (isPending) {
    return (
      <View style={{ gap: 12 }}>
        <SkeletonCard />
        <SkeletonList count={2} />
      </View>
    );
  }

  if (isReportError) {
    return (
      <ReportErrorCard
        title={t('failedToLoadReport')}
        message={t('checkConnection')}
        retryLabel={t('retry') || 'Retry'}
        onRetry={() => {
          if (isDateRangeMode) {
            void refetchDateRange();
            return;
          }
          void refetchMonthly();
        }}
      />
    );
  }

  return (
    <View>
      {showHeadline ? (
        <ReportHeadlineCard
          summary={headlineSummary}
          caption={isDateRangeMode ? (t('selectedRangeAnalysis') || 'Custom range analysis') : `${effectiveSummaryTitle}`}
        />
      ) : null}

      {/* Monthly Summary Card */}
      {monthlyReport && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginEnd: 12 }}>
              <Calendar size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {effectiveSummaryTitle}
            </Text>
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
                    marginStart: 4,
                    color: expenseChange <= 0 ? colors.success : colors.danger,
                  }}
                >
                  {expenseChange > 0 ? '+' : ''}{formatNumber(expenseChange, 1)}% {t('expensesVsLastMonth') || 'Expenses vs last month'}
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

      {/* Category Breakdown */}
      {isCategoryError && (
        <ReportErrorCard
          title={t('failedToLoadCategories') || 'Failed to load category breakdown'}
          message={t('checkConnection')}
          retryLabel={t('retry') || 'Retry'}
          onRetry={() => {
            void refetchCategory();
          }}
        />
      )}
      {categoryReport && categoryReport.categories.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginEnd: 12 }}>
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
              onPressItem={
                onOpenHistory
                  ? (item) => onOpenHistory({ ...rangeTarget, category: item.category })
                  : undefined
              }
              getItemAccessibilityLabel={(item) => `${t('topCategory') || 'Top category'} ${item.category}`}
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
              const cardContent = (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StyledCategoryIcon
                        category={cat.category}
                        size={16}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, textTransform: 'capitalize', marginStart: 8 }}>
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
                </>
              );

              if (!onOpenHistory) {
                return (
                  <View
                    key={cat.category}
                    style={{
                      backgroundColor: colors.secondary + '4d',
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 16,
                      borderRadius: REPORT_LAYOUT.cardRadius,
                      width: categoryCardWidth,
                      minWidth: categoryCols === 1 ? undefined : 200,
                    }}
                  >
                    {cardContent}
                  </View>
                );
              }

              return (
                <Pressable
                  key={cat.category}
                  onPress={() => onOpenHistory({ ...rangeTarget, category: cat.category })}
                  style={({ pressed }) => ({
                    backgroundColor: colors.secondary + '4d',
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    borderRadius: REPORT_LAYOUT.cardRadius,
                    width: categoryCardWidth,
                    minWidth: categoryCols === 1 ? undefined : 200,
                    opacity: pressed ? 0.84 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('topCategory') || 'Top category'} ${cat.category}`}
                >
                  {cardContent}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Trends Chart */}
      {trendsReport && trendsReport.trends && trendsReport.trends.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginEnd: 12 }}>
              <BarChart3 size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('incomeVsExpenses')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: 8 }}>
              ({trendsReport.months} {t('months')})
            </Text>
          </View>
          <TrendsChart data={trendsReport.trends} t={t} />
        </View>
      )}

      {/* Spending Anomalies */}
      <SpendingAnomalyCard />

      {/* Forecast Card */}
      {forecast && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginEnd: 12 }}>
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
                  <View style={{ marginStart: 12, flex: 1 }}>
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

      {/* Empty State */}
      {!monthlyReport && !categoryReport && (
        <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: REPORT_LAYOUT.cardRadius, alignItems: 'center' }}>
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
