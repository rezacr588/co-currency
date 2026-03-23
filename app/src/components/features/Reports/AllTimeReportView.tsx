import { useMemo } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components/native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { getDateRangeFromPreset, getTimeZoneDateParts } from '../../../utils/dateRange';
import { SkeletonCard, SkeletonList } from '../../ui/Skeleton';
import { ReportErrorCard } from '../../ui';
import { HealthScoreCard } from '../HealthScore/HealthScoreCard';
import { WeeklyRecapCard } from '../WeeklyRecap/WeeklyRecapCard';
import { MonthlyReportView } from './MonthlyReportView';
import { ReportHeadlineCard } from './ReportHeadlineCard';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';
import { createReportDateFormatter, type ReportHistoryTarget } from './reportUX';

interface AllTimeReportViewProps {
  isTablet?: boolean;
  categoryCardWidth: number;
  categoryCols: number;
  onOpenHistory?: (target: ReportHistoryTarget) => void;
}

export function AllTimeReportView({
  isTablet = false,
  categoryCardWidth,
  categoryCols,
  onOpenHistory,
}: AllTimeReportViewProps) {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  const today = useMemo(() => getTimeZoneDateParts(new Date(), reportTimeZone), [reportTimeZone]);
  const fallbackRange = useMemo(() => getDateRangeFromPreset('all_time', reportTimeZone), [reportTimeZone]);

  const { data: coverage, isPending: isLoadingCoverage, isError: isCoverageError, refetch: refetchCoverage } = useQuery({
    queryKey: ['reports', 'coverage', reportTimeZone],
    queryFn: () => api.reports.coverage(reportTimeZone),
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const allTimeRange = useMemo(() => {
    if (coverage?.has_transactions && coverage.first_transaction_date) {
      return {
        fromDate: coverage.first_transaction_date,
        toDate: fallbackRange.toDate!,
      };
    }

    if (coverage && !coverage.has_transactions) {
      return {
        fromDate: fallbackRange.toDate!,
        toDate: fallbackRange.toDate!,
      };
    }

    return {
      fromDate: fallbackRange.fromDate!,
      toDate: fallbackRange.toDate!,
    };
  }, [coverage, fallbackRange]);
  const firstTransactionLabel = useMemo(() => {
    if (!coverage?.first_transaction_date) {
      return null;
    }

    const formatter = createReportDateFormatter(
      language,
      { month: 'short', day: 'numeric', year: 'numeric' },
      reportTimeZone
    );
    const [year, month, day] = coverage.first_transaction_date.split('-').map(Number);
    return formatter.format(new Date(Date.UTC(year, month - 1, day, 12)));
  }, [coverage?.first_transaction_date, language, reportTimeZone]);

  if (isCoverageError) {
    return (
      <ReportErrorCard
        title={t('failedToLoadReport')}
        message={t('checkConnection')}
        retryLabel={t('retry') || 'Retry'}
        onRetry={() => {
          void refetchCoverage();
        }}
      />
    );
  }

  return (
    <View style={{ gap: 24 }}>
      <ReportHeadlineCard
        summary={
          firstTransactionLabel
            ? `${t('sinceFirstTransaction') || 'Since first transaction'}: ${firstTransactionLabel}`
            : (t('allTimeViewSummary') || 'This view combines your full history with the latest weekly insight.')
        }
        caption={t('latestWeeklyInsightCaption') || 'Long-term totals plus your latest weekly snapshot'}
      />

      <View
        style={{
          flexDirection: isTablet ? 'row' : 'column',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <View style={{ flex: 1 }}>
          <HealthScoreCard />
        </View>
        <View style={{ flex: 1 }}>
          <WeeklyRecapCard
            titleOverride={t('latestWeeklyInsight') || 'Latest Weekly Insight'}
            emptySubtitleOverride={t('currentWeekSnapshot') || 'Current week snapshot'}
          />
        </View>
      </View>

      {isLoadingCoverage ? (
        <View style={{ gap: 12 }}>
          <SkeletonCard />
          <SkeletonList count={1} />
        </View>
      ) : (
        <MonthlyReportView
          year={today.year}
          month={today.month}
          fromDate={allTimeRange.fromDate}
          toDate={allTimeRange.toDate}
          summaryTitle={t('allTimeSummary')}
          isTablet={isTablet}
          categoryCardWidth={categoryCardWidth}
          categoryCols={categoryCols}
          onOpenHistory={onOpenHistory}
          showHeadline={false}
        />
      )}
    </View>
  );
}
