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
import { useColors } from '../../context/ThemeContext';
import { formatNumber, getCurrencyDisplay } from '../../utils/format';
import type { Currency } from '../../types/currency';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'IRR', 'TRY', 'CNY'];

// Font families for consistent typography
const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

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
  initialFromCurrency = 'TRY',
  initialToCurrency = 'USD',
  initialAmount = '1',
  showQuickSelect = true,
  allowedCurrencyCodes,
  onStateChange,
}: CurrencyConverterProps) {
  const { t } = useLanguage();
  const colors = useColors();
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
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: type === 'from' ? 8 : 16,
      }}
    >
      <Text style={{ fontSize: 12, color: colors.secondaryForeground, marginBottom: 8, fontFamily: fonts.regular }}>
        {type === 'from' ? (t('from') || 'From') : (t('to') || 'To')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, marginRight: 8 }}>{display.flag || '🌐'}</Text>
        <Text style={{ fontSize: 20, color: colors.foreground, flex: 1, fontFamily: fonts.semibold }}>
          {currency}
        </Text>
        <Text style={{ color: colors.mutedForeground, marginRight: 8, fontFamily: fonts.regular }}>{display.symbol}</Text>
        <ChevronDown size={20} color={colors.mutedForeground} />
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Text style={{ fontSize: 20, color: colors.foreground, fontFamily: fonts.bold }}>
            {pickerMode === 'from' ? 'Select From Currency' : 'Select To Currency'}
          </Text>
          <TouchableOpacity onPress={closePicker} style={{ padding: 8 }}>
            <X size={24} color={colors.secondaryForeground} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ padding: 16 }}>
          <View style={{
            backgroundColor: colors.muted,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
          }}>
            <Search size={20} color={colors.mutedForeground} />
            <TextInput
              style={{
                flex: 1,
                padding: 12,
                color: colors.foreground,
                fontSize: 16,
                fontFamily: fonts.regular,
              }}
              placeholder="Search currency..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Popular Currencies */}
        {!searchQuery && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8, fontFamily: fonts.medium }}>Popular</Text>
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
                      backgroundColor: isSelected ? colors.accent : colors.muted,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{
                      color: isSelected ? colors.primaryForeground : colors.foreground,
                      fontFamily: isSelected ? fonts.semibold : fonts.regular,
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
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 16, marginTop: 8, marginBottom: 4, fontFamily: fonts.medium }}>
          {searchQuery ? 'Search Results' : 'All Currencies'}
        </Text>

        {currenciesLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={availableCurrencies}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.regular }}>No currencies found</Text>
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
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{display.flag || '🌐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: isSelected ? colors.primaryForeground : colors.foreground,
                      fontSize: 16,
                      fontFamily: fonts.semibold,
                    }}>
                      {item.code}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      color: isSelected ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: fonts.regular,
                    }}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontFamily: fonts.regular }}>
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
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 12, color: colors.secondaryForeground, marginBottom: 8, fontFamily: fonts.regular }}>
            {t('amount') || 'Amount'}
          </Text>
          <TextInput
            style={{
              fontSize: 32,
              color: colors.foreground,
              minHeight: 44,
              fontFamily: fonts.bold,
            }}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.subtleForeground}
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
              backgroundColor: colors.accent,
              padding: 12,
              borderRadius: 24,
            }}
          >
            <ArrowDownUp size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {/* To Currency */}
        <CurrencyButton type="to" currency={toCurrency} display={toDisplay} />

        {/* Result */}
        <View style={{
          backgroundColor: colors.muted,
          borderWidth: 2,
          borderColor: colors.accent,
          borderRadius: 12,
          padding: 24,
        }}>
          <Text style={{ fontSize: 12, color: colors.secondaryForeground, marginBottom: 8, fontFamily: fonts.regular }}>
            {t('result') || 'Result'}
          </Text>

          {isSameCurrency ? (
            <Text style={{ fontSize: 18, color: colors.warning, fontFamily: fonts.medium }}>
              Select different currencies
            </Text>
          ) : isError ? (
            <Text style={{ fontSize: 18, color: colors.danger, fontFamily: fonts.medium }}>
              Failed to get rate. Try again.
            </Text>
          ) : conversion ? (
            <>
              <Text style={{ fontSize: 36, color: colors.accent, fontFamily: fonts.bold }}>
                {formatNumber(conversion.result, 2)} {toCurrency}
              </Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: fonts.regular }}>
                1 {fromCurrency} = {formatNumber(conversion.rate, 6)} {toCurrency}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 24, color: colors.subtleForeground, fontFamily: fonts.medium }}>
              Enter an amount
            </Text>
          )}
        </View>

        {/* Quick Select */}
        {showQuickSelect && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, color: colors.foreground, marginBottom: 12, fontFamily: fonts.semibold }}>
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
                      backgroundColor: isTo ? colors.accent : isFrom ? `${colors.accent}33` : colors.muted,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{
                      color: isTo ? colors.primaryForeground : isFrom ? colors.accent : colors.foreground,
                      fontFamily: (isTo || isFrom) ? fonts.semibold : fonts.regular,
                    }}>
                      {display.flag || '🌐'} {code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: colors.subtleForeground, marginTop: 8, fontFamily: fonts.regular }}>
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
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <TextInput
              style={{
                flex: 1,
                padding: 12,
                fontSize: 18,
                color: colors.foreground,
                fontFamily: fonts.semibold,
              }}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.subtleForeground}
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => setPickerMode('from')}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.secondary,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 6,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 4 }}>{fromDisplay.flag || '🌐'}</Text>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: fonts.medium }}>{fromCurrency}</Text>
              <ChevronDown size={14} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap */}
        <TouchableOpacity
          onPress={handleSwap}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.secondary,
            padding: 8,
            borderRadius: 20,
          }}
        >
          <ArrowDownUp size={18} color={colors.secondaryForeground} />
        </TouchableOpacity>

        {/* Result & To */}
        <View style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
          <TouchableOpacity
            onPress={() => setPickerMode('to')}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ flex: 1 }} />
            ) : isError ? (
              <Text style={{ flex: 1, fontSize: 18, color: colors.danger, fontFamily: fonts.semibold }}>Error</Text>
            ) : isSameCurrency ? (
              <Text style={{ flex: 1, fontSize: 18, color: colors.warning, fontFamily: fonts.semibold }}>Same</Text>
            ) : (
              <Text style={{ flex: 1, fontSize: 18, color: colors.foreground, fontFamily: fonts.semibold }}>
                {conversion ? formatNumber(conversion.result, 2) : '0.00'}
              </Text>
            )}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.secondary,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 6,
            }}>
              <Text style={{ fontSize: 16, marginRight: 4 }}>{toDisplay.flag || '🌐'}</Text>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: fonts.medium }}>{toCurrency}</Text>
              <ChevronDown size={14} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rate info */}
      {conversion && !isSameCurrency && (
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 12, fontFamily: fonts.regular }}>
          1 {fromCurrency} = {formatNumber(conversion.rate, 4)} {toCurrency}
        </Text>
      )}

      <CurrencyPickerModal />
    </View>
  );
}
