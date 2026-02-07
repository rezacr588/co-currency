import { formatDateKey, safeMax } from '../../../../utils/dateRange';
import { addDays, isDateInRange, startOfDay } from './time';
import type {
  BucketGranularity,
  ChartBucket,
  DailyAggregationResult,
  DaySummary,
  NormalizedTransaction,
} from './types';
import type { Transaction } from '../../../../types/wallet';

function getAmountInReportCurrency(
  tx: Transaction,
  conversionRates: Record<string, number>,
  reportCurrency: string
): number | null {
  if (tx.currency === reportCurrency) {
    return tx.amount;
  }

  const rate = conversionRates[tx.currency];
  if (Number.isFinite(rate) && rate > 0) {
    return tx.amount * rate;
  }

  return null;
}

export function buildDailyAggregation(
  windowStart: Date,
  windowDays: number,
  transactions: Transaction[],
  conversionRates: Record<string, number>,
  reportCurrency: string
): DailyAggregationResult {
  const grouped = new Map<
    string,
    { income: number; expenses: number; txCount: number; excludedCount: number; transactions: NormalizedTransaction[] }
  >();

  let excludedTransactionCount = 0;
  const excludedCurrencySet = new Set<string>();

  transactions.forEach((tx) => {
    const dateKey = formatDateKey(new Date(tx.created_at));
    const group = grouped.get(dateKey) || {
      income: 0,
      expenses: 0,
      txCount: 0,
      excludedCount: 0,
      transactions: [],
    };

    const normalizedAmount = getAmountInReportCurrency(tx, conversionRates, reportCurrency);
    if (normalizedAmount !== null) {
      if (tx.type === 'credit') {
        group.income += normalizedAmount;
      } else if (tx.type === 'debit') {
        group.expenses += normalizedAmount;
      }
    } else if (tx.currency && tx.currency !== reportCurrency) {
      excludedTransactionCount += 1;
      group.excludedCount += 1;
      excludedCurrencySet.add(tx.currency);
    }

    group.txCount += 1;
    group.transactions.push({
      transaction: tx,
      amountInReportCurrency: normalizedAmount,
    });

    grouped.set(dateKey, group);
  });

  const todayKey = formatDateKey(startOfDay(new Date()));

  const daySummaries: DaySummary[] = Array.from({ length: windowDays }, (_, index) => {
    const date = addDays(windowStart, index);
    const dateKey = formatDateKey(date);
    const dayData = grouped.get(dateKey);
    const income = dayData?.income || 0;
    const expenses = dayData?.expenses || 0;

    return {
      date,
      dateKey,
      income,
      expenses,
      net: income - expenses,
      txCount: dayData?.txCount || 0,
      excludedCount: dayData?.excludedCount || 0,
      transactions: dayData?.transactions || [],
      isToday: dateKey === todayKey,
    };
  });

  return {
    daySummaries,
    excludedTransactionCount,
    excludedCurrencies: Array.from(excludedCurrencySet).sort((a, b) => a.localeCompare(b)),
  };
}

export function buildChartBuckets(
  daySummaries: DaySummary[],
  granularity: BucketGranularity,
  rangeFormatter: Intl.DateTimeFormat,
  monthFormatter: Intl.DateTimeFormat
): ChartBucket[] {
  const today = startOfDay(new Date());

  if (granularity === 'day') {
    return daySummaries.map((day) => ({
      key: day.dateKey,
      label: rangeFormatter.format(day.date),
      startDate: day.date,
      endDate: day.date,
      income: day.income,
      expenses: day.expenses,
      net: day.net,
      txCount: day.txCount,
      excludedCount: day.excludedCount,
      transactions: day.transactions,
      isCurrentBucket: day.isToday,
    }));
  }

  if (granularity === 'week') {
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
      const excludedCount = slice.reduce((sum, day) => sum + day.excludedCount, 0);
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
        excludedCount,
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
      endCursor += 1;
    }

    const slice = daySummaries.slice(cursor, endCursor + 1);
    const startDate = slice[0].date;
    const endDate = slice[slice.length - 1].date;
    const income = slice.reduce((sum, day) => sum + day.income, 0);
    const expenses = slice.reduce((sum, day) => sum + day.expenses, 0);
    const txCount = slice.reduce((sum, day) => sum + day.txCount, 0);
    const excludedCount = slice.reduce((sum, day) => sum + day.excludedCount, 0);
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
      excludedCount,
      transactions,
      isCurrentBucket: isDateInRange(today, startDate, endDate),
    });

    cursor = endCursor + 1;
  }

  return buckets;
}

export function sumTotals(daySummaries: DaySummary[]): { income: number; expenses: number; net: number } {
  return daySummaries.reduce(
    (acc, day) => {
      acc.income += day.income;
      acc.expenses += day.expenses;
      acc.net += day.net;
      return acc;
    },
    { income: 0, expenses: 0, net: 0 }
  );
}

export function getDefaultSelectedBucketIndex(chartBuckets: ChartBucket[]): number {
  if (chartBuckets.length === 0) {
    return 0;
  }

  const reverseIndex = [...chartBuckets].reverse().findIndex((bucket) => bucket.txCount > 0);
  if (reverseIndex >= 0) {
    return chartBuckets.length - 1 - reverseIndex;
  }

  return chartBuckets.length - 1;
}

export function getSelectedTransactions(
  bucket: ChartBucket | null,
  limit = 4
): NormalizedTransaction[] {
  if (!bucket) {
    return [];
  }

  return [...bucket.transactions]
    .sort(
      (a, b) =>
        new Date(b.transaction.created_at).getTime() -
        new Date(a.transaction.created_at).getTime()
    )
    .slice(0, limit);
}

export function getMaxBucketValue(chartBuckets: ChartBucket[]): number {
  const values = chartBuckets.flatMap((bucket) => [bucket.income, bucket.expenses]);
  return safeMax(values) || 1;
}

export function formatBucketRange(bucket: ChartBucket | null, formatter: Intl.DateTimeFormat): string {
  if (!bucket) {
    return '';
  }

  if (bucket.startDate.getTime() === bucket.endDate.getTime()) {
    return formatter.format(bucket.startDate);
  }

  return `${formatter.format(bucket.startDate)} - ${formatter.format(bucket.endDate)}`;
}
