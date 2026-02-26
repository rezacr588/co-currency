import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowLeftRight, History, MessageCircle, Target, PiggyBank, BarChart3, Wallet, KanbanSquare } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCurrency, formatCompactCurrency, getCurrencyDisplay, formatDate, formatTransactionAmount, getTransactionCurrency } from '../../../../src/utils/format';
import { StyledCategoryIcon } from '../../../../src/constants/icons';
import { Skeleton, SkeletonList, SkeletonTransaction, SkeletonBalance } from '../../../../src/components/ui/Skeleton';

export default function WalletScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
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
    { label: t('reports') || 'Reports', href: '/(app)/(tabs)/reports', icon: BarChart3 },
    { label: 'Planner', href: '/todo', icon: KanbanSquare },
  ];

  const featureCols = isDesktop ? 6 : 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <ScrollView
        style={{ flex: 1 }}
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
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 24, overflow: 'hidden' }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Wallet size={16} color={colors.secondaryForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 8, fontFamily: 'Inter_500Medium' }}>
                  {t('totalBalance') || 'Total Balance'}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 16 }}>
                {formatCurrency(summary?.total_balance_usd ?? 0, 'USD')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Link href={'/(app)/(tabs)/add' as any} asChild>
                  <Pressable
                    style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t('addTransaction') || 'Add Transaction'}
                    accessibilityRole="button"
                  >
                    <Plus size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 8, fontSize: 14 }}>
                      {t('addTransaction')}
                    </Text>
                  </Pressable>
                </Link>
                <Link href={'/(app)/(tabs)/wallet/convert' as any} asChild>
                  <Pressable
                    style={({ pressed }) => [{ flex: 1, backgroundColor: colors.secondary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t('convertCurrency') || t('convert') || 'Convert Currency'}
                    accessibilityRole="button"
                  >
                    <ArrowLeftRight size={18} color={colors.secondaryForeground} />
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginLeft: 8, fontSize: 14 }}>
                      {t('convertCurrency') || t('convert') || 'Convert'}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </>
          )}
        </View>

        {/* 2. Quick Actions Grid */}
        <View style={{ marginBottom: 24 }}>
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
                    style={({ pressed }) => [{ alignItems: 'center', width: itemWidth, minHeight: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={action.label}
                    accessibilityRole="button"
                  >
                    <View
                      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 24 }}
                    >
                      <Icon size={20} color={colors.accent} />
                    </View>
                    <Text
                      style={{ color: colors.foreground, marginTop: 8, textAlign: 'center', fontSize: 10 }}
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
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>{t('balances')}</Text>
          {isLoadingBalances ? (
            <SkeletonList count={4} ItemComponent={SkeletonBalance} />
          ) : balances.length === 0 ? (
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.mutedForeground }}>{t('noBalances')}</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: balanceGap }}>
                {displayedBalances.map((balance) => {
                  const display = getCurrencyDisplay(balance.currency);
                  return (
                    <View
                      key={balance.currency}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: 4 }}>
                        <Text style={{ fontSize: 24, marginRight: 8 }}>{display.flag || '🌐'}</Text>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{balance.currency}</Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          color: balance.balance >= 0 ? colors.foreground : colors.danger,
                          fontSize: 15,
                          paddingLeft: 4,
                        }}
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
                  <Pressable style={({ pressed }) => [{ marginTop: 12, alignItems: 'center', cursor: 'pointer' }, pressed && { opacity: 0.7 }]}>
                    <Text style={{ color: colors.accent, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <History size={18} color={colors.accent} />
              <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginLeft: 8 }}>
                {t('recentTransactions')}
              </Text>
            </View>
            <Link href={'/(app)/(tabs)/wallet/history' as any} asChild>
              <Pressable style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', cursor: 'pointer' }, pressed && { opacity: 0.7 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 14 }}>{t('viewAll')}</Text>
              </Pressable>
            </Link>
          </View>
          {isLoadingTransactions ? (
            <SkeletonList count={3} ItemComponent={SkeletonTransaction} />
          ) : transactions.length === 0 ? (
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.mutedForeground }}>{t('noTransactions')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: txGap }}>
              {transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: txCardWidth,
                    minWidth: txCols === 1 ? undefined : 280,
                    padding: 16,
                  }}
                >
                  <StyledCategoryIcon category={tx.category || 'other'} size={18} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                      {tx.description || tx.category || 'Transaction'}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {formatDate(tx.created_at, { month: 'short', day: 'numeric' })}
                      {tx.category ? ` · ${tx.category}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        color: tx.type === 'credit' ? colors.success : colors.danger,
                        fontSize: 15,
                      }}
                    >
                      {formatTransactionAmount(tx)}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                      {getTransactionCurrency(tx)}
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
