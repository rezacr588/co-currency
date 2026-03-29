import { useState, useMemo, useEffect } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Wallet } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../src/utils/format';
import { CATEGORY_COLORS } from '../../../src/constants/icons';
import { useReportTimeZone } from '../../../src/hooks/useReportTimeZone';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { PageHeader, PageScaffold } from '../../../src/components/ui';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';
import {
  type DatePreset,
  getDateRangeFromPreset,
  getMonthLabelAnchor,
  getTimeZoneDateParts,
} from '../../../src/utils/dateRange';
import {
  ReportPeriodTabs,
  type ReportPeriod,
  DailyReportView,
  WeeklyReportView,
  AllTimeReportView,
  MonthlyReportView,
  YearlyReportView,
  DateRangeSelector,
} from '../../../src/components/features/Reports';
import { RingChart } from '../../../src/components/features/Reports/charts';
import {
  buildReportsOverviewQueryKey,
  REPORT_QUERY_RETRY,
  REPORT_QUERY_STALE_TIME_MS,
} from '../../../src/components/features/Reports/queryConfig';
import { buildHistoryRouteParams, createReportDateFormatter, type ReportHistoryTarget } from '../../../src/components/features/Reports/reportUX';

const REPORT_PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];

function parseInitialReportPeriod(periodParam: string | string[] | undefined): ReportPeriod {
  const period = Array.isArray(periodParam) ? periodParam[0] : periodParam;

  if (period && REPORT_PERIODS.includes(period as ReportPeriod)) {
    return period as ReportPeriod;
  }

  return 'monthly';
}

function ReportContextStrip({
  timeZoneLabel,
  activeLabel,
}: {
  timeZoneLabel: string;
  activeLabel: string;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingBottom: 16,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('analyticsTimeZone')}</Text>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
            {timeZoneLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {t('activeReportView') || 'Active View'}
          </Text>
          <Text
            style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1, marginStart: 12, textAlign: 'right' }}
            numberOfLines={1}
          >
            {activeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ period?: string | string[] }>();
  const queryClient = useQueryClient();
  const { reportTimeZone, reportTimeZoneLabel } = useReportTimeZone();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, isDesktop, isTablet } = useScreenLayout();
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  // Calculate category card widths
  const containerPadding = isDesktop ? 32 : isTablet ? 24 : 16;
  const cardGap = 12;
  const contentWidth = Math.min(width, 1280);
  const availableWidth = contentWidth - containerPadding * 2;
  const categoryCols = isDesktop ? 3 : isTablet ? 2 : 1;
  const categoryCardWidth = categoryCols === 1 ? availableWidth : (availableWidth - cardGap * (categoryCols - 1)) / categoryCols;

  // Report period state
  const [period, setPeriod] = useState<ReportPeriod>(() => parseInitialReportPeriod(params.period));

  // Date range state (for monthly view)
  const reportToday = useMemo(() => getTimeZoneDateParts(new Date(), reportTimeZone), [reportTimeZone]);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('this_month');
  const [selectedYear, setSelectedYear] = useState(reportToday.year);
  const [selectedMonth, setSelectedMonth] = useState(reportToday.month);

  const monthShortLabels = useMemo(() => {
    const formatter = createReportDateFormatter(language, { month: 'short' }, reportTimeZone);
    return Array.from({ length: 12 }, (_, index) => formatter.format(getMonthLabelAnchor(index)));
  }, [language, reportTimeZone]);

  const monthLongLabels = useMemo(() => {
    const formatter = createReportDateFormatter(language, { month: 'long' }, reportTimeZone);
    return Array.from({ length: 12 }, (_, index) => formatter.format(getMonthLabelAnchor(index)));
  }, [language, reportTimeZone]);

  // Get date range from current selection
  const dateRange = useMemo(() => {
    if (selectedPreset === 'custom' || selectedPreset === 'this_month' || selectedPreset === 'last_month') {
      return {
        year: selectedYear,
        month: selectedMonth,
        label: `${monthLongLabels[selectedMonth - 1]} ${selectedYear}`,
      };
    }

    const baseRange = getDateRangeFromPreset(selectedPreset, reportTimeZone);
    const localizedLabelMap: Partial<Record<DatePreset, string>> = {
      last_3_months: t('threeMonths'),
      last_6_months: t('sixMonths'),
      this_year: t('thisYear'),
      last_year: t('lastYear'),
      all_time: t('allTime'),
    };

    return {
      ...baseRange,
      label: localizedLabelMap[selectedPreset] || baseRange.label,
    };
  }, [monthLongLabels, reportTimeZone, selectedMonth, selectedPreset, selectedYear, t]);

  useEffect(() => {
    if (selectedPreset === 'this_month') {
      setSelectedYear(reportToday.year);
      setSelectedMonth(reportToday.month);
      return;
    }

    if (selectedPreset === 'last_month') {
      const lastMonth = reportToday.month === 1 ? 12 : reportToday.month - 1;
      const lastMonthYear = reportToday.month === 1 ? reportToday.year - 1 : reportToday.year;
      setSelectedYear(lastMonthYear);
      setSelectedMonth(lastMonth);
    }
  }, [reportToday.month, reportToday.year, selectedPreset]);

  // Handle preset change
  const handlePresetChange = (preset: DatePreset) => {
    setSelectedPreset(preset);
    if (preset === 'this_month') {
      setSelectedYear(reportToday.year);
      setSelectedMonth(reportToday.month);
    } else if (preset === 'last_month') {
      const lastMonth = reportToday.month === 1 ? 12 : reportToday.month - 1;
      const lastMonthYear = reportToday.month === 1 ? reportToday.year - 1 : reportToday.year;
      setSelectedYear(lastMonthYear);
      setSelectedMonth(lastMonth);
    }
  };

  // Handle month selection from picker
  const handleMonthSelect = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedPreset('custom');
  };

  const handleOpenHistory = (target: ReportHistoryTarget) => {
    router.push({
      pathname: '/(app)/(tabs)/wallet/history',
      params: buildHistoryRouteParams(target),
    });
  };

  const handleSelectReportMonth = ({ year, month }: { year: number; month: number }) => {
    setPeriod('monthly');
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedPreset('custom');
  };

  const monthlyOverviewQueryKey = buildReportsOverviewQueryKey({
    year: dateRange.year || selectedYear,
    month: dateRange.month || selectedMonth,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    reportTimeZone,
  });

  const { data: monthlyOverview, isError: monthlyOverviewError } = useQuery({
    queryKey: monthlyOverviewQueryKey,
    queryFn: () =>
      api.reports.overview({
        year: dateRange.year || selectedYear,
        month: dateRange.month || selectedMonth,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        timeZone: reportTimeZone,
      }),
    enabled: period === 'monthly',
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  // Fetch networth for non-monthly views (monthly uses the overview payload)
  const { data: networth, isError: networthError } = useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.reports.networth(),
    enabled: period !== 'monthly',
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const displayNetworth = period === 'monthly' ? monthlyOverview?.networth : networth;
  const displayNetworthError = period === 'monthly' ? monthlyOverviewError : networthError;

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    setRefreshing(false);
  };

  const activeReportLabel = useMemo(() => {
    switch (period) {
      case 'daily':
        return t('dailyReport');
      case 'weekly':
        return t('weeklyReport');
      case 'monthly':
        return dateRange.label;
      case 'yearly':
        return t('yearlyReport');
      case 'all_time':
        return t('allTime');
      default:
        return t('monthlyReport');
    }
  }, [dateRange.label, period, t]);

  const stickyHeaderIndex = displayNetworth && !displayNetworthError ? 2 : 1;

  return (
    <PageScaffold
      scroll
      maxWidth={1280}
      contentContainerStyle={{
        paddingBottom: bottomPadding,
      }}
      scrollProps={{
        stickyHeaderIndices: (isDesktop || isTablet) ? [stickyHeaderIndex] : undefined,
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <PageHeader
          title={t('reportsAndStats')}
          subtitle={t('reportsDescription') || 'Review net worth, report periods, and category breakdowns with a consistent layout.'}
          actions={!isDesktop ? <AppSwitcherTrigger variant="header_inline" /> : undefined}
        />

        {/* Net Worth Card (always visible) */}
        {displayNetworth && !displayNetworthError && (
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: colors.primary + '18', padding: 8, borderRadius: 8, marginEnd: 12 }}>
                <Wallet size={20} color={colors.primary} />
              </View>
              <Text style={{ color: colors.mutedForeground }}>{t('netWorth')}</Text>
            </View>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 16 }}>
              {formatCompactCurrency(displayNetworth.total_balance, displayNetworth.currency)}
            </Text>

            {displayNetworth.balances && displayNetworth.balances.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 12 }}>{t('balanceDistribution')}</Text>
                <RingChart
                  segments={displayNetworth.balances.slice(0, 5).map((b) => ({
                    value: b.balance_in_base,
                    color: CATEGORY_COLORS[b.currency.toLowerCase()] || colors.primary,
                    label: b.currency,
                  }))}
                  centerLabel={t('total')}
                  centerValue={formatCompactCurrency(displayNetworth.total_balance, displayNetworth.currency)}
                />
              </View>
            )}
          </View>
        )}

        <View style={{ backgroundColor: colors.background }}>
          <ReportPeriodTabs selected={period} onSelect={setPeriod} />
          <ReportContextStrip
            timeZoneLabel={reportTimeZoneLabel}
            activeLabel={activeReportLabel}
          />
        </View>

        {/* Conditional content based on period */}
        {period === 'daily' && (
          <DailyReportView isTablet={isTablet} onOpenHistory={handleOpenHistory} />
        )}

        {period === 'weekly' && (
          <WeeklyReportView isTablet={isTablet} onOpenHistory={handleOpenHistory} />
        )}

        {period === 'monthly' && (
          <>
            {/* Date Range Selector */}
            <DateRangeSelector
              selectedPreset={selectedPreset}
              onPresetChange={handlePresetChange}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
              dateLabel={dateRange.label}
              monthLabels={monthShortLabels}
              selectDateRangeLabel={t('selectDateRange')}
              previousYearLabel={t('previousYear')}
              nextYearLabel={t('nextYear')}
              t={t}
              currentYear={reportToday.year}
              currentMonth={reportToday.month}
            />

            {/* Monthly Report View */}
            <MonthlyReportView
              year={dateRange.year || selectedYear}
              month={dateRange.month || selectedMonth}
              fromDate={dateRange.fromDate}
              toDate={dateRange.toDate}
              isTablet={isTablet}
              categoryCardWidth={categoryCardWidth}
              categoryCols={categoryCols}
              onOpenHistory={handleOpenHistory}
            />
          </>
        )}

        {period === 'yearly' && (
          <YearlyReportView
            isTablet={isTablet}
            onOpenHistory={handleOpenHistory}
            onSelectMonth={handleSelectReportMonth}
          />
        )}

        {period === 'all_time' && (
          <AllTimeReportView
            isTablet={isTablet}
            categoryCardWidth={categoryCardWidth}
            categoryCols={categoryCols}
            onOpenHistory={handleOpenHistory}
          />
        )}
    </PageScaffold>
  );
}
