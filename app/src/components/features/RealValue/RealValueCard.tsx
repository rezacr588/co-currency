import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Shield, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { Card } from '../../ui';
import type { WealthOverview, CurrencyExposure } from '../../../types/wealth';

interface RealValueCardProps {
  compact?: boolean;
}

function ShieldGauge({ score }: { score: number }) {
  const theme = useTheme();
  const colors = theme.colors;

  const getColor = (s: number): string => {
    if (s >= 80) return colors.success;
    if (s >= 60) return '#84cc16';
    if (s >= 40) return colors.warning;
    if (s >= 20) return '#f97316';
    return colors.danger;
  };

  const color = getColor(score);

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 9999,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 7,
          borderColor: `${color}30`,
          backgroundColor: 'transparent',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 88,
            height: 88,
            borderRadius: 9999,
            borderWidth: 7,
            borderColor: 'transparent',
            borderLeftColor: score > 0 ? color : 'transparent',
            borderBottomColor: score > 25 ? color : 'transparent',
            borderRightColor: score > 50 ? color : 'transparent',
            borderTopColor: score > 75 ? color : 'transparent',
          }}
        />
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
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
          <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
            {exposure.currency}
          </Text>
          <View
            style={{
              backgroundColor: inflationColor + '25',
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 4,
              marginStart: 6,
            }}
          >
            <Text style={{ fontSize: 10, color: inflationColor, fontFamily: 'Inter_500Medium' }}>
              {exposure.annual_inflation.toFixed(1)}%
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {exposure.share_percentage.toFixed(0)}%
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: colors.muted, borderRadius: 9999, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: 9999,
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

  const getScoreColor = (score: number): string => {
    if (score >= 80) return colors.success;
    if (score >= 60) return '#84cc16';
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
                borderRadius: 9999,
                backgroundColor: scoreColor + '25',
                alignItems: 'center',
                justifyContent: 'center',
                marginEnd: 12,
              }}
            >
              <Shield size={20} color={scoreColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
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
                        fontFamily: 'Inter_700Bold',
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
    <Card style={{ padding: 20 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              backgroundColor: colors.accent + '25',
              alignItems: 'center',
              justifyContent: 'center',
              marginEnd: 12,
            }}
          >
            <Shield size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('wealthShieldScore') || 'Wealth Shield Score'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {t('purchasingPower') || 'Purchasing power protection'}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleRefresh} disabled={isRefetching} style={{ padding: 8 }}>
          <RefreshCw
            size={18}
            color={colors.mutedForeground}
            style={isRefetching ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {isPending || isRefetching ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            {t('calculatingScore') || 'Analyzing purchasing power...'}
          </Text>
        </View>
      ) : wealthData ? (
        <>
          {/* Score + Balance Comparison */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <ShieldGauge score={wealthData.shield_score} />
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Inter_700Bold',
                color: colors.foreground,
                marginTop: 8,
              }}
            >
              {t(`wealthShield${wealthData.shield_label}` as any) || wealthData.shield_label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              {getTrendIcon(wealthData.shield_trend)}
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginStart: 4 }}>
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
              backgroundColor: colors.muted + '80',
              padding: 16,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {t('nominalBalance') || 'Nominal'}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Inter_600SemiBold',
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
                    fontFamily: 'Inter_700Bold',
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
                  backgroundColor: colors.danger + '15',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, color: colors.danger, fontFamily: 'Inter_500Medium' }}>
                  -{wealthData.erosion_amount.toFixed(2)} {wealthData.currency} (-{wealthData.erosion_rate.toFixed(2)}%)
                </Text>
              </View>
            )}
          </View>

          {/* Currency Exposure */}
          {wealthData.currency_breakdown && wealthData.currency_breakdown.length > 0 && (
            <View
              style={{
                backgroundColor: colors.muted + '80',
                padding: 16,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_500Medium',
                  color: colors.foreground,
                  marginBottom: 12,
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
            backgroundColor: colors.muted + '80',
            padding: 24,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Shield size={32} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
            {t('addTransactionsForScore') || 'Add balances to see your purchasing power analysis'}
          </Text>
        </View>
      )}
    </Card>
  );
}
