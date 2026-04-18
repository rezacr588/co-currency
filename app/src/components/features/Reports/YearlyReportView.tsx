import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PieChart, BarChart3 } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { buildDateKey, getMonthLabelAnchor, getTimeZoneDateParts, safeMax } from '../../../utils/dateRange';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { HorizontalBarChart } from './charts';
import { ReportHeadlineCard } from './ReportHeadlineCard';
import { EmptyState } from '../../ui/EmptyState';
import { ReportErrorCard } from '../../ui';
import { SkeletonCard, SkeletonList } from '../../ui/Skeleton';
import { REPORT_LAYOUT } from './reportConstants';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
import type { ReportHistoryTarget } from './reportUX';

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};

interface YearlyReportViewProps {
  isTablet?: boolean;
  onOpenHistory?: (target: ReportHistoryTarget) => void;
  onSelectMonth?: (selection: { year: number; month: number }) => void;
}

const YearSelector = memo(function YearSelector({
  selectedYear,
  currentYear,
  onPreviousYear,
  onNextYear,
  previousLabel,
  nextLabel,
}: {
  selectedYear: number;
  currentYear: number;
  onPreviousYear: () => void;
  onNextYear: () => void;
  previousLabel: string;
  nextLabel: string;
}) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xxl, gap: theme.spacing.lg }}>
      <Pressable
        onPress={onPreviousYear}
        style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: colors.secondary }}
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        accessibilityHint="Show previous year report"
        hitSlop={8}
      >
        <ChevronLeft size={20} color={colors.mutedForeground} />
      </Pressable>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.md, borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center' }}>
        <Calendar size={18} color={colors.accent} />
        <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold', marginStart: theme.spacing.sm }}>{selectedYear}</Text>
      </View>
      <Pressable
        onPress={onNextYear}
        style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: selectedYear >= currentYear ? theme.alpha(colors.secondary, 0.3) : colors.secondary, opacity: selectedYear >= currentYear ? 0.5 : 1 }}
        disabled={selectedYear >= currentYear}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityHint="Show next year report"
        hitSlop={8}
      >
        <ChevronRight size={20} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
});

export function YearlyReportView({
  isTablet = false,
  onOpenHistory,
  onSelectMonth,
}: YearlyReportViewProps) {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();
  const today = getTimeZoneDateParts(new Date(), reportTimeZone);
  const currentYear = today.year;
  const currentMonth = today.month;
  const currentDateKey = buildDateKey(today.year, today.month, today.day);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    if (selectedYear > currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  const { data: yearlyReport, isPending, isError, refetch } = useQuery({
    queryKey: ['reports', 'yearly', selectedYear, reportTimeZone],
    queryFn: () => api.reports.yearly(selectedYear, undefined, reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const yearRange = useMemo(() => {
    const fromDate = buildDateKey(selectedYear, 1, 1);
    const toDate = selectedYear === currentYear
      ? currentDateKey
      : buildDateKey(selectedYear, 12, 31);

    return { fromDate, toDate };
  }, [currentDateKey, currentYear, selectedYear]);

  const { data: categoryReport, isError: isCategoryError, refetch: refetchCategoryReport } = useQuery({
    queryKey: ['reports', 'category', yearRange.fromDate, yearRange.toDate, reportTimeZone],
    queryFn: () => api.reports.category(yearRange.fromDate, yearRange.toDate, undefined, reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const monthLabels = useMemo(() => {
    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      timeZone: reportTimeZone,
    };

    if (language === 'fa') {
      (formatOptions as Record<string, unknown>).calendar = 'persian';
    }

    const formatter = new Intl.DateTimeFormat(
      LANGUAGE_LOCALES[language] || 'en-US',
      formatOptions
    );

    return Array.from({ length: 12 }, (_, index) => formatter.format(getMonthLabelAnchor(index)));
  }, [language, reportTimeZone]);

  const maxMonthlyValue = yearlyReport?.months && yearlyReport.months.length > 0
    ? safeMax(yearlyReport.months.flatMap((m) => [m.income, m.expenses]))
    : 1;

  const monthsInScope = useMemo(() => {
    if (!yearlyReport?.months) return [];
    const visibleMonths = selectedYear === currentYear ? currentMonth : 12;
    return yearlyReport.months.slice(0, visibleMonths);
  }, [currentMonth, currentYear, selectedYear, yearlyReport?.months]);

  const averageMonthlyIncome = useMemo(() => {
    if (monthsInScope.length === 0) return 0;
    return monthsInScope.reduce((sum, month) => sum + month.income, 0) / monthsInScope.length;
  }, [monthsInScope]);

  const averageMonthlyExpenses = useMemo(() => {
    if (monthsInScope.length === 0) return 0;
    return monthsInScope.reduce((sum, month) => sum + month.expenses, 0) / monthsInScope.length;
  }, [monthsInScope]);

  const bestNetMonth = useMemo(() => {
    if (monthsInScope.length === 0) return null;
    return monthsInScope.reduce((best, month) => (month.net > best.net ? month : best), monthsInScope[0]);
  }, [monthsInScope]);

  const highestExpenseMonth = useMemo(() => {
    if (monthsInScope.length === 0) return null;
    return monthsInScope.reduce((highest, month) => (month.expenses > highest.expenses ? month : highest), monthsInScope[0]);
  }, [monthsInScope]);
  const headlineSummary = useMemo(() => {
    if (bestNetMonth && highestExpenseMonth) {
      return `${t('bestMonth') || 'Best Month'}: ${monthLabels[bestNetMonth.month - 1]} | ${t('highestSpendingMonth') || 'Highest Spending Month'}: ${monthLabels[highestExpenseMonth.month - 1]}`;
    }

    if (bestNetMonth) {
      return `${t('bestMonth') || 'Best Month'}: ${monthLabels[bestNetMonth.month - 1]}`;
    }

    return t('yearlyOverviewStable') || 'This year is building a steady pattern.';
  }, [bestNetMonth, highestExpenseMonth, monthLabels, t]);
  const yearFrameLabel = selectedYear === currentYear
    ? (t('yearToDate') || 'Year to date')
    : (t('fullYear') || 'Full year');

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
      <ReportHeadlineCard
        summary={headlineSummary}
        caption={`${selectedYear} • ${yearFrameLabel}`}
      />

      <YearSelector
        selectedYear={selectedYear}
        currentYear={currentYear}
        onPreviousYear={() => setSelectedYear((y) => y - 1)}
        onNextYear={() => selectedYear < currentYear && setSelectedYear((y) => y + 1)}
        previousLabel={t('previousYear')}
        nextLabel={t('nextYear')}
      />

      {yearlyReport ? (
        <>
          {/* Annual Summary Card */}
          <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <View style={{ backgroundColor: theme.alpha(colors.accent, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
                <Calendar size={20} color={colors.accent} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('annualSummary')}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: theme.spacing.md }}>
              {yearFrameLabel}
            </Text>

            <View style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: theme.spacing.md,
            }}>
              {/* Total Income */}
              <View style={{ flex: 1, backgroundColor: theme.alpha(colors.success, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.success, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                  <TrendingUp size={16} color={colors.success} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.sm }}>{t('totalIncome')}</Text>
                </View>
                <Text style={{ color: colors.success, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(yearlyReport.income, yearlyReport.currency)}
                </Text>
              </View>

              {/* Total Expenses */}
              <View style={{ flex: 1, backgroundColor: theme.alpha(colors.danger, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.danger, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                  <TrendingDown size={16} color={colors.danger} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.sm }}>{t('totalExpenses')}</Text>
                </View>
                <Text style={{ color: colors.danger, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(yearlyReport.expenses, yearlyReport.currency)}
                </Text>
              </View>
            </View>

            {/* Net and Savings Rate */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
              <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('net')}</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Inter_700Bold',
                    color: yearlyReport.net >= 0 ? colors.success : colors.danger,
                  }}
                >
                  {`${yearlyReport.net >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(yearlyReport.net), yearlyReport.currency)}`}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.5), padding: theme.spacing.md, borderRadius: theme.radii.sm }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>{t('savingsRate')}</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Inter_700Bold',
                    color: yearlyReport.savings_rate >= 0 ? colors.success : colors.danger,
                  }}
                >
                  {formatNumber(yearlyReport.savings_rate, 1)}%
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
              <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: theme.alpha(colors.secondary, 0.5), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
                  {t('avgMonthlyIncome') || 'Avg Monthly Income'}
                </Text>
                <Text style={{ color: colors.success, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(averageMonthlyIncome, yearlyReport.currency)}
                </Text>
              </View>
              <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: theme.alpha(colors.secondary, 0.5), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
                  {t('avgMonthlyExpenses') || 'Avg Monthly Expenses'}
                </Text>
                <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(averageMonthlyExpenses, yearlyReport.currency)}
                </Text>
              </View>
              {bestNetMonth && (
                <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: theme.alpha(colors.secondary, 0.5), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
                    {t('bestMonth') || 'Best Month'}
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 }}>
                    {monthLabels[bestNetMonth.month - 1]}
                  </Text>
                  <Text style={{ color: bestNetMonth.net >= 0 ? colors.success : colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {bestNetMonth.net >= 0 ? '+' : ''}{formatCompactCurrency(bestNetMonth.net, bestNetMonth.currency)}
                  </Text>
                </View>
              )}
              {highestExpenseMonth && (
                <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: theme.alpha(colors.secondary, 0.5), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
                    {t('highestSpendingMonth') || 'Highest Spending Month'}
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 }}>
                    {monthLabels[highestExpenseMonth.month - 1]}
                  </Text>
                  <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                    {formatCompactCurrency(highestExpenseMonth.expenses, highestExpenseMonth.currency)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 12-Month Bar Chart */}
          {monthsInScope.length > 0 && (
            <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
                <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
                  <Calendar size={20} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('incomeVsExpenses')}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.xs, height: REPORT_LAYOUT.chartHeightLarge }}>
                {monthLabels.map((monthLabel, index) => {
                  const monthData = monthsInScope.find((m) => m.month === index + 1);
                  const incomeHeight = maxMonthlyValue > 0 && monthData
                    ? (monthData.income / maxMonthlyValue) * 100
                    : 0;
                  const expenseHeight = maxMonthlyValue > 0 && monthData
                    ? (monthData.expenses / maxMonthlyValue) * 100
                    : 0;

                  const chartBar = (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                       <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: REPORT_LAYOUT.chartHeightMedium }}>
                        <View
                          style={{ width: REPORT_LAYOUT.barWidthSmall, borderTopLeftRadius: REPORT_LAYOUT.barRadius, borderTopRightRadius: REPORT_LAYOUT.barRadius, backgroundColor: colors.success, height: Math.max(incomeHeight, 2) }}
                        />
                        <View
                          style={{ width: REPORT_LAYOUT.barWidthSmall, borderTopLeftRadius: REPORT_LAYOUT.barRadius, borderTopRightRadius: REPORT_LAYOUT.barRadius, backgroundColor: colors.danger, height: Math.max(expenseHeight, 2) }}
                        />
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: theme.spacing.xs }}>
                        {monthLabel}
                      </Text>
                    </View>
                  );

                  if (!monthData || !onSelectMonth) {
                    return (
                      <View key={monthLabel} style={{ flex: 1 }}>
                        {chartBar}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={monthLabel}
                      onPress={() => onSelectMonth({ year: selectedYear, month: monthData.month })}
                      style={({ pressed }) => ({
                        flex: 1,
                        opacity: pressed ? 0.82 : 1,
                      })}
                      accessibilityRole="button"
                      accessibilityLabel={`${monthLabel} ${selectedYear}`}
                      accessibilityHint="Open monthly report for this month"
                    >
                      {chartBar}
                    </Pressable>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.success, marginEnd: theme.spacing.xs }} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.danger, marginEnd: theme.spacing.xs }} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
                </View>
              </View>
            </View>
          )}

          {isCategoryError && (
            <ReportErrorCard
              title={t('failedToLoadCategories') || 'Failed to load category breakdown'}
              message={t('checkConnection')}
              retryLabel={t('retry') || 'Retry'}
              onRetry={() => {
                void refetchCategoryReport();
              }}
            />
          )}

          {categoryReport && categoryReport.categories.length > 0 && (
            <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius, marginBottom: REPORT_LAYOUT.sectionSpacing }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
                <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
                  <PieChart size={20} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  {t('spendingByCategory')}
                </Text>
              </View>

              <HorizontalBarChart
                data={categoryReport.categories.slice(0, 6)}
                maxValue={safeMax(categoryReport.categories.map((category) => category.amount))}
                labelKey="category"
                valueKey="amount"
                formatValue={(value) => formatCompactCurrency(value, categoryReport.currency)}
                onPressItem={
                  onOpenHistory
                    ? (item) =>
                        onOpenHistory({
                          fromDate: yearRange.fromDate,
                          toDate: yearRange.toDate,
                          category: item.category,
                        })
                    : undefined
                }
                getItemAccessibilityLabel={(item) => `${t('topCategory') || 'Top category'} ${item.category}`}
              />
            </View>
          )}

          {/* Monthly Breakdown List */}
          {monthsInScope.length > 0 && (
            <View style={{ backgroundColor: colors.card, padding: REPORT_LAYOUT.cardPadding, borderRadius: REPORT_LAYOUT.cardRadius }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: theme.spacing.lg }}>{t('monthlySummary')}</Text>
              <View style={{ gap: theme.spacing.md }}>
                {monthsInScope.map((month) => {
                  const rowContent = (
                    <>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                        {monthLabels[month.month - 1]}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: theme.alpha(colors.success, 0.08), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: theme.spacing.xs }}>
                            {t('income')}
                          </Text>
                          <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                            +{formatCompactCurrency(month.income, month.currency)}
                          </Text>
                        </View>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: theme.alpha(colors.danger, 0.08), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: theme.spacing.xs }}>
                            {t('expenses')}
                          </Text>
                          <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                            -{formatCompactCurrency(month.expenses, month.currency)}
                          </Text>
                        </View>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: theme.alpha(colors.secondary, 0.5), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: theme.spacing.xs }}>
                            {t('net')}
                          </Text>
                          <Text
                            style={{
                              color: month.net >= 0 ? colors.success : colors.danger,
                              fontSize: 14,
                              fontFamily: 'Inter_600SemiBold',
                            }}
                          >
                            {month.net >= 0 ? '+' : ''}{formatCompactCurrency(month.net, month.currency)}
                          </Text>
                        </View>
                      </View>
                    </>
                  );

                  if (!onSelectMonth) {
                    return (
                      <View
                        key={month.month}
                        style={{ backgroundColor: theme.alpha(colors.secondary, 0.3), padding: REPORT_LAYOUT.tilePadding, borderRadius: theme.radii.sm }}
                      >
                        {rowContent}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={month.month}
                      onPress={() => onSelectMonth({ year: selectedYear, month: month.month })}
                      style={({ pressed }) => ({
                        backgroundColor: theme.alpha(colors.secondary, 0.3),
                        padding: REPORT_LAYOUT.tilePadding,
                        borderRadius: theme.radii.sm,
                        opacity: pressed ? 0.84 : 1,
                      })}
                      accessibilityRole="button"
                      accessibilityLabel={`${monthLabels[month.month - 1]} ${selectedYear}`}
                    >
                      {rowContent}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title={t('emptyNoReportsTitle') || 'No data for this period'}
          description={t('emptyNoReportsDesc') || 'Add transactions in this range to see reports.'}
        />
      )}
    </View>
  );
}
