import { useState, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, CheckCircle, X, DollarSign, Calendar, Pencil, Trash2 } from 'lucide-react-native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { trackPositiveAction, maybeRequestReview } from '../../../src/utils/review';
import { haptics } from '../../../src/utils/haptics';
import { GoalIcon } from '../../../src/constants/icons';
import { CurrencyPicker } from '../../../src/components/ui/CurrencyPicker';
import { SkeletonGoalCard, SkeletonList } from '../../../src/components/ui/Skeleton';
import { SwipeableRow, type SwipeAction } from '../../../src/components/ui';
import type { CreateGoalRequest, UpdateGoalRequest, Goal } from '../../../src/types/goal';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const bottomPadding = isDesktop || isTablet ? insets.bottom : insets.bottom + 96;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.goals.delete(id),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
    onError: (error) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error ? error.message : t('failedToDelete') || 'Failed to delete goal'
      );
    },
  });

  const handleDelete = useCallback((goal: Goal) => {
    Alert.alert(
      t('deleteGoal') || 'Delete Goal',
      t('confirmDeleteGoal') || `Are you sure you want to delete "${goal.name}"?`,
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(goal.id),
        },
      ]
    );
  }, [deleteMutation, t]);

  const handleEdit = useCallback((goal: Goal) => {
    setEditingGoal(goal);
    setShowEditModal(true);
  }, []);

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
                      <GoalCard goal={goal} onEdit={handleEdit} onDelete={handleDelete} isDesktop={isDesktop} />
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
                      <GoalCard goal={goal} onEdit={handleEdit} onDelete={handleDelete} isDesktop={isDesktop} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <GoalFormModal visible={showForm} onClose={() => setShowForm(false)} />

      {editingGoal && (
        <GoalEditModal
          visible={showEditModal}
          goal={editingGoal}
          onClose={() => {
            setShowEditModal(false);
            setEditingGoal(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  isDesktop: boolean;
}

function GoalCard({ goal, onEdit, onDelete, isDesktop }: GoalCardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showContribute, setShowContribute] = useState(false);
  const [amount, setAmount] = useState('');
  const [contributeError, setContributeError] = useState('');
  const progressPercent = Math.min(goal.progress, 100);

  const contributeMutation = useMutation({
    mutationFn: (contributionAmount: number) =>
      api.goals.contribute(goal.id, { amount: contributionAmount }),
    onSuccess: async (data) => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowContribute(false);
      setAmount('');
      setContributeError('');

      // Track positive action and maybe request review if goal completed
      await trackPositiveAction();
      if (data.is_completed) {
        // Goal was just completed - great time to ask for review
        await maybeRequestReview();
      }
    },
    onError: (error) => {
      haptics.error();
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

  // Swipe actions - edit (blue) and delete (red)
  const rightActions: SwipeAction[] = [
    {
      icon: 'edit',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      onPress: () => onEdit(goal),
    },
    {
      icon: 'delete',
      color: '#ffffff',
      backgroundColor: '#ef4444',
      onPress: () => onDelete(goal),
    },
  ];

  const cardContent = (
    <View className="bg-card border border-border p-4 rounded-lg">
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
        {/* Desktop: inline action buttons */}
        {isDesktop && (
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => onEdit(goal)}
              className="p-2"
              hitSlop={10}
              style={{ cursor: 'pointer' }}
            >
              <Pencil size={16} color="#71717a" />
            </Pressable>
            <Pressable
              onPress={() => onDelete(goal)}
              className="p-2"
              hitSlop={10}
              style={{ cursor: 'pointer' }}
            >
              <Trash2 size={16} color="#71717a" />
            </Pressable>
          </View>
        )}
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
    </View>
  );

  return (
    <SwipeableRow
      rightActions={rightActions}
      enabled={!isDesktop}
    >
      {cardContent}
    </SwipeableRow>
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

function GoalEditModal({ visible, goal, onClose }: { visible: boolean; goal: Goal; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Initialize state from the goal being edited
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(goal.target_amount.toString());
  const [category, setCategory] = useState(goal.category || 'savings');
  const [deadline, setDeadline] = useState(
    goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : ''
  );
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: UpdateGoalRequest) => api.goals.update(goal.id, data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
    onError: (err) => {
      haptics.error();
      setError(err instanceof Error ? err.message : 'Failed to update goal');
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('enterName') || 'Please enter a name');
      return;
    }
    const parsedAmount = parseFloat(targetAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount') || 'Please enter a valid amount');
      return;
    }
    setError('');

    const goalData: UpdateGoalRequest = {
      name: name.trim(),
      target_amount: parsedAmount,
      category,
    };

    if (deadline) {
      const parsedDate = new Date(deadline);
      if (isNaN(parsedDate.getTime())) {
        setError(t('invalidDate') || 'Invalid date format. Please use YYYY-MM-DD.');
        return;
      }
      goalData.deadline = parsedDate.toISOString();
    } else {
      goalData.deadline = undefined;
    }

    mutation.mutate(goalData);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">{t('editGoal') || 'Edit Goal'}</Text>
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
              <View className="bg-secondary border border-border px-4 rounded-lg items-center justify-center">
                <Text className="text-muted-foreground font-medium">{goal.currency}</Text>
              </View>
            </View>
            <Text className="text-muted-foreground text-xs mt-1">
              {t('currentProgress') || 'Current progress'}: {formatCompactCurrency(goal.current_amount, goal.currency)}
            </Text>
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
              <Text className="text-accent-foreground font-semibold">{t('saveChanges') || 'Save Changes'}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
