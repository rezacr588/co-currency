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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
import { Plus, ArrowLeft, X, PieChart, AlertTriangle } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatNumber } from '../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground, CategoryIcon } from '../../src/constants/icons';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { SkeletonCard, SkeletonList } from '../../src/components/ui/Skeleton';
import type { CreateBudgetRequest } from '../../src/types/goal';

const CATEGORIES = ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'other'];
const PERIODS = ['monthly', 'yearly'] as const;

export default function BudgetsScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { width } = useWindowDimensions();

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

  const budgets = data?.budgets || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ cursor: 'pointer', padding: 8, marginRight: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('back') || 'Go back'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('budgets')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, padding: 10, borderRadius: 9999 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('createBudget') || 'Create Budget'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 32 : 16,
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardDismissMode="on-drag"
      >
        {isError ? (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{t('failedToLoadBudgets') || 'Failed to load budgets'}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, cursor: 'pointer' }}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonCard} />
        ) : budgets.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <PieChart size={48} color={colors.placeholder} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 16 }}>{t('noBudgets')}</Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>{t('noBudgetsDescription')}</Text>
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
                <BudgetCard budget={budget} />
              </View>
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
  const theme = useTheme();
  const colors = theme.colors;
  const progressPercent = Math.min(budget.progress, 100);
  const categoryColor = CATEGORY_COLORS[budget.category.toLowerCase()] || colors.accent;

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {budget.is_over_budget || budget.is_near_limit ? (
            <View
              style={{
                padding: 8,
                borderRadius: 8,
                marginRight: 12,
                backgroundColor: budget.is_over_budget ? `${colors.danger}26` : `${colors.accent}26`,
              }}
            >
              <AlertTriangle
                size={22}
                color={budget.is_over_budget ? colors.danger : colors.accent}
              />
            </View>
          ) : (
            <View style={{ marginRight: 12 }}>
              <StyledCategoryIcon
                category={budget.category}
                size={22}
                backgroundOpacity={0.15}
                borderRadius={10}
                padding={8}
              />
            </View>
          )}
          <View>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, textTransform: 'capitalize' }} numberOfLines={1}>{budget.category}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t(budget.period)}</Text>
          </View>
        </View>
        {budget.is_over_budget && (
          <View style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
            <Text style={{ color: colors.danger, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{t('overBudget')}</Text>
          </View>
        )}
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

function BudgetFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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

  const mutation = useMutation({
    mutationFn: (data: CreateBudgetRequest) => api.budgets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      api.badges.check().then(() => {
        queryClient.invalidateQueries({ queryKey: ['badges'] });
      }).catch(() => {});
      onClose();
      resetForm();
      showToast(t('budgetCreated') || 'Budget created', 'success');
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('createBudget')}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [{ cursor: 'pointer' }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('close') || 'Close'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={24} color={colors.placeholder} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: isDesktop ? 32 : 16,
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
                    onPress={() => setCategory(cat)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: bgColor,
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: isSelected ? 'transparent' : getCategoryBackground(cat, 0.25),
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
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

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('amount')}</Text>
            <TextInput
              style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, color: colors.foreground, fontSize: 18, outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('period')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={{ flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: period === p ? colors.accent : colors.card, cursor: 'pointer' }}
                >
                  <Text style={{ color: period === p ? colors.accentForeground : colors.foreground, fontFamily: period === p ? 'Inter_600SemiBold' : undefined }}>
                    {t(p)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button variant="primary" size="lg" onPress={handleSubmit} isLoading={mutation.isPending}>
            {t('createBudget')}
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
