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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, X, PieChart, AlertTriangle } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { formatCompactCurrency, formatNumber } from '../../src/utils/format';
import type { CreateBudgetRequest } from '../../src/types/goal';

const CATEGORIES = ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'other'];
const PERIODS = ['monthly', 'yearly'] as const;

export default function BudgetsScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['budgets'] });
    setRefreshing(false);
  };

  const budgets = data?.budgets || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <ArrowLeft size={24} color="rgb(248, 250, 252)" />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{t('budgets')}</Text>
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
        ) : budgets.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center">
            <PieChart size={48} color="rgb(148, 163, 184)" />
            <Text className="text-lg font-semibold text-foreground mt-4">{t('noBudgets')}</Text>
            <Text className="text-muted-foreground text-center mt-2">{t('noBudgetsDescription')}</Text>
          </View>
        ) : (
          <View className="gap-4">
            {budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} />
            ))}
          </View>
        )}
      </ScrollView>

      <BudgetFormModal visible={showForm} onClose={() => setShowForm(false)} />
    </SafeAreaView>
  );
}

function BudgetCard({ budget }: { budget: any }) {
  const { t } = useLanguage();
  const progressPercent = Math.min(budget.progress, 100);

  return (
    <View className="bg-card p-4 rounded-xl">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className={`p-2 rounded-lg mr-3 ${
              budget.is_over_budget ? 'bg-danger/20' : budget.is_near_limit ? 'bg-warning/20' : 'bg-accent/20'
            }`}
          >
            {budget.is_over_budget || budget.is_near_limit ? (
              <AlertTriangle
                size={24}
                color={budget.is_over_budget ? 'rgb(220, 38, 38)' : 'rgb(212, 175, 55)'}
              />
            ) : (
              <PieChart size={24} color="rgb(212, 175, 55)" />
            )}
          </View>
          <View>
            <Text className="text-lg font-semibold text-foreground capitalize">{budget.category}</Text>
            <Text className="text-muted-foreground text-sm">{t(budget.period)}</Text>
          </View>
        </View>
        {budget.is_over_budget && (
          <View className="bg-danger/20 px-2 py-1 rounded">
            <Text className="text-danger text-xs font-semibold">{t('overBudget')}</Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View className="h-3 bg-secondary rounded-full mb-2">
        <View
          className={`h-full rounded-full ${
            budget.is_over_budget ? 'bg-danger' : budget.is_near_limit ? 'bg-warning' : 'bg-success'
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground">
          {formatCompactCurrency(budget.spent, budget.currency)} / {formatCompactCurrency(budget.amount, budget.currency)}
        </Text>
        <Text className={budget.is_over_budget ? 'text-danger font-semibold' : 'text-foreground'}>
          {formatNumber(progressPercent, 0)}%
        </Text>
      </View>

      <View className="flex-row justify-between mt-3 pt-3 border-t border-border">
        <View>
          <Text className="text-muted-foreground text-xs">{t('remaining')}</Text>
          <Text className={`font-semibold ${budget.remaining >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCompactCurrency(Math.max(0, budget.remaining), budget.currency)}
          </Text>
        </View>
        <View>
          <Text className="text-muted-foreground text-xs">{t('dailyAllowance')}</Text>
          <Text className="text-foreground font-semibold">
            {formatCompactCurrency(budget.daily_allowance, budget.currency)}
          </Text>
        </View>
        <View>
          <Text className="text-muted-foreground text-xs">{t('daysLeft')}</Text>
          <Text className="text-foreground font-semibold">{budget.remaining_days}</Text>
        </View>
      </View>
    </View>
  );
}

function BudgetFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateBudgetRequest) => api.budgets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    },
  });

  const resetForm = () => {
    setCategory('food');
    setAmount('');
    setCurrency('USD');
    setPeriod('monthly');
    setError('');
  };

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    setError('');
    mutation.mutate({ category, amount: parsedAmount, currency, period });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('createBudget')}</Text>
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
            <Text className="text-muted-foreground mb-2">{t('period')}</Text>
            <View className="flex-row gap-3">
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  className={`flex-1 p-4 rounded-xl items-center ${period === p ? 'bg-accent' : 'bg-card'}`}
                >
                  <Text className={period === p ? 'text-accent-foreground font-semibold' : 'text-foreground'}>
                    {t(p)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            className={`bg-primary p-4 rounded-xl items-center ${mutation.isPending ? 'opacity-50' : ''}`}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">{t('createBudget')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
