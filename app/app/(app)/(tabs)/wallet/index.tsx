import { useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRefreshControl } from '../../../../src/hooks/useRefreshableQuery';
import { Plus, ArrowLeftRight, History, MessageCircle, Target, PiggyBank, BarChart3, Wallet, KanbanSquare, Shield } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCurrency, formatCompactCurrency, getCurrencyDisplay, formatDate, formatTransactionAmount, getTransactionCurrency } from '../../../../src/utils/format';
import { StyledCategoryIcon } from '../../../../src/constants/icons';
import { AppSwitcherTrigger } from '../../../../src/components/navigation/AppSwitcherTrigger';
import { PageHeader, PageScaffold } from '../../../../src/components/ui';
import { Skeleton, SkeletonList, SkeletonTransaction, SkeletonBalance } from '../../../../src/components/ui/Skeleton';
import { CollapsibleSection } from '../../../../src/components/ui/CollapsibleSection';
import { CurrencyConverter } from '../../../../src/components/features/CurrencyConverter';
import { useScreenLayout } from '../../../../src/hooks/useScreenLayout';

export default function WalletScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { width, isCompactPhone, isDesktop, isTablet } = useScreenLayout();
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  // Balance cards: 3 cols on desktop, 2 cols on tablet/mobile
  const balanceWidthPct = isDesktop ? '32%' : '48%';

  // Transaction cards: 2 cols on desktop, 1 on tablet/mobile
  const txWidthPct = isDesktop ? '48%' : '100%';

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

  const [showRealValue, setShowRealValue] = useState(false);

  const { data: wealthOverview } = useQuery({
    queryKey: ['wealth', 'overview'],
    queryFn: () => api.wealth.overview(),
    staleTime: 5 * 60 * 1000,
    enabled: showRealValue,
  });

  const { refreshing, onRefresh } = useRefreshControl(refetchSummary, refetchBalances, refetchTransactions);

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

  const featureWidthPct = isDesktop ? '15%' : isCompactPhone ? '31%' : '23%';

  return (
    <PageScaffold
      scroll
      maxWidth={1280}
      contentContainerStyle={{
        paddingBottom: bottomPadding,
      }}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <PageHeader
          title={t('wallet')}
          subtitle={t('walletDescription') || 'Track balances, transactions, and key actions from one place.'}
          actions={!isDesktop ? <AppSwitcherTrigger variant="header_inline" /> : undefined}
        />

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
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: 8, fontFamily: 'Inter_500Medium' }}>
                  {t('totalBalance') || 'Total Balance'}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 16 }}>
                {formatCurrency(summary?.total_balance_usd ?? 0, 'USD')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Link href={'/transaction-create' as any} asChild>
                  <Pressable
                    style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={t('addTransaction') || 'Add Transaction'}
                    accessibilityRole="button"
                  >
                    <Plus size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', marginStart: 8, fontSize: 14 }}>
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
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginStart: 8, fontSize: 14 }}>
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
              justifyContent: 'flex-start',
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href as any} asChild>
                  <Pressable
                    style={({ pressed }) => [{ alignItems: 'center', width: featureWidthPct, minWidth: 70, minHeight: 44, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={action.label}
                    accessibilityRole="button"
                  >
                    <View
                      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 24 }}
                    >
                      <Icon size={20} color={colors.primary} />
                    </View>
                    <Text
                      style={{ color: colors.foreground, marginTop: 8, textAlign: 'center', fontSize: 12, lineHeight: 16, minHeight: 32 }}
                      numberOfLines={isDesktop ? 1 : 2}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>

        {/* 3. CoAI Currency Converter */}
        <View style={{ marginBottom: 24 }}>
          <CollapsibleSection title={t('currencyConverter') || 'CoAI Converter'} storageKey="wallet_converter">
            <CurrencyConverter variant="full" showQuickSelect={false} />
          </CollapsibleSection>
        </View>

        {/* 4. Currency Balances - 2-Column Compact Grid */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{t('balances')}</Text>
            <Pressable
              onPress={() => setShowRealValue(!showRealValue)}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: showRealValue ? colors.accent + '20' : colors.muted,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 16,
                cursor: 'pointer',
              }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={showRealValue ? (t('switchToNominal') || 'Show nominal') : (t('switchToReal') || 'Show real value')}
              accessibilityRole="button"
            >
              <Shield size={12} color={showRealValue ? colors.accent : colors.mutedForeground} />
              <Text style={{ fontSize: 11, color: showRealValue ? colors.accent : colors.mutedForeground, fontFamily: 'Inter_500Medium', marginStart: 4 }}>
                {showRealValue ? (t('realBalance') || 'Real') : (t('nominalBalance') || 'Nominal')}
              </Text>
            </Pressable>
          </View>
          {isLoadingBalances ? (
            <SkeletonList count={4} ItemComponent={SkeletonBalance} />
          ) : balances.length === 0 ? (
            <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.mutedForeground }}>{t('noBalances')}</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                {displayedBalances.map((balance) => {
                  const display = getCurrencyDisplay(balance.currency);
                  const exposure = showRealValue && wealthOverview
                    ? wealthOverview.currency_breakdown?.find((e: any) => e.currency === balance.currency)
                    : null;
                  const inflationRate = exposure?.annual_inflation || 0;
                  const accentColor = showRealValue && exposure
                    ? inflationRate > 10 ? colors.danger : inflationRate > 3 ? colors.warning : colors.success
                    : colors.primary;
                  return (
                    <View
                      key={balance.currency}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        width: balanceWidthPct,
                        flexGrow: 1,
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
                          backgroundColor: accentColor + '80',
                          borderTopLeftRadius: 12,
                          borderBottomLeftRadius: 12,
                        }}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingStart: 4 }}>
                        <Text style={{ fontSize: 24, marginEnd: 8 }}>{display.flag || '🌐'}</Text>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{balance.currency}</Text>
                        {showRealValue && exposure && (
                          <View style={{ backgroundColor: accentColor + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginStart: 6 }}>
                            <Text style={{ fontSize: 9, color: accentColor, fontFamily: 'Inter_500Medium' }}>
                              {inflationRate.toFixed(1)}%
                            </Text>
                          </View>
                        )}
                      </View>
                      {showRealValue && exposure ? (
                        <View style={{ paddingStart: 4 }}>
                          <Text
                            style={{
                              fontFamily: 'Inter_400Regular',
                              color: colors.mutedForeground,
                              fontSize: 12,
                              textDecorationLine: 'line-through',
                            }}
                            numberOfLines={1}
                          >
                            {formatCompactCurrency(balance.balance, balance.currency)}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Inter_700Bold',
                              color: colors.foreground,
                              fontSize: 15,
                            }}
                            numberOfLines={1}
                          >
                            {formatCompactCurrency(exposure.real_balance, balance.currency)}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={{
                            fontFamily: 'Inter_600SemiBold',
                            color: balance.balance >= 0 ? colors.foreground : colors.danger,
                            fontSize: 15,
                            paddingStart: 4,
                          }}
                          numberOfLines={1}
                        >
                          {formatCompactCurrency(balance.balance, balance.currency)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {showViewAllBalances && (
                <Link href={'/(app)/(tabs)/wallet/history' as any} asChild>
                  <Pressable style={({ pressed }) => [{ marginTop: 12, alignItems: 'center', cursor: 'pointer' }, pressed && { opacity: 0.7 }]}>
                    <Text style={{ color: colors.primary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
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
              <History size={18} color={colors.primary} />
              <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginStart: 8 }}>
                {t('recentTransactions')}
              </Text>
            </View>
            <Link href={'/(app)/(tabs)/wallet/history' as any} asChild>
              <Pressable style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', cursor: 'pointer' }, pressed && { opacity: 0.7 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 14 }}>{t('viewAll')}</Text>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              {transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: txWidthPct,
                    padding: 16,
                  }}
                >
                  <StyledCategoryIcon category={tx.category || 'other'} size={18} />
                  <View style={{ flex: 1, marginStart: 12 }}>
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
    </PageScaffold>
  );
}
