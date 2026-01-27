import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, X, RefreshCw, Play, Pause, TrendingUp, TrendingDown } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
import { FrequencyIcon, StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground, CategoryIcon } from '../../src/constants/icons';
import type { CreateRecurringRequest } from '../../src/types/goal';

const CATEGORIES = ['income', 'bills', 'food', 'transportation', 'entertainment', 'other'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export default function RecurringScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  // Grid columns based on screen size
  const getGridColumns = () => {
    if (isDesktop) return 3;
    if (isTablet) return 2;
    return 1;
  };
  const columns = getGridColumns();

  const { data, isPending } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.recurring.list(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['recurring'] });
    setRefreshing(false);
  };

  const transactions = data?.recurring_transactions || [];
  const activeTransactions = transactions.filter((t) => t.is_active);
  const pausedTransactions = transactions.filter((t) => !t.is_active);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border" style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 mr-2" style={{ cursor: 'pointer' }}>
            <ArrowLeft size={24} color="rgb(248, 250, 252)" />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{t('recurring')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} className="bg-primary p-2 rounded-full" style={{ cursor: 'pointer' }}>
          <Plus size={24} color="#09090b" />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : transactions.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <RefreshCw size={48} color="rgb(148, 163, 184)" />
            <Text className="text-lg font-semibold text-foreground mt-4">{t('noRecurring')}</Text>
            <Text className="text-muted-foreground text-center mt-2">{t('noRecurringDescription')}</Text>
          </View>
        ) : (
          <>
            {activeTransactions.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-semibold text-foreground mb-4">
                  {t('active')} ({activeTransactions.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {activeTransactions.map((tx) => (
                    <View key={tx.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <RecurringCard transaction={tx} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {pausedTransactions.length > 0 && (
              <View>
                <Text className="text-lg font-semibold text-muted-foreground mb-4">
                  {t('paused')} ({pausedTransactions.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {pausedTransactions.map((tx) => (
                    <View key={tx.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <RecurringCard transaction={tx} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <RecurringFormModal visible={showForm} onClose={() => setShowForm(false)} />
    </SafeAreaView>
  );
}

function RecurringCard({ transaction }: { transaction: any }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const executeMutation = useMutation({
    mutationFn: () => api.recurring.execute(transaction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.recurring.update(transaction.id, { is_active: !transaction.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });

  return (
    <View className={`bg-card border border-border p-4 rounded-xl ${!transaction.is_active ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className="mr-3">
            <StyledCategoryIcon
              category={transaction.category || 'other'}
              size={22}
              backgroundOpacity={0.15}
              borderRadius={10}
              padding={10}
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-foreground" numberOfLines={1}>
              {transaction.description || transaction.category || 'Recurring'}
            </Text>
            <View className="flex-row items-center">
              <FrequencyIcon frequency={transaction.frequency} size={12} color="rgb(148, 163, 184)" />
              <Text className="text-muted-foreground text-sm ml-1">{t(transaction.frequency)}</Text>
            </View>
          </View>
        </View>
        <Text
          className={`text-lg font-bold ${
            transaction.type === 'credit' ? 'text-success' : 'text-danger'
          }`}
        >
          {transaction.type === 'credit' ? '+' : '-'}
          {formatCompactCurrency(transaction.amount, transaction.currency)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-border">
        <View>
          <Text className="text-muted-foreground text-xs">{t('nextExecution')}</Text>
          <Text className="text-foreground">{formatDate(transaction.next_execution)}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => executeMutation.mutate()}
            disabled={executeMutation.isPending || !transaction.is_active}
            className={`bg-accent p-2 rounded-lg ${!transaction.is_active ? 'opacity-50' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {executeMutation.isPending ? (
              <ActivityIndicator size="small" color="rgb(15, 26, 42)" />
            ) : (
              <Play size={16} color="rgb(15, 26, 42)" />
            )}
          </Pressable>
          <Pressable
            onPress={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className={`p-2 rounded-lg ${transaction.is_active ? 'bg-warning/20' : 'bg-success/20'}`}
            style={{ cursor: 'pointer' }}
          >
            {toggleMutation.isPending ? (
              <ActivityIndicator size="small" />
            ) : transaction.is_active ? (
              <Pause size={16} color="rgb(212, 175, 55)" />
            ) : (
              <Play size={16} color="rgb(16, 185, 129)" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RecurringFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('bills');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateRecurringRequest) => api.recurring.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create recurring transaction');
    },
  });

  const resetForm = () => {
    setType('debit');
    setAmount('');
    setCurrency('USD');
    setCategory('bills');
    setDescription('');
    setFrequency('monthly');
    setError('');
  };

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    setError('');

    const nextExecution = new Date();
    nextExecution.setDate(nextExecution.getDate() + 1);

    mutation.mutate({
      type,
      amount: parsedAmount,
      currency,
      category,
      description: description || undefined,
      frequency,
      next_execution: nextExecution.toISOString(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('createRecurring')}</Text>
          <Pressable onPress={onClose} style={{ cursor: 'pointer' }}>
            <X size={24} color="rgb(148, 163, 184)" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {error ? (
            <View className="bg-danger-light p-4 rounded-xl mb-4">
              <Text className="text-danger">{error}</Text>
            </View>
          ) : null}

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('type')}</Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setType('debit')}
                className={`flex-1 p-4 rounded-xl items-center ${type === 'debit' ? 'bg-danger' : 'bg-card'}`}
                style={{ cursor: 'pointer' }}
              >
                <TrendingDown size={20} color={type === 'debit' ? 'white' : 'rgb(220, 38, 38)'} />
                <Text className={`mt-1 ${type === 'debit' ? 'text-white font-semibold' : 'text-foreground'}`}>
                  {t('expense')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setType('credit')}
                className={`flex-1 p-4 rounded-xl items-center ${type === 'credit' ? 'bg-success' : 'bg-card'}`}
                style={{ cursor: 'pointer' }}
              >
                <TrendingUp size={20} color={type === 'credit' ? 'white' : 'rgb(16, 185, 129)'} />
                <Text className={`mt-1 ${type === 'credit' ? 'text-white font-semibold' : 'text-foreground'}`}>
                  {t('income')}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('amount')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground text-lg"
              style={{ outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('frequency')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {FREQUENCIES.map((freq) => (
                <Pressable
                  key={freq}
                  onPress={() => setFrequency(freq)}
                  className={`px-4 py-2 rounded-lg ${frequency === freq ? 'bg-accent' : 'bg-card'}`}
                  style={{ cursor: 'pointer' }}
                >
                  <Text className={frequency === freq ? 'text-accent-foreground font-semibold' : 'text-foreground'}>
                    {t(freq)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('category')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                const catColor = CATEGORY_COLORS[cat.toLowerCase()] || 'rgb(148, 163, 184)';
                const bgColor = isSelected ? catColor : getCategoryBackground(cat, 0.12);

                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: bgColor,
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: isSelected ? 'transparent' : getCategoryBackground(cat, 0.25),
                    }}
                    className="px-4 py-2 rounded-xl flex-row items-center gap-2"
                  >
                    <CategoryIcon
                      category={cat}
                      size={16}
                      color={isSelected ? 'white' : catColor}
                    />
                    <Text
                      style={{
                        color: isSelected ? 'white' : catColor,
                        fontWeight: isSelected ? '600' : '500',
                      }}
                    >
                      {t(cat) || cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('description')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            className={`bg-primary p-4 rounded-xl items-center ${mutation.isPending ? 'opacity-50' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <Text className="text-primary-foreground font-semibold text-lg">{t('createRecurring')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
