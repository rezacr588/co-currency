import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  ArrowRightLeft,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useToast } from '../../src/components/ui/Toast';
import { PageScaffold } from '../../src/components/ui';
import { Card } from '../../src/components/ui';
import { Input } from '../../src/components/ui';
import { Button } from '../../src/components/ui';
import { Select } from '../../src/components/ui';
import { useCurrencies } from '../../src/hooks';
import { RealValueCard } from '../../src/components/features/RealValue';
import { haptics } from '../../src/utils/haptics';
import type { WealthOverview, WealthAlert, WhatIfResult } from '../../src/types/wealth';

export default function RealValueScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // What-If state
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [whatIfAmount, setWhatIfAmount] = useState('1000');
  const [whatIfMonths, setWhatIfMonths] = useState('12');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const { data: currencies } = useCurrencies();
  const currencyOptions = (currencies || []).map((c: { code: string; name: string }) => ({
    label: `${c.code} - ${c.name}`,
    value: c.code,
  }));

  const { data: wealthData, isPending: isOverviewPending } = useQuery<WealthOverview>({
    queryKey: ['wealth', 'overview'],
    queryFn: () => api.wealth.overview(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: alertsData, isPending: isAlertsPending } = useQuery<{ alerts: WealthAlert[] }>({
    queryKey: ['wealth', 'alerts'],
    queryFn: () => api.wealth.alerts(),
    staleTime: 2 * 60 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.wealth.markAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wealth', 'alerts'] });
      haptics.light();
    },
  });

  const whatIfMutation = useMutation({
    mutationFn: () =>
      api.wealth.whatIf({
        from: fromCurrency.toUpperCase().trim(),
        to: toCurrency.toUpperCase().trim(),
        amount: parseFloat(whatIfAmount) || 0,
        months_ago: parseInt(whatIfMonths, 10) || 12,
      }),
    onSuccess: (data) => {
      setWhatIfResult(data);
      haptics.light();
    },
    onError: () => {
      showToast(t('somethingWentWrong') || 'Something went wrong', 'error');
    },
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={16} color={colors.success} />;
      case 'declining':
        return <TrendingDown size={16} color={colors.danger} />;
      default:
        return <Minus size={16} color={colors.mutedForeground} />;
    }
  };

  const alerts = alertsData?.alerts || [];
  const unreadAlerts = alerts.filter((a) => !a.is_read);

  return (
    <PageScaffold
      scroll
      maxWidth={800}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingBottom: 16,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginEnd: 8 }}
          hitSlop={8}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Inter_700Bold',
              color: colors.foreground,
            }}
          >
            {t('realValueScreenTitle') || 'Real Value Protection'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
            {t('purchasingPower') || 'Purchasing power protection'}
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 9999,
            backgroundColor: colors.accent + '25',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={22} color={colors.accent} />
        </View>
      </View>

      {/* Shield Score - Full Card */}
      <View style={{ marginBottom: 20 }}>
        <RealValueCard />
      </View>

      {/* Purchasing Power Summary */}
      {wealthData && (
        <Card style={{ marginBottom: 20, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            {getTrendIcon(wealthData.shield_trend)}
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginStart: 8,
              }}
            >
              {t('purchasingPowerSummary') || 'Purchasing Power Summary'}
            </Text>
          </View>

          {wealthData.erosion_amount > 0 ? (
            <View
              style={{
                backgroundColor: colors.danger + '15',
                padding: 16,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: colors.danger,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {t('yourMoneyLost') || 'Your money lost'}{' '}
                {wealthData.erosion_amount.toFixed(2)} {wealthData.currency}{' '}
                {t('thisMonth') || 'this month'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.danger + 'CC', marginTop: 4 }}>
                {t('erosionRate') || 'Erosion rate'}: -{wealthData.erosion_rate.toFixed(2)}%
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.success + '15',
                padding: 16,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: colors.success,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {t('purchasingPowerProtected') || 'Your purchasing power is protected'}
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 12 }}>
            {wealthData.headline}
          </Text>
        </Card>
      )}

      {isOverviewPending && (
        <Card style={{ marginBottom: 20, padding: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </Card>
      )}

      {/* What-If Analysis */}
      <Card style={{ marginBottom: 20, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <ArrowRightLeft size={18} color={colors.accent} />
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              color: colors.foreground,
              marginStart: 8,
            }}
          >
            {t('whatIfAnalysis') || 'What-If Analysis'}
          </Text>
        </View>

        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 16 }}>
          {t('whatIfDesc') || 'See how currency changes would have affected your money over time.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 6 }}>
              {t('whatIfFrom') || 'From'}
            </Text>
            <Select
              value={fromCurrency}
              onValueChange={setFromCurrency}
              options={currencyOptions}
              placeholder={t('selectCurrency') || 'Select currency'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 6 }}>
              {t('whatIfTo') || 'To'}
            </Text>
            <Select
              value={toCurrency}
              onValueChange={setToCurrency}
              options={currencyOptions}
              placeholder={t('selectCurrency') || 'Select currency'}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('whatIfAmount') || 'Amount'}
              value={whatIfAmount}
              onChangeText={setWhatIfAmount}
              placeholder="1000"
              keyboardType="numeric"
              style={{ fontSize: 15, outlineStyle: 'none' } as any}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t('whatIfMonths') || 'Months ago'}
              value={whatIfMonths}
              onChangeText={setWhatIfMonths}
              placeholder="12"
              keyboardType="numeric"
              style={{ fontSize: 15, outlineStyle: 'none' } as any}
            />
          </View>
        </View>

        <Button
          onPress={() => whatIfMutation.mutate()}
          isLoading={whatIfMutation.isPending}
          disabled={!fromCurrency || !toCurrency || !whatIfAmount}
        >
          {t('whatIfAnalyze') || 'Analyze'}
        </Button>

        {whatIfResult && (
          <View
            style={{
              backgroundColor: colors.muted + '80',
              padding: 16,
              borderRadius: 10,
              marginTop: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {t('actualValue') || 'Actual Value'}
                </Text>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                  {whatIfResult.actual_value.toFixed(2)} {whatIfResult.to_currency}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {t('hypotheticalValue') || 'If kept in'} {whatIfResult.to_currency}
                </Text>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                  {whatIfResult.hypothetical_value.toFixed(2)} {whatIfResult.to_currency}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor:
                  whatIfResult.difference >= 0 ? colors.success + '15' : colors.danger + '15',
                padding: 10,
                borderRadius: 6,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  color: whatIfResult.difference >= 0 ? colors.success : colors.danger,
                }}
              >
                {whatIfResult.difference >= 0 ? '+' : ''}
                {whatIfResult.difference.toFixed(2)} ({whatIfResult.difference_percentage.toFixed(1)}%)
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 8 }}>
              {whatIfResult.explanation}
            </Text>
          </View>
        )}
      </Card>

      {/* Wealth Alerts */}
      <Card style={{ marginBottom: 20, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <AlertTriangle size={18} color={colors.warning} />
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              color: colors.foreground,
              marginStart: 8,
              flex: 1,
            }}
          >
            {t('wealthAlerts') || 'Wealth Alerts'}
          </Text>
          {unreadAlerts.length > 0 && (
            <View
              style={{
                backgroundColor: colors.danger,
                borderRadius: 9999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                minWidth: 22,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Inter_600SemiBold' }}>
                {unreadAlerts.length}
              </Text>
            </View>
          )}
        </View>

        {isAlertsPending ? (
          <ActivityIndicator color={colors.mutedForeground} />
        ) : alerts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <CheckCircle size={28} color={colors.success} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 14 }}>
              {t('noAlerts') || 'No alerts — your wealth is on track'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {alerts.slice(0, 10).map((alert) => (
              <View
                key={alert.id}
                style={{
                  backgroundColor: alert.is_read ? colors.muted + '40' : colors.warning + '15',
                  padding: 12,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: alert.is_read ? colors.border : colors.warning,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.mutedForeground,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {alert.alert_type.replace(/_/g, ' ')}
                      </Text>
                      {alert.currency_code && (
                        <View
                          style={{
                            backgroundColor: colors.secondary,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: colors.secondaryForeground }}>
                            {alert.currency_code}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
                      {alert.message}
                    </Text>
                  </View>
                  {!alert.is_read && (
                    <Pressable
                      onPress={() => markReadMutation.mutate(alert.id)}
                      style={{ padding: 6, marginStart: 8 }}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 12, color: colors.accent }}>
                        {t('markAsRead') || 'Read'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Currency Inflation Table */}
      {wealthData?.currency_breakdown && wealthData.currency_breakdown.length > 0 && (
        <Card style={{ marginBottom: 20, padding: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              color: colors.foreground,
              marginBottom: 16,
            }}
          >
            {t('inflationTable') || 'Currency Inflation Breakdown'}
          </Text>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              marginBottom: 8,
            }}
          >
            <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>
              {t('currency') || 'Currency'}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: 'right' }}>
              {t('inflation') || 'Inflation'}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: 'right' }}>
              {t('nominalBalance') || 'Nominal'}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: 'right' }}>
              {t('realBalance') || 'Real'}
            </Text>
          </View>

          {/* Rows */}
          {wealthData.currency_breakdown.map((item) => {
            const inflColor =
              item.annual_inflation > 10
                ? colors.danger
                : item.annual_inflation > 3
                  ? colors.warning
                  : colors.success;

            return (
              <View
                key={item.currency}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border + '40',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
                    {item.currency}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                    {item.share_percentage.toFixed(0)}% {t('exposure') || 'exposure'}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View
                    style={{
                      backgroundColor: inflColor + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: inflColor, fontFamily: 'Inter_500Medium' }}>
                      {item.annual_inflation.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: colors.mutedForeground,
                    textAlign: 'right',
                    textDecorationLine: 'line-through',
                  }}
                >
                  {item.nominal_balance.toFixed(2)}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: 'Inter_500Medium',
                    color: colors.foreground,
                    textAlign: 'right',
                  }}
                >
                  {item.real_balance.toFixed(2)}
                </Text>
              </View>
            );
          })}

          {/* Erosion Total */}
          {wealthData.erosion_amount > 0 && (
            <View
              style={{
                backgroundColor: colors.danger + '10',
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: colors.danger, fontFamily: 'Inter_500Medium' }}>
                {t('totalErosion') || 'Total erosion'}: -{wealthData.erosion_amount.toFixed(2)}{' '}
                {wealthData.currency}
              </Text>
            </View>
          )}
        </Card>
      )}
    </PageScaffold>
  );
}
