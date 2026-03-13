import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Wallet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../../src/utils/format';
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
} from '../../../src/components/features/Reports';
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
            style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1, marginLeft: 12, textAlign: 'right' }}
            numberOfLines={1}
          >
            {activeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Month Picker Modal Component
function MonthYearPicker({
  visible,
  onClose,
  selectedYear,
  selectedMonth,
  onSelect,
  monthLabels,
  previousYearLabel,
  nextYearLabel,
  t,
  reportTimeZone,
}: {
  visible: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  monthLabels: string[];
  previousYearLabel: string;
  nextYearLabel: string;
  t: (key: string) => string;
  reportTimeZone: string;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const [viewYear, setViewYear] = useState(selectedYear);
  const { width, isCompactPhone } = useScreenLayout();
  const insets = useSafeAreaInsets();
  const reportToday = useMemo(() => getTimeZoneDateParts(new Date(), reportTimeZone), [reportTimeZone]);
  const currentYear = reportToday.year;
  const currentMonth = reportToday.month;
  const modalScreenPadding = Math.max(16, Math.max(insets.left, insets.right) + 16);
  const modalWidth = Math.min(width - modalScreenPadding * 2, 384);
  const modalInnerWidth = modalWidth - 48;
  const monthCols = isCompactPhone ? 2 : 3;
  const monthGap = 8;
  const monthTileWidth = (modalInnerWidth - monthGap * (monthCols - 1)) / monthCols;

  useEffect(() => {
    if (visible) {
      setViewYear(selectedYear);
    }
  }, [selectedYear, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: modalScreenPadding }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: modalWidth, maxWidth: 384 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Year selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Pressable
              onPress={() => setViewYear(viewYear - 1)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: colors.secondary }}
              accessibilityRole="button"
              accessibilityLabel={previousYearLabel}
            >
              <ChevronLeft size={20} color={colors.secondaryForeground} />
            </Pressable>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{viewYear}</Text>
            <Pressable
              onPress={() => viewYear < currentYear && setViewYear(viewYear + 1)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: viewYear >= currentYear ? 'transparent' : colors.secondary, opacity: viewYear >= currentYear ? 0.3 : 1 }}
              disabled={viewYear >= currentYear}
              accessibilityRole="button"
              accessibilityLabel={nextYearLabel}
            >
              <ChevronRight size={20} color={colors.secondaryForeground} />
            </Pressable>
          </View>

          {/* Month grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {monthLabels.map((monthLabel, index) => {
              const monthNum = index + 1;
              const isSelected = selectedYear === viewYear && selectedMonth === monthNum;
              const isFuture = viewYear === currentYear && monthNum > currentMonth;
              const isCurrentMonth = viewYear === currentYear && monthNum === currentMonth;

              return (
                <Pressable
                  key={`${monthLabel}-${monthNum}`}
                  onPress={() => !isFuture && onSelect(viewYear, monthNum)}
                  disabled={isFuture}
                  style={{
                    width: monthTileWidth,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? colors.primary
                      : isCurrentMonth
                        ? colors.primary + '18'
                        : isFuture
                          ? colors.secondary + '4D'
                          : colors.secondary,
                    borderWidth: isCurrentMonth && !isSelected ? 1 : 0,
                    borderColor: isCurrentMonth ? colors.primary : 'transparent',
                    opacity: isFuture ? 0.4 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={monthLabel}
                  accessibilityState={{ selected: isSelected, disabled: isFuture }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      color: isSelected ? colors.primaryForeground : isFuture ? colors.mutedForeground : colors.foreground,
                    }}
                  >
                    {monthLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={{ marginTop: 24, backgroundColor: colors.secondary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{t('close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Date Range Selector Component (for Monthly view)
function DateRangeSelector({
  selectedPreset,
  onPresetChange,
  selectedYear,
  selectedMonth,
  onMonthSelect,
  dateLabel,
  monthLabels,
  selectDateRangeLabel,
  previousYearLabel,
  nextYearLabel,
  t,
  reportTimeZone,
}: {
  selectedPreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  selectedYear: number;
  selectedMonth: number;
  onMonthSelect: (year: number, month: number) => void;
  dateLabel: string;
  monthLabels: string[];
  selectDateRangeLabel: string;
  previousYearLabel: string;
  nextYearLabel: string;
  t: (key: string) => string;
  reportTimeZone: string;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const [showPicker, setShowPicker] = useState(false);

  const presets: { key: DatePreset; labelKey: string }[] = [
    { key: 'this_month', labelKey: 'thisMonth' },
    { key: 'last_month', labelKey: 'lastMonth' },
    { key: 'last_3_months', labelKey: 'threeMonths' },
    { key: 'last_6_months', labelKey: 'sixMonths' },
    { key: 'this_year', labelKey: 'thisYear' },
  ];

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Current Selection & Calendar Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Pressable
          onPress={() => setShowPicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
          accessibilityRole="button"
          accessibilityLabel={selectDateRangeLabel}
        >
          <Calendar size={18} color={colors.primary} />
          <Text
            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginLeft: 8, flexShrink: 1 }}
            numberOfLines={1}
          >
            {dateLabel}
          </Text>
          <ChevronRight size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      {/* Preset Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {presets.map((preset) => (
          <Pressable
            key={preset.key}
            onPress={() => onPresetChange(preset.key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              backgroundColor: selectedPreset === preset.key ? colors.primary : colors.secondary,
              borderWidth: selectedPreset === preset.key ? 0 : 1,
              borderColor: colors.border,
            }}
            accessibilityRole="button"
            accessibilityLabel={t(preset.labelKey)}
            accessibilityState={{ selected: selectedPreset === preset.key }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_500Medium',
                color: selectedPreset === preset.key ? colors.primaryForeground : colors.foreground,
              }}
            >
              {t(preset.labelKey)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Month Picker Modal */}
      <MonthYearPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSelect={(year, month) => {
          onMonthSelect(year, month);
          setShowPicker(false);
        }}
        monthLabels={monthLabels}
        previousYearLabel={previousYearLabel}
        nextYearLabel={nextYearLabel}
        t={t}
        reportTimeZone={reportTimeZone}
      />
    </View>
  );
}

// SVG donut chart for net worth currency breakdown
function RingChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative offsets for each segment (memoized)
  const arcs = useMemo(() => {
    let cumulativePercent = 0;
    return segments.map((segment) => {
      const percent = segment.value / total;
      const dashArray = percent * circumference;
      const dashOffset = -cumulativePercent * circumference;
      cumulativePercent += percent;
      return { ...segment, dashArray, dashOffset, percent };
    });
  }, [segments, total, circumference]);

  if (total === 0) return null;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.secondary}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Colored segments */}
          {arcs.map((arc, index) => (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${arc.dashArray} ${circumference - arc.dashArray}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          ))}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{centerLabel}</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{centerValue}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 }}>
        {segments.slice(0, 4).map((segment, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: segment.color, marginRight: 4 }}
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {segment.label} ({formatNumber((segment.value / total) * 100, 0)}%)
            </Text>
          </View>
        ))}
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

  // Fetch networth for all views (shown above tabs)
  const { data: networth, isError: networthError } = useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.reports.networth(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const stickyHeaderIndex = networth && !networthError ? 2 : 1;

  return (
    <PageScaffold
      scroll
      maxWidth={1280}
      contentContainerStyle={{
        paddingBottom: bottomPadding,
      }}
      scrollProps={{
        stickyHeaderIndices: [stickyHeaderIndex],
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <PageHeader
          title={t('reportsAndStats')}
          subtitle={t('reportsDescription') || 'Review net worth, report periods, and category breakdowns with a consistent layout.'}
          actions={!isDesktop ? <AppSwitcherTrigger variant="header_inline" /> : undefined}
        />

        {/* Net Worth Card (always visible) */}
        {networth && !networthError && (
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: colors.primary + '18', padding: 8, borderRadius: 8, marginRight: 12 }}>
                <Wallet size={20} color={colors.primary} />
              </View>
              <Text style={{ color: colors.mutedForeground }}>{t('netWorth')}</Text>
            </View>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 16 }}>
              {formatCompactCurrency(networth.total_balance, networth.currency)}
            </Text>

            {networth.balances && networth.balances.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 12 }}>{t('balanceDistribution')}</Text>
                <RingChart
                  segments={networth.balances.slice(0, 5).map((b) => ({
                    value: b.balance_in_base,
                    color: CATEGORY_COLORS[b.currency.toLowerCase()] || colors.primary,
                    label: b.currency,
                  }))}
                  centerLabel={t('total')}
                  centerValue={formatCompactCurrency(networth.total_balance, networth.currency)}
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
              reportTimeZone={reportTimeZone}
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
