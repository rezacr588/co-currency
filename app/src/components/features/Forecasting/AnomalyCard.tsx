import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, AlertOctagon, Bell, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { Card } from '../../ui';
import type { Anomaly, AnomalyDetectionResponse } from '../../../api/forecasting';

interface AnomalyCardProps {
  threshold?: number;
  compact?: boolean;
  maxItems?: number;
  onViewAll?: () => void;
  onAcknowledge?: (anomaly: Anomaly) => void;
}

const severityConfig = {
  low: {
    icon: Bell,
    color: '#3b82f6', // blue
    label: 'Low',
  },
  medium: {
    icon: AlertCircle,
    color: '#f59e0b', // amber
    label: 'Medium',
  },
  high: {
    icon: AlertTriangle,
    color: '#f97316', // orange
    label: 'High',
  },
  critical: {
    icon: AlertOctagon,
    color: '#ef4444', // red
    label: 'Critical',
  },
};

function AnomalyItem({ anomaly, onPress }: { anomaly: Anomaly; onPress?: () => void }) {
  const theme = useTheme();
  const colors = theme.colors;
  const config = severityConfig[anomaly.severity];
  const Icon = config.icon;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress?.();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        backgroundColor: `${config.color}10`,
        borderRadius: theme.radii.md,
        borderLeftWidth: 3,
        borderLeftColor: config.color,
        marginBottom: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${config.color}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={config.color} />
      </View>
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
            {anomaly.category}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {formatDate(anomaly.date)}
          </Text>
        </View>
        <Text style={{ color: config.color, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
          {formatCurrency(anomaly.amount)}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
          {anomaly.message}
        </Text>
      </View>
    </Pressable>
  );
}

export function AnomalyCard({ threshold = 2.5, compact = false, maxItems = 5, onViewAll, onAcknowledge }: AnomalyCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const { data, isLoading, isError, error, refetch } = useQuery<AnomalyDetectionResponse>({
    queryKey: ['forecasting', 'anomalies', { threshold }],
    queryFn: () => api.forecasting.detectAnomalies(threshold),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });

  const handleRefresh = async () => {
    haptics.light();
    await refetch();
  };

  if (isLoading) {
    return (
      <Card style={{ padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: compact ? 80 : 120 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: theme.spacing.sm, fontSize: 14 }}>
            {t('anomalies.scanning') || 'Scanning transactions...'}
          </Text>
        </View>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card style={{ padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: compact ? 80 : 120 }}>
          <AlertTriangle size={32} color={colors.warning} />
          <Text style={{ color: colors.mutedForeground, marginTop: theme.spacing.sm, fontSize: 14, textAlign: 'center' }}>
            {(error as Error)?.message?.includes('insufficient')
              ? t('anomalies.insufficientData') || 'Need more transactions'
              : t('anomalies.unavailable') || 'Anomaly detection unavailable'}
          </Text>
        </View>
      </Card>
    );
  }

  const anomalies = data?.anomalies || [];
  const displayAnomalies = anomalies.slice(0, maxItems);
  const hasMore = anomalies.length > maxItems;

  // No anomalies state
  if (anomalies.length === 0) {
    return (
      <Card style={{ padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: compact ? 80 : 120 }}>
          <CheckCircle size={32} color={colors.success} />
          <Text style={{ color: colors.foreground, marginTop: theme.spacing.sm, fontSize: 16, fontWeight: '600' }}>
            {t('anomalies.allGood') || 'All Clear!'}
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: theme.spacing.xs, fontSize: 14, textAlign: 'center' }}>
            {t('anomalies.noAnomalies') || 'No unusual spending detected'}
          </Text>
        </View>
      </Card>
    );
  }

  if (compact) {
    const highSeverityCount = anomalies.filter((a) => a.severity === 'high' || a.severity === 'critical').length;

    return (
      <Pressable onPress={onViewAll}>
        <Card style={{ padding: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: highSeverityCount > 0 ? `${colors.danger}20` : `${colors.warning}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} color={highSeverityCount > 0 ? colors.danger : colors.warning} />
              </View>
              <View style={{ marginLeft: theme.spacing.md }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {t('anomalies.unusualSpending') || 'Unusual Spending'}
                </Text>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '600' }}>
                  {anomalies.length} {t('anomalies.detected') || 'detected'}
                </Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.mutedForeground} />
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card style={{ padding: theme.spacing.lg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AlertTriangle size={20} color={colors.warning} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', marginLeft: theme.spacing.sm }}>
            {t('anomalies.title') || 'Spending Alerts'}
          </Text>
          <View
            style={{
              backgroundColor: colors.danger,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginLeft: theme.spacing.sm,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{anomalies.length}</Text>
          </View>
        </View>
        <Pressable onPress={handleRefresh} hitSlop={8}>
          <RefreshCw size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Summary */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginBottom: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          backgroundColor: colors.muted,
          borderRadius: theme.radii.md,
        }}
      >
        {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
          const count = anomalies.filter((a) => a.severity === severity).length;
          const config = severityConfig[severity];
          return (
            <View key={severity} style={{ alignItems: 'center' }}>
              <Text style={{ color: config.color, fontSize: 18, fontWeight: '700' }}>{count}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, textTransform: 'capitalize' }}>{config.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Anomaly List */}
      <View>
        {displayAnomalies.map((anomaly, index) => (
          <AnomalyItem key={`${anomaly.date}-${anomaly.category}-${index}`} anomaly={anomaly} onPress={() => onAcknowledge?.(anomaly)} />
        ))}
      </View>

      {/* View All Button */}
      {hasMore && onViewAll && (
        <Pressable
          onPress={() => {
            haptics.light();
            onViewAll();
          }}
          style={{
            marginTop: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: theme.spacing.md,
            backgroundColor: colors.muted,
            borderRadius: theme.radii.md,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '500' }}>
            {t('anomalies.viewAll') || `View All (${anomalies.length})`}
          </Text>
          <ArrowRight size={16} color={colors.primary} style={{ marginLeft: theme.spacing.xs }} />
        </Pressable>
      )}
    </Card>
  );
}
