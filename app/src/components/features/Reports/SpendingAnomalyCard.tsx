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

interface SpendingAnomalyCardProps {
  compact?: boolean;
}

export function SpendingAnomalyCard({ compact = false }: SpendingAnomalyCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const [expanded, setExpanded] = useState(false);
  const { reportTimeZone } = useReportTimeZone();

  const { data: report } = useQuery({
    queryKey: ['reports', 'anomalies', reportTimeZone],
    queryFn: () => api.reports.anomalies(undefined, reportTimeZone),
    staleTime: 5 * 60 * 1000,
  });

  if (!report || !report.anomalies || report.anomalies.length === 0) return null;

  const anomalies = report.anomalies;
  const visibleAnomalies = expanded || compact ? anomalies : anomalies.slice(0, 3);
  const hasMore = anomalies.length > 3;

  if (compact) {
    return (
      <View style={{ backgroundColor: colors.warning + '1a', borderWidth: 1, borderColor: colors.warning + '4d', padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
        <AlertTriangle size={20} color={colors.warning} />
        <View style={{ marginLeft: 12, flex: 1 }}>
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
    <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, marginBottom: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ backgroundColor: colors.warning + '33', padding: 8, borderRadius: 8, marginRight: 12 }}>
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
      <View style={{ gap: 12 }}>
        {visibleAnomalies.map((anomaly, idx) => (
          <View
            key={anomaly.transaction_id || idx}
            style={{ backgroundColor: colors.secondary + '4d', borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <StyledCategoryIcon
                category={anomaly.category}
                size={14}
                backgroundOpacity={0.15}
                borderRadius={6}
                padding={6}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                  {anomaly.description}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{anomaly.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.danger, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                  {formatCompactCurrency(anomaly.amount, anomaly.currency)}
                </Text>
                <View style={{ backgroundColor: colors.warning + '33', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, marginTop: 4 }}>
                  <Text style={{ color: colors.warning, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                    {anomaly.deviation}x {t('timesYourAverage') || 'avg'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>
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
          style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8 }}
        >
          {expanded ? (
            <ChevronUp size={16} color={colors.mutedForeground} />
          ) : (
            <ChevronDown size={16} color={colors.mutedForeground} />
          )}
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 4 }}>
            {expanded
              ? (t('showLess') || 'Show less')
              : `${t('showMore') || 'Show more'} (${anomalies.length - 3})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
