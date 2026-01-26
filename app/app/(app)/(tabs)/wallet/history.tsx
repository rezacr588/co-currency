import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Filter } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../../src/utils/format';
import { CategoryIcon } from '../../../../src/constants/icons';

export default function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['wallet', 'transactions', 'all'],
    queryFn: () => api.wallet.getTransactions(50),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    setRefreshing(false);
  }, [queryClient]);

  const transactions = data?.transactions || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="rgb(248, 250, 252)" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t('transactionHistory')}</Text>
        <Pressable className="p-2">
          <Filter size={24} color="rgb(148, 163, 184)" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : transactions.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center">
            <Text className="text-muted-foreground">{t('noTransactions')}</Text>
          </View>
        ) : (
          <View className="gap-3">
            {transactions.map((tx) => (
              <View
                key={tx.id}
                className="bg-card p-4 rounded-xl flex-row items-center"
              >
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
                    {formatDate(tx.created_at)} - {tx.category || t('uncategorized')}
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
      </ScrollView>
    </SafeAreaView>
  );
}
