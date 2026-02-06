import { useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency } from '../../../utils/format';
import { getWeekRange, formatDateKey, safeMax } from '../../../utils/dateRange';
import { StyledCategoryIcon } from '../../../constants/icons';
import type { Transaction } from '../../../types/wallet';

interface DailyReportViewProps {
  isTablet?: boolean;
}

// Group transactions by day
function groupByDay(transactions: Transaction[]): Map<string, { income: number; expenses: number; transactions: Transaction[] }> {
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DailyReportView({ isTablet = false }: DailyReportViewProps) {
  const { t } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week range based on offset
  const { start: weekStart, end: weekEnd } = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    return getWeekRange(now);
  }, [weekOffset]);

  const fromDate = formatDateKey(weekStart);
  const toDate = formatDateKey(weekEnd);

  const { data: transactionsData, isPending, isError, error } = useQuery({
    queryKey: ['transactions', 'daily', fromDate, toDate],
    queryFn: () => api.wallet.getTransactions(500, 0, { from_date: fromDate, to_date: toDate }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const dailyData = useMemo(() => {
    if (!transactionsData?.transactions) return null;
    return groupByDay(transactionsData.transactions);
  }, [transactionsData]);

  // Generate array of days in the week
  const weekDays = useMemo(() => {
    const days = [];
    const current = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [weekStart]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!dailyData) return { income: 0, expenses: 0, net: 0 };
    let income = 0, expenses = 0;
    dailyData.forEach((day) => {
      income += day.income;
      expenses += day.expenses;
    });
    return { income, expenses, net: income - expenses };
  }, [dailyData]);

  // Find max for chart scaling
  const maxDailyValue = useMemo(() => {
    if (!dailyData) return 1;
    const values: number[] = [];
    dailyData.forEach((day) => {
      values.push(day.income, day.expenses);
    });
    return safeMax(values) || 1;
  }, [dailyData]);

  // Format week label
  const weekLabel = useMemo(() => {
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();

    if (weekOffset === 0) return t('thisWeek');

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }, [weekStart, weekEnd, weekOffset, t]);

  // Get today's date key
  const todayKey = formatDateKey(new Date());
  const yesterdayKey = formatDateKey(new Date(Date.now() - 86400000));

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

  // Get currency from first transaction or default
  const currency = transactionsData?.transactions?.[0]?.currency || 'USD';

  return (
    <View>
      {/* Week Navigation */}
      <View className="flex-row items-center justify-center mb-6 gap-4">
        <Pressable
          onPress={() => setWeekOffset((o) => o - 1)}
          className="p-3 rounded-xl bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>
        <View className="bg-card px-6 py-3 rounded-xl flex-row items-center">
          <Calendar size={18} color="rgb(212, 175, 55)" />
          <Text className="text-foreground text-lg font-bold ml-2">{weekLabel}</Text>
        </View>
        <Pressable
          onPress={() => weekOffset < 0 && setWeekOffset((o) => o + 1)}
          className={`p-3 rounded-xl ${weekOffset >= 0 ? 'bg-secondary/30 opacity-50' : 'bg-secondary'}`}
          disabled={weekOffset >= 0}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <ChevronRight size={20} color="#a1a1aa" />
        </Pressable>
      </View>

      {/* Weekly Summary Card */}
      <View className="bg-card p-6 rounded-xl mb-6">
        <View style={{
          flexDirection: isTablet ? 'row' : 'column',
          gap: 12,
        }}>
          <View className="flex-1 bg-success/10 border border-success/30 p-4 rounded-xl">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={16} color="rgb(16, 185, 129)" />
              <Text className="text-muted-foreground text-sm ml-2">{t('totalIncome')}</Text>
            </View>
            <Text className="text-success text-2xl font-bold">
              {formatCompactCurrency(totals.income, currency)}
            </Text>
          </View>

          <View className="flex-1 bg-danger/10 border border-danger/30 p-4 rounded-xl">
            <View className="flex-row items-center mb-2">
              <TrendingDown size={16} color="rgb(220, 38, 38)" />
              <Text className="text-muted-foreground text-sm ml-2">{t('totalExpenses')}</Text>
            </View>
            <Text className="text-danger text-2xl font-bold">
              {formatCompactCurrency(totals.expenses, currency)}
            </Text>
          </View>
        </View>

        <View className="mt-4 bg-secondary/50 p-4 rounded-lg">
          <Text className="text-muted-foreground text-sm mb-1">{t('net')}</Text>
          <Text
            className={`text-2xl font-bold ${totals.net >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {totals.net >= 0 ? '+' : ''}{formatCompactCurrency(totals.net, currency)}
          </Text>
        </View>
      </View>

      {/* Daily Bar Chart */}
      <View className="bg-card p-6 rounded-xl mb-6">
        <View className="flex-row items-center mb-4">
          <View className="bg-secondary p-2 rounded-lg mr-3">
            <Calendar size={20} color="rgb(148, 163, 184)" />
          </View>
          <Text className="text-foreground font-semibold">{t('incomeVsExpenses')}</Text>
        </View>

        <View className="flex-row items-end justify-between gap-2" style={{ height: 140 }}>
          {weekDays.map((date, index) => {
            const dateKey = formatDateKey(date);
            const dayData = dailyData?.get(dateKey);
            const incomeHeight = dayData ? (dayData.income / maxDailyValue) * 100 : 0;
            const expenseHeight = dayData ? (dayData.expenses / maxDailyValue) * 100 : 0;
            const isToday = dateKey === todayKey;

            return (
              <View key={dateKey} className="flex-1 items-center">
                <View className="flex-row gap-1 items-end" style={{ height: 100 }}>
                  <View
                    className="w-2 rounded-t bg-success"
                    style={{ height: Math.max(incomeHeight, 2) }}
                  />
                  <View
                    className="w-2 rounded-t bg-danger"
                    style={{ height: Math.max(expenseHeight, 2) }}
                  />
                </View>
                <Text
                  className={`text-xs mt-1 ${isToday ? 'text-accent font-bold' : 'text-muted-foreground'}`}
                >
                  {DAY_NAMES[index]}
                </Text>
                <Text
                  className={`text-[10px] ${isToday ? 'text-accent' : 'text-muted-foreground'}`}
                >
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
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

      {/* Daily Breakdown List */}
      <View className="bg-card p-6 rounded-xl">
        <Text className="text-foreground font-semibold mb-4">{t('dailyReport')}</Text>
        <View className="gap-3">
          {weekDays.map((date) => {
            const dateKey = formatDateKey(date);
            const dayData = dailyData?.get(dateKey);
            const net = (dayData?.income || 0) - (dayData?.expenses || 0);
            const isToday = dateKey === todayKey;
            const isYesterday = dateKey === yesterdayKey;

            let dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (isToday) dayLabel = t('today');
            if (isYesterday) dayLabel = t('yesterday');

            return (
              <View
                key={dateKey}
                className={`p-3 rounded-lg ${isToday ? 'bg-accent/10 border border-accent/30' : 'bg-secondary/30'}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`font-medium ${isToday ? 'text-accent' : 'text-foreground'}`}>
                    {dayLabel}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    {dayData ? (
                      <>
                        <Text className="text-success text-sm">
                          +{formatCompactCurrency(dayData.income, currency)}
                        </Text>
                        <Text className="text-danger text-sm">
                          -{formatCompactCurrency(dayData.expenses, currency)}
                        </Text>
                        <Text
                          className={`font-semibold ${net >= 0 ? 'text-success' : 'text-danger'}`}
                        >
                          {net >= 0 ? '+' : ''}{formatCompactCurrency(net, currency)}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-muted-foreground text-sm">-</Text>
                    )}
                  </View>
                </View>

                {/* Show transactions for this day */}
                {dayData && dayData.transactions && dayData.transactions.length > 0 && (
                  <View className="mt-2 pt-2 border-t border-border/30">
                    {dayData.transactions.slice(0, 3).map((tx) => (
                      <View key={tx.id} className="flex-row items-center justify-between py-1">
                        <View className="flex-row items-center flex-1">
                          <StyledCategoryIcon
                            category={tx.category || 'other'}
                            size={12}
                            backgroundOpacity={0.1}
                            borderRadius={4}
                            padding={4}
                          />
                          <Text className="text-muted-foreground text-xs ml-2 flex-1" numberOfLines={1}>
                            {tx.description || tx.category || 'Transaction'}
                          </Text>
                        </View>
                        <Text
                          className={`text-xs font-medium ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}
                        >
                          {tx.type === 'credit' ? '+' : '-'}{formatCompactCurrency(tx.amount, tx.currency)}
                        </Text>
                      </View>
                    ))}
                    {dayData.transactions.length > 3 && (
                      <Text className="text-muted-foreground text-xs mt-1">
                        +{dayData.transactions.length - 3} more
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
