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
  const { data, isPending, error } = useHistorical(date, baseCurrency);

  const rate = data?.rates?.find((r: { code: string; rate: number }) => r.code === targetCurrency);
  const flag = CURRENCY_FLAGS[targetCurrency] || '';

  if (error) {
    return (
      <View className="p-4 bg-danger/10 rounded-xl border border-danger/20">
        <Text className="text-danger text-sm">Failed to load</Text>
      </View>
    );
  }

  return (
    <View className="p-4 bg-card rounded-xl border border-border">
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-2 h-2 rounded-full bg-primary" />
        <Text className="text-xs font-medium text-muted-foreground uppercase">
          {formatDate(date)}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl">{flag}</Text>
          <Text className="font-medium text-foreground">{targetCurrency}</Text>
        </View>
        {isPending ? (
          <ActivityIndicator size="small" color="rgb(212, 175, 55)" />
        ) : (
          <Text className="font-mono text-lg font-semibold text-primary">
            {rate ? formatRate(rate.rate) : 'N/A'}
          </Text>
        )}
      </View>
      <Text className="text-xs text-muted-foreground mt-2">
        1 {baseCurrency} = {rate ? formatRate(rate.rate) : '...'} {targetCurrency}
      </Text>
    </View>
  );
}

export default function HistoricalScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();

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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            style={{ cursor: 'pointer' }}
            className="p-2 mr-2"
          >
            <ChevronLeft size={24} color="rgb(148, 163, 184)" />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">
            {t('historicalRates') || 'Historical Rates'}
          </Text>
        </View>

        {/* Currency Selectors */}
        <Card className="p-4 mb-6">
          <View
            className={`${
              isLargeScreen ? 'flex-row items-center justify-between' : 'gap-4'
            }`}
          >
            <Text className="text-lg font-semibold text-foreground mb-2">
              {t('selectCurrencies') || 'Select Currencies'}
            </Text>
            <View className="flex-row items-center gap-2 flex-wrap">
              <View style={{ minWidth: 100 }}>
                <Select
                  value={baseCurrency}
                  onValueChange={setBaseCurrency}
                  options={currencyOptions}
                  placeholder="From"
                />
              </View>
              <ArrowRight size={20} color="rgb(148, 163, 184)" />
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
          <View className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 flex-row items-center gap-3">
            <AlertTriangle size={20} color="rgb(251, 191, 36)" />
            <Text className="text-amber-600 flex-1">
              {t('sameCurrency') || 'Please select different currencies to compare rates'}
            </Text>
          </View>
        ) : (
          /* Historical Rate Cards */
          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">
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
