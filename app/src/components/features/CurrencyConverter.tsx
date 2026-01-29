import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { ArrowDownUp, ChevronDown, X, Search } from 'lucide-react-native';
import { useConvert, useCurrencies } from '../../hooks';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber, getCurrencyDisplay } from '../../utils/format';
import type { Currency } from '../../types/currency';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'IRR', 'TRY', 'CNY'];

interface CurrencyConverterProps {
  variant?: 'full' | 'compact';
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
  showQuickSelect = true,
  allowedCurrencyCodes,
  onStateChange,
}: CurrencyConverterProps) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [fromCurrency, setFromCurrency] = useState(initialFromCurrency);
  const [toCurrency, setToCurrency] = useState(initialToCurrency);
  const [amount, setAmount] = useState(initialAmount);
  const [pickerMode, setPickerMode] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Parse amount
  const parsedAmount = useMemo(() => {
    if (!amount || amount.trim() === '') return 0;
    const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }, [amount]);

  const { data: conversion, isPending, isError } = useConvert(fromCurrency, toCurrency, parsedAmount);
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();

  // Filter currencies
  const availableCurrencies = useMemo(() => {
    let list = currencies || [];
    if (allowedCurrencyCodes && allowedCurrencyCodes.length > 0) {
      list = list.filter((c) => allowedCurrencyCodes.includes(c.code));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currencies, allowedCurrencyCodes, searchQuery]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({ amount, parsedAmount, fromCurrency, toCurrency });
  }, [amount, parsedAmount, fromCurrency, toCurrency, onStateChange]);

  // Handle amount input
  const handleAmountChange = useCallback((text: string) => {
    // Only allow numbers and one decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
    }
    setAmount(cleaned);
  }, []);

  // Swap currencies
  const handleSwap = useCallback(() => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  }, [fromCurrency, toCurrency]);

  // Select currency
  const handleSelectCurrency = useCallback((code: string) => {
    if (pickerMode === 'from') {
      setFromCurrency(code);
    } else {
      setToCurrency(code);
    }
    setPickerMode(null);
    setSearchQuery('');
  }, [pickerMode]);

  // Close picker
  const closePicker = useCallback(() => {
    setPickerMode(null);
    setSearchQuery('');
  }, []);

  const fromDisplay = getCurrencyDisplay(fromCurrency);
  const toDisplay = getCurrencyDisplay(toCurrency);
  const isSameCurrency = fromCurrency === toCurrency;

  // Currency Selector Button
  const CurrencyButton = ({ type, currency, display }: { type: 'from' | 'to'; currency: string; display: any }) => (
    <TouchableOpacity
      onPress={() => setPickerMode(type)}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#18181b',
        borderWidth: 1,
        borderColor: '#27272a',
        borderRadius: 12,
        padding: 16,
        marginBottom: type === 'from' ? 8 : 16,
      }}
    >
      <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
        {type === 'from' ? (t('from') || 'From') : (t('to') || 'To')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, marginRight: 8 }}>{display.flag || '🌐'}</Text>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#fafafa', flex: 1 }}>
          {currency}
        </Text>
        <Text style={{ color: '#71717a', marginRight: 8 }}>{display.symbol}</Text>
        <ChevronDown size={20} color="#71717a" />
      </View>
    </TouchableOpacity>
  );

  // Currency Picker Modal
  const CurrencyPickerModal = () => (
    <Modal
      visible={pickerMode !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closePicker}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#09090b' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#27272a',
        }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fafafa' }}>
            {pickerMode === 'from' ? 'Select From Currency' : 'Select To Currency'}
          </Text>
          <TouchableOpacity onPress={closePicker} style={{ padding: 8 }}>
            <X size={24} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ padding: 16 }}>
          <View style={{
            backgroundColor: '#18181b',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
          }}>
            <Search size={20} color="#71717a" />
            <TextInput
              style={{
                flex: 1,
                padding: 12,
                color: '#fafafa',
                fontSize: 16,
              }}
              placeholder="Search currency..."
              placeholderTextColor="#71717a"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Popular Currencies */}
        {!searchQuery && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#71717a', marginBottom: 8 }}>Popular</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_CURRENCIES.map((code) => {
                const display = getCurrencyDisplay(code);
                const isSelected = pickerMode === 'from' ? code === fromCurrency : code === toCurrency;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => handleSelectCurrency(code)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: isSelected ? '#d4af37' : '#18181b',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{
                      color: isSelected ? '#09090b' : '#fafafa',
                      fontWeight: isSelected ? '600' : '400',
                    }}>
                      {display.flag || '🌐'} {code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* All Currencies */}
        <Text style={{ fontSize: 12, color: '#71717a', marginLeft: 16, marginTop: 8, marginBottom: 4 }}>
          {searchQuery ? 'Search Results' : 'All Currencies'}
        </Text>

        {currenciesLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#d4af37" />
          </View>
        ) : (
          <FlatList
            data={availableCurrencies}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#71717a' }}>No currencies found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const display = getCurrencyDisplay(item.code);
              const isSelected = pickerMode === 'from'
                ? item.code === fromCurrency
                : item.code === toCurrency;
              return (
                <TouchableOpacity
                  onPress={() => handleSelectCurrency(item.code)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    marginBottom: 4,
                    borderRadius: 12,
                    backgroundColor: isSelected ? '#d4af37' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{display.flag || '🌐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontWeight: '600',
                      color: isSelected ? '#09090b' : '#fafafa',
                      fontSize: 16,
                    }}>
                      {item.code}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      color: isSelected ? '#09090b' : '#71717a',
                    }}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={{ color: isSelected ? '#09090b' : '#71717a' }}>
                    {display.symbol}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  // FULL VARIANT
  if (variant === 'full') {
    return (
      <View>
        {/* Amount Input */}
        <View style={{
          backgroundColor: '#18181b',
          borderWidth: 1,
          borderColor: '#27272a',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
            {t('amount') || 'Amount'}
          </Text>
          <TextInput
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#fafafa',
              minHeight: 44,
            }}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#52525b"
            selectTextOnFocus
          />
        </View>

        {/* From Currency */}
        <CurrencyButton type="from" currency={fromCurrency} display={fromDisplay} />

        {/* Swap Button */}
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <TouchableOpacity
            onPress={handleSwap}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#d4af37',
              padding: 12,
              borderRadius: 24,
            }}
          >
            <ArrowDownUp size={24} color="#09090b" />
          </TouchableOpacity>
        </View>

        {/* To Currency */}
        <CurrencyButton type="to" currency={toCurrency} display={toDisplay} />

        {/* Result */}
        <View style={{
          backgroundColor: '#18181b',
          borderWidth: 2,
          borderColor: '#d4af37',
          borderRadius: 12,
          padding: 24,
        }}>
          <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
            {t('result') || 'Result'}
          </Text>

          {isSameCurrency ? (
            <Text style={{ fontSize: 18, color: '#f59e0b' }}>
              Select different currencies
            </Text>
          ) : isPending ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator size="large" color="#d4af37" />
              <Text style={{ color: '#71717a', marginTop: 8 }}>Calculating...</Text>
            </View>
          ) : isError ? (
            <Text style={{ fontSize: 18, color: '#ef4444' }}>
              Failed to get rate. Try again.
            </Text>
          ) : conversion ? (
            <>
              <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#d4af37' }}>
                {formatNumber(conversion.result, 2)} {toCurrency}
              </Text>
              <Text style={{ color: '#71717a', marginTop: 8 }}>
                1 {fromCurrency} = {formatNumber(conversion.rate, 6)} {toCurrency}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 24, color: '#52525b' }}>
              Enter an amount
            </Text>
          )}
        </View>

        {/* Quick Select */}
        {showQuickSelect && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fafafa', marginBottom: 12 }}>
              {t('popularCurrencies') || 'Popular Currencies'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_CURRENCIES.map((code) => {
                const display = getCurrencyDisplay(code);
                const isFrom = code === fromCurrency;
                const isTo = code === toCurrency;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => {
                      if (code !== fromCurrency) setToCurrency(code);
                    }}
                    onLongPress={() => {
                      if (code !== toCurrency) setFromCurrency(code);
                    }}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: isTo ? '#d4af37' : isFrom ? 'rgba(212, 175, 55, 0.2)' : '#18181b',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{
                      color: isTo ? '#09090b' : isFrom ? '#d4af37' : '#fafafa',
                      fontWeight: (isTo || isFrom) ? '600' : '400',
                    }}>
                      {display.flag || '🌐'} {code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: '#52525b', marginTop: 8 }}>
              Tap to set "To", long-press for "From"
            </Text>
          </View>
        )}

        <CurrencyPickerModal />
      </View>
    );
  }

  // COMPACT VARIANT
  return (
    <View>
      <View style={{
        flexDirection: isTablet ? 'row' : 'column',
        gap: 12,
        alignItems: 'center'
      }}>
        {/* Amount & From */}
        <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
          <View style={{
            backgroundColor: '#18181b',
            borderWidth: 1,
            borderColor: '#27272a',
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <TextInput
              style={{
                flex: 1,
                padding: 12,
                fontSize: 18,
                fontWeight: '600',
                color: '#fafafa',
              }}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#52525b"
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => setPickerMode('from')}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#27272a',
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 6,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 4 }}>{fromDisplay.flag || '🌐'}</Text>
              <Text style={{ fontWeight: '500', color: '#fafafa', fontSize: 14 }}>{fromCurrency}</Text>
              <ChevronDown size={14} color="#71717a" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap */}
        <TouchableOpacity
          onPress={handleSwap}
          activeOpacity={0.7}
          style={{
            backgroundColor: '#27272a',
            padding: 8,
            borderRadius: 20,
          }}
        >
          <ArrowDownUp size={18} color="#a1a1aa" />
        </TouchableOpacity>

        {/* Result & To */}
        <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
          <TouchableOpacity
            onPress={() => setPickerMode('to')}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#18181b',
              borderWidth: 1,
              borderColor: '#27272a',
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#d4af37" style={{ flex: 1 }} />
            ) : isError ? (
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: '#ef4444' }}>Error</Text>
            ) : isSameCurrency ? (
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: '#f59e0b' }}>Same</Text>
            ) : (
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: '#fafafa' }}>
                {conversion ? formatNumber(conversion.result, 2) : '0.00'}
              </Text>
            )}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#27272a',
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 6,
            }}>
              <Text style={{ fontSize: 16, marginRight: 4 }}>{toDisplay.flag || '🌐'}</Text>
              <Text style={{ fontWeight: '500', color: '#fafafa', fontSize: 14 }}>{toCurrency}</Text>
              <ChevronDown size={14} color="#71717a" style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rate info */}
      {conversion && !isSameCurrency && (
        <Text style={{ color: '#71717a', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
          1 {fromCurrency} = {formatNumber(conversion.rate, 4)} {toCurrency}
        </Text>
      )}

      <CurrencyPickerModal />
    </View>
  );
}
