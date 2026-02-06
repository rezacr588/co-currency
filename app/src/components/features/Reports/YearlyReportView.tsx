import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../../utils/format';
import { safeMax, getMonthName } from '../../../utils/dateRange';
import type { YearlyReport } from '../../../types/goal';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface YearlyReportViewProps {
  isTablet?: boolean;
}

export function YearlyReportView({ isTablet = false }: YearlyReportViewProps) {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: yearlyReport, isPending, isError } = useQuery({
    queryKey: ['reports', 'yearly', selectedYear],
    queryFn: () => api.reports.yearly(selectedYear),
    staleTime: 5 * 60 * 1000,
  });

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

  const maxMonthlyValue = yearlyReport?.months && yearlyReport.months.length > 0
    ? safeMax(yearlyReport.months.flatMap((m) => [m.income, m.expenses]))
    : 1;

  return (
    <View>
      {/* Year Navigation */}
      <View className="flex-row items-center justify-center mb-6 gap-4">
        <Pressable
          onPress={() => setSelectedYear((y) => y - 1)}
          className="p-3 rounded-xl bg-secondary"
          accessibilityRole="button"
          accessibilityLabel="Previous year"
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>
        <View className="bg-card px-6 py-3 rounded-xl flex-row items-center">
          <Calendar size={18} color="rgb(212, 175, 55)" />
          <Text className="text-foreground text-xl font-bold ml-2">{selectedYear}</Text>
        </View>
        <Pressable
          onPress={() => selectedYear < currentYear && setSelectedYear((y) => y + 1)}
          className={`p-3 rounded-xl ${selectedYear >= currentYear ? 'bg-secondary/30 opacity-50' : 'bg-secondary'}`}
          disabled={selectedYear >= currentYear}
          accessibilityRole="button"
          accessibilityLabel="Next year"
        >
          <ChevronRight size={20} color="#a1a1aa" />
        </Pressable>
      </View>

      {yearlyReport ? (
        <>
          {/* Annual Summary Card */}
          <View className="bg-card p-6 rounded-xl mb-6">
            <View className="flex-row items-center mb-4">
              <View className="bg-accent/20 p-2 rounded-lg mr-3">
                <Calendar size={20} color="rgb(212, 175, 55)" />
              </View>
              <Text className="text-foreground font-semibold">{t('annualSummary')}</Text>
            </View>

            <View style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: 12,
            }}>
              {/* Total Income */}
              <View className="flex-1 bg-success/10 border border-success/30 p-4 rounded-xl">
                <View className="flex-row items-center mb-2">
                  <TrendingUp size={16} color="rgb(16, 185, 129)" />
                  <Text className="text-muted-foreground text-sm ml-2">{t('totalIncome')}</Text>
                </View>
                <Text className="text-success text-2xl font-bold">
                  {formatCompactCurrency(yearlyReport.income, yearlyReport.currency)}
                </Text>
              </View>

              {/* Total Expenses */}
              <View className="flex-1 bg-danger/10 border border-danger/30 p-4 rounded-xl">
                <View className="flex-row items-center mb-2">
                  <TrendingDown size={16} color="rgb(220, 38, 38)" />
                  <Text className="text-muted-foreground text-sm ml-2">{t('totalExpenses')}</Text>
                </View>
                <Text className="text-danger text-2xl font-bold">
                  {formatCompactCurrency(yearlyReport.expenses, yearlyReport.currency)}
                </Text>
              </View>
            </View>

            {/* Net and Savings Rate */}
            <View className="flex-row gap-4 mt-4">
              <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
                <Text
                  className={`text-lg font-bold ${
                    yearlyReport.net >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {`${yearlyReport.net >= 0 ? '+' : '-'}${formatCompactCurrency(Math.abs(yearlyReport.net), yearlyReport.currency)}`}
                </Text>
              </View>
              <View className="flex-1 bg-secondary/50 p-3 rounded-lg">
                <Text className="text-muted-foreground text-xs mb-1">{t('savingsRate')}</Text>
                <Text
                  className={`text-lg font-bold ${
                    yearlyReport.savings_rate >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatNumber(yearlyReport.savings_rate, 1)}%
                </Text>
              </View>
            </View>
          </View>

          {/* 12-Month Bar Chart */}
          {yearlyReport.months && yearlyReport.months.length > 0 && (
            <View className="bg-card p-6 rounded-xl mb-6">
              <View className="flex-row items-center mb-4">
                <View className="bg-secondary p-2 rounded-lg mr-3">
                  <Calendar size={20} color="rgb(148, 163, 184)" />
                </View>
                <Text className="text-foreground font-semibold">{t('incomeVsExpenses')}</Text>
              </View>

              <View className="flex-row items-end justify-between gap-1" style={{ height: 140 }}>
                {MONTH_NAMES.map((monthName, index) => {
                  const monthData = yearlyReport.months.find((m) => m.month === index + 1);
                  const incomeHeight = maxMonthlyValue > 0 && monthData
                    ? (monthData.income / maxMonthlyValue) * 100
                    : 0;
                  const expenseHeight = maxMonthlyValue > 0 && monthData
                    ? (monthData.expenses / maxMonthlyValue) * 100
                    : 0;

                  return (
                    <View key={monthName} className="flex-1 items-center">
                      <View className="flex-row gap-0.5 items-end" style={{ height: 100 }}>
                        <View
                          className="w-1.5 rounded-t bg-success"
                          style={{ height: Math.max(incomeHeight, 2) }}
                        />
                        <View
                          className="w-1.5 rounded-t bg-danger"
                          style={{ height: Math.max(expenseHeight, 2) }}
                        />
                      </View>
                      <Text className="text-muted-foreground text-[10px] mt-1">
                        {monthName}
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
          )}

          {/* Monthly Breakdown List */}
          {yearlyReport.months && yearlyReport.months.length > 0 && (
            <View className="bg-card p-6 rounded-xl">
              <Text className="text-foreground font-semibold mb-4">{t('monthlySummary')}</Text>
              <View className="gap-3">
                {yearlyReport.months.map((month) => (
                  <View
                    key={month.month}
                    className="flex-row items-center justify-between bg-secondary/30 p-3 rounded-lg"
                  >
                    <Text className="text-foreground font-medium">
                      {MONTH_NAMES[month.month - 1]}
                    </Text>
                    <View className="flex-row items-center gap-4">
                      <Text className="text-success text-sm">
                        +{formatCompactCurrency(month.income, month.currency)}
                      </Text>
                      <Text className="text-danger text-sm">
                        -{formatCompactCurrency(month.expenses, month.currency)}
                      </Text>
                      <Text
                        className={`font-semibold ${
                          month.net >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {month.net >= 0 ? '+' : ''}{formatCompactCurrency(month.net, month.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      ) : (
        <View className="bg-card p-8 rounded-xl items-center">
          <Calendar size={48} color="rgb(71, 71, 71)" />
          <Text className="text-foreground font-semibold mt-4 text-lg">{t('noDataAvailable')}</Text>
          <Text className="text-muted-foreground mt-2 text-center">
            {t('addTransaction')}
          </Text>
        </View>
      )}
    </View>
  );
}
