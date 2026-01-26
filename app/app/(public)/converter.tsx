import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, Modal } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownUp, ArrowLeft, Moon, Sun, ChevronDown, X, Search } from 'lucide-react-native';
import { useConvert, useCurrencies } from '../../src/hooks';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from '../../src/context/ThemeContext';
import { formatNumber, getCurrencyDisplay } from '../../src/utils/format';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'IRR', 'TRY', 'CNY', 'INR', 'KRW'];

export default function ConverterScreen() {
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const parsedAmount = parseFloat(amount) || 0;
  const { data: conversion, isPending, isError } = useConvert(fromCurrency, toCurrency, parsedAmount);
  const { data: currencies } = useCurrencies();

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

  const filteredCurrencies = currencies?.filter((c: { code: string; name: string }) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const fromDisplay = getCurrencyDisplay(fromCurrency);
  const toDisplay = getCurrencyDisplay(toCurrency);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Desktop/Tablet Navbar */}
      {isTablet && (
        <View className="bg-card border-b border-border px-6 py-4 flex-row items-center justify-between">
          <Link href="/" asChild>
            <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
              <Text className="text-2xl font-bold text-primary">CoFinance</Text>
            </Pressable>
          </Link>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={toggleTheme} style={{ cursor: 'pointer' }} className="p-2">
              {isDark ? (
                <Sun size={20} color="rgb(212, 175, 55)" />
              ) : (
                <Moon size={20} color="rgb(148, 163, 184)" />
              )}
            </Pressable>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-4 py-2 rounded-lg">
                <Text className="text-white font-semibold">{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 48 : 24,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: isDesktop ? 500 : undefined }}>
          {/* Mobile Header */}
          {!isTablet && (
            <Link href="/" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center mb-6">
                <ArrowLeft size={20} color="rgb(148, 163, 184)" />
                <Text className="text-muted-foreground ml-2">{t('back') || 'Back'}</Text>
              </Pressable>
            </Link>
          )}

          <Text
            className="font-bold text-foreground mb-2"
            style={{ fontSize: isDesktop ? 36 : 28 }}
          >
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
              <ArrowDownUp size={24} color="white" />
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
          <View className="mt-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              {t('popularCurrencies')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {POPULAR_CURRENCIES.map((code) => {
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
              {t('tapToSelectTo') || 'Tap to select "To" currency, long-press for "From"'}
            </Text>
          </View>
        </View>
      </ScrollView>

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
                {showCurrencyPicker === 'from' ? t('selectFromCurrency') || 'Select From Currency' : t('selectToCurrency') || 'Select To Currency'}
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
            <ScrollView className="flex-1 px-4">
              <Text className="text-sm text-muted-foreground mb-2 mt-2">
                {searchQuery ? t('searchResults') || 'Search Results' : t('allCurrencies') || 'All Currencies'}
              </Text>
              {filteredCurrencies.map((currency: { code: string; name: string }) => {
                const display = getCurrencyDisplay(currency.code);
                const isSelected = showCurrencyPicker === 'from' ? currency.code === fromCurrency : currency.code === toCurrency;
                return (
                  <Pressable
                    key={currency.code}
                    onPress={() => handleSelectCurrency(currency.code)}
                    style={{ cursor: 'pointer' }}
                    className={`flex-row items-center p-3 rounded-xl mb-1 ${isSelected ? 'bg-accent' : 'active:bg-muted'}`}
                  >
                    <Text className="text-2xl mr-3">{display.flag || '🌐'}</Text>
                    <View className="flex-1">
                      <Text className={`font-semibold ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}>
                        {currency.code}
                      </Text>
                      <Text className={`text-sm ${isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
                        {currency.name}
                      </Text>
                    </View>
                    <Text className={isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}>
                      {display.symbol}
                    </Text>
                  </Pressable>
                );
              })}
              <View className="h-8" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
