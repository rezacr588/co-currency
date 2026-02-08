import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useColors } from '../../../src/context/ThemeContext';
import { formatCompactCurrency, formatNumber } from '../../../src/utils/format';
import { CATEGORY_COLORS } from '../../../src/constants/icons';
import {
  type DatePreset,
  getDateRangeFromPreset,
} from '../../../src/utils/dateRange';
import {
  ReportPeriodTabs,
  type ReportPeriod,
  DailyReportView,
  WeeklyReportView,
  MonthlyReportView,
  YearlyReportView,
} from '../../../src/components/features/Reports';

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};

function createDateFormatter(language: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = LANGUAGE_LOCALES[language] || 'en-US';
  const formatOptions: Intl.DateTimeFormatOptions = { ...options };
  if (language === 'fa') {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }
  return new Intl.DateTimeFormat(locale, formatOptions);
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
}) {
  const colors = useColors();
  const [viewYear, setViewYear] = useState(selectedYear);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    if (visible) {
      setViewYear(selectedYear);
    }
  }, [selectedYear, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/60 justify-center items-center"
        onPress={onClose}
      >
        <Pressable
          className="bg-card rounded-2xl p-6 mx-6 w-full max-w-sm"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Year selector */}
          <View className="flex-row items-center justify-between mb-6">
            <Pressable
              onPress={() => setViewYear(viewYear - 1)}
              className="p-2 rounded-lg bg-secondary"
              accessibilityRole="button"
              accessibilityLabel={previousYearLabel}
            >
              <ChevronLeft size={20} color={colors.secondaryForeground} />
            </Pressable>
            <Text className="text-foreground text-xl font-bold">{viewYear}</Text>
            <Pressable
              onPress={() => viewYear < currentYear && setViewYear(viewYear + 1)}
              className={`p-2 rounded-lg ${viewYear >= currentYear ? 'opacity-30' : 'bg-secondary'}`}
              disabled={viewYear >= currentYear}
              accessibilityRole="button"
              accessibilityLabel={nextYearLabel}
            >
              <ChevronRight size={20} color={colors.secondaryForeground} />
            </Pressable>
          </View>

          {/* Month grid */}
          <View className="flex-row flex-wrap gap-2">
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
                  style={{ width: '31%' }}
                  className={`py-3 rounded-xl items-center ${
                    isSelected
                      ? 'bg-accent'
                      : isCurrentMonth
                        ? 'bg-accent/20 border border-accent'
                        : isFuture
                          ? 'bg-secondary/30 opacity-40'
                          : 'bg-secondary'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={monthLabel}
                  accessibilityState={{ selected: isSelected, disabled: isFuture }}
                >
                  <Text
                    className={`font-medium ${
                      isSelected ? 'text-background' : isFuture ? 'text-muted-foreground' : 'text-foreground'
                    }`}
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
            className="mt-6 bg-secondary py-3 rounded-xl items-center"
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          >
            <Text className="text-foreground font-medium">{t('close')}</Text>
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
}) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);

  const presets: { key: DatePreset; labelKey: string }[] = [
    { key: 'this_month', labelKey: 'thisMonth' },
    { key: 'last_month', labelKey: 'lastMonth' },
    { key: 'last_3_months', labelKey: 'threeMonths' },
    { key: 'last_6_months', labelKey: 'sixMonths' },
    { key: 'this_year', labelKey: 'thisYear' },
    { key: 'all_time', labelKey: 'allTime' },
  ];

  return (
    <View className="mb-6">
      {/* Current Selection & Calendar Button */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={() => setShowPicker(true)}
          className="flex-row items-center bg-card border border-border px-4 py-2.5 rounded-xl"
          accessibilityRole="button"
          accessibilityLabel={selectDateRangeLabel}
        >
          <Calendar size={18} color={colors.accent} />
          <Text className="text-foreground font-semibold ml-2">{dateLabel}</Text>
          <ChevronRight size={16} color={colors.mutedForeground} className="ml-1" />
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
            className={`px-4 py-2 rounded-full ${
              selectedPreset === preset.key
                ? 'bg-accent'
                : 'bg-secondary border border-border'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t(preset.labelKey)}
            accessibilityState={{ selected: selectedPreset === preset.key }}
          >
            <Text
              className={`text-sm font-medium ${
                selectedPreset === preset.key ? 'text-background' : 'text-foreground'
              }`}
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
  const colors = useColors();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative offsets for each segment
  let cumulativePercent = 0;
  const arcs = segments.map((segment) => {
    const percent = segment.value / total;
    const dashArray = percent * circumference;
    const dashOffset = -cumulativePercent * circumference;
    cumulativePercent += percent;
    return { ...segment, dashArray, dashOffset, percent };
  });

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }} className="items-center justify-center">
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
        <View className="absolute items-center justify-center">
          <Text className="text-muted-foreground text-xs">{centerLabel}</Text>
          <Text className="text-foreground text-lg font-bold">{centerValue}</Text>
        </View>
      </View>
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

export default function ReportsScreen() {
  const { t, language } = useLanguage();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  // Calculate category card widths
  const containerPadding = isDesktop ? 32 : 24;
  const cardGap = 12;
  const availableWidth = width - containerPadding * 2;
  const categoryCols = isDesktop ? 3 : isTablet ? 2 : 1;
  const categoryCardWidth = categoryCols === 1 ? availableWidth : (availableWidth - cardGap * (categoryCols - 1)) / categoryCols;

  // Report period state
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  // Date range state (for monthly view)
  const now = new Date();
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('this_month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const monthShortLabels = useMemo(() => {
    const formatter = createDateFormatter(language, { month: 'short' });
    return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2024, index, 1)));
  }, [language]);

  const monthLongLabels = useMemo(() => {
    const formatter = createDateFormatter(language, { month: 'long' });
    return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2024, index, 1)));
  }, [language]);

  // Get date range from current selection
  const dateRange = useMemo(() => {
    if (selectedPreset === 'custom' || selectedPreset === 'this_month' || selectedPreset === 'last_month') {
      return {
        year: selectedYear,
        month: selectedMonth,
        label: `${monthLongLabels[selectedMonth - 1]} ${selectedYear}`,
      };
    }

    const baseRange = getDateRangeFromPreset(selectedPreset);
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
  }, [monthLongLabels, selectedMonth, selectedPreset, selectedYear, t]);

  // Handle preset change
  const handlePresetChange = (preset: DatePreset) => {
    setSelectedPreset(preset);
    if (preset === 'this_month') {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
    } else if (preset === 'last_month') {
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
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
        <Text className="text-3xl font-bold text-foreground mb-4">{t('reportsAndStats')}</Text>

        {/* Net Worth Card (always visible) */}
        {networth && !networthError && (
          <View className="bg-card p-6 rounded-xl mb-6">
            <View className="flex-row items-center mb-4">
              <View className="bg-accent/20 p-2 rounded-lg mr-3">
                <Wallet size={20} color={colors.accent} />
              </View>
              <Text className="text-muted-foreground">{t('netWorth')}</Text>
            </View>
            <Text className="text-4xl font-bold text-accent mb-4">
              {formatCompactCurrency(networth.total_balance, networth.currency)}
            </Text>

            {networth.balances && networth.balances.length > 0 && (
              <View className="mt-2">
                <Text className="text-muted-foreground text-sm mb-3">{t('balanceDistribution')}</Text>
                <RingChart
                  segments={networth.balances.slice(0, 5).map((b) => ({
                    value: b.balance_in_base,
                    color: CATEGORY_COLORS[b.currency.toLowerCase()] || colors.accent,
                    label: b.currency,
                  }))}
                  centerLabel={t('total')}
                  centerValue={formatCompactCurrency(networth.total_balance, networth.currency)}
                />
              </View>
            )}
          </View>
        )}

        {/* Report Period Tabs */}
        <ReportPeriodTabs selected={period} onSelect={setPeriod} />

        {/* Conditional content based on period */}
        {period === 'daily' && (
          <DailyReportView isTablet={isTablet} />
        )}

        {period === 'weekly' && (
          <WeeklyReportView isTablet={isTablet} />
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
            />
          </>
        )}

        {period === 'yearly' && (
          <YearlyReportView isTablet={isTablet} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
