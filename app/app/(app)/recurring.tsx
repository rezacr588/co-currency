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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
import { Plus, ArrowLeft, X, RefreshCw, Play, Pause, TrendingUp, TrendingDown } from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatDate, formatTransactionAmount } from '../../src/utils/format';
import { FrequencyIcon, StyledCategoryIcon, CATEGORY_COLORS, getCategoryBackground, CategoryIcon } from '../../src/constants/icons';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { SkeletonCard, SkeletonList } from '../../src/components/ui/Skeleton';
import type { CreateRecurringRequest } from '../../src/types/goal';

const CATEGORIES = ['income', 'bills', 'food', 'transportation', 'entertainment', 'other'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export default function RecurringScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const { data, isPending, isError, refetch, refreshing, onRefresh } = useRefreshableQuery({
    queryKey: ['recurring'],
    queryFn: () => api.recurring.list(),
  });

  const transactions = data?.recurring_transactions || [];
  const activeTransactions = transactions.filter((t) => t.is_active);
  const pausedTransactions = transactions.filter((t) => !t.is_active);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ cursor: 'pointer', padding: 8, marginRight: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('back') || 'Go back'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('recurring')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, padding: 10, borderRadius: 9999 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('createRecurring') || 'Create Recurring'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{t('failedToLoadRecurring') || 'Failed to load recurring transactions'}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ cursor: 'pointer', backgroundColor: colors.danger + '33', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonCard} />
        ) : transactions.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <RefreshCw size={48} color={colors.placeholder} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 16 }}>{t('noRecurring')}</Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>{t('noRecurringDescription')}</Text>
          </View>
        ) : (
          <>
            {activeTransactions.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>
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
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 16 }}>
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
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const executeMutation = useMutation({
    mutationFn: () => api.recurring.execute(transaction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      showToast(t('transactionExecuted') || 'Transaction executed', 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('failedToExecute') || 'Failed to execute', 'error');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.recurring.update(transaction.id, { is_active: !transaction.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      showToast(
        transaction.is_active
          ? t('recurringPaused') || 'Recurring paused'
          : t('recurringResumed') || 'Recurring resumed',
        'success'
      );
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('failedToUpdate') || 'Failed to update', 'error');
    },
  });

  const handleExecute = () => {
    Alert.alert(
      t('executeTransaction') || 'Execute Transaction',
      t('executeTransactionConfirm') || 'Are you sure you want to execute this transaction now?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: t('execute') || 'Execute', onPress: () => executeMutation.mutate() },
      ]
    );
  };

  const handleToggle = () => {
    const action = transaction.is_active
      ? t('pauseRecurring') || 'Pause'
      : t('resumeRecurring') || 'Resume';
    Alert.alert(
      action,
      transaction.is_active
        ? t('pauseRecurringConfirm') || 'Are you sure you want to pause this recurring transaction?'
        : t('resumeRecurringConfirm') || 'Resume this recurring transaction?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: action, onPress: () => toggleMutation.mutate() },
      ]
    );
  };

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, opacity: !transaction.is_active ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ marginRight: 12 }}>
            <StyledCategoryIcon
              category={transaction.category || 'other'}
              size={22}
              backgroundOpacity={0.15}
              borderRadius={10}
              padding={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>
              {transaction.description || transaction.category || 'Recurring'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FrequencyIcon frequency={transaction.frequency} size={12} color={colors.placeholder} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginLeft: 4 }}>{t(transaction.frequency)}</Text>
            </View>
          </View>
        </View>
        <Text
          style={{
            fontSize: 18,
            fontFamily: 'Inter_700Bold',
            color: transaction.type === 'credit' ? colors.success : colors.danger,
          }}
        >
          {formatTransactionAmount(transaction)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('nextExecution')}</Text>
          <Text style={{ color: colors.foreground }}>{formatDate(transaction.next_execution)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={handleExecute}
            disabled={executeMutation.isPending || !transaction.is_active}
            style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.accent, padding: 8, borderRadius: 8, opacity: !transaction.is_active ? 0.4 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('execute') || 'Execute transaction'}
            accessibilityRole="button"
          >
            {executeMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Play size={16} color={colors.primaryForeground} />
            )}
          </Pressable>
          <Pressable
            onPress={handleToggle}
            disabled={toggleMutation.isPending}
            style={({ pressed }) => [{ cursor: 'pointer', padding: 8, borderRadius: 8, backgroundColor: transaction.is_active ? colors.warning + '33' : colors.success + '33', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={transaction.is_active ? (t('pauseRecurring') || 'Pause') : (t('resumeRecurring') || 'Resume')}
            accessibilityRole="button"
          >
            {toggleMutation.isPending ? (
              <ActivityIndicator size="small" />
            ) : transaction.is_active ? (
              <Pause size={16} color={colors.warning} />
            ) : (
              <Play size={16} color={colors.success} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RecurringFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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
      showToast(t('recurringCreated') || 'Recurring transaction created', 'success');
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('createRecurring')}</Text>
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
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('type')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setType('debit')}
                style={{ cursor: 'pointer', flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: type === 'debit' ? colors.danger : colors.card }}
              >
                <TrendingDown size={20} color={type === 'debit' ? '#ffffff' : colors.danger} />
                <Text style={{ marginTop: 4, color: type === 'debit' ? '#ffffff' : colors.foreground, fontFamily: type === 'debit' ? 'Inter_600SemiBold' : undefined }}>
                  {t('expense')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setType('credit')}
                style={{ cursor: 'pointer', flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: type === 'credit' ? colors.success : colors.card }}
              >
                <TrendingUp size={20} color={type === 'credit' ? '#ffffff' : colors.success} />
                <Text style={{ marginTop: 4, color: type === 'credit' ? '#ffffff' : colors.foreground, fontFamily: type === 'credit' ? 'Inter_600SemiBold' : undefined }}>
                  {t('income')}
                </Text>
              </Pressable>
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
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('frequency')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FREQUENCIES.map((freq) => (
                <Pressable
                  key={freq}
                  onPress={() => setFrequency(freq)}
                  style={{ cursor: 'pointer', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: frequency === freq ? colors.accent : colors.card }}
                >
                  <Text style={{ color: frequency === freq ? colors.accentForeground : colors.foreground, fontFamily: frequency === freq ? 'Inter_600SemiBold' : undefined }}>
                    {t(freq)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

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
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('description')}</Text>
            <TextInput
              style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, color: colors.foreground, outlineStyle: 'none' } as any}
              value={description}
              onChangeText={setDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <Button variant="primary" size="lg" onPress={handleSubmit} isLoading={mutation.isPending}>
            {t('createRecurring')}
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
