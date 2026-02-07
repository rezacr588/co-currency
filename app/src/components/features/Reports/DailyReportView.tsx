import { useMemo, useState } from 'react';
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

interface DailySummary {
  date: Date;
  dateKey: string;
  income: number;
  expenses: number;
  net: number;
  transactions: Transaction[];
  isToday: boolean;
  isYesterday: boolean;
}

const WINDOW_DAYS = 30;
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

function getRollingWindow(windowIndex: number): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const end = addDays(today, -(windowIndex * WINDOW_DAYS));
  const start = addDays(end, -(WINDOW_DAYS - 1));
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

function groupByDay(
  transactions: Transaction[]
): Map<string, { income: number; expenses: number; transactions: Transaction[] }> {
  const groups = new Map<string, { income: number; expenses: number; transactions: Transaction[] }>();

  transactions.forEach((tx) => {
    const dateKey = formatDateKey(new Date(tx.created_at));
    const current = groups.get(dateKey) || { income: 0, expenses: 0, transactions: [] };

    if (tx.type === 'credit') {
      current.income += tx.amount;
    } else {
      current.expenses += tx.amount;
    }

    current.transactions.push(tx);
    groups.set(dateKey, current);
  });

  return groups;
}

export function DailyReportView({ isTablet = false }: DailyReportViewProps) {
  const { t, language } = useLanguage();
  const [windowIndex, setWindowIndex] = useState(0);

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getRollingWindow(windowIndex),
    [windowIndex]
  );

  const fromDate = formatDateKey(windowStart);
  const toDate = formatDateKey(windowEnd);

  const { data: transactionsData, isPending, isError } = useQuery({
    queryKey: ['transactions', 'daily-history', fromDate, toDate],
    queryFn: () => api.wallet.getTransactions(1000, 0, { from_date: fromDate, to_date: toDate }),
    staleTime: 2 * 60 * 1000,
  });

  const groupedData = useMemo(() => {
    if (!transactionsData?.transactions) return new Map<string, { income: number; expenses: number; transactions: Transaction[] }>();
    return groupByDay(transactionsData.transactions);
  }, [transactionsData]);

  const windowDays = useMemo(() => {
    return Array.from({ length: WINDOW_DAYS }, (_, index) => addDays(windowStart, index));
  }, [windowStart]);

  const todayKey = formatDateKey(new Date());
  const yesterdayKey = formatDateKey(addDays(new Date(), -1));

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
        transactions: dayData?.transactions || [],
        isToday: dateKey === todayKey,
        isYesterday: dateKey === yesterdayKey,
      };
    });
  }, [groupedData, todayKey, windowDays, yesterdayKey]);

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

  const averageDailyNet = totals.net / WINDOW_DAYS;

  const maxDailyValue = useMemo(() => {
    const values = daySummaries.flatMap((day) => [day.income, day.expenses]);
    return safeMax(values) || 1;
  }, [daySummaries]);

  const rangeFormatter = useMemo(
    () => createDateFormatter(language, { month: 'short', day: 'numeric' }),
    [language]
  );
  const weekdayFormatter = useMemo(
    () => createDateFormatter(language, { weekday: 'short' }),
    [language]
  );
  const breakdownDateFormatter = useMemo(
    () => createDateFormatter(language, { weekday: 'short', month: 'short', day: 'numeric' }),
    [language]
  );

  const rangeLabel = `${rangeFormatter.format(windowStart)} - ${rangeFormatter.format(windowEnd)}`;
  const isCurrentWindow = windowIndex === 0;
  const historyRows = useMemo(() => [...daySummaries].reverse(), [daySummaries]);

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

  const currency = transactionsData?.transactions?.[0]?.currency || 'USD';

  return (
    <View>
      <View className="bg-card p-5 rounded-xl mb-6">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            onPress={() => setWindowIndex((index) => index + 1)}
            className="p-3 rounded-xl bg-secondary"
            accessibilityRole="button"
            accessibilityLabel={t('previous30Days')}
          >
            <ChevronLeft size={20} color="#a1a1aa" />
          </Pressable>

          <View className="flex-1 bg-secondary/40 border border-border px-4 py-3 rounded-xl items-center">
            <View className="flex-row items-center">
              <Calendar size={16} color="rgb(212, 175, 55)" />
              <Text className="text-foreground font-semibold ml-2">
                {isCurrentWindow ? t('last30Days') : t('history30Days')}
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm mt-1">{rangeLabel}</Text>
            {isCurrentWindow && (
              <Text className="text-accent text-xs mt-1">{t('currentPeriod')}</Text>
            )}
          </View>

          <Pressable
            onPress={() => !isCurrentWindow && setWindowIndex((index) => index - 1)}
            className={`p-3 rounded-xl ${isCurrentWindow ? 'bg-secondary/30 opacity-50' : 'bg-secondary'}`}
            disabled={isCurrentWindow}
            accessibilityRole="button"
            accessibilityLabel={t('next30Days')}
          >
            <ChevronRight size={20} color="#a1a1aa" />
          </Pressable>
        </View>

        {!isCurrentWindow && (
          <Pressable
            onPress={() => setWindowIndex(0)}
            className="mt-3 py-2.5 px-4 rounded-lg bg-accent/15 border border-accent/30 flex-row items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('goToCurrentPeriod')}
          >
            <RotateCcw size={14} color="rgb(212, 175, 55)" />
            <Text className="text-accent font-medium ml-2">{t('goToCurrentPeriod')}</Text>
          </Pressable>
        )}
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
          <Text className="text-success text-lg font-bold">
            {formatCompactCurrency(totals.income, currency)}
          </Text>
        </View>

        <View className="bg-danger/10 border border-danger/30 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <View className="flex-row items-center mb-1">
            <TrendingDown size={16} color="rgb(220, 38, 38)" />
            <Text className="text-muted-foreground text-xs ml-2">{t('totalExpenses')}</Text>
          </View>
          <Text className="text-danger text-lg font-bold">
            {formatCompactCurrency(totals.expenses, currency)}
          </Text>
        </View>

        <View className="bg-secondary/45 border border-border rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
          <Text className={`text-lg font-bold ${totals.net >= 0 ? 'text-success' : 'text-danger'}`}>
            {totals.net >= 0 ? '+' : ''}
            {formatCompactCurrency(totals.net, currency)}
          </Text>
        </View>

        <View className="bg-accent/10 border border-accent/25 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('avgDaily')}</Text>
          <Text className={`text-lg font-bold ${averageDailyNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {averageDailyNet >= 0 ? '+' : ''}
            {formatCompactCurrency(averageDailyNet, currency)}
          </Text>
        </View>
      </View>

      <View className="bg-card p-5 rounded-xl mb-6">
        <View className="flex-row items-center justify-between mb-4">
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {daySummaries.map((day, index) => {
            const incomeHeight = day.income > 0 ? Math.max((day.income / maxDailyValue) * 96, 4) : 2;
            const expenseHeight = day.expenses > 0 ? Math.max((day.expenses / maxDailyValue) * 96, 4) : 2;
            const showLabel =
              index === 0 ||
              index === daySummaries.length - 1 ||
              day.isToday ||
              index % 5 === 0;

            return (
              <View key={day.dateKey} className="items-center" style={{ width: 22 }}>
                <View style={{ height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <View
                    className={`w-2 rounded-t ${day.income > 0 ? 'bg-success' : 'bg-secondary/50'}`}
                    style={{ height: incomeHeight }}
                  />
                  <View
                    className={`w-2 rounded-t ${day.expenses > 0 ? 'bg-danger' : 'bg-secondary/50'}`}
                    style={{ height: expenseHeight }}
                  />
                </View>
                {showLabel ? (
                  <>
                    <Text className={`text-[10px] mt-1 ${day.isToday ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                      {weekdayFormatter.format(day.date)}
                    </Text>
                    <Text className={`text-[10px] ${day.isToday ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                      {rangeFormatter.format(day.date)}
                    </Text>
                  </>
                ) : (
                  <View style={{ height: 24 }} />
                )}
              </View>
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
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-foreground font-semibold">{t('dailyBreakdown')}</Text>
          <Text className="text-muted-foreground text-xs">{rangeLabel}</Text>
        </View>
        <View className="gap-2">
          {historyRows.map((day) => {
            const dayLabel = day.isToday
              ? t('today')
              : day.isYesterday
                ? t('yesterday')
                : breakdownDateFormatter.format(day.date);

            return (
              <View
                key={day.dateKey}
                className={`rounded-lg border p-3 ${day.isToday ? 'bg-accent/10 border-accent/30' : 'bg-secondary/25 border-border/60'}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text className={`font-medium ${day.isToday ? 'text-accent' : 'text-foreground'}`}>
                      {dayLabel}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {day.transactions.length === 0
                        ? t('noActivity')
                        : `${day.transactions.length} ${t('transactions')}`}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className={`font-semibold ${day.net >= 0 ? 'text-success' : 'text-danger'}`}>
                      {day.net >= 0 ? '+' : ''}
                      {formatCompactCurrency(day.net, currency)}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      +{formatCompactCurrency(day.income, currency)} / -{formatCompactCurrency(day.expenses, currency)}
                    </Text>
                  </View>
                </View>

                {day.transactions.length > 0 && (
                  <View className="mt-2 pt-2 border-t border-border/40">
                    {day.transactions.slice(0, 2).map((tx) => (
                      <View key={tx.id} className="flex-row items-center justify-between py-1">
                        <View className="flex-row items-center flex-1 pr-3">
                          <StyledCategoryIcon
                            category={tx.category || 'other'}
                            size={12}
                            backgroundOpacity={0.1}
                            borderRadius={4}
                            padding={4}
                          />
                          <Text className="text-muted-foreground text-xs ml-2 flex-1" numberOfLines={1}>
                            {tx.description || tx.category || t('transactions')}
                          </Text>
                        </View>
                        <Text className={`text-xs font-medium ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                          {tx.type === 'credit' ? '+' : '-'}
                          {formatCompactCurrency(tx.amount, tx.currency)}
                        </Text>
                      </View>
                    ))}
                    {day.transactions.length > 2 && (
                      <Text className="text-muted-foreground text-xs mt-1">
                        +{day.transactions.length - 2} {t('transactions')}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
