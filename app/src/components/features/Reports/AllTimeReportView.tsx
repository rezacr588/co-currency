import { useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components/native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import { getDateRangeFromPreset, getTimeZoneDateParts } from '../../../utils/dateRange';
import { HealthScoreCard } from '../HealthScore/HealthScoreCard';
import { WeeklyRecapCard } from '../WeeklyRecap/WeeklyRecapCard';
import { MonthlyReportView } from './MonthlyReportView';

interface AllTimeReportViewProps {
  isTablet?: boolean;
  categoryCardWidth: number;
  categoryCols: number;
}

export function AllTimeReportView({
  isTablet = false,
  categoryCardWidth,
  categoryCols,
}: AllTimeReportViewProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const { reportTimeZone } = useReportTimeZone();

  const today = useMemo(() => getTimeZoneDateParts(new Date(), reportTimeZone), [reportTimeZone]);
  const fallbackRange = useMemo(() => getDateRangeFromPreset('all_time', reportTimeZone), [reportTimeZone]);

  const { data: coverage, isPending: isLoadingCoverage } = useQuery({
    queryKey: ['reports', 'coverage', reportTimeZone],
    queryFn: () => api.reports.coverage(reportTimeZone),
    staleTime: 5 * 60 * 1000,
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

  return (
    <View style={{ gap: 24 }}>
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
          <WeeklyRecapCard />
        </View>
      </View>

      {isLoadingCoverage ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
          <ActivityIndicator size="large" color={colors.accent} />
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
        />
      )}
    </View>
  );
}
