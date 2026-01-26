import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, User, DollarSign, PiggyBank, CreditCard } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { CategoryIcon } from '../../../src/constants/icons';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

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
              <Text className="text-muted-foreground">{t('welcomeBack')}</Text>
              <Text className="text-2xl font-bold text-foreground">{user?.name}</Text>
            </View>
            <Link href="/(app)/profile" asChild>
              <Pressable style={{ cursor: 'pointer' }} className="bg-card p-3 rounded-full">
                <User size={24} color="rgb(148, 163, 184)" />
              </Pressable>
            </Link>
          </View>
        )}

        {/* Stats Grid - Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column */}
        <View
          style={{
            flexDirection: isTablet ? 'row' : 'column',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Total Balance */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card p-6 rounded-2xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground">{t('totalBalance')}</Text>
                <View className="bg-primary/20 p-2 rounded-lg">
                  <DollarSign size={20} color="rgb(212, 175, 55)" />
                </View>
              </View>
              {isPending ? (
                <ActivityIndicator size="small" color="rgb(212, 175, 55)" />
              ) : (
                <Text className="text-3xl font-bold text-accent">
                  {formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}
                </Text>
              )}
            </View>
          </View>

          {/* Income */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-success/10 p-6 rounded-2xl h-full border border-success/20">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-success">{t('income')}</Text>
                  <View className="bg-success/20 p-2 rounded-lg">
                    <TrendingUp size={20} color="rgb(16, 185, 129)" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">This month</Text>
              </View>
            </View>
          )}

          {/* Expenses */}
          {monthlyReport && (
            <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
              <View className="bg-danger/10 p-6 rounded-2xl h-full border border-danger/20">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-danger">{t('expenses')}</Text>
                  <View className="bg-danger/20 p-2 rounded-lg">
                    <TrendingDown size={20} color="rgb(220, 38, 38)" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">This month</Text>
              </View>
            </View>
          )}

          {/* Goals Progress */}
          <View style={{ flex: isDesktop ? 1 : isTablet ? '48%' as any : 1, minWidth: isDesktop ? 200 : undefined }}>
            <View className="bg-card p-6 rounded-2xl h-full">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted-foreground">{t('financialGoals')}</Text>
                <View className="bg-primary/20 p-2 rounded-lg">
                  <PiggyBank size={20} color="rgb(212, 175, 55)" />
                </View>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {activeGoals} / {totalGoals}
              </Text>
              <Text className="text-xs text-muted-foreground mt-1">Active goals</Text>
            </View>
          </View>
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
                <Text className="text-lg font-semibold text-foreground">{t('walletBalances')}</Text>
                <Link href="/(app)/(tabs)/wallet" asChild>
                  <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
                    <Text className="text-accent mr-1">{t('viewAll')}</Text>
                    <ArrowRight size={16} color="rgb(212, 175, 55)" />
                  </Pressable>
                </Link>
              </View>
              {isPending ? (
                <ActivityIndicator />
              ) : (
                <View className="gap-3">
                  {(summary?.balances || []).slice(0, isDesktop ? 5 : 3).map((balance) => (
                    <View
                      key={balance.currency}
                      className="bg-card p-4 rounded-xl flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <View className="bg-primary/20 p-2 rounded-lg mr-3">
                          <Wallet size={20} color="rgb(212, 175, 55)" />
                        </View>
                        <Text className="text-lg font-semibold text-foreground">
                          {balance.currency}
                        </Text>
                      </View>
                      <Text className="text-lg text-foreground">
                        {formatCompactCurrency(balance.balance, balance.currency)}
                      </Text>
                    </View>
                  ))}
                  {(summary?.balances || []).length === 0 && (
                    <View className="bg-card p-6 rounded-xl items-center">
                      <Wallet size={32} color="rgb(148, 163, 184)" />
                      <Text className="text-muted-foreground mt-2">No balances yet</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Right Column - Recent Transactions */}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-foreground">{t('recentTransactions')}</Text>
              <Link href="/(app)/(tabs)/wallet/history" asChild>
                <Pressable style={{ cursor: 'pointer' }} className="flex-row items-center">
                  <Text className="text-accent mr-1">{t('viewAll')}</Text>
                  <ArrowRight size={16} color="rgb(212, 175, 55)" />
                </Pressable>
              </Link>
            </View>
            {isPending ? (
              <ActivityIndicator />
            ) : (
              <View className="gap-3">
                {(summary?.recent_transactions || []).slice(0, isDesktop ? 6 : 5).map((tx) => (
                  <View
                    key={tx.id}
                    className="bg-card p-4 rounded-xl flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`p-2 rounded-lg mr-3 ${
                          tx.type === 'credit' ? 'bg-success/20' : 'bg-danger/20'
                        }`}
                      >
                        <CategoryIcon
                          category={tx.category || 'other'}
                          size={20}
                          color={tx.type === 'credit' ? 'rgb(16, 185, 129)' : 'rgb(220, 38, 38)'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground" numberOfLines={1}>
                          {tx.description || tx.category || 'Transaction'}
                        </Text>
                        <Text className="text-muted-foreground text-sm">
                          {formatDate(tx.created_at)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`text-lg font-semibold ml-2 ${
                        tx.type === 'credit' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}
                      {formatCompactCurrency(tx.amount, tx.currency)}
                    </Text>
                  </View>
                ))}
                {(summary?.recent_transactions || []).length === 0 && (
                  <View className="bg-card p-6 rounded-xl items-center">
                    <CreditCard size={32} color="rgb(148, 163, 184)" />
                    <Text className="text-muted-foreground mt-2">No transactions yet</Text>
                    <Link href="/(app)/(tabs)/add" asChild>
                      <Pressable style={{ cursor: 'pointer' }} className="bg-primary px-4 py-2 rounded-lg mt-3">
                        <Text className="text-white font-medium">Add Transaction</Text>
                      </Pressable>
                    </Link>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
