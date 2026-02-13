import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowLeftRight, Bot, History, MessageCircle, Target, PiggyBank, BarChart3, Wallet } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useColors } from '../../../../src/context/ThemeContext';
import { formatCurrency, formatCompactCurrency, getCurrencyDisplay, formatDate } from '../../../../src/utils/format';
import { StyledCategoryIcon } from '../../../../src/constants/icons';
import { Skeleton, SkeletonList, SkeletonTransaction, SkeletonBalance } from '../../../../src/components/ui/Skeleton';

export default function WalletScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const containerPadding = isDesktop ? 32 : 16;
  const availableWidth = width - containerPadding * 2;

  // Balance cards: 3 cols on desktop, 2 cols on tablet/mobile
  const balanceCols = isDesktop ? 3 : 2;
  const balanceGap = 10;
  const balanceCardWidth = (availableWidth - balanceGap * (balanceCols - 1)) / balanceCols;

  // Transaction cards: 2 cols on desktop, 1 on tablet/mobile
  const txCols = isDesktop ? 2 : 1;
  const txGap = 12;
  const txCardWidth = txCols === 1 ? availableWidth : (availableWidth - txGap * (txCols - 1)) / txCols;

  const { data: summary, isPending: isLoadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
  });

  const { data: balancesData, isPending: isLoadingBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  const { data: transactionsData, isPending: isLoadingTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => api.wallet.getTransactions(10),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchBalances(), refetchTransactions()]);
    setRefreshing(false);
  }, [refetchSummary, refetchBalances, refetchTransactions]);

  const balances = balancesData?.balances || [];
  const transactions = transactionsData?.transactions || [];
  const mobileBalanceLimit = 4;
  const showViewAllBalances = !isDesktop && balances.length > mobileBalanceLimit;
  const displayedBalances = isDesktop ? balances : balances.slice(0, mobileBalanceLimit);

  const quickActions = [
    { label: t('history') || 'History', href: '/(app)/(tabs)/wallet/history', icon: History },
    { label: t('goals') || 'Goals', href: '/(app)/(tabs)/goals', icon: Target },
    { label: t('budgets') || 'Budgets', href: '/(app)/budgets', icon: PiggyBank },
    { label: t('aiAdvisor') || 'AI Advisor', href: '/(app)/(tabs)/wallet/chat', icon: MessageCircle },
    { label: t('aiReceiptParser') || 'AI Parser', href: '/(app)/(tabs)/wallet/ai', icon: Bot },
    { label: t('reports') || 'Reports', href: '/(app)/(tabs)/reports', icon: BarChart3 },
  ];

  const featureCols = isDesktop ? 6 : 3;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 1. Hero Balance Card */}
        <View className="bg-card border border-border rounded-2xl p-4 mb-6" style={{ overflow: 'hidden' }}>
          {isLoadingSummary ? (
            <View>
              <Skeleton width={120} height={14} borderRadius={4} />
              <View style={{ marginTop: 12 }}>
                <Skeleton width={200} height={36} borderRadius={6} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <Skeleton width="48%" height={44} borderRadius={12} />
                <Skeleton width="48%" height={44} borderRadius={12} />
              </View>
            </View>
          ) : (
            <>
              <View className="flex-row items-center mb-2">
                <Wallet size={16} color={colors.secondaryForeground} />
                <Text className="text-muted-foreground text-sm ml-2 font-medium">
                  {t('totalBalance') || 'Total Balance'}
                </Text>
              </View>
              <Text className="text-foreground text-2xl font-bold mb-4">
                {formatCurrency(summary?.total_balance_usd ?? 0, 'USD')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Link href={'/(app)/(tabs)/add' as any} asChild>
                  <Pressable
                    className="flex-1 bg-primary rounded-xl flex-row items-center justify-center"
                    style={({ pressed }) => [{ height: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t('addTransaction') || 'Add Transaction'}
                    accessibilityRole="button"
                  >
                    <Plus size={18} color={colors.primaryForeground} />
                    <Text className="text-primary-foreground font-semibold ml-2 text-sm">
                      {t('addTransaction')}
                    </Text>
                  </Pressable>
                </Link>
                <Link href={'/(app)/(tabs)/wallet/convert' as any} asChild>
                  <Pressable
                    className="flex-1 bg-secondary rounded-xl flex-row items-center justify-center"
                    style={({ pressed }) => [{ height: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t('convertCurrency') || t('convert') || 'Convert Currency'}
                    accessibilityRole="button"
                  >
                    <ArrowLeftRight size={18} color={colors.secondaryForeground} />
                    <Text className="text-foreground font-semibold ml-2 text-sm">
                      {t('convertCurrency') || t('convert') || 'Convert'}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </>
          )}
        </View>

        {/* 2. Quick Actions Grid */}
        <View className="mb-6">
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              const itemWidth = (availableWidth - 16 * (featureCols - 1)) / featureCols;
              return (
                <Link key={action.href} href={action.href as any} asChild>
                  <Pressable
                    className="items-center"
                    style={({ pressed }) => [{ width: itemWidth, minHeight: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={action.label}
                    accessibilityRole="button"
                  >
                    <View
                      className="bg-card border border-border items-center justify-center"
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    >
                      <Icon size={20} color={colors.accent} />
                    </View>
                    <Text
                      className="text-foreground mt-2 text-center"
                      style={{ fontSize: 10 }}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>

        {/* 4. Currency Balances - 2-Column Compact Grid */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">{t('balances')}</Text>
          {isLoadingBalances ? (
            <SkeletonList count={4} ItemComponent={SkeletonBalance} />
          ) : balances.length === 0 ? (
            <View className="bg-card p-6 rounded-xl items-center">
              <Text className="text-muted-foreground">{t('noBalances')}</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: balanceGap }}>
                {displayedBalances.map((balance) => {
                  const display = getCurrencyDisplay(balance.currency);
                  return (
                    <View
                      key={balance.currency}
                      className="bg-card rounded-xl"
                      style={{
                        width: balanceCardWidth,
                        padding: 12,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Left accent bar */}
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          backgroundColor: colors.accent + '80',
                          borderTopLeftRadius: 12,
                          borderBottomLeftRadius: 12,
                        }}
                      />
                      <View className="flex-row items-center mb-1" style={{ paddingLeft: 4 }}>
                        <Text className="text-2xl mr-2">{display.flag || '🌐'}</Text>
                        <Text className="text-foreground font-bold text-sm">{balance.currency}</Text>
                      </View>
                      <Text
                        className={`font-semibold ${
                          balance.balance >= 0 ? 'text-foreground' : 'text-danger'
                        }`}
                        style={{ fontSize: 15, paddingLeft: 4 }}
                        numberOfLines={1}
                      >
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {showViewAllBalances && (
                <Link href={'/(app)/(tabs)/wallet/history' as any} asChild>
                  <Pressable className="mt-3 items-center" style={({ pressed }) => [{ cursor: 'pointer' }, pressed && { opacity: 0.7 }]}>
                    <Text className="text-accent text-sm font-medium">
                      {t('viewAll') || 'View All'} ({balances.length})
                    </Text>
                  </Pressable>
                </Link>
              )}
            </>
          )}
        </View>

        {/* 5. Recent Transactions - Enhanced Cards */}
        <View>
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <History size={18} color={colors.accent} />
              <Text className="text-lg font-semibold text-foreground ml-2">
                {t('recentTransactions')}
              </Text>
            </View>
            <Link href={'/(app)/(tabs)/wallet/history' as any} asChild>
              <Pressable className="flex-row items-center" style={({ pressed }) => [{ cursor: 'pointer' }, pressed && { opacity: 0.7 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text className="text-accent text-sm">{t('viewAll')}</Text>
              </Pressable>
            </Link>
          </View>
          {isLoadingTransactions ? (
            <SkeletonList count={3} ItemComponent={SkeletonTransaction} />
          ) : transactions.length === 0 ? (
            <View className="bg-card p-6 rounded-xl items-center">
              <Text className="text-muted-foreground">{t('noTransactions')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: txGap }}>
              {transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  className="bg-card rounded-xl flex-row items-center"
                  style={{
                    width: txCardWidth,
                    minWidth: txCols === 1 ? undefined : 280,
                    padding: 16,
                  }}
                >
                  <StyledCategoryIcon category={tx.category || 'other'} size={18} />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-foreground text-sm" numberOfLines={1}>
                      {tx.description || tx.category || 'Transaction'}
                    </Text>
                    <Text className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {formatDate(tx.created_at, { month: 'short', day: 'numeric' })}
                      {tx.category ? ` · ${tx.category}` : ''}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`font-semibold ${
                        tx.type === 'credit' ? 'text-success' : 'text-danger'
                      }`}
                      style={{ fontSize: 15 }}
                    >
                      {`${tx.type === 'credit' ? '+' : '-'}${formatCompactCurrency(tx.amount, tx.currency)}`}
                    </Text>
                    <Text className="text-muted-foreground" style={{ fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                      {tx.currency}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
