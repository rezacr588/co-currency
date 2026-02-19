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
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, CheckCircle, X, DollarSign, Calendar, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../../src/api';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../../src/utils/format';
import { trackPositiveAction, maybeRequestReview } from '../../../src/utils/review';
import { haptics } from '../../../src/utils/haptics';
import { GoalIcon } from '../../../src/constants/icons';
import { CurrencyPicker } from '../../../src/components/ui/CurrencyPicker';
import { SkeletonGoalCard, SkeletonList } from '../../../src/components/ui/Skeleton';
import { SwipeableRow, type SwipeAction } from '../../../src/components/ui';
import { useToast } from '../../../src/components/ui/Toast';
import { Button } from '../../../src/components/ui/Button';
import { FormError } from '../../../src/components/ui/FormError';
import type { CreateGoalRequest, UpdateGoalRequest, Goal } from '../../../src/types/goal';

const GOAL_CATEGORIES = [
  'savings',
  'emergency_fund',
  'vacation',
  'home',
  'car',
  'education',
  'retirement',
  'investment',
  'debt_payoff',
  'other',
];

export default function GoalsScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
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
    await refetch();
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

  // Calculate card widths for grid layout
  const containerPadding = isDesktop ? 32 : 16;
  const gap = 16;
  const availableWidth = width - containerPadding * 2;
  const getCardWidth = () => {
    if (columns === 1) return availableWidth;
    return (availableWidth - gap * (columns - 1)) / columns;
  };
  const cardWidth = getCardWidth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: bottomPadding,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardDismissMode="on-drag"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('financialGoals')}</Text>
          <Pressable
            onPress={() => setShowForm(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [{ backgroundColor: colors.foreground, padding: 10, borderRadius: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('createGoal') || 'Create Goal'}
            accessibilityRole="button"
          >
            <Plus size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>

        {isError ? (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 500 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{t('failedToLoadGoals') || 'Failed to load goals'}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, cursor: 'pointer' }}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonGoalCard} />
        ) : goals.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 32, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 500 : '100%', alignSelf: 'center', width: '100%' }}>
            <Target size={48} color={colors.subtleForeground} />
            <Text style={{ fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground, marginTop: 16 }}>{t('noGoals')}</Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8, fontSize: 14 }}>
              {t('noGoalsDescription')}
            </Text>
            <Pressable
              onPress={() => setShowForm(true)}
              style={{ backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 16, cursor: 'pointer' }}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{t('createGoal')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 16 }}>
                  {t('activeGoals')} ({activeGoals.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                }}>
                  {activeGoals.map((goal) => (
                    <View key={goal.id} style={{
                      width: cardWidth,
                      minWidth: columns === 1 ? undefined : 280,
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
                <Text style={{ fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 16 }}>
                  {t('completedGoals')} ({completedGoals.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                }}>
                  {completedGoals.map((goal) => (
                    <View key={goal.id} style={{
                      width: cardWidth,
                      minWidth: columns === 1 ? undefined : 280,
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
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const [showContribute, setShowContribute] = useState(false);
  const [amount, setAmount] = useState('');
  const [contributeError, setContributeError] = useState('');
  const progressPercent = Math.min(goal.progress, 100);

  const { showToast } = useToast();

  const contributeMutation = useMutation({
    mutationFn: (contributionAmount: number) =>
      api.goals.contribute(goal.id, { amount: contributionAmount }),
    onSuccess: async (data) => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      showToast(t('contributionAdded') || 'Contribution added', 'success');
      // Check for new badges in background
      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {});
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
      color: colors.foreground,
      backgroundColor: colors.info,
      onPress: () => onEdit(goal),
    },
    {
      icon: 'delete',
      color: colors.foreground,
      backgroundColor: colors.danger,
      onPress: () => onDelete(goal),
    },
  ];

  const cardContent = (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 6, marginRight: 12 }}>
          {goal.is_completed ? (
            <CheckCircle size={20} color={colors.success} />
          ) : (
            <GoalIcon category={goal.category || 'other'} size={20} color={colors.secondaryForeground} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground }} numberOfLines={1}>{goal.name}</Text>
          {goal.category && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
              {t(goal.category as any) || goal.category}
            </Text>
          )}
        </View>
        {/* Desktop: inline action buttons */}
        {isDesktop && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              onPress={() => onEdit(goal)}
              hitSlop={10}
              style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('editGoal') || 'Edit Goal'}
              accessibilityRole="button"
            >
              <Pencil size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => onDelete(goal)}
              hitSlop={10}
              style={({ pressed }) => [{ padding: 8, cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('deleteGoal') || 'Delete Goal'}
              accessibilityRole="button"
            >
              <Trash2 size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={{ height: 6, backgroundColor: colors.secondary, borderRadius: 9999, marginBottom: 8 }}>
        <View
          style={{ height: '100%', borderRadius: 9999, backgroundColor: goal.is_completed ? colors.success : colors.foreground, width: `${progressPercent}%` }}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
          {formatCompactCurrency(goal.current_amount, goal.currency)} /{' '}
          {formatCompactCurrency(goal.target_amount, goal.currency)}
        </Text>
        <Text
          style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: goal.is_completed ? colors.success : colors.foreground }}
        >
          {progressPercent.toFixed(0)}%
        </Text>
      </View>

      {goal.deadline && (
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }} numberOfLines={1}>
          {t('deadline')}: {formatDate(goal.deadline)}
        </Text>
      )}

      {/* Contribute section */}
      {!goal.is_completed && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {showContribute ? (
            <View>
              {contributeError ? (
                <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>{contributeError}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 6, color: colors.foreground, fontSize: 14, outlineStyle: 'none' } as any}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text);
                    setContributeError('');
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.subtleForeground}
                />
                <Pressable
                  onPress={handleContribute}
                  disabled={contributeMutation.isPending}
                  style={{ backgroundColor: colors.foreground, padding: 10, borderRadius: 6, cursor: 'pointer' }}
                >
                  {contributeMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Plus size={18} color={colors.primaryForeground} />
                  )}
                </Pressable>
                <Pressable onPress={() => { setShowContribute(false); setContributeError(''); }} hitSlop={6} style={{ backgroundColor: colors.secondary, padding: 10, borderRadius: 6, cursor: 'pointer' }}>
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowContribute(true)}
              style={({ pressed }) => [{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 6, alignItems: 'center', cursor: 'pointer' }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('contribute') || 'Contribute'}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{t('contribute')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SwipeableRow
      rightActions={rightActions}
      enabled={Platform.OS !== 'web'}
    >
      {cardContent}
    </SwipeableRow>
  );
}

function GoalFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
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
      // Check for new badges in background
      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {});
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{t('createGoal')}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ padding: 8, backgroundColor: colors.secondary, borderRadius: 9999, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
            <X size={18} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
            maxWidth: 500,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <FormError message={error} />

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('goalName')}</Text>
            <TextInput
              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Emergency Fund, Vacation, etc."
              placeholderTextColor={colors.subtleForeground}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('targetAmount')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, fontSize: 18, outlineStyle: 'none' } as any}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.subtleForeground}
              />
              <Pressable
                onPress={() => setShowCurrencyPicker(true)}
                style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{currency}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    backgroundColor: category === cat ? colors.foreground : colors.secondary,
                    borderColor: category === cat ? colors.foreground : colors.border,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <GoalIcon
                    category={cat}
                    size={14}
                    color={category === cat ? colors.primaryForeground : colors.secondaryForeground}
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 14,
                      color: category === cat ? colors.background : colors.foreground,
                      fontFamily: category === cat ? 'Inter_500Medium' : undefined,
                    }}
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('deadline')} ({t('optional')})</Text>
            <TextInput
              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtleForeground}
            />
          </View>

          <Button variant="accent" onPress={handleSubmit} isLoading={mutation.isPending}>
            {t('createGoal')}
          </Button>
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
  const theme = useTheme();
  const colors = theme.colors;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{t('editGoal') || 'Edit Goal'}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ padding: 8, backgroundColor: colors.secondary, borderRadius: 9999, cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button">
            <X size={18} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
            maxWidth: 500,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <FormError message={error} />

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('goalName')}</Text>
            <TextInput
              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Emergency Fund, Vacation, etc."
              placeholderTextColor={colors.subtleForeground}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('targetAmount')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, fontSize: 18, outlineStyle: 'none' } as any}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.subtleForeground}
              />
              <View style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>{goal.currency}</Text>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {t('currentProgress') || 'Current progress'}: {formatCompactCurrency(goal.current_amount, goal.currency)}
            </Text>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('category')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    backgroundColor: category === cat ? colors.foreground : colors.secondary,
                    borderColor: category === cat ? colors.foreground : colors.border,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <GoalIcon
                    category={cat}
                    size={14}
                    color={category === cat ? colors.primaryForeground : colors.secondaryForeground}
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 14,
                      color: category === cat ? colors.background : colors.foreground,
                      fontFamily: category === cat ? 'Inter_500Medium' : undefined,
                    }}
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('deadline')} ({t('optional')})</Text>
            <TextInput
              style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 8, color: colors.foreground, outlineStyle: 'none' } as any}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtleForeground}
            />
          </View>

          <Button variant="accent" onPress={handleSubmit} isLoading={mutation.isPending}>
            {t('saveChanges') || 'Save Changes'}
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
