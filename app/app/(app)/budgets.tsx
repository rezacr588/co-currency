import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,

  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
import { Plus, ArrowLeft, X, PieChart, AlertTriangle, Pencil, Trash2 } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber, getCurrencyDisplay } from '../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground, CategoryIcon } from '../../src/constants/icons';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { SkeletonCard, SkeletonList } from '../../src/components/ui/Skeleton';
import { haptics } from '../../src/utils/haptics';
import { COMMON_CURRENCIES } from '../../src/constants/currencies';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../src/types/goal';

const CATEGORIES = [
  'food', 'transportation', 'entertainment', 'shopping', 'bills',
  'health', 'fitness', 'education', 'utilities', 'home',
  'travel', 'gifts', 'coffee', 'clothing', 'pets', 'other',
];
const PERIODS = ['monthly', 'yearly'] as const;

export default function BudgetsScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    open_form?: string;
    category?: string;
    amount?: string;
    currency?: string;
    period?: string;
  }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const { width } = useWindowDimensions();
  const createPrefill = useMemo(
    () => ({
      category: typeof params.category === 'string' ? params.category : undefined,
      amount: typeof params.amount === 'string' ? params.amount : undefined,
      currency: typeof params.currency === 'string' ? params.currency : undefined,
      period: typeof params.period === 'string' ? params.period : undefined,
    }),
    [params.amount, params.category, params.currency, params.period]
  );

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const getGridColumns = () => {
    if (isDesktop) return 3;
    if (isTablet) return 2;
    return 1;
  };
  const columns = getGridColumns();

  const { data, isPending, isError, refetch, refreshing, onRefresh } = useRefreshableQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.budgets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      haptics.success();
      showToast(t('budgetDeleted') || 'Budget deleted', 'success');
    },
    onError: (err) => {
      haptics.error();
      showToast(t('failedToDeleteBudget') || 'Failed to delete budget', 'error');
    },
  });

  const handleDelete = (budget: Budget) => {
    Alert.alert(
      t('confirmDelete') || 'Confirm Delete',
      t('confirmDeleteBudget') || 'Are you sure you want to delete this budget?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.medium();
            deleteMutation.mutate(budget.id);
          },
        },
      ]
    );
  };

  const handleEdit = (budget: Budget) => {
    haptics.light();
    setEditBudget(budget);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditBudget(null);
  };

  const budgets = data?.budgets || [];

  useEffect(() => {
    if (params.open_form !== '1') {
      return;
    }

    setEditBudget(null);
    setShowForm(true);
    router.replace('/(app)/budgets');
  }, [params.open_form, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ cursor: 'pointer', padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('back') || 'Go back'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('budgets')}</Text>
        </View>
        <Pressable onPress={() => { haptics.light(); setShowForm(true); }} style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, padding: 10, borderRadius: 9999 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('createBudget') || 'Create Budget'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? theme.spacing.xxxl : theme.spacing.lg,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardDismissMode="on-drag"
      >
        {isError ? (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: theme.spacing.xxl, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{t('failedToLoadBudgets') || 'Failed to load budgets'}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ backgroundColor: colors.danger + '33', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: 8, cursor: 'pointer' }}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonCard} />
        ) : budgets.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: theme.spacing.xxl, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <PieChart size={48} color={colors.placeholder} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: theme.spacing.lg }}>{t('noBudgets')}</Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: theme.spacing.sm }}>{t('noBudgetsDescription')}</Text>
          </View>
        ) : (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            {budgets.map((budget) => (
              <View key={budget.id} style={{
                width: columns === 1 ? '100%' : `${(100 / columns) - (16 * (columns - 1) / columns)}%`,
                minWidth: columns === 1 ? '100%' : 300,
              }}>
                <BudgetCard
                  budget={budget}
                  onEdit={() => handleEdit(budget)}
                  onDelete={() => handleDelete(budget)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BudgetFormModal
        visible={showForm}
        onClose={handleCloseForm}
        editBudget={editBudget}
        prefill={createPrefill}
      />
    </SafeAreaView>
  );
}

function BudgetCard({ budget, onEdit, onDelete }: { budget: Budget; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const progressPercent = Math.min(budget.progress, 100);
  const categoryColor = CATEGORY_COLORS[budget.category.toLowerCase()] || colors.accent;

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: theme.spacing.lg, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {budget.is_over_budget || budget.is_near_limit ? (
            <View
              style={{
                padding: 8,
                borderRadius: 8,
                marginEnd: 12,
                backgroundColor: budget.is_over_budget ? `${colors.danger}26` : `${colors.accent}26`,
              }}
            >
              <AlertTriangle
                size={22}
                color={budget.is_over_budget ? colors.danger : colors.accent}
              />
            </View>
          ) : (
            <View style={{ marginEnd: 12 }}>
              <StyledCategoryIcon
                category={budget.category}
                size={22}
                backgroundOpacity={0.15}
                borderRadius={10}
                padding={8}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, textTransform: 'capitalize' }} numberOfLines={1}>{budget.category}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t(budget.period)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {budget.is_over_budget && (
            <View style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginEnd: 4 }}>
              <Text style={{ color: colors.danger, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{t('overBudget')}</Text>
            </View>
          )}
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              { padding: 8, borderRadius: 8, backgroundColor: colors.secondary, cursor: 'pointer' },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={t('editBudget') || 'Edit Budget'}
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Pencil size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [
              { padding: 8, borderRadius: 8, backgroundColor: colors.danger + '1A', cursor: 'pointer' },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={t('delete') || 'Delete'}
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ height: 12, backgroundColor: colors.secondary, borderRadius: 9999, marginBottom: 8, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: 9999,
            width: `${Math.min(progressPercent, 100)}%`,
            backgroundColor: budget.is_over_budget
              ? colors.danger
              : budget.is_near_limit
              ? colors.accent
              : categoryColor,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }} numberOfLines={1}>
          {formatCompactCurrency(budget.spent, budget.currency)} / {formatCompactCurrency(budget.amount, budget.currency)}
        </Text>
        <Text style={{ fontSize: 14, color: budget.is_over_budget ? colors.danger : colors.foreground, fontFamily: budget.is_over_budget ? 'Inter_600SemiBold' : 'Inter_500Medium' }}>
          {formatNumber(progressPercent, 0)}% {budget.is_over_budget ? `(${t('overBudget')})` : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('remaining')}</Text>
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: budget.remaining >= 0 ? colors.success : colors.danger }}>
            {formatCompactCurrency(Math.max(0, budget.remaining), budget.currency)}
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('dailyAllowance')}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {formatCompactCurrency(budget.daily_allowance, budget.currency)}
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('daysLeft')}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{budget.remaining_days}</Text>
        </View>
      </View>
    </View>
  );
}

function BudgetFormModal({
  visible,
  onClose,
  editBudget,
  prefill,
}: {
  visible: boolean;
  onClose: () => void;
  editBudget?: Budget | null;
  prefill?: {
    category?: string;
    amount?: string;
    currency?: string;
    period?: string;
  };
}) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!visible || isInitialized) {
      if (!visible && isInitialized) {
        setIsInitialized(false);
      }
      return;
    }

    if (editBudget) {
      setCategory(editBudget.category);
      setAmount(String(editBudget.amount));
      setCurrency(editBudget.currency);
      setPeriod(editBudget.period);
      setError('');
      setIsInitialized(true);
      return;
    }

    setCategory(
      prefill?.category && CATEGORIES.includes(prefill.category)
        ? prefill.category
        : 'food'
    );
    setAmount(prefill?.amount ?? '');
    setCurrency(prefill?.currency?.toUpperCase() || 'USD');
    setPeriod(prefill?.period === 'yearly' ? 'yearly' : 'monthly');
    setError('');
    setIsInitialized(true);
  }, [editBudget, isInitialized, prefill, visible]);

  const isEditing = !!editBudget;

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetRequest) => api.budgets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {});
      haptics.success();
      onClose();
      resetForm();
      showToast(t('budgetCreated') || 'Budget created', 'success');
    },
    onError: (err) => {
      haptics.error();
      setError(err instanceof Error ? err.message : t('budgetSaveFailed') || 'Failed to save budget');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: UpdateBudgetRequest }) => api.budgets.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      haptics.success();
      onClose();
      resetForm();
      showToast(t('budgetUpdated') || 'Budget updated', 'success');
    },
    onError: (err) => {
      haptics.error();
      setError(err instanceof Error ? err.message : t('budgetSaveFailed') || 'Failed to save budget');
    },
  });

  const resetForm = () => {
    setCategory('food');
    setAmount('');
    setCurrency('USD');
    setPeriod('monthly');
    setError('');
    setIsInitialized(false);
  };

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    setError('');
    haptics.medium();

    if (isEditing && editBudget) {
      updateMutation.mutate({
        id: editBudget.id,
        payload: { amount: parsedAmount, period },
      });
    } else {
      createMutation.mutate({ category, amount: parsedAmount, currency, period });
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {isEditing ? (t('editBudget') || 'Edit Budget') : (t('createBudget') || 'Create Budget')}
          </Text>
          <Pressable onPress={() => { onClose(); resetForm(); }} style={({ pressed }) => [{ cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={24} color={colors.placeholder} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? theme.spacing.xxxl : theme.spacing.lg,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <FormError message={error} />

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('category')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                const catColor = CATEGORY_COLORS[cat.toLowerCase()] || colors.placeholder;
                const bgColor = isSelected ? catColor : getCategoryBackground(cat, 0.12);

                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      if (!isEditing) {
                        haptics.selection();
                        setCategory(cat);
                      }
                    }}
                    disabled={isEditing}
                    style={{
                      cursor: isEditing ? undefined : 'pointer',
                      backgroundColor: bgColor,
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: isSelected ? 'transparent' : getCategoryBackground(cat, 0.25),
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      opacity: isEditing && !isSelected ? 0.4 : 1,
                    }}
                  >
                    <CategoryIcon
                      category={cat}
                      size={16}
                      color={isSelected ? '#ffffff' : catColor}
                    />
                    <Text
                      style={{
                        color: isSelected ? '#ffffff' : catColor,
                        fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      }}
                    >
                      {t(cat) || cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginBottom: theme.spacing.xxl }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('amount')}</Text>
            <TextInput
              style={{ backgroundColor: colors.card, padding: theme.spacing.lg, borderRadius: 12, color: colors.foreground, fontSize: 18, outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {/* Currency Picker */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('currency') || 'Currency'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {COMMON_CURRENCIES.map((code) => {
                  const display = getCurrencyDisplay(code);
                  const isSelected = currency === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => {
                        if (!isEditing) {
                          haptics.selection();
                          setCurrency(code);
                        }
                      }}
                      disabled={isEditing}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: theme.spacing.lg,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: isSelected ? colors.accent : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          cursor: isEditing ? undefined : 'pointer',
                          opacity: isEditing && !isSelected ? 0.4 : 1,
                        },
                        pressed && !isEditing && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{display.flag || ''}</Text>
                      <Text style={{
                        color: isSelected ? colors.accentForeground : colors.foreground,
                        fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                        fontSize: 14,
                      }}>
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={{ marginBottom: theme.spacing.xxl }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('period')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => { haptics.selection(); setPeriod(p); }}
                  style={{ flex: 1, padding: theme.spacing.lg, borderRadius: 12, alignItems: 'center', backgroundColor: period === p ? colors.accent : colors.card, cursor: 'pointer' }}
                >
                  <Text style={{ color: period === p ? colors.accentForeground : colors.foreground, fontFamily: period === p ? 'Inter_600SemiBold' : undefined }}>
                    {t(p)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button variant="primary" size="lg" onPress={handleSubmit} isLoading={isMutating}>
            {isEditing ? (t('editBudget') || 'Edit Budget') : (t('createBudget') || 'Create Budget')}
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
