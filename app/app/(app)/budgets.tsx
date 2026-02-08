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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, X, PieChart, AlertTriangle } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useColors } from '../../src/context/ThemeContext';
import { formatCompactCurrency, formatNumber } from '../../src/utils/format';
import { StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground, CategoryIcon } from '../../src/constants/icons';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import type { CreateBudgetRequest } from '../../src/types/goal';

const CATEGORIES = ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'other'];
const PERIODS = ['monthly', 'yearly'] as const;

export default function BudgetsScreen() {
  const { t } = useLanguage();
  const colors = useColors();
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

  const { data, isPending, isError, refetch } = useQuery({
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
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border" style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 mr-2" style={{ cursor: 'pointer' }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{t('budgets')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} className="bg-primary p-2 rounded-full" style={{ cursor: 'pointer' }}>
          <Plus size={24} color={colors.primaryForeground} />
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
        {isError ? (
          <View className="bg-danger-muted border border-danger/20 p-6 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text className="text-danger font-medium mb-2">{t('failedToLoadBudgets') || 'Failed to load budgets'}</Text>
            <Pressable
              onPress={() => refetch()}
              className="bg-danger/20 px-4 py-2 rounded-lg"
              style={{ cursor: 'pointer' }}
            >
              <Text className="text-danger font-medium">{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : budgets.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <PieChart size={48} color={colors.placeholder} />
            <Text className="text-lg font-semibold text-foreground mt-4">{t('noBudgets')}</Text>
            <Text className="text-muted-foreground text-center mt-2">{t('noBudgetsDescription')}</Text>
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
  const colors = useColors();
  const progressPercent = Math.min(budget.progress, 100);
  const categoryColor = CATEGORY_COLORS[budget.category.toLowerCase()] || colors.accent;

  return (
    <View className="bg-card border border-border p-4 rounded-xl">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          {budget.is_over_budget || budget.is_near_limit ? (
            <View
              className="p-2 rounded-lg mr-3"
              style={{
                backgroundColor: budget.is_over_budget ? `${colors.danger}26` : `${colors.accent}26`,
              }}
            >
              <AlertTriangle
                size={22}
                color={budget.is_over_budget ? colors.danger : colors.accent}
              />
            </View>
          ) : (
            <View className="mr-3">
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
      <View className="h-3 bg-secondary rounded-full mb-2 overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.min(progressPercent, 100)}%`,
            backgroundColor: budget.is_over_budget
              ? colors.danger
              : budget.is_near_limit
              ? colors.accent
              : categoryColor,
          }}
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
  const colors = useColors();
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
      // Check for new badges in background
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
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('createBudget')}</Text>
          <Pressable onPress={onClose} style={{ cursor: 'pointer' }}>
            <X size={24} color={colors.placeholder} />
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
          <FormError message={error} />

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('category')}</Text>
            <View className="flex-row flex-wrap gap-2">
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
            <Text className="text-muted-foreground mb-2">{t('amount')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground text-lg"
              style={{ outlineStyle: 'none' } as any}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
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
                  style={{ cursor: 'pointer' }}
                >
                  <Text className={period === p ? 'text-accent-foreground font-semibold' : 'text-foreground'}>
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
