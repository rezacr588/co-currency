import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowDownUp, Check } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { formatNumber, getCurrencyDisplay } from '../../../../src/utils/format';
import { useConvert } from '../../../../src/hooks';

export default function WalletConvertScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const { data: balances } = useQuery({
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

  const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const { data: conversion, isPending: isConverting } = useConvert(fromCurrency, toCurrency, parsedAmount);

  useEffect(() => {
    if (availableCurrencies.length === 0) return;
    if (!availableCurrencies.includes(fromCurrency)) {
      setFromCurrency(availableCurrencies[0]);
    }
    if (!availableCurrencies.includes(toCurrency) || toCurrency === fromCurrency) {
      const next = availableCurrencies.find((code) => code !== fromCurrency) || availableCurrencies[0];
      setToCurrency(next);
    }
  }, [availableCurrencies, fromCurrency, toCurrency]);

  const mutation = useMutation({
    mutationFn: () =>
      api.wallet.convert({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: parsedAmount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    },
  });

  const handleConvert = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    if (fromCurrency === toCurrency) {
      setError(t('selectDifferentCurrencies'));
      return;
    }
    setError('');
    mutation.mutate();
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const fromDisplay = getCurrencyDisplay(fromCurrency);
  const toDisplay = getCurrencyDisplay(toCurrency);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-border" style={{ maxWidth: 800, width: '100%', alignSelf: 'center' }}>
        <Pressable onPress={() => router.back()} className="p-2 mr-2" style={{ cursor: 'pointer' }}>
          <ArrowLeft size={24} color="rgb(248, 250, 252)" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t('convertCurrency')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {error ? (
          <View className="bg-danger-muted border border-danger/20 p-4 rounded-xl mb-4">
            <Text className="text-danger">{error}</Text>
          </View>
        ) : null}

        {(balances?.balances?.length ?? 0) === 0 && (
          <View className="bg-card border border-border p-4 rounded-xl mb-6">
            <Text className="text-foreground font-medium mb-2">
              {t('noWalletBalances') || 'No wallet balances yet'}
            </Text>
            <Text className="text-muted-foreground text-sm mb-3">
              Add a transaction to create a wallet balance before converting.
            </Text>
            <Link href="/(app)/(tabs)/add" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-4 py-2 rounded-lg self-start">
                <Text className="text-accent-foreground font-medium text-sm">{t('addTransaction') || 'Add Transaction'}</Text>
              </Pressable>
            </Link>
          </View>
        )}

        {/* Amount */}
        <View className="mb-6">
          <Text className="text-muted-foreground mb-2">{t('amount')}</Text>
          <View className="bg-card rounded-xl flex-row items-center px-4">
            <Text className="text-2xl text-muted-foreground mr-2">{fromDisplay.symbol}</Text>
            <TextInput
              className="flex-1 p-4 text-2xl font-bold text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>
        </View>

        {/* From Currency */}
        <View className="mb-4">
          <Text className="text-muted-foreground mb-2">{t('from')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableCurrencies.map((code) => {
              const display = getCurrencyDisplay(code);
              const balance = balances?.balances.find((b) => b.currency === code);
              return (
                <Pressable
                  key={code}
                  onPress={() => setFromCurrency(code)}
                  className={`px-4 py-3 rounded-xl ${
                    fromCurrency === code ? 'bg-accent' : 'bg-card'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                    <Text
                      className={`font-semibold ${
                        fromCurrency === code ? 'text-accent-foreground' : 'text-foreground'
                      }`}
                    >
                      {display.flag || '🌐'} {code}
                    </Text>
                  <Text
                    className={`text-sm ${
                      fromCurrency === code ? 'text-accent-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {formatNumber(balance?.balance || 0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Swap Button */}
        <View className="items-center my-4">
          <Pressable onPress={swapCurrencies} className="bg-primary p-3 rounded-full" style={{ cursor: 'pointer' }}>
            <ArrowDownUp size={24} color="#09090b" />
          </Pressable>
        </View>

        {/* To Currency */}
        <View className="mb-6">
          <Text className="text-muted-foreground mb-2">{t('to')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableCurrencies.map((code) => {
              const display = getCurrencyDisplay(code);
              return (
                <Pressable
                  key={code}
                  onPress={() => setToCurrency(code)}
                  className={`px-4 py-3 rounded-xl ${
                    toCurrency === code ? 'bg-accent' : 'bg-card'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <Text
                    className={`font-semibold ${
                      toCurrency === code ? 'text-accent-foreground' : 'text-foreground'
                    }`}
                  >
                    {display.flag || '🌐'} {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Conversion Preview */}
        <View className="bg-card border border-border p-4 rounded-xl mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-muted-foreground text-sm">{t('estimatedResult') || 'Estimated result'}</Text>
            {isConverting ? (
              <ActivityIndicator size="small" color="#71717a" />
            ) : conversion ? (
              <Text className="text-xs text-muted-foreground">
                {formatNumber(conversion.rate, 4)} {toCurrency}/{fromCurrency}
              </Text>
            ) : null}
          </View>
          <Text className="text-2xl font-bold text-foreground">
            {conversion ? formatNumber(conversion.result, 2) : '0.00'} {toCurrency}
          </Text>
        </View>

        {/* Convert Button */}
        <Pressable
          onPress={handleConvert}
          disabled={mutation.isPending || !parsedAmount || fromCurrency === toCurrency}
          className={`bg-primary p-4 rounded-xl flex-row items-center justify-center ${
            mutation.isPending || !parsedAmount || fromCurrency === toCurrency ? 'opacity-50' : ''
          }`}
          style={{ cursor: 'pointer' }}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#09090b" />
          ) : (
            <>
              <Check size={20} color="#09090b" />
              <Text className="text-primary-foreground font-semibold text-lg ml-2">{t('convert')}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
