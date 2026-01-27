import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Filter, Trash2, X } from 'lucide-react-native';
import { api } from '../../../../src/api';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../../src/utils/format';
import { StyledCategoryIcon } from '../../../../src/constants/icons';

export default function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const { data, isPending } = useQuery({
    queryKey: ['wallet', 'transactions', 'all'],
    queryFn: () => api.wallet.getTransactions(50),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    setRefreshing(false);
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.wallet.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const handleDelete = useCallback((tx: { id: string; description?: string; category?: string }) => {
    Alert.alert(
      t('deleteTransaction'),
      t('deleteTransactionConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(tx.id),
        },
      ]
    );
  }, [deleteMutation, t]);

  const transactions = data?.transactions || [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border" style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <Pressable onPress={() => router.back()} className="p-2" style={{ cursor: 'pointer' }}>
          <ArrowLeft size={24} color="rgb(248, 250, 252)" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t('transactionHistory')}</Text>
        <Pressable className="p-2" style={{ cursor: 'pointer' }}>
          <Filter size={24} color="rgb(148, 163, 184)" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : transactions.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text className="text-muted-foreground">{t('noTransactions')}</Text>
          </View>
        ) : (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            {transactions.map((tx) => (
              <View
                key={tx.id}
                className="bg-card border border-border p-4 rounded-xl flex-row items-center"
                style={{
                  width: isDesktop ? '48%' : '100%',
                  minWidth: 300,
                } as any}
              >
                <View className="mr-3">
                  <StyledCategoryIcon
                    category={tx.category || 'other'}
                    size={20}
                    backgroundOpacity={0.15}
                    borderRadius={10}
                    padding={10}
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
                <Pressable
                  onPress={() => handleDelete(tx)}
                  className="ml-3 p-2"
                  style={{ cursor: 'pointer' }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={18} color="#71717a" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
