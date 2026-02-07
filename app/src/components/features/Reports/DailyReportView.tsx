import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RotateCcw,
} from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency } from '../../../utils/format';
import { formatDateKey, safeMax } from '../../../utils/dateRange';
import { StyledCategoryIcon } from '../../../constants/icons';
import type { Transaction } from '../../../types/wallet';

interface DailyReportViewProps {
  isTablet?: boolean;
}

type TimelinePreset = '7D' | '30D' | '3M' | '6M' | '1Y';

type BucketGranularity = 'day' | 'week' | 'month';

interface TimelineConfig {
  windowDays: number;
  bucketGranularity: BucketGranularity;
  translationKey: string;
}

interface DailySummary {
  date: Date;
  dateKey: string;
  income: number;
  expenses: number;
  net: number;
  txCount: number;
  transactions: Transaction[];
  isToday: boolean;
}

interface ChartBucket {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
  income: number;
  expenses: number;
  net: number;
  txCount: number;
  transactions: Transaction[];
  isCurrentBucket: boolean;
}

interface ReportFetchResult {
  transactions: Transaction[];
  conversionRates: Record<string, number>;
  missingCurrencies: string[];
  truncated: boolean;
}

const REPORT_CURRENCY = 'USD';
const PAGE_SIZE = 500;
const FETCH_CAP = 5000;

const TIMELINE_CONFIG: Record<TimelinePreset, TimelineConfig> = {
  '7D': { windowDays: 7, bucketGranularity: 'day', translationKey: 'timeline7d' },
  '30D': { windowDays: 30, bucketGranularity: 'day', translationKey: 'timeline30d' },
  '3M': { windowDays: 90, bucketGranularity: 'week', translationKey: 'timeline3m' },
  '6M': { windowDays: 180, bucketGranularity: 'week', translationKey: 'timeline6m' },
  '1Y': { windowDays: 365, bucketGranularity: 'month', translationKey: 'timeline1y' },
};

const TIMELINE_PRESETS: TimelinePreset[] = ['7D', '30D', '3M', '6M', '1Y'];

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isDateInRange(target: Date, start: Date, end: Date): boolean {
  const targetTs = target.getTime();
  return targetTs >= start.getTime() && targetTs <= end.getTime();
}

function getWindowRange(windowDays: number, windowIndex: number): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const end = addDays(today, -(windowIndex * windowDays));
  const start = addDays(end, -(windowDays - 1));
  return { start, end };
}

function createDateFormatter(language: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = LANGUAGE_LOCALES[language] || 'en-US';
  const formatOptions: Intl.DateTimeFormatOptions = { ...options };
  if (language === 'fa') {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }
  return new Intl.DateTimeFormat(locale, formatOptions);
}

function getAmountInReportCurrency(tx: Transaction, conversionRates: Record<string, number>): number {
  if (tx.currency === REPORT_CURRENCY) {
    return tx.amount;
  }

  const rate = conversionRates[tx.currency];
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    return tx.amount * rate;
  }

  // Fallback when conversion rate is unavailable.
  return tx.amount;
}

async function fetchTransactionsForRange(fromDate: string, toDate: string): Promise<ReportFetchResult> {
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const allTransactions: Transaction[] = [];

  while (allTransactions.length < total && allTransactions.length < FETCH_CAP) {
    const page = await api.wallet.getTransactions(PAGE_SIZE, offset, {
      from_date: fromDate,
      to_date: toDate,
    });

    const transactions = page.transactions || [];
    total = Number.isFinite(page.total) ? page.total : transactions.length;

    if (transactions.length === 0) {
      break;
    }

    const remainingCapacity = FETCH_CAP - allTransactions.length;
    allTransactions.push(...transactions.slice(0, remainingCapacity));

    if (transactions.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  const truncated = Number.isFinite(total) && total > FETCH_CAP;

  const conversionRates: Record<string, number> = {
    [REPORT_CURRENCY]: 1,
  };
  const missingCurrencies: string[] = [];

  const distinctCurrencies = Array.from(
    new Set(
      allTransactions
        .map((tx) => tx.currency)
        .filter((currency): currency is string => !!currency && currency !== REPORT_CURRENCY)
    )
  );

  await Promise.all(
    distinctCurrencies.map(async (currency) => {
      try {
        const conversion = await api.convert({
          from: currency,
          to: REPORT_CURRENCY,
          amount: 1,
        });

        if (Number.isFinite(conversion.rate) && conversion.rate > 0) {
          conversionRates[currency] = conversion.rate;
          return;
        }
      } catch {
        // Ignore conversion errors and mark currency as missing.
      }

      missingCurrencies.push(currency);
    })
  );

  missingCurrencies.sort((a, b) => a.localeCompare(b));

  return {
    transactions: allTransactions,
    conversionRates,
    missingCurrencies,
    truncated,
  };
}

export function DailyReportView({ isTablet = false }: DailyReportViewProps) {
  const { t, language } = useLanguage();
  const [timelinePreset, setTimelinePreset] = useState<TimelinePreset>('30D');
  const [windowIndex, setWindowIndex] = useState(0);
  const [selectedBucketIndex, setSelectedBucketIndex] = useState(0);

  const timelineConfig = TIMELINE_CONFIG[timelinePreset];

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getWindowRange(timelineConfig.windowDays, windowIndex),
    [timelineConfig.windowDays, windowIndex]
  );

  const fromDate = formatDateKey(windowStart);
  const toDate = formatDateKey(windowEnd);

  const {
    data: reportData,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['transactions', 'daily-history', timelinePreset, fromDate, toDate],
    queryFn: () => fetchTransactionsForRange(fromDate, toDate),
    staleTime: 2 * 60 * 1000,
  });

  const windowDays = useMemo(() => {
    return Array.from({ length: timelineConfig.windowDays }, (_, index) => addDays(windowStart, index));
  }, [timelineConfig.windowDays, windowStart]);

  const groupedData = useMemo(() => {
    const groups = new Map<string, { income: number; expenses: number; transactions: Transaction[] }>();
    const rates = reportData?.conversionRates || {};

    (reportData?.transactions || []).forEach((tx) => {
      const dateKey = formatDateKey(new Date(tx.created_at));
      const current = groups.get(dateKey) || { income: 0, expenses: 0, transactions: [] };
      const amountInReportCurrency = getAmountInReportCurrency(tx, rates);

      if (tx.type === 'credit') {
        current.income += amountInReportCurrency;
      } else if (tx.type === 'debit') {
        current.expenses += amountInReportCurrency;
      }

      current.transactions.push(tx);
      groups.set(dateKey, current);
    });

    return groups;
  }, [reportData]);

  const today = startOfDay(new Date());
  const todayKey = formatDateKey(today);

  const daySummaries = useMemo<DailySummary[]>(() => {
    return windowDays.map((date) => {
      const dateKey = formatDateKey(date);
      const dayData = groupedData.get(dateKey);
      const income = dayData?.income || 0;
      const expenses = dayData?.expenses || 0;

      return {
        date,
        dateKey,
        income,
        expenses,
        net: income - expenses,
        txCount: dayData?.transactions.length || 0,
        transactions: dayData?.transactions || [],
        isToday: dateKey === todayKey,
      };
    });
  }, [groupedData, todayKey, windowDays]);

  const rangeFormatter = useMemo(
    () => createDateFormatter(language, { month: 'short', day: 'numeric' }),
    [language]
  );
  const rangeWithYearFormatter = useMemo(
    () => createDateFormatter(language, { month: 'short', day: 'numeric', year: 'numeric' }),
    [language]
  );
  const monthFormatter = useMemo(
    () => createDateFormatter(language, { month: 'short' }),
    [language]
  );

  const chartBuckets = useMemo<ChartBucket[]>(() => {
    if (timelineConfig.bucketGranularity === 'day') {
      return daySummaries.map((day) => ({
        key: day.dateKey,
        label: rangeFormatter.format(day.date),
        startDate: day.date,
        endDate: day.date,
        income: day.income,
        expenses: day.expenses,
        net: day.net,
        txCount: day.txCount,
        transactions: day.transactions,
        isCurrentBucket: day.isToday,
      }));
    }

    if (timelineConfig.bucketGranularity === 'week') {
      const buckets: ChartBucket[] = [];
      for (let index = 0; index < daySummaries.length; index += 7) {
        const slice = daySummaries.slice(index, index + 7);
        if (slice.length === 0) {
          continue;
        }

        const startDate = slice[0].date;
        const endDate = slice[slice.length - 1].date;
        const income = slice.reduce((sum, day) => sum + day.income, 0);
        const expenses = slice.reduce((sum, day) => sum + day.expenses, 0);
        const txCount = slice.reduce((sum, day) => sum + day.txCount, 0);
        const transactions = slice.flatMap((day) => day.transactions);

        buckets.push({
          key: `${slice[0].dateKey}-${slice[slice.length - 1].dateKey}`,
          label: `${rangeFormatter.format(startDate)} - ${rangeFormatter.format(endDate)}`,
          startDate,
          endDate,
          income,
          expenses,
          net: income - expenses,
          txCount,
          transactions,
          isCurrentBucket: isDateInRange(today, startDate, endDate),
        });
      }

      return buckets;
    }

    const buckets: ChartBucket[] = [];
    let cursor = 0;

    while (cursor < daySummaries.length) {
      const firstDay = daySummaries[cursor];
      const month = firstDay.date.getMonth();
      const year = firstDay.date.getFullYear();

      let endCursor = cursor;
      while (endCursor + 1 < daySummaries.length) {
        const nextDay = daySummaries[endCursor + 1];
        if (nextDay.date.getMonth() !== month || nextDay.date.getFullYear() !== year) {
          break;
        }
        endCursor++;
      }

      const slice = daySummaries.slice(cursor, endCursor + 1);
      const startDate = slice[0].date;
      const endDate = slice[slice.length - 1].date;
      const income = slice.reduce((sum, day) => sum + day.income, 0);
      const expenses = slice.reduce((sum, day) => sum + day.expenses, 0);
      const txCount = slice.reduce((sum, day) => sum + day.txCount, 0);
      const transactions = slice.flatMap((day) => day.transactions);

      buckets.push({
        key: `${year}-${month + 1}`,
        label: monthFormatter.format(startDate),
        startDate,
        endDate,
        income,
        expenses,
        net: income - expenses,
        txCount,
        transactions,
        isCurrentBucket: isDateInRange(today, startDate, endDate),
      });

      cursor = endCursor + 1;
    }

    return buckets;
  }, [daySummaries, monthFormatter, rangeFormatter, timelineConfig.bucketGranularity, today]);

  useEffect(() => {
    if (chartBuckets.length === 0) {
      setSelectedBucketIndex(0);
      return;
    }

    const reverseIndex = [...chartBuckets].reverse().findIndex((bucket) => bucket.txCount > 0);
    if (reverseIndex >= 0) {
      setSelectedBucketIndex(chartBuckets.length - 1 - reverseIndex);
      return;
    }

    setSelectedBucketIndex(chartBuckets.length - 1);
  }, [chartBuckets]);

  const selectedBucket = chartBuckets[selectedBucketIndex] || chartBuckets[chartBuckets.length - 1] || null;

  const selectedBucketRange = useMemo(() => {
    if (!selectedBucket) {
      return '';
    }

    if (selectedBucket.startDate.getTime() === selectedBucket.endDate.getTime()) {
      return rangeWithYearFormatter.format(selectedBucket.startDate);
    }

    return `${rangeWithYearFormatter.format(selectedBucket.startDate)} - ${rangeWithYearFormatter.format(selectedBucket.endDate)}`;
  }, [rangeWithYearFormatter, selectedBucket]);

  const selectedTransactions = useMemo(() => {
    if (!selectedBucket) {
      return [];
    }

    return [...selectedBucket.transactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [selectedBucket]);

  const totals = useMemo(() => {
    return daySummaries.reduce(
      (acc, day) => {
        acc.income += day.income;
        acc.expenses += day.expenses;
        acc.net += day.net;
        return acc;
      },
      { income: 0, expenses: 0, net: 0 }
    );
  }, [daySummaries]);

  const averageDailyNet = daySummaries.length > 0 ? totals.net / daySummaries.length : 0;

  const maxBucketValue = useMemo(() => {
    const values = chartBuckets.flatMap((bucket) => [bucket.income, bucket.expenses]);
    return safeMax(values) || 1;
  }, [chartBuckets]);

  const rangeLabel = `${rangeWithYearFormatter.format(windowStart)} - ${rangeWithYearFormatter.format(windowEnd)}`;
  const isCurrentWindow = windowIndex === 0;

  if (isPending) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="bg-card p-6 rounded-xl items-center">
        <AlertCircle size={48} color="rgb(220, 38, 38)" />
        <Text className="text-foreground font-semibold mt-4 text-lg">{t('failedToLoadReport')}</Text>
        <Text className="text-muted-foreground mt-2 text-center">{t('checkConnection')}</Text>
      </View>
    );
  }

  const timelineLabel = t(timelineConfig.translationKey);

  return (
    <View>
      <View className="bg-card p-5 rounded-xl mb-6">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            onPress={() => setWindowIndex((index) => index + 1)}
            className="p-3 rounded-xl bg-secondary"
            accessibilityRole="button"
            accessibilityLabel={t('previousPeriod')}
          >
            <ChevronLeft size={20} color="#a1a1aa" />
          </Pressable>

          <View className="flex-1 bg-secondary/40 border border-border px-4 py-3 rounded-xl items-center">
            <View className="flex-row items-center">
              <Calendar size={16} color="rgb(212, 175, 55)" />
              <Text className="text-foreground font-semibold ml-2">{timelineLabel}</Text>
            </View>
            <Text className="text-muted-foreground text-xs mt-1">{rangeLabel}</Text>
            <Text className="text-muted-foreground text-xs mt-1">
              {(t('reportCurrency') || 'Report currency') + `: ${REPORT_CURRENCY}`}
            </Text>
            {isCurrentWindow ? (
              <Text className="text-accent text-xs mt-1">{t('currentPeriod')}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => !isCurrentWindow && setWindowIndex((index) => index - 1)}
            className={`p-3 rounded-xl ${isCurrentWindow ? 'bg-secondary/30 opacity-50' : 'bg-secondary'}`}
            disabled={isCurrentWindow}
            accessibilityRole="button"
            accessibilityLabel={t('nextPeriod')}
          >
            <ChevronRight size={20} color="#a1a1aa" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 2 }}
        >
          {TIMELINE_PRESETS.map((preset) => {
            const isSelected = preset === timelinePreset;
            return (
              <Pressable
                key={preset}
                onPress={() => {
                  setTimelinePreset(preset);
                  setWindowIndex(0);
                }}
                className={`px-3 py-2 rounded-full border ${
                  isSelected ? 'bg-accent border-accent' : 'bg-secondary border-border'
                }`}
                accessibilityRole="button"
                accessibilityLabel={t(TIMELINE_CONFIG[preset].translationKey)}
                accessibilityState={{ selected: isSelected }}
              >
                <Text className={`text-xs font-semibold ${isSelected ? 'text-background' : 'text-foreground'}`}>
                  {t(TIMELINE_CONFIG[preset].translationKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!isCurrentWindow ? (
          <Pressable
            onPress={() => setWindowIndex(0)}
            className="mt-3 py-2.5 px-4 rounded-lg bg-accent/15 border border-accent/30 flex-row items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('goToCurrentPeriod')}
          >
            <RotateCcw size={14} color="rgb(212, 175, 55)" />
            <Text className="text-accent font-medium ml-2">{t('goToCurrentPeriod')}</Text>
          </Pressable>
        ) : null}

        {reportData?.missingCurrencies.length ? (
          <Text className="text-accent text-xs mt-3">
            {(t('conversionFallbackNotice') || 'Some currencies could not be converted exactly') + `: ${reportData.missingCurrencies.join(', ')}`}
          </Text>
        ) : null}

        {reportData?.truncated ? (
          <Text className="text-muted-foreground text-xs mt-1">
            {t('dataLimitedNotice') || 'Large data range limited for performance.'}
          </Text>
        ) : null}
      </View>

      <View
        className="mb-6"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <View className="bg-success/10 border border-success/30 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <View className="flex-row items-center mb-1">
            <TrendingUp size={16} color="rgb(16, 185, 129)" />
            <Text className="text-muted-foreground text-xs ml-2">{t('totalIncome')}</Text>
          </View>
          <Text className="text-success text-lg font-bold">{formatCompactCurrency(totals.income, REPORT_CURRENCY)}</Text>
        </View>

        <View className="bg-danger/10 border border-danger/30 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <View className="flex-row items-center mb-1">
            <TrendingDown size={16} color="rgb(220, 38, 38)" />
            <Text className="text-muted-foreground text-xs ml-2">{t('totalExpenses')}</Text>
          </View>
          <Text className="text-danger text-lg font-bold">{formatCompactCurrency(totals.expenses, REPORT_CURRENCY)}</Text>
        </View>

        <View className="bg-secondary/45 border border-border rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
          <Text className={`text-lg font-bold ${totals.net >= 0 ? 'text-success' : 'text-danger'}`}>
            {totals.net >= 0 ? '+' : ''}
            {formatCompactCurrency(totals.net, REPORT_CURRENCY)}
          </Text>
        </View>

        <View className="bg-accent/10 border border-accent/25 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('avgDaily')}</Text>
          <Text className={`text-lg font-bold ${averageDailyNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {averageDailyNet >= 0 ? '+' : ''}
            {formatCompactCurrency(averageDailyNet, REPORT_CURRENCY)}
          </Text>
        </View>
      </View>

      <View className="bg-card p-5 rounded-xl mb-6">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <View className="bg-secondary p-2 rounded-lg mr-3">
              <Calendar size={18} color="rgb(148, 163, 184)" />
            </View>
            <View>
              <Text className="text-foreground font-semibold">{t('dailyTimeline')}</Text>
              <Text className="text-muted-foreground text-xs">{rangeLabel}</Text>
            </View>
          </View>
        </View>

        <Text className="text-muted-foreground text-xs mb-3">{t('tapBarForDetails')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {chartBuckets.map((bucket, index) => {
            const incomeHeight = bucket.income > 0 ? Math.max((bucket.income / maxBucketValue) * 96, 4) : 2;
            const expenseHeight = bucket.expenses > 0 ? Math.max((bucket.expenses / maxBucketValue) * 96, 4) : 2;
            const isSelected = index === selectedBucketIndex;
            const bucketRangeText =
              bucket.startDate.getTime() === bucket.endDate.getTime()
                ? rangeWithYearFormatter.format(bucket.startDate)
                : `${rangeWithYearFormatter.format(bucket.startDate)} - ${rangeWithYearFormatter.format(bucket.endDate)}`;

            return (
              <Pressable
                key={bucket.key}
                onPress={() => setSelectedBucketIndex(index)}
                className={`items-center rounded-lg px-1 py-1 ${isSelected ? 'bg-accent/10 border border-accent/30' : ''}`}
                style={{ width: timelinePreset === '30D' ? 40 : timelinePreset === '7D' ? 56 : 62 }}
                accessibilityRole="button"
                accessibilityLabel={`${t('selectedRange')}: ${bucketRangeText}. ${bucket.txCount} ${t('transactionsCount')}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={{ height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <View
                    className={`w-2 rounded-t ${bucket.income > 0 ? 'bg-success' : 'bg-secondary/50'}`}
                    style={{ height: incomeHeight }}
                  />
                  <View
                    className={`w-2 rounded-t ${bucket.expenses > 0 ? 'bg-danger' : 'bg-secondary/50'}`}
                    style={{ height: expenseHeight }}
                  />
                </View>
                <Text
                  className={`text-[10px] mt-1 text-center ${
                    bucket.isCurrentBucket ? 'text-accent font-semibold' : 'text-muted-foreground'
                  }`}
                  numberOfLines={1}
                >
                  {bucket.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row justify-center gap-4 mt-4">
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

      <View className="bg-card p-5 rounded-xl">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-semibold">{t('selectedRange')}</Text>
          <Text className="text-muted-foreground text-xs">{selectedBucketRange}</Text>
        </View>

        {selectedBucket ? (
          <>
            <Text className="text-muted-foreground text-xs mb-3">
              {selectedBucket.txCount} {t('transactionsCount')}
            </Text>

            <View className="bg-secondary/35 border border-border rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs">{t('totalIncome')}</Text>
                <Text className="text-success font-semibold">{formatCompactCurrency(selectedBucket.income, REPORT_CURRENCY)}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-muted-foreground text-xs">{t('totalExpenses')}</Text>
                <Text className="text-danger font-semibold">{formatCompactCurrency(selectedBucket.expenses, REPORT_CURRENCY)}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border/60">
                <Text className="text-muted-foreground text-xs">{t('net')}</Text>
                <Text className={`font-bold ${selectedBucket.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  {selectedBucket.net >= 0 ? '+' : ''}
                  {formatCompactCurrency(selectedBucket.net, REPORT_CURRENCY)}
                </Text>
              </View>
            </View>

            {selectedTransactions.length > 0 ? (
              <View className="gap-2">
                {selectedTransactions.map((tx) => {
                  const normalizedAmount = getAmountInReportCurrency(tx, reportData?.conversionRates || {});
                  return (
                    <View key={tx.id} className="rounded-lg border border-border/60 bg-secondary/20 p-3 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 pr-3">
                        <StyledCategoryIcon
                          category={tx.category || 'other'}
                          size={12}
                          backgroundOpacity={0.1}
                          borderRadius={4}
                          padding={4}
                        />
                        <View className="ml-2 flex-1">
                          <Text className="text-foreground text-xs font-medium" numberOfLines={1}>
                            {tx.description || tx.category || t('transactions')}
                          </Text>
                          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                            {formatDateKey(new Date(tx.created_at))}
                          </Text>
                        </View>
                      </View>
                      <Text className={`text-xs font-semibold ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                        {tx.type === 'credit' ? '+' : '-'}
                        {formatCompactCurrency(normalizedAmount, REPORT_CURRENCY)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text className="text-muted-foreground text-sm">{t('noActivity')}</Text>
            )}
          </>
        ) : (
          <Text className="text-muted-foreground text-sm">{t('noDataAvailable')}</Text>
        )}
      </View>
    </View>
  );
}
