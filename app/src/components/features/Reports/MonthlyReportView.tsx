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
import { EmptyState } from '../../ui/EmptyState';
import { ReportErrorCard } from '../../ui';
import { CashFlowProjectionCard } from './CashFlowProjectionCard';
import { SpendingAnomalyCard } from './SpendingAnomalyCard';
import { ReportHeadlineCard } from './ReportHeadlineCard';
import { ComparisonBarChart, HorizontalBarChart, TrendsChart } from './charts';
import { REPORT_LAYOUT } from './reportConstants';
import { buildReportsOverviewQueryKey, REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
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

  const overviewQueryKey = buildReportsOverviewQueryKey({
    year,
    month,
    fromDate,
    toDate,
    reportTimeZone,
  });

  const { data: overview, isPending, isError, refetch } = useQuery({
    queryKey: overviewQueryKey,
    queryFn: () =>
      api.reports.overview({
        year,
        month,
        fromDate,
        toDate,
        timeZone: reportTimeZone,
      }),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const monthlyReportRaw = overview?.monthly ?? undefined;
  const dateRangeReport = overview?.date_range ?? undefined;

  // Unified report data
  const reportState = buildMonthlyState(isDateRangeMode, monthlyReportRaw, dateRangeReport);
  const monthlyReport = reportState.data;
  const prevMonthReport = overview?.previous_month ?? undefined;

  // Month-over-month expense comparison (only in single-month mode)
  const expenseChange = useMemo(() => {
    if (isDateRangeMode) return null;
    if (!monthlyReport || !prevMonthReport || prevMonthReport.expenses <= 0) return null;
    return ((monthlyReport.expenses - prevMonthReport.expenses) / prevMonthReport.expenses) * 100;
  }, [monthlyReport, prevMonthReport, isDateRangeMode]);

  const categoryReport = overview?.category;
  const trendsReport = overview?.trends;
  const forecast = overview?.forecast;
  const anomalyReport = overview?.anomalies;
  const cashFlowReport = overview?.cashflow;
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

  if (isError) {
    return (
      <ReportErrorCard
        title={t('failedToLoadReport')}
        message={t('checkConnection')}
        retryLabel={t('retry') || 'Retry'}
        onRetry={() => {
          void refetch();
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg }}>
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: 6,
                  borderRadius: theme.radii.full,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: expenseChange <= 0 ? theme.alpha(colors.success, 0.2) : theme.alpha(colors.danger, 0.2),
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
                    marginStart: theme.spacing.xs,
                    color: expenseChange <= 0 ? colors.success : colors.danger,
                  }}
                >
                  {expenseChange > 0 ? '+' : ''}{formatNumber(expenseChange, 1)}% {t('expensesVsLastMonth') || 'Expenses vs last month'}
                </Text>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.xxl }}>
            <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('net')}</Text>
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
            <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('savingsRate')}</Text>
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

      {categoryReport && categoryReport.categories.length > 0 && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <PieChart size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('spendingByCategory')}</Text>
          </View>

          <View style={{ marginBottom: theme.spacing.xxl }}>
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
            gap: theme.spacing.md,
            marginTop: theme.spacing.lg,
          }}>
            {categoryReport.categories.slice(0, 6).map((cat) => {
              const categoryColor = CATEGORY_COLORS[cat.category.toLowerCase()] || colors.accent;
              const cardContent = (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StyledCategoryIcon
                        category={cat.category}
                        size={16}
                        backgroundOpacity={0.15}
                        borderRadius={6}
                        padding={6}
                      />
                      <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, textTransform: 'capitalize', marginStart: theme.spacing.sm }}>
                        {cat.category}
                      </Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                      {formatCompactCurrency(cat.amount, categoryReport.currency)}
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: colors.secondary, borderRadius: theme.radii.full, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: theme.radii.full,
                        width: `${cat.percentage}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
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
                      backgroundColor: theme.alpha(colors.secondary, 0.3),
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: theme.spacing.lg,
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
                    backgroundColor: theme.alpha(colors.secondary, 0.3),
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: theme.spacing.lg,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <BarChart3 size={20} color={colors.placeholder} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('incomeVsExpenses')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.sm }}>
              ({trendsReport.months} {t('months')})
            </Text>
          </View>
          <TrendsChart data={trendsReport.trends} t={t} />
        </View>
      )}

      {/* Spending Anomalies */}
      <SpendingAnomalyCard report={anomalyReport} />

      {/* Forecast Card */}
      {forecast && (
        <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.alpha(colors.accent, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
              <TrendingUp size={20} color={colors.accent} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('forecast')}</Text>
          </View>

          {forecast.days_until_zero > 0 ? (
            <View style={{ gap: theme.spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
                <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('avgDaily')} {t('income')}</Text>
                  <Text style={{ color: colors.success, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {formatCompactCurrency(forecast.avg_daily_income, forecast.currency)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('avgDaily')} {t('expenses')}</Text>
                  <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {formatCompactCurrency(forecast.avg_daily_spend, forecast.currency)}
                  </Text>
                </View>
              </View>

              {forecast.net_daily_flow < 0 && (
                <View style={{ backgroundColor: theme.alpha(colors.danger, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.danger, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center' }}>
                  <AlertCircle size={20} color={colors.danger} />
                  <View style={{ marginStart: theme.spacing.md, flex: 1 }}>
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
      <CashFlowProjectionCard report={cashFlowReport} />

      {/* Empty State */}
      {!monthlyReport && !categoryReport && (
        <EmptyState
          icon={BarChart3}
          title={t('emptyNoReportsTitle') || 'No data for this period'}
          description={t('emptyNoReportsDesc') || 'Add transactions in this range to see reports.'}
        />
      )}
    </View>
  );
}
