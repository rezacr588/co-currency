import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, User } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { CategoryIcon } from '../../../src/constants/icons';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: summary, isPending } = useQuery({
    queryKey: ['wallet', 'summary'],
    queryFn: () => api.wallet.getSummary(),
  });

  const { data: monthlyReport } = useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => api.reports.monthly(),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-muted-foreground">{t('welcomeBack')}</Text>
            <Text className="text-2xl font-bold text-foreground">{user?.name}</Text>
          </View>
          <Link href="/(app)/profile" asChild>
            <Pressable className="bg-card p-3 rounded-full">
              <User size={24} color="rgb(148, 163, 184)" />
            </Pressable>
          </Link>
        </View>

        {/* Total Balance Card */}
        <View className="bg-card p-6 rounded-2xl mb-6">
          <Text className="text-muted-foreground mb-2">{t('totalBalance')}</Text>
          {isPending ? (
            <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          ) : (
            <Text className="text-4xl font-bold text-accent">
              {formatCompactCurrency(summary?.total_balance_usd || 0, 'USD')}
            </Text>
          )}
        </View>

        {/* Monthly Summary */}
        {monthlyReport && (
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1 bg-success/10 p-4 rounded-xl">
              <View className="flex-row items-center mb-2">
                <TrendingUp size={20} color="rgb(16, 185, 129)" />
                <Text className="text-success ml-2">{t('income')}</Text>
              </View>
              <Text className="text-xl font-bold text-foreground">
                {formatCompactCurrency(monthlyReport.income, monthlyReport.currency)}
              </Text>
            </View>
            <View className="flex-1 bg-danger/10 p-4 rounded-xl">
              <View className="flex-row items-center mb-2">
                <TrendingDown size={20} color="rgb(220, 38, 38)" />
                <Text className="text-danger ml-2">{t('expenses')}</Text>
              </View>
              <Text className="text-xl font-bold text-foreground">
                {formatCompactCurrency(monthlyReport.expenses, monthlyReport.currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Wallet Balances */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">{t('walletBalances')}</Text>
            <Link href="/(app)/(tabs)/wallet" asChild>
              <Pressable className="flex-row items-center">
                <Text className="text-accent mr-1">{t('viewAll')}</Text>
                <ArrowRight size={16} color="rgb(212, 175, 55)" />
              </Pressable>
            </Link>
          </View>
          {isPending ? (
            <ActivityIndicator />
          ) : (
            <View className="gap-3">
              {summary?.balances.slice(0, 3).map((balance) => (
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
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">{t('recentTransactions')}</Text>
            <Link href="/(app)/(tabs)/wallet" asChild>
              <Pressable className="flex-row items-center">
                <Text className="text-accent mr-1">{t('viewAll')}</Text>
                <ArrowRight size={16} color="rgb(212, 175, 55)" />
              </Pressable>
            </Link>
          </View>
          {isPending ? (
            <ActivityIndicator />
          ) : (
            <View className="gap-3">
              {summary?.recent_transactions.slice(0, 5).map((tx) => (
                <View
                  key={tx.id}
                  className="bg-card p-4 rounded-xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center">
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
                    <View>
                      <Text className="font-semibold text-foreground">
                        {tx.description || tx.category || 'Transaction'}
                      </Text>
                      <Text className="text-muted-foreground text-sm">
                        {formatDate(tx.created_at)}
                      </Text>
                    </View>
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
