import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react-native';
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
  const report = useDailyReportData(language);

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
