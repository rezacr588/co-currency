import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, AlertTriangle, Info } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useForecast, useAnomalies, useForecastingHealth } from '../../../../src/hooks/useForecasting';
import { ForecastCard, AnomalyCard } from '../../../../src/components/features/Forecasting';
import { EmptyState } from '../../../../src/components/ui';
import { formatCompactCurrency } from '../../../../src/utils/format';
import type { ForecastPrediction } from '../../../../src/api/forecasting';

export default function ForecastingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { spacing, radii, alpha } = theme;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [currency] = useState('USD');
  const [days, setDays] = useState(30);

  const { data: healthData } = useForecastingHealth();
  const { data: forecastData, refetch: refetchForecast } = useForecast({ days, currency });
  const { refetch: refetchAnomalies } = useAnomalies({});

  const isServiceAvailable = healthData?.status === 'healthy';

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchForecast(), refetchAnomalies()]);
    setRefreshing(false);
  }, [refetchForecast, refetchAnomalies]);

  const dayOptions = [7, 14, 30, 60, 90];
  const hasPredictions = !!forecastData?.predictions && forecastData.predictions.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.full,
              backgroundColor: colors.secondary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('a11yBack') || 'Back'}
          >
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Inter_700Bold',
                color: colors.foreground,
              }}
            >
              {t('forecastingTitle') || 'Cash Flow Forecast'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
              AI-powered predictions
            </Text>
          </View>
          <View
            style={{
              backgroundColor: isServiceAvailable ? alpha(colors.success, 0.125) : alpha(colors.danger, 0.125),
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.xs,
              borderRadius: radii.md,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Inter_600SemiBold',
                color: isServiceAvailable ? colors.success : colors.danger,
              }}
            >
              {isServiceAvailable ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Forecast Period Selector */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: colors.mutedForeground,
              marginBottom: spacing.sm + 2,
            }}
          >
            Forecast Period
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {dayOptions.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.xl,
                  backgroundColor: days === d ? colors.primary : colors.secondary,
                  borderWidth: days === d ? 0 : 1,
                  borderColor: colors.border,
                }}
                accessibilityRole="button"
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                    color: days === d ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {d} days
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Main Forecast Card or Empty State */}
        {hasPredictions ? (
          <ForecastCard
            currency={currency}
            days={days}
            compact={false}
          />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title={t('emptyNoForecastTitle') || 'No forecast available'}
            description={t('emptyNoForecastDesc') || 'Add more transactions to unlock forecasting.'}
          />
        )}

        {/* Anomaly Alerts */}
        <View style={{ marginTop: spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <AlertTriangle size={18} color={colors.warning} />
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Inter_700Bold',
                color: colors.foreground,
              }}
            >
              {t('anomaliesTitle') || 'Spending Alerts'}
            </Text>
          </View>
          <AnomalyCard compact={false} />
        </View>

        {/* Daily Breakdown */}
        {hasPredictions && (
          <View style={{ marginTop: spacing.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
              <TrendingUp size={18} color={colors.primary} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Inter_700Bold',
                  color: colors.foreground,
                }}
              >
                Daily Breakdown
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {/* Table Header */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: colors.secondary,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: colors.mutedForeground,
                  }}
                >
                  Date
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: colors.mutedForeground,
                    textAlign: 'right',
                  }}
                >
                  Balance
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: colors.mutedForeground,
                    textAlign: 'right',
                  }}
                >
                  Income
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: colors.mutedForeground,
                    textAlign: 'right',
                  }}
                >
                  Expense
                </Text>
              </View>

              {/* Table Rows - Show first 7 days */}
              {forecastData!.predictions.slice(0, 7).map((prediction: ForecastPrediction, index: number) => (
                <View
                  key={prediction.date}
                  style={{
                    flexDirection: 'row',
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md + 2,
                    borderBottomWidth: index < 6 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: colors.foreground,
                    }}
                  >
                    {new Date(prediction.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontFamily: 'Inter_600SemiBold',
                      color: colors.foreground,
                      textAlign: 'right',
                    }}
                  >
                    {formatCompactCurrency(prediction.balance, currency)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: colors.success,
                      textAlign: 'right',
                    }}
                  >
                    +{formatCompactCurrency(prediction.income, currency)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: colors.danger,
                      textAlign: 'right',
                    }}
                  >
                    -{formatCompactCurrency(prediction.expenses, currency)}
                  </Text>
                </View>
              ))}

              {/* Show more indicator */}
              {forecastData!.predictions.length > 7 && (
                <View
                  style={{
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                    backgroundColor: colors.secondary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.mutedForeground,
                    }}
                  >
                    +{forecastData!.predictions.length - 7} more days
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Info Section */}
        <View
          style={{
            marginTop: spacing.xxl,
            backgroundColor: alpha(colors.primary, 0.08),
            borderRadius: radii.md,
            padding: spacing.lg,
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          <Info size={20} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginBottom: spacing.xs + 2,
              }}
            >
              How it works
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedForeground,
                lineHeight: 20,
              }}
            >
              Our ML model analyzes your transaction history to predict future cash flow.
              Predictions improve with more transaction data and become more accurate over time.
              Anomaly detection helps identify unusual spending patterns.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
