import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency } from '../../../utils/format';
import { StyledCategoryIcon } from '../../../constants/icons';
import { useReportTimeZone } from '../../../hooks/useReportTimeZone';
import type { AnomalyReport } from '../../../types/goal';
import { Card } from '../../ui';
import { REPORT_QUERY_RETRY, REPORT_QUERY_STALE_TIME_MS } from './queryConfig';

interface SpendingAnomalyCardProps {
  compact?: boolean;
  report?: AnomalyReport | null;
}

export function SpendingAnomalyCard({ compact = false, report: providedReport = null }: SpendingAnomalyCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const [expanded, setExpanded] = useState(false);
  const { reportTimeZone } = useReportTimeZone();

  const { data: queriedReport } = useQuery({
    queryKey: ['reports', 'anomalies', reportTimeZone],
    queryFn: () => api.reports.anomalies(undefined, reportTimeZone),
    enabled: providedReport == null,
    staleTime: REPORT_QUERY_STALE_TIME_MS,
    retry: REPORT_QUERY_RETRY,
  });

  const report = providedReport ?? queriedReport;

  if (!report || !report.anomalies || report.anomalies.length === 0) return null;

  const anomalies = report.anomalies;
  const visibleAnomalies = expanded || compact ? anomalies : anomalies.slice(0, 3);
  const hasMore = anomalies.length > 3;

  if (compact) {
    return (
      <View style={{ backgroundColor: theme.alpha(colors.warning, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.warning, 0.3), padding: theme.spacing.lg, borderRadius: theme.radii.md, marginBottom: theme.spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
        <AlertTriangle size={20} color={colors.warning} />
        <View style={{ marginStart: theme.spacing.md, flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {anomalies.length}{' '}
            {t('unusualTransactions') || 'unusual transactions this week'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {t('tapToViewAnomalies') || 'View in Reports for details'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Card style={{ padding: theme.spacing.xxl, marginBottom: theme.spacing.xxl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <View style={{ backgroundColor: theme.alpha(colors.warning, 0.2), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
          <AlertTriangle size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {t('spendingAnomalies') || 'Spending Anomalies'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {t('unusualSpending') || 'Unusual spending detected this week'}
          </Text>
        </View>
      </View>

      {/* Anomaly List */}
      <View style={{ gap: theme.spacing.md }}>
        {visibleAnomalies.map((anomaly, idx) => (
          <View
            key={anomaly.transaction_id || idx}
            style={{ backgroundColor: theme.alpha(colors.secondary, 0.3), borderWidth: 1, borderColor: colors.border, padding: theme.spacing.md, borderRadius: theme.radii.sm }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <StyledCategoryIcon
                category={anomaly.category}
                size={14}
                backgroundOpacity={0.15}
                borderRadius={6}
                padding={6}
              />
              <View style={{ flex: 1, marginStart: theme.spacing.sm }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                  {anomaly.description}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{anomaly.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.danger, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                  {formatCompactCurrency(anomaly.amount, anomaly.currency)}
                </Text>
                <View style={{ backgroundColor: theme.alpha(colors.warning, 0.2), paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radii.full, marginTop: theme.spacing.xs }}>
                  <Text style={{ color: colors.warning, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                    {anomaly.deviation}x {t('timesYourAverage') || 'avg'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.sm }}>
              {t('categoryAvg') || 'Category avg'}:{' '}
              {formatCompactCurrency(anomaly.average_amount, anomaly.currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Expand/Collapse */}
      {hasMore && !compact && (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md, paddingVertical: theme.spacing.sm }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? (t('showLess') || 'Show less') : `${t('showMore') || 'Show more'} (${anomalies.length - 3})`}
          accessibilityHint={expanded ? (t('showLess') || 'Show less') : (t('showMore') || 'Show more')}
        >
          {expanded ? (
            <ChevronUp size={16} color={colors.mutedForeground} />
          ) : (
            <ChevronDown size={16} color={colors.mutedForeground} />
          )}
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: theme.spacing.xs }}>
            {expanded
              ? (t('showLess') || 'Show less')
              : `${t('showMore') || 'Show more'} (${anomalies.length - 3})`}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}
