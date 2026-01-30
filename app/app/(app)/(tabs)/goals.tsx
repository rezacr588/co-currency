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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, CheckCircle, X, DollarSign, Calendar } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { GoalIcon } from '../../../src/constants/icons';
import { CurrencyPicker } from '../../../src/components/ui/CurrencyPicker';
import { SkeletonGoalCard, SkeletonList } from '../../../src/components/ui/Skeleton';
import type { CreateGoalRequest, Goal } from '../../../src/types/goal';

const GOAL_CATEGORIES = [
  'savings',
  'emergency',
  'vacation',
  'home',
  'car',
  'education',
  'retirement',
  'investment',
  'other',
];

export default function GoalsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['goals'] });
    setRefreshing(false);
  };

  const goals: Goal[] = data?.goals || [];
  const activeGoals = goals.filter((g) => !g.is_completed);
  const completedGoals = goals.filter((g) => g.is_completed);

  // Grid columns based on screen size
  const getGridColumns = () => {
    if (isDesktop) return 3;
    if (isTablet) return 2;
    return 1;
  };
  const columns = getGridColumns();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-semibold text-foreground">{t('financialGoals')}</Text>
          <Pressable
            onPress={() => setShowForm(true)}
            className="bg-foreground p-2.5 rounded-lg"
            style={{ cursor: 'pointer' }}
          >
            <Plus size={20} color="#09090b" />
          </Pressable>
        </View>

        {isError ? (
          <View className="bg-danger-muted border border-danger/20 p-6 rounded-xl items-center" style={{ maxWidth: isDesktop ? 500 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text className="text-danger font-medium mb-2">{t('failedToLoadGoals') || 'Failed to load goals'}</Text>
            <Pressable
              onPress={() => refetch()}
              className="bg-danger/20 px-4 py-2 rounded-lg"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-danger font-medium">{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonGoalCard} />
        ) : goals.length === 0 ? (
          <View className="bg-card border border-border p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 500 : '100%', alignSelf: 'center', width: '100%' }}>
            <Target size={40} color="#52525b" />
            <Text className="text-base font-medium text-foreground mt-4">{t('noGoals')}</Text>
            <Text className="text-muted-foreground text-center mt-2 text-sm">
              {t('noGoalsDescription')}
            </Text>
            <Pressable
              onPress={() => setShowForm(true)}
              className="bg-accent px-5 py-3 rounded-lg mt-4"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-accent-foreground font-semibold text-sm">{t('createGoal')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <View className="mb-6">
                <Text className="text-base font-medium text-foreground mb-4">
                  {t('activeGoals')} ({activeGoals.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                }}>
                  {activeGoals.map((goal) => (
                    <View key={goal.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (16 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 280,
                    }}>
                      <GoalCard goal={goal} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <View>
                <Text className="text-base font-medium text-foreground mb-4">
                  {t('completedGoals')} ({completedGoals.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                }}>
                  {completedGoals.map((goal) => (
                    <View key={goal.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (16 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 280,
                    }}>
                      <GoalCard goal={goal} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <GoalFormModal visible={showForm} onClose={() => setShowForm(false)} />
    </SafeAreaView>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showContribute, setShowContribute] = useState(false);
  const [amount, setAmount] = useState('');
  const [contributeError, setContributeError] = useState('');
  const progressPercent = Math.min(goal.progress, 100);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const contributeMutation = useMutation({
    mutationFn: (contributionAmount: number) =>
      api.goals.contribute(goal.id, { amount: contributionAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowContribute(false);
      setAmount('');
      setContributeError('');
    },
    onError: (error) => {
      setContributeError(error instanceof Error ? error.message : t('contributionFailed') || 'Failed to contribute');
    },
  });

  const handleContribute = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setContributeError(t('enterValidAmount') || 'Please enter a valid amount');
      return;
    }
    setContributeError('');
    contributeMutation.mutate(parsedAmount);
  };

  return (
    <Pressable className="bg-card border border-border p-4 rounded-lg" style={{ cursor: 'pointer' }}>
      <View className="flex-row items-center mb-3">
        <View className="bg-secondary p-2 rounded-md mr-3">
          {goal.is_completed ? (
            <CheckCircle size={20} color="#22c55e" />
          ) : (
            <GoalIcon category={goal.category || 'other'} size={20} color="#a1a1aa" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">{goal.name}</Text>
          {goal.category && (
            <Text className="text-muted-foreground text-xs">
              {t(goal.category as any) || goal.category}
            </Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-1.5 bg-secondary rounded-full mb-2">
        <View
          className={`h-full rounded-full ${goal.is_completed ? 'bg-success' : 'bg-foreground'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-sm">
          {formatCompactCurrency(goal.current_amount, goal.currency)} /{' '}
          {formatCompactCurrency(goal.target_amount, goal.currency)}
        </Text>
        <Text
          className={`text-sm font-medium ${goal.is_completed ? 'text-success' : 'text-foreground'}`}
        >
          {progressPercent.toFixed(0)}%
        </Text>
      </View>

      {goal.deadline && (
        <Text className="text-muted-foreground text-xs mt-2">
          {t('deadline')}: {formatDate(goal.deadline)}
        </Text>
      )}

      {/* Contribute section */}
      {!goal.is_completed && (
        <View className="mt-3 pt-3 border-t border-border">
          {showContribute ? (
            <View>
              {contributeError ? (
                <Text className="text-danger text-xs mb-2">{contributeError}</Text>
              ) : null}
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 bg-muted border border-border p-2.5 rounded-md text-foreground text-sm"
                  style={{ outlineStyle: 'none' } as any}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text);
                    setContributeError('');
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#52525b"
                />
                <Pressable
                  onPress={handleContribute}
                  disabled={contributeMutation.isPending}
                  className="bg-foreground p-2.5 rounded-md"
                  style={{ cursor: 'pointer' }}
                >
                  {contributeMutation.isPending ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <Plus size={18} color="#09090b" />
                  )}
                </Pressable>
                <Pressable onPress={() => { setShowContribute(false); setContributeError(''); }} className="bg-secondary p-2.5 rounded-md" style={{ cursor: 'pointer' }}>
                  <X size={18} color="#71717a" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowContribute(true)}
              className="bg-secondary border border-border p-2.5 rounded-md items-center"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-foreground font-medium text-sm">{t('contribute')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

function GoalFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('savings');
  const [deadline, setDeadline] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateGoalRequest) => api.goals.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    },
  });

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setCurrency('USD');
    setCategory('savings');
    setDeadline('');
    setError('');
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('enterName'));
      return;
    }
    const parsedAmount = parseFloat(targetAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    setError('');

    const goalData: CreateGoalRequest = {
      name: name.trim(),
      target_amount: parsedAmount,
      currency,
      category,
    };

    if (deadline) {
      const parsedDate = new Date(deadline);
      if (isNaN(parsedDate.getTime())) {
        setError(t('invalidDate') || 'Invalid date format. Please use YYYY-MM-DD.');
        return;
      }
      goalData.deadline = parsedDate.toISOString();
    }

    mutation.mutate(goalData);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">{t('createGoal')}</Text>
          <Pressable onPress={onClose} style={{ cursor: 'pointer' }} className="p-2 bg-secondary rounded-full">
            <X size={18} color="#a1a1aa" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
            maxWidth: 500,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {error ? (
            <View className="bg-danger-muted border border-danger/20 p-3 rounded-lg mb-4">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('goalName')}</Text>
            <TextInput
              className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Emergency Fund, Vacation, etc."
              placeholderTextColor="#52525b"
            />
          </View>

          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('targetAmount')}</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-muted border border-border p-3.5 rounded-lg text-foreground text-lg"
                style={{ outlineStyle: 'none' } as any}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#52525b"
              />
              <Pressable
                onPress={() => setShowCurrencyPicker(true)}
                className="bg-secondary border border-border px-4 rounded-lg items-center justify-center"
                style={{ cursor: 'pointer' }}
              >
                <Text className="text-foreground font-medium">{currency}</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-5">
            <Text className="text-muted-foreground text-sm mb-2">{t('category')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {GOAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-md flex-row items-center border ${
                    category === cat ? 'bg-foreground border-foreground' : 'bg-secondary border-border'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <GoalIcon
                    category={cat}
                    size={14}
                    color={category === cat ? '#09090b' : '#a1a1aa'}
                  />
                  <Text
                    className={`ml-2 text-sm ${
                      category === cat ? 'text-background font-medium' : 'text-foreground'
                    }`}
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground text-sm mb-2">{t('deadline')} ({t('optional')})</Text>
            <TextInput
              className="bg-muted border border-border p-3.5 rounded-lg text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#52525b"
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            className={`bg-accent p-3.5 rounded-lg items-center ${mutation.isPending ? 'opacity-50' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <Text className="text-accent-foreground font-semibold">{t('createGoal')}</Text>
            )}
          </Pressable>
        </ScrollView>

        <CurrencyPicker
          visible={showCurrencyPicker}
          onClose={() => setShowCurrencyPicker(false)}
          onSelect={setCurrency}
          selectedCurrency={currency}
          title={t('selectCurrency')}
        />
      </SafeAreaView>
    </Modal>
  );
}
