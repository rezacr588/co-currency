import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { ArrowDownUp, ChevronDown, X, Search } from 'lucide-react-native';
import { useConvert, useCurrencies } from '../../hooks';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber, getCurrencyDisplay } from '../../utils/format';
import type { Currency } from '../../types/currency';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'IRR', 'TRY', 'CNY', 'INR', 'KRW'];

type ConverterVariant = 'full' | 'compact';

interface CurrencyConverterProps {
  variant?: ConverterVariant;
  initialFromCurrency?: string;
  initialToCurrency?: string;
  initialAmount?: string;
  showQuickSelect?: boolean;
  allowedCurrencyCodes?: string[];
  onStateChange?: (state: {
    amount: string;
    parsedAmount: number;
    fromCurrency: string;
    toCurrency: string;
  }) => void;
}

export function CurrencyConverter({
  variant = 'full',
  initialFromCurrency = 'USD',
  initialToCurrency = 'EUR',
  initialAmount = '1',
  showQuickSelect,
}: CurrencyConverterProps) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [fromCurrency, setFromCurrency] = useState(initialFromCurrency);
  const [toCurrency, setToCurrency] = useState(initialToCurrency);
  const [amount, setAmount] = useState(initialAmount);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const parsedAmount = parseFloat(amount) || 0;
  const { data: conversion, isPending, isError } = useConvert(fromCurrency, toCurrency, parsedAmount);
  const { data: currencies } = useCurrencies();

  const allowedCodes = useMemo(() => {
    if (!allowedCurrencyCodes || allowedCurrencyCodes.length === 0) return null;
    return Array.from(new Set(allowedCurrencyCodes));
  }, [allowedCurrencyCodes]);

  const currencyOptions: Currency[] = useMemo(() => {
    if (currencies && currencies.length > 0) {
      const list = allowedCodes ? currencies.filter((c) => allowedCodes.includes(c.code)) : currencies;
      return list;
    }
    if (allowedCodes && allowedCodes.length > 0) {
      return allowedCodes.map((code) => ({
        code,
        name: code,
        symbol: code,
        priority: 0,
      }));
    }
    return [];
  }, [currencies, allowedCodes]);

  const filteredCurrencies = useMemo(() => {
    const list = currencyOptions || [];
    if (!searchQuery) return list;
    const lower = searchQuery.toLowerCase();
    return list.filter((c: { code: string; name: string }) =>
      c.code.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
    );
  }, [currencyOptions, searchQuery]);

  const quickSelectList = useMemo(() => {
    if (!allowedCodes || allowedCodes.length === 0) return POPULAR_CURRENCIES;
    return POPULAR_CURRENCIES.filter((code) => allowedCodes.includes(code));
  }, [allowedCodes]);

  useEffect(() => {
    if (!allowedCodes || allowedCodes.length === 0) return;
    if (!allowedCodes.includes(fromCurrency)) {
      setFromCurrency(allowedCodes[0]);
    }
    if (!allowedCodes.includes(toCurrency) || toCurrency === fromCurrency) {
      const next = allowedCodes.find((code) => code !== fromCurrency) || allowedCodes[0];
      setToCurrency(next);
    }
  }, [allowedCodes, fromCurrency, toCurrency]);

  useEffect(() => {
    onStateChange?.({ amount, parsedAmount, fromCurrency, toCurrency });
  }, [amount, parsedAmount, fromCurrency, toCurrency, onStateChange]);

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleSelectCurrency = (code: string) => {
    if (showCurrencyPicker === 'from') {
      setFromCurrency(code);
    } else if (showCurrencyPicker === 'to') {
      setToCurrency(code);
    }
    setShowCurrencyPicker(null);
    setSearchQuery('');
  };

  const fromDisplay = getCurrencyDisplay(fromCurrency);
  const toDisplay = getCurrencyDisplay(toCurrency);
  const shouldShowQuickSelect = (showQuickSelect ?? variant === 'full') && quickSelectList.length > 0;

  return (
    <View>
      {variant === 'full' ? (
        <View>
          {/* Amount Input */}
          <View className="bg-card p-4 rounded-xl mb-4">
            <Text className="text-sm text-muted-foreground mb-2">{t('amount')}</Text>
            <TextInput
              className="text-3xl font-bold text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>

          {/* From Currency */}
          <Pressable
            onPress={() => setShowCurrencyPicker('from')}
            style={{ cursor: 'pointer' }}
            className="bg-card p-4 rounded-xl mb-2 active:bg-muted"
          >
            <Text className="text-sm text-muted-foreground mb-2">{t('from')}</Text>
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">{fromDisplay.flag || '🌐'}</Text>
              <Text className="text-xl font-semibold text-foreground flex-1">
                {fromCurrency}
              </Text>
              <Text className="text-muted-foreground mr-2">{fromDisplay.symbol}</Text>
              <ChevronDown size={20} color="rgb(148, 163, 184)" />
            </View>
          </Pressable>

          {/* Swap Button */}
          <View className="items-center my-2">
            <Pressable
              onPress={swapCurrencies}
              style={{ cursor: 'pointer' }}
              className="bg-primary p-3 rounded-full"
            >
              <ArrowDownUp size={24} color="#09090b" />
            </Pressable>
          </View>

          {/* To Currency */}
          <Pressable
            onPress={() => setShowCurrencyPicker('to')}
            style={{ cursor: 'pointer' }}
            className="bg-card p-4 rounded-xl mb-4 active:bg-muted"
          >
            <Text className="text-sm text-muted-foreground mb-2">{t('to')}</Text>
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">{toDisplay.flag || '🌐'}</Text>
              <Text className="text-xl font-semibold text-foreground flex-1">
                {toCurrency}
              </Text>
              <Text className="text-muted-foreground mr-2">{toDisplay.symbol}</Text>
              <ChevronDown size={20} color="rgb(148, 163, 184)" />
            </View>
          </Pressable>

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

          {/* Quick Select - Popular Currencies */}
          {shouldShowQuickSelect && (
            <View className="mt-8">
              <Text className="text-lg font-semibold text-foreground mb-4">
                {t('popularCurrencies')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {quickSelectList.map((code) => {
                  const display = getCurrencyDisplay(code);
                  const isFromSelected = code === fromCurrency;
                  const isToSelected = code === toCurrency;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => {
                        if (code !== fromCurrency) {
                          setToCurrency(code);
                        }
                      }}
                      onLongPress={() => {
                        if (code !== toCurrency) {
                          setFromCurrency(code);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      className={`px-4 py-2 rounded-lg ${
                        isToSelected ? 'bg-accent' : isFromSelected ? 'bg-primary/20' : 'bg-card'
                      }`}
                    >
                      <Text
                        className={
                          isToSelected
                            ? 'text-accent-foreground font-semibold'
                            : isFromSelected
                            ? 'text-primary font-semibold'
                            : 'text-foreground'
                        }
                      >
                        {display.flag || '🌐'} {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="text-xs text-muted-foreground mt-2">
                {t('tapToSelectTo') || 'Tap to select \"To\" currency, long-press for \"From\"'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 12, alignItems: 'center' }}>
            {/* Amount & From Currency */}
            <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
              <View className="bg-muted border border-border rounded-lg flex-row items-center">
                <TextInput
                  className="flex-1 p-3 text-lg font-semibold text-foreground"
                  style={{ outlineStyle: 'none' } as any}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor="#52525b"
                />
                <Pressable
                  onPress={() => setShowCurrencyPicker('from')}
                  style={{ cursor: 'pointer' }}
                  className="flex-row items-center bg-secondary px-3 py-2 rounded-md mr-2"
                >
                  <Text className="text-base mr-1">{fromDisplay.flag || '🌐'}</Text>
                  <Text className="font-medium text-foreground text-sm">{fromCurrency}</Text>
                  <ChevronDown size={14} color="#71717a" />
                </Pressable>
              </View>
            </View>

            {/* Swap Button */}
            <Pressable
              onPress={swapCurrencies}
              style={{ cursor: 'pointer' }}
              className="bg-secondary border border-border p-2 rounded-full"
            >
              <ArrowDownUp size={18} color="#a1a1aa" />
            </Pressable>

            {/* To Currency & Result */}
            <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
              <Pressable
                onPress={() => setShowCurrencyPicker('to')}
                style={{ cursor: 'pointer' }}
                className="bg-muted border border-border rounded-lg flex-row items-center p-3"
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#71717a" className="flex-1" />
                ) : (
                  <Text className="flex-1 text-lg font-semibold text-foreground">
                    {conversion ? formatNumber(conversion.result, 2) : '0.00'}
                  </Text>
                )}
                <View className="flex-row items-center bg-secondary px-3 py-2 rounded-md">
                  <Text className="text-base mr-1">{toDisplay.flag || '🌐'}</Text>
                  <Text className="font-medium text-foreground text-sm">{toCurrency}</Text>
                  <ChevronDown size={14} color="#71717a" />
                </View>
              </Pressable>
            </View>
          </View>

          {/* Rate info */}
          {conversion && (
            <Text className="text-muted-foreground text-xs mt-3 text-center">
              1 {fromCurrency} = {formatNumber(conversion.rate, 4)} {toCurrency}
            </Text>
          )}
        </View>
      )}

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCurrencyPicker(null);
          setSearchQuery('');
        }}
      >
        <Pressable
          onPress={() => {
            setShowCurrencyPicker(null);
            setSearchQuery('');
          }}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-background rounded-t-3xl"
            style={{
              maxHeight: '80%',
              minHeight: '50%',
            }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                {showCurrencyPicker === 'from'
                  ? t('selectFromCurrency') || 'Select From Currency'
                  : t('selectToCurrency') || 'Select To Currency'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowCurrencyPicker(null);
                  setSearchQuery('');
                }}
                style={{ cursor: 'pointer' }}
                className="p-2"
              >
                <X size={24} color="rgb(148, 163, 184)" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View className="p-4">
              <View className="bg-muted rounded-xl flex-row items-center px-4">
                <Search size={20} color="rgb(148, 163, 184)" />
                <TextInput
                  className="flex-1 p-3 text-foreground"
                  style={{ outlineStyle: 'none' } as any}
                  placeholder={t('searchCurrency') || 'Search currency...'}
                  placeholderTextColor="rgb(148, 163, 184)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
            </View>

            {/* Popular Currencies in Modal */}
            {!searchQuery && (
              <View className="px-4 pb-2">
                <Text className="text-sm text-muted-foreground mb-2">
                  {t('popular') || 'Popular'}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {POPULAR_CURRENCIES.slice(0, 8).map((code) => {
                    const display = getCurrencyDisplay(code);
                    const isSelected = showCurrencyPicker === 'from' ? code === fromCurrency : code === toCurrency;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => handleSelectCurrency(code)}
                        style={{ cursor: 'pointer' }}
                        className={`px-3 py-2 rounded-lg ${isSelected ? 'bg-accent' : 'bg-card'}`}
                      >
                        <Text
                          className={isSelected ? 'text-accent-foreground font-semibold' : 'text-foreground'}
                        >
                          {display.flag || '🌐'} {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Currency List */}
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              ListHeaderComponent={
                <Text className="text-sm text-muted-foreground mb-2 mt-2">
                  {searchQuery ? t('searchResults') || 'Search Results' : t('allCurrencies') || 'All Currencies'}
                </Text>
              }
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <Text className="text-muted-foreground">
                    {t('noCurrencyFound') || 'No currency found'}
                  </Text>
                </View>
              }
              renderItem={({ item: currency }) => {
                const display = getCurrencyDisplay(currency.code);
                const isSelected = showCurrencyPicker === 'from'
                  ? currency.code === fromCurrency
                  : currency.code === toCurrency;
                return (
                  <Pressable
                    key={currency.code}
                    onPress={() => handleSelectCurrency(currency.code)}
                    style={{ cursor: 'pointer' }}
                    className={`flex-row items-center p-3 rounded-xl mb-1 ${
                      isSelected ? 'bg-accent' : 'active:bg-muted'
                    }`}
                  >
                    <Text className="text-2xl mr-3">{display.flag || '🌐'}</Text>
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${
                          isSelected ? 'text-accent-foreground' : 'text-foreground'
                        }`}
                      >
                        {currency.code}
                      </Text>
                      <Text
                        className={`text-sm ${
                          isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {currency.name}
                      </Text>
                    </View>
                    <Text className={isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}>
                      {display.symbol}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
