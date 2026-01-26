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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, X, RefreshCw, Play, Pause, TrendingUp, TrendingDown } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
import { FrequencyIcon } from '../../src/constants/icons';
import type { CreateRecurringRequest } from '../../src/types/goal';

const CATEGORIES = ['income', 'bills', 'food', 'transportation', 'entertainment', 'other'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export default function RecurringScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <ArrowLeft size={24} color="rgb(248, 250, 252)" />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{t('recurring')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} className="bg-primary p-2 rounded-full">
          <Plus size={24} color="white" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : transactions.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center">
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
                <View className="gap-3">
                  {activeTransactions.map((tx) => (
                    <RecurringCard key={tx.id} transaction={tx} />
                  ))}
                </View>
              </View>
            )}

            {pausedTransactions.length > 0 && (
              <View>
                <Text className="text-lg font-semibold text-muted-foreground mb-4">
                  {t('paused')} ({pausedTransactions.length})
                </Text>
                <View className="gap-3">
                  {pausedTransactions.map((tx) => (
                    <RecurringCard key={tx.id} transaction={tx} />
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
    <View className={`bg-card p-4 rounded-xl ${!transaction.is_active ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View
            className={`p-2 rounded-lg mr-3 ${
              transaction.type === 'credit' ? 'bg-success/20' : 'bg-danger/20'
            }`}
          >
            {transaction.type === 'credit' ? (
              <TrendingUp size={24} color="rgb(16, 185, 129)" />
            ) : (
              <TrendingDown size={24} color="rgb(220, 38, 38)" />
            )}
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
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('createRecurring')}</Text>
          <Pressable onPress={onClose}>
            <X size={24} color="rgb(148, 163, 184)" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
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
              >
                <TrendingDown size={20} color={type === 'debit' ? 'white' : 'rgb(220, 38, 38)'} />
                <Text className={`mt-1 ${type === 'debit' ? 'text-white font-semibold' : 'text-foreground'}`}>
                  {t('expense')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setType('credit')}
                className={`flex-1 p-4 rounded-xl items-center ${type === 'credit' ? 'bg-success' : 'bg-card'}`}
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
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg ${category === cat ? 'bg-accent' : 'bg-card'}`}
                >
                  <Text className={category === cat ? 'text-accent-foreground font-semibold' : 'text-foreground'}>
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('description')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
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
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">{t('createRecurring')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
