import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle, PieChart } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { buildDateKey, getMonthLabelAnchor, getTimeZoneDateParts, safeMax } from '../../../utils/dateRange';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { HorizontalBarChart } from './MonthlyReportView';
import { ReportHeadlineCard } from './ReportHeadlineCard';
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

  const { data: yearlyReport, isPending, isError } = useQuery({
    queryKey: ['reports', 'yearly', selectedYear, reportTimeZone],
    queryFn: () => api.reports.yearly(selectedYear, undefined, reportTimeZone),
    staleTime: 5 * 60 * 1000,
  });

  const yearRange = useMemo(() => {
    const fromDate = buildDateKey(selectedYear, 1, 1);
    const toDate = selectedYear === currentYear
      ? currentDateKey
      : buildDateKey(selectedYear, 12, 31);

    return { fromDate, toDate };
  }, [currentDateKey, currentYear, selectedYear]);

  const { data: categoryReport, isError: isCategoryError } = useQuery({
    queryKey: ['reports', 'category', yearRange.fromDate, yearRange.toDate, reportTimeZone],
    queryFn: () => api.reports.category(yearRange.fromDate, yearRange.toDate, undefined, reportTimeZone),
    staleTime: 5 * 60 * 1000,
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
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isError) {
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
      <ReportHeadlineCard
        summary={headlineSummary}
        caption={`${selectedYear} • ${yearFrameLabel}`}
      />

      {/* Year Navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 16 }}>
        <Pressable
          onPress={() => setSelectedYear((y) => y - 1)}
          style={{ padding: 12, borderRadius: 12, backgroundColor: colors.secondary }}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Calendar size={18} color={colors.accent} />
          <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold', marginLeft: 8 }}>{selectedYear}</Text>
        </View>
        <Pressable
          onPress={() => selectedYear < currentYear && setSelectedYear((y) => y + 1)}
          style={{ padding: 12, borderRadius: 12, backgroundColor: selectedYear >= currentYear ? colors.secondary + '4d' : colors.secondary, opacity: selectedYear >= currentYear ? 0.5 : 1 }}
          disabled={selectedYear >= currentYear}
          accessibilityRole="button"
          accessibilityLabel="Next year"
        >
          <ChevronRight size={20} color="#a1a1aa" />
        </Pressable>
      </View>

      {yearlyReport ? (
        <>
          {/* Annual Summary Card */}
          <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
                <Calendar size={20} color={colors.accent} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('annualSummary')}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
              {yearFrameLabel}
            </Text>

            <View style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: 12,
            }}>
              {/* Total Income */}
              <View style={{ flex: 1, backgroundColor: colors.success + '1a', borderWidth: 1, borderColor: colors.success + '4d', padding: 16, borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <TrendingUp size={16} color={colors.success} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8 }}>{t('totalIncome')}</Text>
                </View>
                <Text style={{ color: colors.success, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(yearlyReport.income, yearlyReport.currency)}
                </Text>
              </View>

              {/* Total Expenses */}
              <View style={{ flex: 1, backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <TrendingDown size={16} color={colors.danger} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8 }}>{t('totalExpenses')}</Text>
                </View>
                <Text style={{ color: colors.danger, fontSize: 24, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(yearlyReport.expenses, yearlyReport.currency)}
                </Text>
              </View>
            </View>

            {/* Net and Savings Rate */}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
              <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('net')}</Text>
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
              <View style={{ flex: 1, backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('savingsRate')}</Text>
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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
                  {t('avgMonthlyIncome') || 'Avg Monthly Income'}
                </Text>
                <Text style={{ color: colors.success, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(averageMonthlyIncome, yearlyReport.currency)}
                </Text>
              </View>
              <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
                  {t('avgMonthlyExpenses') || 'Avg Monthly Expenses'}
                </Text>
                <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  {formatCompactCurrency(averageMonthlyExpenses, yearlyReport.currency)}
                </Text>
              </View>
              {bestNetMonth && (
                <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
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
                <View style={{ width: isTablet ? '48.5%' : '48%', backgroundColor: colors.secondary + '80', padding: 12, borderRadius: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
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
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
                  <Calendar size={20} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('incomeVsExpenses')}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, height: 140 }}>
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
                      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 100 }}>
                        <View
                          style={{ width: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.success, height: Math.max(incomeHeight, 2) }}
                        />
                        <View
                          style={{ width: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.danger, height: Math.max(expenseHeight, 2) }}
                        />
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4 }}>
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
                    >
                      {chartBar}
                    </Pressable>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
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
          )}

          {isCategoryError && (
            <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ color: colors.danger, fontSize: 14 }}>
                {t('failedToLoadCategories') || 'Failed to load category breakdown'}
              </Text>
            </View>
          )}

          {categoryReport && categoryReport.categories.length > 0 && (
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginRight: 12 }}>
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
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 16 }}>{t('monthlySummary')}</Text>
              <View style={{ gap: 12 }}>
                {monthsInScope.map((month) => {
                  const rowContent = (
                    <>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                        {monthLabels[month.month - 1]}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: colors.success + '14', padding: 10, borderRadius: 8 }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                            {t('income')}
                          </Text>
                          <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                            +{formatCompactCurrency(month.income, month.currency)}
                          </Text>
                        </View>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: colors.danger + '14', padding: 10, borderRadius: 8 }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                            {t('expenses')}
                          </Text>
                          <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                            -{formatCompactCurrency(month.expenses, month.currency)}
                          </Text>
                        </View>
                        <View style={{ width: isTablet ? '31%' : '48%', backgroundColor: colors.secondary + '80', padding: 10, borderRadius: 8 }}>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
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
                        style={{ backgroundColor: colors.secondary + '4d', padding: 12, borderRadius: 8 }}
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
                        backgroundColor: colors.secondary + '4d',
                        padding: 12,
                        borderRadius: 8,
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
        <View style={{ backgroundColor: colors.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
          <Calendar size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('noDataAvailable')}</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
            {t('addTransaction')}
          </Text>
        </View>
      )}
    </View>
  );
}
