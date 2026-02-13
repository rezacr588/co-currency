import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useColors } from '../../../context/ThemeContext';
import { formatCompactCurrency } from '../../../utils/format';
import { StyledCategoryIcon } from '../../../constants/icons';
import type { AnomalyReport } from '../../../types/goal';

interface SpendingAnomalyCardProps {
  compact?: boolean;
}

export function SpendingAnomalyCard({ compact = false }: SpendingAnomalyCardProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const { data: report } = useQuery({
    queryKey: ['reports', 'anomalies'],
    queryFn: () => api.reports.anomalies(),
    staleTime: 5 * 60 * 1000,
  });

  if (!report || !report.anomalies || report.anomalies.length === 0) return null;

  const anomalies = report.anomalies;
  const visibleAnomalies = expanded || compact ? anomalies : anomalies.slice(0, 3);
  const hasMore = anomalies.length > 3;

  if (compact) {
    return (
      <View className="bg-warning/10 border border-warning/30 p-4 rounded-xl mb-4 flex-row items-center">
        <AlertTriangle size={20} color={colors.warning} />
        <View className="ml-3 flex-1">
          <Text className="text-foreground font-medium text-sm">
            {anomalies.length}{' '}
            {t('unusualTransactions') || 'unusual transactions this week'}
          </Text>
          <Text className="text-muted-foreground text-xs mt-0.5">
            {t('tapToViewAnomalies') || 'View in Reports for details'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-card p-6 rounded-xl mb-6">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <View className="bg-warning/20 p-2 rounded-lg mr-3">
          <AlertTriangle size={20} color={colors.warning} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">
            {t('spendingAnomalies') || 'Spending Anomalies'}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {t('unusualSpending') || 'Unusual spending detected this week'}
          </Text>
        </View>
      </View>

      {/* Anomaly List */}
      <View className="gap-3">
        {visibleAnomalies.map((anomaly, idx) => (
          <View
            key={anomaly.transaction_id || idx}
            className="bg-secondary/30 border border-border p-3 rounded-lg"
          >
            <View className="flex-row items-center">
              <StyledCategoryIcon
                category={anomaly.category}
                size={14}
                backgroundOpacity={0.15}
                borderRadius={6}
                padding={6}
              />
              <View className="flex-1 ml-2">
                <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
                  {anomaly.description}
                </Text>
                <Text className="text-muted-foreground text-xs">{anomaly.date}</Text>
              </View>
              <View className="items-end">
                <Text className="text-danger font-bold text-sm">
                  {formatCompactCurrency(anomaly.amount, anomaly.currency)}
                </Text>
                <View className="bg-warning/20 px-2 py-0.5 rounded-full mt-1">
                  <Text className="text-warning text-xs font-medium">
                    {anomaly.deviation}x {t('timesYourAverage') || 'avg'}
                  </Text>
                </View>
              </View>
            </View>
            <Text className="text-muted-foreground text-xs mt-2">
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
          className="flex-row items-center justify-center mt-3 py-2"
          style={{ cursor: 'pointer' }}
        >
          {expanded ? (
            <ChevronUp size={16} color={colors.mutedForeground} />
          ) : (
            <ChevronDown size={16} color={colors.mutedForeground} />
          )}
          <Text className="text-muted-foreground text-sm ml-1">
            {expanded
              ? (t('showLess') || 'Show less')
              : `${t('showMore') || 'Show more'} (${anomalies.length - 3})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
