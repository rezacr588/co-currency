import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, TextInput, Modal } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, User, DollarSign, PiggyBank, CreditCard, ArrowDownUp, ChevronDown, X, Search } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate, formatNumber, getCurrencyDisplay } from '../../../src/utils/format';
import { StyledCategoryIcon } from '../../../src/constants/icons';
import { useConvert, useCurrencies } from '../../../src/hooks';
import { Skeleton } from '../../../src/components/ui/Skeleton';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'IRR', 'TRY', 'CAD', 'AUD'];

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  // Converter state
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const parsedAmount = parseFloat(amount) || 0;
  const { data: conversion, isPending: isConverting } = useConvert(fromCurrency, toCurrency, parsedAmount);
  const { data: currencies } = useCurrencies();

  const { data: summary, isPending } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
  });

  const { data: monthlyReport } = useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => api.reports.monthly(),
  });

  const { data: goalsData } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });
  const goals = goalsData?.goals;

  // Calculate stats
  const totalGoals = goals?.length || 0;
  const activeGoals = goals?.filter((g: any) => g.current_amount < g.target_amount).length || 0;

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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: isDesktop ? 1400 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* Mobile Header - Only show on mobile */}
        {!isDesktop && (
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-muted-foreground text-sm">{t('welcomeBack')}</Text>
              <Text className="text-xl font-bold text-foreground">{user?.name}</Text>
            </View>
            <Link href="/(app)/profile" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-secondary border border-border p-2.5 rounded-full">
                <User size={20} color="#a1a1aa" />
              </Pressable>
            </Link>
          </View>
        )}

        {/* Stats Grid - Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column */}
        <View
          style={{
            flexDirection: isTablet ? 'row' : 'column',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {/* Total Balance */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card border border-border p-5 rounded-xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground text-sm">{t('totalBalance')}</Text>
                <DollarSign size={18} color="#71717a" />
              </View>
              {isPending ? (
                <Skeleton width={120} height={28} />
              ) : (
                <Text className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}
                </Text>
              )}
            </View>
          </View>

          {/* Income */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-card border border-border p-5 rounded-xl h-full">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-muted-foreground text-sm">{t('income')}</Text>
                  <TrendingUp size={18} color="#22c55e" />
                </View>
                <Text className="text-2xl font-bold text-success">
                  {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">This month</Text>
              </View>
            </View>
          )}

          {/* Expenses */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-card border border-border p-5 rounded-xl h-full">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-muted-foreground text-sm">{t('expenses')}</Text>
                  <TrendingDown size={18} color="#ef4444" />
                </View>
                <Text className="text-2xl font-bold text-danger">
                  {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">This month</Text>
              </View>
            </View>
          )}

          {/* Goals Progress */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card border border-border p-5 rounded-xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground text-sm">{t('financialGoals')}</Text>
                <PiggyBank size={18} color="#71717a" />
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {activeGoals} / {totalGoals}
              </Text>
              <Text className="text-xs text-muted-foreground mt-1">Active goals</Text>
            </View>
          </View>
        </View>

        {/* Currency Converter Widget */}
        <View className="bg-card border border-border p-4 rounded-xl mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-semibold text-foreground">{t('currencyConverter') || 'Currency Converter'}</Text>
            <Link href="/(app)/(tabs)/wallet/convert" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
                <Text className="text-muted-foreground text-sm mr-1">{t('fullConverter') || 'Full converter'}</Text>
                <ArrowRight size={14} color="#71717a" />
              </Pressable>
            </Link>
          </View>

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
                {isConverting ? (
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

        {/* Two Column Layout for Desktop */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: 24,
          }}
        >
          {/* Left Column - Wallet Balances */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-semibold text-foreground">{t('walletBalances') || 'Wallet Balances'}</Text>
                <Link href="/(app)/(tabs)/wallet" asChild>
                  <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
                    <Text className="text-muted-foreground text-sm mr-1">{t('viewAll')}</Text>
                    <ArrowRight size={14} color="#71717a" />
                  </Pressable>
                </Link>
              </View>
              {isPending ? (
                <ActivityIndicator color="#71717a" />
              ) : (
                <View className="gap-2">
                  {(summary?.balances || []).slice(0, isDesktop ? 5 : 3).map((balance) => (
                    <View
                      key={balance.currency}
                      className="bg-card border border-border p-4 rounded-lg flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <View className="bg-secondary p-2 rounded-md mr-3">
                          <Wallet size={18} color="#a1a1aa" />
                        </View>
                        <Text className="text-base font-medium text-foreground">
                          {balance.currency}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-foreground">
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </Text>
                    </View>
                  ))}
                  {(summary?.balances || []).length === 0 && (
                    <View className="bg-card border border-border p-6 rounded-lg items-center">
                      <Wallet size={28} color="#52525b" />
                      <Text className="text-muted-foreground mt-2 text-sm">No balances yet</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Right Column - Recent Transactions */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold text-foreground">{t('recentTransactions')}</Text>
              <Link href="/(app)/(tabs)/wallet/history" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
                  <Text className="text-muted-foreground text-sm mr-1">{t('viewAll')}</Text>
                  <ArrowRight size={14} color="#71717a" />
                </Pressable>
              </Link>
            </View>
            {isPending ? (
              <ActivityIndicator color="#71717a" />
            ) : (
              <View className="gap-2">
                {(summary?.recent_transactions || []).slice(0, isDesktop ? 6 : 5).map((tx) => (
                  <View
                    key={tx.id}
                    className="bg-card border border-border p-4 rounded-lg flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1">
                      <View className="mr-3">
                        <StyledCategoryIcon
                          category={tx.category || 'other'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
                          {tx.description || tx.category || 'Transaction'}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {formatDate(tx.created_at)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`text-base font-semibold ml-2 ${
                        tx.type === 'credit' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}
                      {formatCompactCurrency(tx.amount, tx.currency)}
                    </Text>
                  </View>
                ))}
                {(summary?.recent_transactions || []).length === 0 && (
                  <View className="bg-card border border-border p-6 rounded-lg items-center">
                    <CreditCard size={28} color="#52525b" />
                    <Text className="text-muted-foreground mt-2 text-sm">No transactions yet</Text>
                    <Link href="/(app)/(tabs)/add" asChild>
                      <Pressable style={{ cursor: 'pointer' }} className="bg-accent px-4 py-2 rounded-lg mt-3">
                        <Text className="text-accent-foreground font-medium text-sm">Add Transaction</Text>
                      </Pressable>
                    </Link>
                  </View>
                )}
              </View>
            )}
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
          className="flex-1 bg-black/70 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-background border-t border-border rounded-t-2xl"
            style={{
              maxHeight: '80%',
              minHeight: '50%',
            }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">
                {showCurrencyPicker === 'from' ? 'Select from currency' : 'Select to currency'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowCurrencyPicker(null);
                  setSearchQuery('');
                }}
                style={{ cursor: 'pointer' }}
                className="p-2 bg-secondary rounded-full"
              >
                <X size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View className="p-4">
              <View className="bg-muted border border-border rounded-lg flex-row items-center px-4">
                <Search size={18} color="#71717a" />
                <TextInput
                  className="flex-1 p-3 text-foreground"
                  style={{ outlineStyle: 'none' } as any}
                  placeholder="Search currency..."
                  placeholderTextColor="#52525b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
            </View>

            {/* Popular Currencies */}
            {!searchQuery && (
              <View className="px-4 pb-2">
                <Text className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Popular</Text>
                <View className="flex-row flex-wrap gap-2">
                  {POPULAR_CURRENCIES.map((code) => {
                    const display = getCurrencyDisplay(code);
                    const isSelected = showCurrencyPicker === 'from' ? code === fromCurrency : code === toCurrency;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => handleSelectCurrency(code)}
                        style={{ cursor: 'pointer' }}
                        className={`px-3 py-2 rounded-md border ${isSelected ? 'bg-foreground border-foreground' : 'bg-secondary border-border'}`}
                      >
                        <Text className={`text-sm ${isSelected ? 'text-background font-semibold' : 'text-foreground'}`}>
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
              <Text className="text-xs text-muted-foreground mb-2 mt-2 uppercase tracking-wider">
                {searchQuery ? 'Search results' : 'All currencies'}
              </Text>
              {filteredCurrencies.map((currency: { code: string; name: string }) => {
                const display = getCurrencyDisplay(currency.code);
                const isSelected = showCurrencyPicker === 'from' ? currency.code === fromCurrency : currency.code === toCurrency;
                return (
                  <Pressable
                    key={currency.code}
                    onPress={() => handleSelectCurrency(currency.code)}
                    style={{ cursor: 'pointer' }}
                    className={`flex-row items-center p-3 rounded-lg mb-1 border ${isSelected ? 'bg-foreground border-foreground' : 'border-transparent active:bg-secondary'}`}
                  >
                    <Text className="text-xl mr-3">{display.flag || '🌐'}</Text>
                    <View className="flex-1">
                      <Text className={`font-medium text-sm ${isSelected ? 'text-background' : 'text-foreground'}`}>
                        {currency.code}
                      </Text>
                      <Text className={`text-xs ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
                        {currency.name}
                      </Text>
                    </View>
                    <Text className={`text-sm ${isSelected ? 'text-background' : 'text-muted-foreground'}`}>
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
