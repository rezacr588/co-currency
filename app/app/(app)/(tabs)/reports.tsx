import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Wallet, Calendar, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground } from '../../../src/constants/icons';

// Date range preset types
type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'last_year' | 'all_time' | 'custom';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Get date range from preset
function getDateRangeFromPreset(preset: DatePreset): { year?: number; month?: number; fromDate?: string; toDate?: string; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  switch (preset) {
    case 'this_month':
      return { year: currentYear, month: currentMonth, label: `${FULL_MONTH_NAMES[currentMonth - 1]} ${currentYear}` };
    case 'last_month': {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return { year: lastMonthYear, month: lastMonth, label: `${FULL_MONTH_NAMES[lastMonth - 1]} ${lastMonthYear}` };
    }
    case 'last_3_months': {
      const fromDate = new Date(currentYear, currentMonth - 4, 1);
      const toDate = new Date(currentYear, currentMonth, 0);
      return {
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        label: 'Last 3 Months',
      };
    }
    case 'last_6_months': {
      const fromDate = new Date(currentYear, currentMonth - 7, 1);
      const toDate = new Date(currentYear, currentMonth, 0);
      return {
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        label: 'Last 6 Months',
      };
    }
    case 'this_year':
      return {
        fromDate: `${currentYear}-01-01`,
        toDate: `${currentYear}-12-31`,
        label: `${currentYear}`,
      };
    case 'last_year':
      return {
        fromDate: `${currentYear - 1}-01-01`,
        toDate: `${currentYear - 1}-12-31`,
        label: `${currentYear - 1}`,
      };
    case 'all_time':
      return { label: 'All Time' };
    default:
      return { year: currentYear, month: currentMonth, label: `${FULL_MONTH_NAMES[currentMonth - 1]} ${currentYear}` };
  }
}

// Month Picker Modal Component
function MonthYearPicker({
  visible,
  onClose,
  selectedYear,
  selectedMonth,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
}) {
  const [viewYear, setViewYear] = useState(selectedYear);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

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
            >
              <ChevronLeft size={20} color="#a1a1aa" />
            </Pressable>
            <Text className="text-foreground text-xl font-bold">{viewYear}</Text>
            <Pressable
              onPress={() => viewYear < currentYear && setViewYear(viewYear + 1)}
              className={`p-2 rounded-lg ${viewYear >= currentYear ? 'opacity-30' : 'bg-secondary'}`}
              disabled={viewYear >= currentYear}
            >
              <ChevronRight size={20} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* Month grid */}
          <View className="flex-row flex-wrap gap-2">
            {MONTH_NAMES.map((month, index) => {
              const monthNum = index + 1;
              const isSelected = selectedYear === viewYear && selectedMonth === monthNum;
              const isFuture = viewYear === currentYear && monthNum > currentMonth;
              const isCurrentMonth = viewYear === currentYear && monthNum === currentMonth;

              return (
                <Pressable
                  key={month}
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
                >
                  <Text
                    className={`font-medium ${
                      isSelected ? 'text-background' : isFuture ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {month}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            className="mt-6 bg-secondary py-3 rounded-xl items-center"
          >
            <Text className="text-foreground font-medium">Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Date Range Selector Component
function DateRangeSelector({
  selectedPreset,
  onPresetChange,
  selectedYear,
  selectedMonth,
  onMonthSelect,
  dateLabel,
  isCompact,
}: {
  selectedPreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  selectedYear: number;
  selectedMonth: number;
  onMonthSelect: (year: number, month: number) => void;
  dateLabel: string;
  isCompact?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const presets: { key: DatePreset; label: string; icon?: string }[] = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_3_months', label: '3 Months' },
    { key: 'last_6_months', label: '6 Months' },
    { key: 'this_year', label: 'This Year' },
    { key: 'all_time', label: 'All Time' },
  ];

  return (
    <View className="mb-6">
      {/* Current Selection & Calendar Button */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={() => setShowPicker(true)}
          className="flex-row items-center bg-card border border-border px-4 py-2.5 rounded-xl"
        >
          <Calendar size={18} color="rgb(212, 175, 55)" />
          <Text className="text-foreground font-semibold ml-2">{dateLabel}</Text>
          <ChevronRight size={16} color="#71717a" className="ml-1" />
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
          >
            <Text
              className={`text-sm font-medium ${
                selectedPreset === preset.key ? 'text-background' : 'text-foreground'
              }`}
            >
              {preset.label}
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
      />
    </View>
  );
}

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

  // Date range state
  const now = new Date();
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('this_month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Get date range from current selection
  const dateRange = useMemo(() => {
    if (selectedPreset === 'custom' || selectedPreset === 'this_month' || selectedPreset === 'last_month') {
      return {
        year: selectedYear,
        month: selectedMonth,
        label: `${FULL_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
      };
    }
    return getDateRangeFromPreset(selectedPreset);
  }, [selectedPreset, selectedYear, selectedMonth]);

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

  const { data: monthlyReport, isPending: isLoadingMonthly } = useQuery({
    queryKey: ['reports', 'monthly', dateRange.year, dateRange.month],
    queryFn: () => api.reports.monthly(dateRange.year, dateRange.month),
  });

  const { data: categoryReport, isPending: isLoadingCategory } = useQuery({
    queryKey: ['reports', 'category', dateRange.fromDate, dateRange.toDate],
    queryFn: () => {
      if (dateRange.fromDate && dateRange.toDate) {
        return api.reports.category(dateRange.fromDate, dateRange.toDate);
      }
      // For single month, calculate from/to dates
      const startDate = new Date(dateRange.year || now.getFullYear(), (dateRange.month || now.getMonth() + 1) - 1, 1);
      const endDate = new Date(dateRange.year || now.getFullYear(), dateRange.month || now.getMonth() + 1, 0);
      return api.reports.category(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
    },
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
        <Text className="text-3xl font-bold text-foreground mb-4">{t('reportsAndStats')}</Text>

        {/* Date Range Selector */}
        <DateRangeSelector
          selectedPreset={selectedPreset}
          onPresetChange={handlePresetChange}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
          dateLabel={dateRange.label}
          isCompact={!isDesktop}
        />

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
