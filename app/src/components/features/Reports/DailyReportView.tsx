import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingDown, TrendingUp, PieChart } from 'lucide-react-native';
import { api } from '../../../api';
import { StyledCategoryIcon } from '../../../constants/icons';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../utils/format';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
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
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  // Derive primary currency from the highest normalized balance value.
  const { data: networthData } = useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.reports.networth(),
    staleTime: 5 * 60 * 1000,
  });

  const primaryCurrency = useMemo(() => {
    const balances = networthData?.balances;
    if (!balances || balances.length === 0) return 'USD';
    const sorted = [...balances].sort((a, b) => b.balance_in_base - a.balance_in_base);
    return sorted[0].currency;
  }, [networthData]);

  const report = useDailyReportData(language, reportTimeZone, primaryCurrency);

  const timelineLabel = t(report.timelineTranslationKey);

  const chartRangeFormatter = useMemo(
    () => report.rangeWithYearFormatter,
    [report.rangeWithYearFormatter]
  );

  if (report.isPending) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (report.isError) {
    return (
      <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
        <AlertCircle size={48} color={colors.danger} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, fontSize: 18 }}>{t('failedToLoadReport')}</Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>{t('checkConnection')}</Text>
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

      <View style={{ marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ backgroundColor: colors.success + '1a', borderWidth: 1, borderColor: colors.success + '4d', borderRadius: 12, padding: 16, width: isTablet ? '48.5%' : '48%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <TrendingUp size={16} color={colors.success} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 8 }}>{t('totalIncome')}</Text>
          </View>
          <Text style={{ color: colors.success, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.totals.income, report.reportCurrency)}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '4d', borderRadius: 12, padding: 16, width: isTablet ? '48.5%' : '48%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <TrendingDown size={16} color={colors.danger} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 8 }}>{t('totalExpenses')}</Text>
          </View>
          <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
            {formatCompactCurrency(report.totals.expenses, report.reportCurrency)}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.secondary + '73', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, width: isTablet ? '48.5%' : '48%' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('net')}</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: report.totals.net >= 0 ? colors.success : colors.danger }}>
            {report.totals.net >= 0 ? '+' : ''}
            {formatCompactCurrency(report.totals.net, report.reportCurrency)}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.accent + '1a', borderWidth: 1, borderColor: colors.accent + '40', borderRadius: 12, padding: 16, width: isTablet ? '48.5%' : '48%' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>{t('avgDaily')}</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: report.averageDailyNet >= 0 ? colors.success : colors.danger }}>
            {report.averageDailyNet >= 0 ? '+' : ''}
            {formatCompactCurrency(report.averageDailyNet, report.reportCurrency)}
          </Text>
        </View>
      </View>

      {/* Period Comparison & Top Categories */}
      {(report.comparedToLast !== 0 || report.topCategories.length > 0) && (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12, marginBottom: 24 }}>
          {report.comparedToLast !== 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              {report.comparedToLast <= 0 ? (
                <TrendingDown size={16} color="#22c55e" />
              ) : (
                <TrendingUp size={16} color="#ef4444" />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  marginLeft: 8,
                  color: report.comparedToLast <= 0 ? colors.success : colors.danger,
                }}
              >
                {`${report.comparedToLast < 0 ? '' : '+'}${Math.round(report.comparedToLast)}% ${t('vsPreviousPeriod') || 'vs previous period'}`}
              </Text>
            </View>
          )}

          {report.topCategories.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <PieChart size={14} color="#a1a1aa" />
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 8 }}>
                  {t('topCategories') || 'Top Categories'}
                </Text>
              </View>
              {report.topCategories.map((cat) => (
                <View key={cat.category} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <StyledCategoryIcon
                      category={cat.category}
                      size={12}
                      backgroundOpacity={0.1}
                      borderRadius={4}
                      padding={4}
                    />
                    <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 8, textTransform: 'capitalize' }}>{cat.category}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginRight: 8 }}>
                      {formatCompactCurrency(cat.amount, report.reportCurrency)}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
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
        reportTimeZone={reportTimeZone}
      />
    </View>
  );
}
