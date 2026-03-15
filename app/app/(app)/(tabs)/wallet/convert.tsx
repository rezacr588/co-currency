import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from '../../../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { CurrencyConverter } from '../../../../src/components/features/CurrencyConverter';
import { useToast } from '../../../../src/components/ui/Toast';
import { Button } from '../../../../src/components/ui/Button';

export default function WalletConvertScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; from?: string; to?: string }>();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;
  const initialAmount = typeof params.amount === 'string' ? params.amount : '';
  const initialFromCurrency = typeof params.from === 'string' ? params.from.toUpperCase() : 'USD';
  const initialToCurrency = typeof params.to === 'string' ? params.to.toUpperCase() : 'EUR';

  const [converterState, setConverterState] = useState({
    amount: initialAmount,
    parsedAmount: 0,
    fromCurrency: initialFromCurrency,
    toCurrency: initialToCurrency,
  });
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const { data: balances, isPending: isLoadingBalances, isError: isBalancesError, refetch: refetchBalances } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  const balanceCurrencies = useMemo(
    () => balances?.balances.map((b) => b.currency) || [],
    [balances]
  );

  const availableCurrencies = balanceCurrencies.length > 0
    ? balanceCurrencies
    : ['USD', 'EUR'];

  const { parsedAmount, fromCurrency, toCurrency } = converterState;

  const mutation = useMutation({
    mutationFn: () =>
      api.wallet.convert({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: parsedAmount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balances'] });
      showToast(t('conversionSuccess') || 'Conversion completed', 'success');
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    },
  });

  const fromBalance = balances?.balances.find((b) => b.currency === fromCurrency);
  const hasInsufficientBalance = parsedAmount > 0 && (!fromBalance || fromBalance.balance < parsedAmount);

  const handleConvert = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    if (fromCurrency === toCurrency) {
      setError(t('selectDifferentCurrencies'));
      return;
    }
    if (hasInsufficientBalance) {
      setError(t('insufficientBalance'));
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginEnd: 8, cursor: 'pointer' }}
          hitSlop={12}
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('convertCurrency')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
      >
        {error ? (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </View>
        ) : null}

        {isBalancesError && (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.danger, marginBottom: 8 }}>{t('failedToLoadBalances') || 'Failed to load balances'}</Text>
            <Pressable onPress={() => refetchBalances()} style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', cursor: 'pointer' }}>
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        )}

        {(balances?.balances?.length ?? 0) === 0 && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
              {t('noWalletBalances') || 'No wallet balances yet'}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 12 }}>
              {t('noWalletBalancesDescription') || 'Add a transaction to create a wallet balance before converting.'}
            </Text>
            <Link href={'/transaction-create' as any} asChild>
              <Pressable style={{ cursor: 'pointer', backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{t('addTransaction') || 'Add Transaction'}</Text>
              </Pressable>
            </Link>
          </View>
        )}

        <CurrencyConverter
          variant="full"
          showQuickSelect={false}
          allowedCurrencyCodes={availableCurrencies}
          initialAmount={initialAmount}
          initialFromCurrency={initialFromCurrency}
          initialToCurrency={initialToCurrency}
          onStateChange={setConverterState}
        />

        {/* Balance Warning */}
        {isLoadingBalances && parsedAmount > 0 && (
          <View style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('loadingBalances') || 'Loading balances...'}</Text>
          </View>
        )}
        {hasInsufficientBalance && !isLoadingBalances && (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 12, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.danger, fontSize: 14 }}>
              {t('insufficientBalance') || 'Insufficient balance'}: {fromBalance ? `${fromBalance.balance} ${fromCurrency}` : `0 ${fromCurrency}`}
            </Text>
          </View>
        )}

        {/* Convert Button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleConvert}
          disabled={!parsedAmount || fromCurrency === toCurrency || hasInsufficientBalance || isLoadingBalances}
          isLoading={mutation.isPending}
          leftIcon={<Check size={20} color={colors.primaryForeground} />}
        >
          {t('convert')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
