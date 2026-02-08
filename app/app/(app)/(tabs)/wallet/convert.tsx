import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme, useColors } from '../../../../src/context/ThemeContext';
import { CurrencyConverter } from '../../../../src/components/features/CurrencyConverter';
import { useToast } from '../../../../src/components/ui/Toast';
import { Button } from '../../../../src/components/ui/Button';

export default function WalletConvertScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useColors();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;
  const iconColor = colors.foreground;

  const [converterState, setConverterState] = useState({
    amount: '',
    parsedAmount: 0,
    fromCurrency: 'USD',
    toCurrency: 'EUR',
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
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-border" style={{ maxWidth: 800, width: '100%', alignSelf: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          className="p-2 mr-2"
          hitSlop={12}
          style={{ cursor: 'pointer' }}
        >
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t('convertCurrency')}</Text>
      </View>

      <ScrollView
        className="flex-1"
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
          <View className="bg-danger-muted border border-danger/20 p-4 rounded-xl mb-4">
            <Text className="text-danger">{error}</Text>
          </View>
        ) : null}

        {isBalancesError && (
          <View className="bg-danger-muted border border-danger/20 p-4 rounded-xl mb-4">
            <Text className="text-danger mb-2">{t('failedToLoadBalances') || 'Failed to load balances'}</Text>
            <Pressable onPress={() => refetchBalances()} className="bg-danger/20 px-4 py-2 rounded-lg self-start" style={{ cursor: 'pointer' }}>
              <Text className="text-danger font-medium">{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        )}

        {(balances?.balances?.length ?? 0) === 0 && (
          <View className="bg-card border border-border p-4 rounded-xl mb-6">
            <Text className="text-foreground font-medium mb-2">
              {t('noWalletBalances') || 'No wallet balances yet'}
            </Text>
            <Text className="text-muted-foreground text-sm mb-3">
              {t('noWalletBalancesDescription') || 'Add a transaction to create a wallet balance before converting.'}
            </Text>
            <Link href="/(app)/(tabs)/add" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-4 py-2 rounded-lg self-start">
                <Text className="text-accent-foreground font-medium text-sm">{t('addTransaction') || 'Add Transaction'}</Text>
              </Pressable>
            </Link>
          </View>
        )}

        <CurrencyConverter
          variant="full"
          showQuickSelect={false}
          allowedCurrencyCodes={availableCurrencies}
          initialAmount=""
          onStateChange={setConverterState}
        />

        {/* Balance Warning */}
        {isLoadingBalances && parsedAmount > 0 && (
          <View className="bg-muted border border-border p-3 rounded-xl mb-4">
            <Text className="text-muted-foreground text-sm">{t('loadingBalances') || 'Loading balances...'}</Text>
          </View>
        )}
        {hasInsufficientBalance && !isLoadingBalances && (
          <View className="bg-danger-muted border border-danger/20 p-3 rounded-xl mb-4">
            <Text className="text-danger text-sm">
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
