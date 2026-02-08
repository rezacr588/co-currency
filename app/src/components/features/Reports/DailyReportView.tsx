import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingDown, TrendingUp, PieChart } from 'lucide-react-native';
import { api } from '../../../api';
import { StyledCategoryIcon } from '../../../constants/icons';
import { useLanguage } from '../../../context/LanguageContext';
import { formatCompactCurrency } from '../../../utils/format';
import { DailyReportHeader } from './daily/DailyReportHeader';
import { DailySelectedRangeCard } from './daily/DailySelectedRangeCard';
import { DailyTimelineChart } from './daily/DailyTimelineChart';
import { useDailyReportData } from './daily/useDailyReportData';
import type { ChartBucket } from './daily/types';

interface DailyReportViewProps {
  isTablet?: boolean;
}

function formatBucketRange(bucket: ChartBucket, formatter: Intl.DateTimeFormat): string {
  if (bucket.startDate.getTime() === bucket.endDate.getTime()) {
    return formatter.format(bucket.startDate);
  }

  return `${formatter.format(bucket.startDate)} - ${formatter.format(bucket.endDate)}`;
}

export function DailyReportView({ isTablet = false }: DailyReportViewProps) {
  const { t, language } = useLanguage();

  // Derive primary currency from wallet balances (highest balance)
  const { data: balancesData } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
    staleTime: 5 * 60 * 1000,
  });

  const primaryCurrency = useMemo(() => {
    const balances = balancesData?.balances;
    if (!balances || balances.length === 0) return 'USD';
    const sorted = [...balances].sort((a, b) => b.balance - a.balance);
    return sorted[0].currency;
  }, [balancesData]);

  const report = useDailyReportData(language, primaryCurrency);

  const timelineLabel = t(report.timelineTranslationKey);

  const chartRangeFormatter = useMemo(
    () => report.rangeWithYearFormatter,
    [report.rangeWithYearFormatter]
  );

  if (report.isPending) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  if (report.isError) {
    return (
      <View className="bg-card p-6 rounded-xl items-center">
        <AlertCircle size={48} color="rgb(220, 38, 38)" />
        <Text className="text-foreground font-semibold mt-4 text-lg">{t('failedToLoadReport')}</Text>
        <Text className="text-muted-foreground mt-2 text-center">{t('checkConnection')}</Text>
      </View>
    );
  }

  return (
    <View>
      <DailyReportHeader
        t={t}
        timelinePreset={report.timelinePreset}
        onTimelinePresetChange={report.setTimelinePreset}
        timelineLabel={timelineLabel}
        rangeLabel={report.rangeLabel}
        reportCurrency={report.reportCurrency}
        isCurrentWindow={report.isCurrentWindow}
        onPreviousWindow={report.goPreviousWindow}
        onNextWindow={report.goNextWindow}
        onCurrentWindow={report.goCurrentWindow}
        excludedTransactionCount={report.excludedTransactionCount}
        excludedCurrencies={report.excludedCurrencies}
        truncated={report.truncated}
      />

      <View className="mb-6" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View className="bg-success/10 border border-success/30 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <View className="flex-row items-center mb-1">
            <TrendingUp size={16} color="rgb(16, 185, 129)" />
            <Text className="text-muted-foreground text-xs ml-2">{t('totalIncome')}</Text>
          </View>
          <Text className="text-success text-lg font-bold">
            {formatCompactCurrency(report.totals.income, report.reportCurrency)}
          </Text>
        </View>

        <View className="bg-danger/10 border border-danger/30 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <View className="flex-row items-center mb-1">
            <TrendingDown size={16} color="rgb(220, 38, 38)" />
            <Text className="text-muted-foreground text-xs ml-2">{t('totalExpenses')}</Text>
          </View>
          <Text className="text-danger text-lg font-bold">
            {formatCompactCurrency(report.totals.expenses, report.reportCurrency)}
          </Text>
        </View>

        <View className="bg-secondary/45 border border-border rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('net')}</Text>
          <Text className={`text-lg font-bold ${report.totals.net >= 0 ? 'text-success' : 'text-danger'}`}>
            {report.totals.net >= 0 ? '+' : ''}
            {formatCompactCurrency(report.totals.net, report.reportCurrency)}
          </Text>
        </View>

        <View className="bg-accent/10 border border-accent/25 rounded-xl p-4" style={{ width: isTablet ? '48.5%' : '48%' }}>
          <Text className="text-muted-foreground text-xs mb-1">{t('avgDaily')}</Text>
          <Text className={`text-lg font-bold ${report.averageDailyNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {report.averageDailyNet >= 0 ? '+' : ''}
            {formatCompactCurrency(report.averageDailyNet, report.reportCurrency)}
          </Text>
        </View>
      </View>

      {/* Period Comparison & Top Categories */}
      {(report.comparedToLast !== 0 || report.topCategories.length > 0) && (
        <View className="bg-card border border-border p-5 rounded-xl mb-6">
          {report.comparedToLast !== 0 && (
            <View className="flex-row items-center mb-3">
              {report.comparedToLast <= 0 ? (
                <TrendingDown size={16} color="#22c55e" />
              ) : (
                <TrendingUp size={16} color="#ef4444" />
              )}
              <Text
                className={`text-sm font-semibold ml-2 ${
                  report.comparedToLast <= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {`${report.comparedToLast < 0 ? '' : '+'}${Math.round(report.comparedToLast)}% ${t('vsPreviousPeriod') || 'vs previous period'}`}
              </Text>
            </View>
          )}

          {report.topCategories.length > 0 && (
            <View>
              <View className="flex-row items-center mb-3">
                <PieChart size={14} color="#a1a1aa" />
                <Text className="text-muted-foreground text-xs font-medium ml-2">
                  {t('topCategories') || 'Top Categories'}
                </Text>
              </View>
              {report.topCategories.map((cat) => (
                <View key={cat.category} className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <StyledCategoryIcon
                      category={cat.category}
                      size={12}
                      backgroundOpacity={0.1}
                      borderRadius={4}
                      padding={4}
                    />
                    <Text className="text-foreground text-sm ml-2 capitalize">{cat.category}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-foreground text-sm font-semibold mr-2">
                      {formatCompactCurrency(cat.amount, report.reportCurrency)}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {Math.round(cat.percentage)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <DailyTimelineChart
        t={t}
        chartBuckets={report.chartBuckets}
        selectedBucketIndex={report.selectedBucketIndex}
        onSelectBucket={report.setSelectedBucketIndex}
        maxBucketValue={report.maxBucketValue}
        timelinePreset={report.timelinePreset}
        rangeLabel={report.rangeLabel}
        formatBucketRange={(bucket) => formatBucketRange(bucket, chartRangeFormatter)}
      />

      <DailySelectedRangeCard
        t={t}
        selectedBucket={report.selectedBucket}
        selectedBucketRange={report.selectedBucketRange}
        selectedTransactions={report.selectedTransactions}
        reportCurrency={report.reportCurrency}
      />
    </View>
  );
}
