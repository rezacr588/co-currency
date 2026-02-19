import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ArrowRight, AlertTriangle } from 'lucide-react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { useCurrencies, useHistorical } from '../../src/hooks';
import { formatRate, formatDate } from '../../src/utils/format';
import { CURRENCY_FLAGS } from '../../src/utils/constants';
import { Card, Select } from '../../src/components/ui';

interface HistoricalCardProps {
  date: string;
  baseCurrency: string;
  targetCurrency: string;
}

function HistoricalCard({ date, baseCurrency, targetCurrency }: HistoricalCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { data, isPending, error } = useHistorical(date, baseCurrency);

  const rate = data?.rates?.find((r: { code: string; rate: number }) => r.code === targetCurrency);
  const flag = CURRENCY_FLAGS[targetCurrency] || '';

  if (error) {
    return (
      <View style={{ padding: 16, backgroundColor: colors.danger + '1a', borderRadius: 12, borderWidth: 1, borderColor: colors.danger + '33' }}>
        <Text style={{ color: colors.danger, fontSize: 14 }}>Failed to load</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.primary }} />
        <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.mutedForeground, textTransform: 'uppercase' }}>
          {formatDate(date)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>{flag}</Text>
          <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground }}>{targetCurrency}</Text>
        </View>
        {isPending ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.primary }}>
            {rate ? formatRate(rate.rate) : 'N/A'}
          </Text>
        )}
      </View>
      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>
        1 {baseCurrency} = {rate ? formatRate(rate.rate) : '...'} {targetCurrency}
      </Text>
    </View>
  );
}

export default function HistoricalScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const colors = theme.colors;

  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');

  const { data: currencies } = useCurrencies();

  const isLargeScreen = width > 768;
  const numColumns = width > 1024 ? 4 : width > 600 ? 2 : 1;

  const getDateDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  const allDates = [
    getDateDaysAgo(1),
    getDateDaysAgo(7),
    getDateDaysAgo(30),
    getDateDaysAgo(90),
  ];

  const isSameCurrency = useMemo(
    () => baseCurrency === targetCurrency,
    [baseCurrency, targetCurrency]
  );

  const currencyOptions =
    currencies?.map((c: { code: string; name: string }) => ({
      label: c.code,
      value: c.code,
    })) || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer', padding: 8, marginRight: 8 }}
          >
            <ChevronLeft size={24} color={colors.placeholder} />
          </Pressable>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('historicalRates') || 'Historical Rates'}
          </Text>
        </View>

        {/* Currency Selectors */}
        <Card style={{ padding: 16, marginBottom: 24 }}>
          <View
            style={
              isLargeScreen
                ? { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                : { gap: 16 }
            }
          >
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 8 }}>
              {t('selectCurrencies') || 'Select Currencies'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ minWidth: 100 }}>
                <Select
                  value={baseCurrency}
                  onValueChange={setBaseCurrency}
                  options={currencyOptions}
                  placeholder="From"
                />
              </View>
              <ArrowRight size={20} color={colors.placeholder} />
              <View style={{ minWidth: 100 }}>
                <Select
                  value={targetCurrency}
                  onValueChange={setTargetCurrency}
                  options={currencyOptions}
                  placeholder="To"
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Same Currency Warning */}
        {isSameCurrency ? (
          <View style={{ backgroundColor: colors.warning + '1a', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.warning + '33', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} color={colors.warning} />
            <Text style={{ color: colors.warning, flex: 1 }}>
              {t('sameCurrency') || 'Please select different currencies to compare rates'}
            </Text>
          </View>
        ) : (
          /* Historical Rate Cards */
          <View>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>
              {t('rateHistory') || 'Rate History'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {allDates.map((date) => (
                <View
                  key={date}
                  style={{
                    width: numColumns === 1 ? '100%' : `${100 / numColumns - 2}%`,
                  }}
                >
                  <HistoricalCard
                    date={date}
                    baseCurrency={baseCurrency}
                    targetCurrency={targetCurrency}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
