import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, AlertTriangle, Info } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useScreenLayout } from '../../../../src/hooks/useScreenLayout';
import { useForecast, useAnomalies, useForecastingHealth } from '../../../../src/hooks/useForecasting';
import { ForecastCard, AnomalyCard } from '../../../../src/components/features/Forecasting';
import { formatCompactCurrency } from '../../../../src/utils/format';
import type { ForecastPrediction } from '../../../../src/api/forecasting';

export default function ForecastingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isTablet } = useScreenLayout();
  
  const [currency, setCurrency] = useState('USD');
  const [days, setDays] = useState(30);
  
  const { data: healthData, isLoading: healthLoading } = useForecastingHealth();
  const { data: forecastData, isLoading: forecastLoading, error: forecastError, refetch: refetchForecast } = useForecast({ days, currency });
  const { data: anomalyData, isLoading: anomalyLoading, error: anomalyError, refetch: refetchAnomalies } = useAnomalies({});
  
  const isLoading = healthLoading || forecastLoading || anomalyLoading;
  const isServiceAvailable = healthData?.status === 'healthy';
  
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchForecast(), refetchAnomalies()]);
    setRefreshing(false);
  }, [refetchForecast, refetchAnomalies]);
  
  const dayOptions = [7, 14, 30, 60, 90];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.secondary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('back') || 'Back'}
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
              backgroundColor: isServiceAvailable ? colors.success + '20' : colors.danger + '20',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
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
          padding: 16,
          paddingBottom: insets.bottom + 32,
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
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: colors.mutedForeground,
              marginBottom: 10,
            }}
          >
            Forecast Period
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {dayOptions.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: days === d ? colors.primary : colors.secondary,
                  borderWidth: days === d ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                    color: days === d ? colors.background : colors.foreground,
                  }}
                >
                  {d} days
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Main Forecast Card */}
        <ForecastCard
          currency={currency}
          days={days}
          compact={false}
        />

        {/* Anomaly Alerts */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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
        {forecastData?.predictions && forecastData.predictions.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {/* Table Header */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
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
              {forecastData.predictions.slice(0, 7).map((prediction: ForecastPrediction, index: number) => (
                <View
                  key={prediction.date}
                  style={{
                    flexDirection: 'row',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
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
              {forecastData.predictions.length > 7 && (
                <View
                  style={{
                    paddingVertical: 12,
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
                    +{forecastData.predictions.length - 7} more days
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Info Section */}
        <View
          style={{
            marginTop: 24,
            backgroundColor: colors.primary + '10',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            gap: 12,
          }}
        >
          <Info size={20} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginBottom: 6,
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
