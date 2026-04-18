import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Shield, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { Card } from '../../ui';
import { HIT_SLOP_SM } from '../../../constants/hitSlop';
import type { WealthOverview, CurrencyExposure } from '../../../types/wealth';

interface RealValueCardProps {
  compact?: boolean;
}

function ShieldGauge({ score }: { score: number }) {
  const theme = useTheme();
  const colors = theme.colors;

  // Palette-coded thresholds for a gradient score scale (high→low).
  const getColor = (s: number): string => {
    if (s >= 80) return colors.palette.green;
    if (s >= 60) return colors.palette.lime;
    if (s >= 40) return colors.warning;
    if (s >= 20) return colors.palette.orange;
    return colors.danger;
  };

  const color = getColor(score);

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: theme.radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 7,
          borderColor: theme.alpha(color, 0.19),
          backgroundColor: 'transparent',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 88,
            height: 88,
            borderRadius: theme.radii.full,
            borderWidth: 7,
            borderColor: 'transparent',
            borderLeftColor: score > 0 ? color : 'transparent',
            borderBottomColor: score > 25 ? color : 'transparent',
            borderRightColor: score > 50 ? color : 'transparent',
            borderTopColor: score > 75 ? color : 'transparent',
          }}
        />
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontFamily: theme.typography.h1.fontFamily, color: colors.foreground }}>
            {score}
          </Text>
          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>/100</Text>
        </View>
      </View>
    </View>
  );
}

function ExposureBar({ exposure, maxBalance }: { exposure: CurrencyExposure; maxBalance: number }) {
  const theme = useTheme();
  const colors = theme.colors;

  const getInflationColor = (rate: number): string => {
    if (rate > 10) return colors.danger;
    if (rate > 3) return colors.warning;
    return colors.success;
  };

  const barWidth = maxBalance > 0 ? Math.max(8, (exposure.nominal_balance / maxBalance) * 100) : 0;
  const inflationColor = getInflationColor(exposure.annual_inflation);

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: theme.typography.bodyMedium.fontFamily, color: colors.foreground }}>
            {exposure.currency}
          </Text>
          <View
            style={{
              backgroundColor: theme.alpha(inflationColor, 0.15),
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 4,
              marginStart: 6,
            }}
          >
            <Text style={{ fontSize: 10, color: inflationColor, fontFamily: theme.typography.bodyMedium.fontFamily }}>
              {exposure.annual_inflation.toFixed(1)}%
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {exposure.share_percentage.toFixed(0)}%
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: colors.muted, borderRadius: theme.radii.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: theme.radii.full,
            width: `${Math.min(100, barWidth)}%`,
            backgroundColor: inflationColor,
          }}
        />
      </View>
    </View>
  );
}

export function RealValueCard({ compact = false }: RealValueCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const {
    data: wealthData,
    isPending,
    refetch,
    isRefetching,
  } = useQuery<WealthOverview>({
    queryKey: ['wealth', 'overview'],
    queryFn: () => api.wealth.overview(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handleRefresh = () => {
    haptics.light();
    refetch();
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={14} color={colors.success} />;
      case 'declining':
        return <TrendingDown size={14} color={colors.danger} />;
      default:
        return <Minus size={14} color={colors.mutedForeground} />;
    }
  };

  // Palette-coded thresholds for the compact gauge.
  const getScoreColor = (score: number): string => {
    if (score >= 80) return colors.palette.green;
    if (score >= 60) return colors.palette.lime;
    if (score >= 40) return colors.warning;
    return colors.danger;
  };

  if (compact) {
    const scoreColor = wealthData ? getScoreColor(wealthData.shield_score) : colors.mutedForeground;

    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii.full,
                backgroundColor: theme.alpha(scoreColor, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginEnd: theme.spacing.md,
              }}
            >
              <Shield size={20} color={scoreColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: theme.typography.h2.fontFamily, fontSize: 14 }}>
                {t('realValue') || 'Real Value'}
              </Text>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : wealthData ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 22,
                        fontFamily: theme.typography.h1.fontFamily,
                        color: colors.foreground,
                        marginEnd: 6,
                      }}
                    >
                      {wealthData.shield_score}
                    </Text>
                    {getTrendIcon(wealthData.shield_trend)}
                  </View>
                  {wealthData.erosion_amount > 0 ? (
                    <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }} numberOfLines={1}>
                      {t('yourMoneyLost') || 'Lost'} {wealthData.erosion_amount.toFixed(2)} {wealthData.currency}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.success, marginTop: 2 }}>
                      {t('purchasingPowerProtected') || 'Protected'}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  {t('noDataYet') || 'No data yet'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  }

  // Full mode
  return (
    <Card style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radii.full,
              backgroundColor: theme.alpha(colors.accent, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              marginEnd: theme.spacing.md,
            }}
          >
            <Shield size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: theme.typography.h2.fontFamily, color: colors.foreground }}>
              {t('wealthShieldScore') || 'Wealth Shield Score'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {t('purchasingPower') || 'Purchasing power protection'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isRefetching}
          accessibilityRole="button"
          accessibilityLabel={t('a11yRefresh') || 'Refresh'}
          hitSlop={HIT_SLOP_SM}
          style={{ padding: theme.spacing.sm }}
        >
          <RefreshCw
            size={18}
            color={colors.mutedForeground}
            style={isRefetching ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {isPending || isRefetching ? (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xxxl }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: theme.spacing.sm }}>
            {t('calculatingScore') || 'Analyzing purchasing power...'}
          </Text>
        </View>
      ) : wealthData ? (
        <>
          {/* Score + Balance Comparison */}
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
            <ShieldGauge score={wealthData.shield_score} />
            <Text
              style={{
                fontSize: 16,
                fontFamily: theme.typography.h1.fontFamily,
                color: colors.foreground,
                marginTop: theme.spacing.sm,
              }}
            >
              {t(`wealthShield${wealthData.shield_label}` as any) || wealthData.shield_label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xs }}>
              {getTrendIcon(wealthData.shield_trend)}
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginStart: theme.spacing.xs }}>
                {wealthData.shield_trend === 'improving'
                  ? (t('improving') || 'Improving')
                  : wealthData.shield_trend === 'declining'
                    ? (t('declining') || 'Declining')
                    : (t('stable') || 'Stable')}
              </Text>
            </View>
          </View>

          {/* Nominal vs Real */}
          <View
            style={{
              backgroundColor: theme.alpha(colors.muted, 0.5),
              padding: theme.spacing.lg,
              borderRadius: 10,
              marginBottom: theme.spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {t('nominalBalance') || 'Nominal'}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: theme.typography.h2.fontFamily,
                    color: colors.mutedForeground,
                    textDecorationLine: 'line-through',
                  }}
                >
                  {wealthData.nominal_total.toFixed(2)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {t('realBalance') || 'Real Value'}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: theme.typography.h1.fontFamily,
                    color: colors.foreground,
                  }}
                >
                  {wealthData.real_total.toFixed(2)}
                </Text>
              </View>
            </View>
            {wealthData.erosion_amount > 0 && (
              <View
                style={{
                  backgroundColor: theme.alpha(colors.danger, 0.08),
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, color: colors.danger, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  -{wealthData.erosion_amount.toFixed(2)} {wealthData.currency} (-{wealthData.erosion_rate.toFixed(2)}%)
                </Text>
              </View>
            )}
          </View>

          {/* Currency Exposure */}
          {wealthData.currency_breakdown && wealthData.currency_breakdown.length > 0 && (
            <View
              style={{
                backgroundColor: theme.alpha(colors.muted, 0.5),
                padding: theme.spacing.lg,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                  color: colors.foreground,
                  marginBottom: theme.spacing.md,
                }}
              >
                {t('inflationExposure') || 'Inflation Exposure'}
              </Text>
              {(() => {
                const maxBalance = Math.max(
                  ...wealthData.currency_breakdown.map((e) => e.nominal_balance)
                );
                return wealthData.currency_breakdown.map((exposure) => (
                  <ExposureBar
                    key={exposure.currency}
                    exposure={exposure}
                    maxBalance={maxBalance}
                  />
                ));
              })()}
            </View>
          )}
        </>
      ) : (
        <View
          style={{
            backgroundColor: theme.alpha(colors.muted, 0.5),
            padding: theme.spacing.xxl,
            borderRadius: theme.radii.sm,
            alignItems: 'center',
          }}
        >
          <Shield size={32} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: theme.spacing.sm }}>
            {t('addTransactionsForScore') || 'Add balances to see your purchasing power analysis'}
          </Text>
        </View>
      )}
    </Card>
  );
}
