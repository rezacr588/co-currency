import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeftRight, Bot, History, MessageCircle, Target, PiggyBank, RefreshCw, CreditCard, BarChart3, Award } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { formatCompactCurrency, getCurrencyDisplay } from '../../../../src/utils/format';
import { SkeletonBalance, SkeletonTransaction, SkeletonList } from '../../../../src/components/ui/Skeleton';

export default function WalletScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const { data: balancesData, isPending: isLoadingBalances } = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => api.wallet.getBalances(),
  });

  const { data: transactionsData, isPending: isLoadingTransactions } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => api.wallet.getTransactions(10),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallet'] });
    setRefreshing(false);
  }, [queryClient]);

  const balances = balancesData?.balances || [];
  const transactions = transactionsData?.transactions || [];

  const quickActions = [
    { label: t('addTransaction'), href: '/(app)/(tabs)/add', icon: Plus, primary: true },
    { label: t('convertCurrency') || t('convert') || 'Convert', href: '/(app)/(tabs)/wallet/convert', icon: ArrowLeftRight },
    { label: t('aiReceiptParser') || 'AI Parser', href: '/(app)/(tabs)/wallet/ai', icon: Bot },
    { label: t('aiAdvisor') || 'AI Advisor', href: '/(app)/(tabs)/wallet/chat', icon: MessageCircle },
  ];

  const featureActions = [
    { label: t('goals') || 'Goals', href: '/(app)/(tabs)/goals', icon: Target },
    { label: t('budgets') || 'Budgets', href: '/(app)/budgets', icon: PiggyBank },
    { label: t('recurring') || 'Recurring', href: '/(app)/recurring', icon: RefreshCw },
    { label: t('subscriptions') || 'Subscriptions', href: '/(app)/subscriptions', icon: CreditCard },
    { label: t('reports') || 'Reports', href: '/(app)/(tabs)/reports', icon: BarChart3 },
    { label: t('badges') || 'Badges', href: '/(app)/badges', icon: Award },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 24,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-3xl font-bold text-foreground mb-6">{t('wallet')}</Text>

        {/* Quick Actions */}
        <View
          className="mb-6"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <View
                key={action.href}
                style={{
                  width: isDesktop ? '23%' : isTablet ? '48%' : '48%',
                  minWidth: 140,
                }}
              >
                <Link href={action.href as any} asChild>
                  <Pressable
                    className={`rounded-xl p-4 items-center justify-center ${
                      action.primary ? 'bg-primary' : 'bg-card border border-border'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <Icon size={22} color={action.primary ? '#09090b' : 'rgb(161, 161, 170)'} />
                    <Text
                      className={`mt-2 text-xs font-semibold ${
                        action.primary ? 'text-primary-foreground' : 'text-foreground'
                      }`}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            );
          })}
        </View>

        {/* Feature Actions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">{t('features') || 'Features'}</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {featureActions.map((action) => {
              const Icon = action.icon;
              return (
                <View
                  key={action.href}
                  style={{
                    width: isDesktop ? '15%' : isTablet ? '31%' : '31%',
                    minWidth: 100,
                  }}
                >
                  <Link href={action.href as any} asChild>
                    <Pressable
                      className="bg-card border border-border rounded-xl p-3 items-center justify-center"
                      style={{ cursor: 'pointer' }}
                    >
                      <Icon size={20} color="rgb(212, 175, 55)" />
                      <Text
                        className="mt-2 text-xs font-medium text-foreground"
                        numberOfLines={1}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              );
            })}
          </View>
        </View>

        {/* Balances */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">{t('balances')}</Text>
          {isLoadingBalances ? (
            <SkeletonList count={3} ItemComponent={SkeletonBalance} />
          ) : balances.length === 0 ? (
            <View className="bg-card p-6 rounded-xl items-center">
              <Text className="text-muted-foreground">{t('noBalances')}</Text>
            </View>
          ) : (
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              {balances.map((balance) => {
                const display = getCurrencyDisplay(balance.currency);
                return (
                  <View
                    key={balance.currency}
                    className="bg-card p-4 rounded-xl flex-row items-center justify-between"
                    style={{
                      width: isDesktop ? '32%' : isTablet ? '48%' : '100%',
                      minWidth: 250,
                    } as any}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-2xl mr-3">{display.flag || '🌐'}</Text>
                      <View>
                        <Text className="text-lg font-semibold text-foreground">
                          {balance.currency}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                          {display.symbol}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`text-xl font-bold ${
                        balance.balance >= 0 ? 'text-foreground' : 'text-danger'
                      }`}
                    >
                      {formatCompactCurrency(balance.balance, balance.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">
              {t('recentTransactions')}
            </Text>
            <Link href="/(app)/(tabs)/wallet/history" asChild>
              <Pressable className="flex-row items-center" style={{ cursor: 'pointer' }}>
                <History size={16} color="rgb(212, 175, 55)" />
                <Text className="text-accent ml-1">{t('viewAll')}</Text>
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
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              {transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  className="bg-card p-4 rounded-xl flex-row items-center justify-between"
                  style={{
                    width: isDesktop ? '48%' : '100%',
                    minWidth: 280,
                  } as any}
                >
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                      {tx.description || tx.category || 'Transaction'}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {tx.category || t('uncategorized')}
                    </Text>
                  </View>
                  <Text
                    className={`text-lg font-semibold ${
                      tx.type === 'credit' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatCompactCurrency(tx.amount, tx.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
