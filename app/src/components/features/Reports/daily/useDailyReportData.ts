import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../api';
import type { Transaction } from '../../../../types/wallet';
import {
  buildChartBuckets,
  buildDailyAggregation,
  formatBucketRange,
  getDefaultSelectedBucketIndex,
  getMaxBucketValue,
  getSelectedTransactions,
  sumTotals,
} from './aggregation';
import {
  FETCH_CAP,
  PAGE_SIZE,
  REPORT_CURRENCY,
  TIMELINE_CONFIG,
} from './constants';
import {
  createDateFormatter,
  getWindowRange,
  toRFC3339RangeEnd,
  toRFC3339RangeStart,
} from './time';
import type {
  ChartBucket,
  NormalizedTransaction,
  ReportFetchResult,
  TimelinePreset,
} from './types';

export interface CategoryTotal {
  category: string;
  amount: number;
  percentage: number;
}

export interface UseDailyReportDataResult {
  timelinePreset: TimelinePreset;
  setTimelinePreset: (preset: TimelinePreset) => void;
  timelineTranslationKey: string;
  windowIndex: number;
  goPreviousWindow: () => void;
  goNextWindow: () => void;
  goCurrentWindow: () => void;
  isCurrentWindow: boolean;
  rangeLabel: string;
  selectedBucketRange: string;
  chartBuckets: ChartBucket[];
  selectedBucketIndex: number;
  setSelectedBucketIndex: (index: number) => void;
  selectedBucket: ChartBucket | null;
  selectedTransactions: NormalizedTransaction[];
  totals: { income: number; expenses: number; net: number };
  averageDailyNet: number;
  comparedToLast: number; // percentage change in expenses vs previous window
  topCategories: CategoryTotal[];
  maxBucketValue: number;
  reportCurrency: string;
  excludedTransactionCount: number;
  excludedCurrencies: string[];
  truncated: boolean;
  rangeWithYearFormatter: Intl.DateTimeFormat;
  isPending: boolean;
  isError: boolean;
}

async function fetchTransactionsForRange(fromTimestamp: string, toTimestamp: string, targetCurrency: string): Promise<ReportFetchResult> {
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const allTransactions: Transaction[] = [];

  while (allTransactions.length < total && allTransactions.length < FETCH_CAP) {
    const page = await api.wallet.getTransactions(PAGE_SIZE, offset, {
      from_ts: fromTimestamp,
      to_ts: toTimestamp,
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
    [targetCurrency]: 1,
  };

  const distinctCurrencies = Array.from(
    new Set(
      allTransactions
        .map((tx) => tx.currency)
        .filter(
          (currency): currency is string =>
            Boolean(currency) && currency !== targetCurrency
        )
    )
  );

  const missingCurrencySet = new Set<string>();

  await Promise.all(
    distinctCurrencies.map(async (currency) => {
      try {
        const conversion = await api.convert({
          from: currency,
          to: targetCurrency,
          amount: 1,
        });

        if (Number.isFinite(conversion.rate) && conversion.rate > 0) {
          conversionRates[currency] = conversion.rate;
          return;
        }
      } catch {
        // Ignore conversion errors and track missing rates.
      }

      missingCurrencySet.add(currency);
    })
  );

  return {
    transactions: allTransactions,
    conversionRates,
    missingCurrencies: Array.from(missingCurrencySet).sort((a, b) => a.localeCompare(b)),
    truncated,
  };
}

export function useDailyReportData(language: string, reportCurrency = REPORT_CURRENCY): UseDailyReportDataResult {
  const [timelinePreset, setTimelinePresetState] = useState<TimelinePreset>('30D');
  const [windowIndex, setWindowIndex] = useState(0);
  const [selectedBucketIndex, setSelectedBucketIndexState] = useState(0);

  const timelineConfig = TIMELINE_CONFIG[timelinePreset];

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getWindowRange(timelineConfig.windowDays, windowIndex),
    [timelineConfig.windowDays, windowIndex]
  );

  const fromTimestamp = toRFC3339RangeStart(windowStart);
  const toTimestamp = toRFC3339RangeEnd(windowEnd);

  const { data: reportData, isPending, isError } = useQuery({
    queryKey: ['transactions', 'daily-history', timelinePreset, fromTimestamp, toTimestamp, reportCurrency],
    queryFn: () => fetchTransactionsForRange(fromTimestamp, toTimestamp, reportCurrency),
    staleTime: 2 * 60 * 1000,
  });

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

  const aggregation = useMemo(
    () =>
      buildDailyAggregation(
        windowStart,
        timelineConfig.windowDays,
        reportData?.transactions || [],
        reportData?.conversionRates || { [reportCurrency]: 1 },
        reportCurrency
      ),
    [reportData?.conversionRates, reportData?.transactions, timelineConfig.windowDays, windowStart]
  );

  const chartBuckets = useMemo(
    () =>
      buildChartBuckets(
        aggregation.daySummaries,
        timelineConfig.bucketGranularity,
        rangeFormatter,
        monthFormatter
      ),
    [aggregation.daySummaries, timelineConfig.bucketGranularity, rangeFormatter, monthFormatter]
  );

  useEffect(() => {
    setSelectedBucketIndexState(getDefaultSelectedBucketIndex(chartBuckets));
  }, [chartBuckets]);

  const selectedBucket =
    chartBuckets[selectedBucketIndex] || chartBuckets[chartBuckets.length - 1] || null;

  const selectedTransactions = useMemo(
    () => getSelectedTransactions(selectedBucket),
    [selectedBucket]
  );

  const totals = useMemo(() => sumTotals(aggregation.daySummaries), [aggregation.daySummaries]);

  const averageDailyNet =
    aggregation.daySummaries.length > 0
      ? totals.net / aggregation.daySummaries.length
      : 0;

  // Previous window for comparison
  const { start: prevWindowStart, end: prevWindowEnd } = useMemo(
    () => getWindowRange(timelineConfig.windowDays, windowIndex + 1),
    [timelineConfig.windowDays, windowIndex]
  );

  const prevFromTimestamp = toRFC3339RangeStart(prevWindowStart);
  const prevToTimestamp = toRFC3339RangeEnd(prevWindowEnd);

  const { data: prevReportData } = useQuery({
    queryKey: ['transactions', 'daily-history', timelinePreset, prevFromTimestamp, prevToTimestamp, reportCurrency],
    queryFn: () => fetchTransactionsForRange(prevFromTimestamp, prevToTimestamp, reportCurrency),
    staleTime: 5 * 60 * 1000,
  });

  const prevAggregation = useMemo(
    () =>
      buildDailyAggregation(
        prevWindowStart,
        timelineConfig.windowDays,
        prevReportData?.transactions || [],
        prevReportData?.conversionRates || { [reportCurrency]: 1 },
        reportCurrency
      ),
    [prevReportData?.conversionRates, prevReportData?.transactions, timelineConfig.windowDays, prevWindowStart, reportCurrency]
  );

  const prevTotals = useMemo(() => sumTotals(prevAggregation.daySummaries), [prevAggregation.daySummaries]);

  const comparedToLast = useMemo(() => {
    if (prevTotals.expenses <= 0) return 0;
    return ((totals.expenses - prevTotals.expenses) / prevTotals.expenses) * 100;
  }, [totals.expenses, prevTotals.expenses]);

  // Top spending categories
  const topCategories = useMemo((): CategoryTotal[] => {
    const categoryMap = new Map<string, number>();
    for (const day of aggregation.daySummaries) {
      for (const item of day.transactions) {
        const tx = item.transaction;
        if (tx.type === 'debit' && item.amountInReportCurrency !== null) {
          const cat = tx.category || 'other';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.amountInReportCurrency);
        }
      }
    }
    const totalExpenses = totals.expenses || 1;
    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalExpenses) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [aggregation.daySummaries, totals.expenses]);

  const maxBucketValue = useMemo(
    () => getMaxBucketValue(chartBuckets),
    [chartBuckets]
  );

  const rangeLabel = `${rangeWithYearFormatter.format(windowStart)} - ${rangeWithYearFormatter.format(windowEnd)}`;
  const selectedBucketRange = formatBucketRange(selectedBucket, rangeWithYearFormatter);

  return {
    timelinePreset,
    setTimelinePreset: (preset: TimelinePreset) => {
      setTimelinePresetState(preset);
      setWindowIndex(0);
    },
    timelineTranslationKey: timelineConfig.translationKey,
    windowIndex,
    goPreviousWindow: () => setWindowIndex((current) => current + 1),
    goNextWindow: () => setWindowIndex((current) => (current > 0 ? current - 1 : 0)),
    goCurrentWindow: () => setWindowIndex(0),
    isCurrentWindow: windowIndex === 0,
    rangeLabel,
    selectedBucketRange,
    chartBuckets,
    selectedBucketIndex,
    setSelectedBucketIndex: (index: number) => setSelectedBucketIndexState(index),
    selectedBucket,
    selectedTransactions,
    totals,
    averageDailyNet,
    comparedToLast,
    topCategories,
    maxBucketValue,
    reportCurrency,
    excludedTransactionCount: aggregation.excludedTransactionCount,
    excludedCurrencies: aggregation.excludedCurrencies,
    truncated: reportData?.truncated || false,
    rangeWithYearFormatter,
    isPending,
    isError,
  };
}
