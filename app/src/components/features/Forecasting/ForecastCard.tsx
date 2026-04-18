import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle, Calendar, RefreshCw, ArrowRight } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { Card } from '../../ui';
import { HIT_SLOP_SM } from '../../../constants/hitSlop';
import type { ForecastResponse } from '../../../api/forecasting';

interface ForecastCardProps {
  days?: number;
  currency?: string;
  compact?: boolean;
  onViewDetails?: () => void;
}

export function ForecastCard({ days = 30, currency = 'USD', compact = false, onViewDetails }: ForecastCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const { data, isLoading, isError, error, refetch } = useQuery<ForecastResponse>({
    queryKey: ['forecasting', 'predict', { days, currency }],
    queryFn: () => api.forecasting.predict(days, currency),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate totals from predictions
  const totals = data?.predictions?.reduce(
    (acc, p) => ({
      income: acc.income + p.income,
      expenses: acc.expenses + p.expenses,
      netCashFlow: acc.netCashFlow + p.net_cash_flow,
    }),
    { income: 0, expenses: 0, netCashFlow: 0 }
  );

  const projectedBalance = data?.predictions?.[data.predictions.length - 1]?.balance ?? 0;
  const isPositive = totals?.netCashFlow ? totals.netCashFlow >= 0 : true;

  const handleRefresh = async () => {
    haptics.light();
    await refetch();
  };

  if (isLoading) {
    return (
      <Card style={{ padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: theme.spacing.sm, fontSize: 14 }}>
            {t('forecasting.loading') || 'Generating forecast...'}
          </Text>
        </View>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card style={{ padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
          <AlertTriangle size={32} color={colors.warning} />
          <Text style={{ color: colors.mutedForeground, marginTop: theme.spacing.sm, fontSize: 14, textAlign: 'center' }}>
            {(error as Error)?.message?.includes('insufficient')
              ? t('forecasting.insufficientData') || 'Need more transaction history'
              : t('forecasting.unavailable') || 'Forecasting unavailable'}
          </Text>
          <Pressable
            onPress={handleRefresh}
            style={{
              marginTop: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: colors.muted,
              borderRadius: theme.radii.md,
            }}
          >
            <RefreshCw size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, marginLeft: theme.spacing.xs, fontSize: 14 }}>
              {t('common.retry') || 'Retry'}
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  if (compact) {
    return (
      <Pressable onPress={onViewDetails} accessibilityRole="button">
        <Card style={{ padding: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isPositive ? theme.alpha(colors.success, 0.125) : theme.alpha(colors.danger, 0.125),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isPositive ? (
                  <TrendingUp size={20} color={colors.success} />
                ) : (
                  <TrendingDown size={20} color={colors.danger} />
                )}
              </View>
              <View style={{ marginLeft: theme.spacing.md }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {t('forecasting.projectedBalance') || `${days}-day projection`}
                </Text>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '600' }}>
                  {formatCurrency(projectedBalance)}
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
          <Calendar size={20} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', marginLeft: theme.spacing.sm }}>
            {t('forecasting.title') || `${days}-Day Forecast`}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel={t('a11yRefresh') || 'Refresh'}
          hitSlop={HIT_SLOP_SM}
        >
          <RefreshCw size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Main Projection */}
      <View
        style={{
          backgroundColor: isPositive ? theme.alpha(colors.success, 0.06) : theme.alpha(colors.danger, 0.06),
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
        }}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.xs }}>
          {t('forecasting.projectedBalance') || 'Projected Balance'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isPositive ? (
            <TrendingUp size={24} color={colors.success} style={{ marginRight: theme.spacing.sm }} />
          ) : (
            <TrendingDown size={24} color={colors.danger} style={{ marginRight: theme.spacing.sm }} />
          )}
          <Text
            style={{
              color: isPositive ? colors.success : colors.danger,
              fontSize: 28,
              fontWeight: '700',
            }}
          >
            {formatCurrency(projectedBalance)}
          </Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.xs }}>
          {t('forecasting.confidenceScore') || 'Confidence'}: {Math.round((data?.confidence_score ?? 0) * 100)}%
        </Text>
      </View>

      {/* Summary Stats */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {t('forecasting.expectedIncome') || 'Expected Income'}
          </Text>
          <Text style={{ color: colors.success, fontSize: 16, fontWeight: '600' }}>
            +{formatCurrency(totals?.income ?? 0)}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: theme.spacing.md }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {t('forecasting.expectedExpenses') || 'Expected Expenses'}
          </Text>
          <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '600' }}>
            -{formatCurrency(totals?.expenses ?? 0)}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: theme.spacing.md }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {t('forecasting.netCashFlow') || 'Net Cash Flow'}
          </Text>
          <Text style={{ color: isPositive ? colors.success : colors.danger, fontSize: 16, fontWeight: '600' }}>
            {isPositive ? '+' : ''}{formatCurrency(totals?.netCashFlow ?? 0)}
          </Text>
        </View>
      </View>

      {/* View Details Button */}
      {onViewDetails && (
        <Pressable
          onPress={() => {
            haptics.light();
            onViewDetails();
          }}
          accessibilityRole="button"
          style={{
            marginTop: theme.spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: theme.spacing.md,
            backgroundColor: colors.muted,
            borderRadius: theme.radii.md,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '500' }}>
            {t('forecasting.viewDetails') || 'View Daily Breakdown'}
          </Text>
          <ArrowRight size={16} color={colors.primary} style={{ marginLeft: theme.spacing.xs }} />
        </Pressable>
      )}
    </Card>
  );
}
