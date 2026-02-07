import type { Transaction } from '../../../../types/wallet';

export type TimelinePreset = '7D' | '30D' | '3M' | '6M' | '1Y';

export type BucketGranularity = 'day' | 'week' | 'month';

export interface TimelineConfig {
  windowDays: number;
  bucketGranularity: BucketGranularity;
  translationKey: string;
}

export interface NormalizedTransaction {
  transaction: Transaction;
  amountInReportCurrency: number | null;
}

export interface DaySummary {
  date: Date;
  dateKey: string;
  income: number;
  expenses: number;
  net: number;
  txCount: number;
  excludedCount: number;
  transactions: NormalizedTransaction[];
  isToday: boolean;
}

export interface ChartBucket {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
  income: number;
  expenses: number;
  net: number;
  txCount: number;
  excludedCount: number;
  transactions: NormalizedTransaction[];
  isCurrentBucket: boolean;
}

export interface ReportFetchResult {
  transactions: Transaction[];
  conversionRates: Record<string, number>;
  missingCurrencies: string[];
  truncated: boolean;
}

export interface DailyAggregationResult {
  daySummaries: DaySummary[];
  excludedTransactionCount: number;
  excludedCurrencies: string[];
}
