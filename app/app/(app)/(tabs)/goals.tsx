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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, CheckCircle, X, DollarSign, Calendar } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { GoalIcon } from '../../../src/constants/icons';
import { CurrencyPicker } from '../../../src/components/ui/CurrencyPicker';
import type { CreateGoalRequest } from '../../../src/types/goal';

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

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const { data, isPending } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['goals'] });
    setRefreshing(false);
  };

  const goals = data?.goals || [];
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
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-3xl font-bold text-foreground">{t('financialGoals')}</Text>
          <Pressable
            onPress={() => setShowForm(true)}
            className="bg-primary p-3 rounded-full"
            style={{ cursor: 'pointer' }}
          >
            <Plus size={24} color="white" />
          </Pressable>
        </View>

        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : goals.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Target size={48} color="rgb(148, 163, 184)" />
            <Text className="text-lg font-semibold text-foreground mt-4">{t('noGoals')}</Text>
            <Text className="text-muted-foreground text-center mt-2">
              {t('noGoalsDescription')}
            </Text>
            <Pressable
              onPress={() => setShowForm(true)}
              className="bg-primary px-6 py-3 rounded-xl mt-4"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-white font-semibold">{t('createGoal')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-semibold text-foreground mb-4">
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
                <Text className="text-lg font-semibold text-foreground mb-4">
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

function GoalCard({ goal }: { goal: any }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showContribute, setShowContribute] = useState(false);
  const [amount, setAmount] = useState('');
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
    },
  });

  const handleContribute = () => {
    const parsedAmount = parseFloat(amount);
    if (parsedAmount > 0) {
      contributeMutation.mutate(parsedAmount);
    }
  };

  return (
    <Pressable className="bg-card p-4 rounded-xl" style={{ cursor: 'pointer' }}>
      <View className="flex-row items-center mb-3">
        <View
          className={`p-2 rounded-lg mr-3 ${goal.is_completed ? 'bg-success/20' : 'bg-accent/20'}`}
        >
          {goal.is_completed ? (
            <CheckCircle size={24} color="rgb(16, 185, 129)" />
          ) : (
            <GoalIcon category={goal.category || 'other'} size={24} color="rgb(212, 175, 55)" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{goal.name}</Text>
          {goal.category && (
            <Text className="text-muted-foreground text-sm">
              {t(goal.category as any) || goal.category}
            </Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-2 bg-secondary rounded-full mb-2">
        <View
          className={`h-full rounded-full ${goal.is_completed ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground">
          {formatCompactCurrency(goal.current_amount, goal.currency)} /{' '}
          {formatCompactCurrency(goal.target_amount, goal.currency)}
        </Text>
        <Text
          className={goal.is_completed ? 'text-success font-semibold' : 'text-accent font-semibold'}
        >
          {progressPercent.toFixed(0)}%
        </Text>
      </View>

      {goal.deadline && (
        <Text className="text-muted-foreground text-sm mt-2">
          {t('deadline')}: {formatDate(goal.deadline)}
        </Text>
      )}

      {/* Contribute section */}
      {!goal.is_completed && (
        <View className="mt-3 pt-3 border-t border-border">
          {showContribute ? (
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 bg-background p-3 rounded-lg text-foreground"
                style={{ outlineStyle: 'none' } as any}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgb(148, 163, 184)"
              />
              <Pressable
                onPress={handleContribute}
                disabled={contributeMutation.isPending}
                className="bg-success p-3 rounded-lg"
                style={{ cursor: 'pointer' }}
              >
                {contributeMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Plus size={20} color="white" />
                )}
              </Pressable>
              <Pressable onPress={() => setShowContribute(false)} className="bg-secondary p-3 rounded-lg" style={{ cursor: 'pointer' }}>
                <X size={20} color="rgb(148, 163, 184)" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowContribute(true)}
              className="bg-accent/20 p-3 rounded-lg items-center"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-accent font-semibold">{t('contribute')}</Text>
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
      goalData.deadline = new Date(deadline).toISOString();
    }

    mutation.mutate(goalData);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('createGoal')}</Text>
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
            <Text className="text-muted-foreground mb-2">{t('goalName')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Emergency Fund, Vacation, etc."
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('targetAmount')}</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-card p-4 rounded-xl text-foreground text-lg"
                style={{ outlineStyle: 'none' } as any}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgb(148, 163, 184)"
              />
              <Pressable
                onPress={() => setShowCurrencyPicker(true)}
                className="bg-card px-4 rounded-xl items-center justify-center"
                style={{ cursor: 'pointer' }}
              >
                <Text className="text-foreground font-semibold">{currency}</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('category')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {GOAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg flex-row items-center ${
                    category === cat ? 'bg-accent' : 'bg-card'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <GoalIcon
                    category={cat}
                    size={16}
                    color={category === cat ? 'rgb(15, 26, 42)' : 'rgb(148, 163, 184)'}
                  />
                  <Text
                    className={`ml-2 ${
                      category === cat ? 'text-accent-foreground font-semibold' : 'text-foreground'
                    }`}
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('deadline')} ({t('optional')})</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="YYYY-MM-DD"
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
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">{t('createGoal')}</Text>
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
