import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownUp } from 'lucide-react-native';
import { useConvert, useCurrencies } from '../../src/hooks';
import { useLanguage } from '../../src/context/LanguageContext';
import { formatNumber, getCurrencyDisplay } from '../../src/utils/format';

export default function ConverterScreen() {
  const { t } = useLanguage();
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1');

  const parsedAmount = parseFloat(amount) || 0;
  const { data: conversion, isPending, isError } = useConvert(fromCurrency, toCurrency, parsedAmount);
  const { data: currencies } = useCurrencies();

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const fromDisplay = getCurrencyDisplay(fromCurrency);
  const toDisplay = getCurrencyDisplay(toCurrency);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-6">
        <Text className="text-3xl font-bold text-foreground mb-2">
          {t('converterTitle')}
        </Text>
        <Text className="text-muted-foreground mb-8">
          {t('converterSubtitle')}
        </Text>

        {/* Amount Input */}
        <View className="bg-card p-4 rounded-xl mb-4">
          <Text className="text-sm text-muted-foreground mb-2">{t('amount')}</Text>
          <TextInput
            className="text-3xl font-bold text-foreground"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="rgb(148, 163, 184)"
          />
        </View>

        {/* From Currency */}
        <View className="bg-card p-4 rounded-xl mb-2">
          <Text className="text-sm text-muted-foreground mb-2">{t('from')}</Text>
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{fromDisplay.flag || '🌐'}</Text>
            <Text className="text-xl font-semibold text-foreground flex-1">
              {fromCurrency}
            </Text>
            <Text className="text-muted-foreground">{fromDisplay.symbol}</Text>
          </View>
        </View>

        {/* Swap Button */}
        <View className="items-center my-2">
          <Pressable
            onPress={swapCurrencies}
            className="bg-primary p-3 rounded-full"
          >
            <ArrowDownUp size={24} color="white" />
          </Pressable>
        </View>

        {/* To Currency */}
        <View className="bg-card p-4 rounded-xl mb-4">
          <Text className="text-sm text-muted-foreground mb-2">{t('to')}</Text>
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{toDisplay.flag || '🌐'}</Text>
            <Text className="text-xl font-semibold text-foreground flex-1">
              {toCurrency}
            </Text>
            <Text className="text-muted-foreground">{toDisplay.symbol}</Text>
          </View>
        </View>

        {/* Result */}
        <View className="bg-card p-6 rounded-xl border-2 border-accent">
          <Text className="text-sm text-muted-foreground mb-2">{t('result')}</Text>
          {isPending ? (
            <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          ) : isError ? (
            <Text className="text-danger">{t('conversionError')}</Text>
          ) : conversion ? (
            <>
              <Text className="text-4xl font-bold text-accent">
                {formatNumber(conversion.result)}
              </Text>
              <Text className="text-muted-foreground mt-2">
                1 {fromCurrency} = {formatNumber(conversion.rate, 6)} {toCurrency}
              </Text>
            </>
          ) : (
            <Text className="text-2xl text-muted-foreground">
              {t('enterAmount')}
            </Text>
          )}
        </View>

        {/* Popular Currencies */}
        <View className="mt-8">
          <Text className="text-lg font-semibold text-foreground mb-4">
            {t('popularCurrencies')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'IRR'].map((code) => {
              const display = getCurrencyDisplay(code);
              return (
                <Pressable
                  key={code}
                  onPress={() => {
                    if (code !== fromCurrency) {
                      setToCurrency(code);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    code === toCurrency ? 'bg-accent' : 'bg-card'
                  }`}
                >
                  <Text
                    className={
                      code === toCurrency ? 'text-accent-foreground font-semibold' : 'text-foreground'
                    }
                  >
                    {display.flag || '🌐'} {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
