import { useState, useEffect } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefreshableQuery } from '../../src/hooks/useRefreshableQuery';
import {
  Plus,
  ArrowLeft,
  X,
  CreditCard,
  Calendar,
  Play,
  Pause,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
import { useToast } from '../../src/components/ui/Toast';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { SkeletonCard, SkeletonList } from '../../src/components/ui/Skeleton';
import { COMMON_CURRENCIES } from '../../src/constants/currencies';
import { getCurrencyDisplay } from '../../src/utils/format';
import { haptics } from '../../src/utils/haptics';
import type { CreateSubscriptionRequest, Subscription } from '../../src/types/goal';

const BILLING_CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
const CATEGORIES = [
  'streaming',
  'software',
  'gaming',
  'fitness',
  'utilities',
  'education',
  'other',
];

export default function SubscriptionsScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
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
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.list(),
  });

  const { data: summary } = useQuery({
    queryKey: ['subscriptions', 'summary'],
    queryFn: () => api.subscriptions.getSummary(),
  });

  const subscriptions = data?.subscriptions || [];
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
  const pausedSubscriptions = subscriptions.filter((s) => s.status === 'paused');
  const cancelledSubscriptions = subscriptions.filter((s) => s.status === 'cancelled');

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSubscription(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ cursor: 'pointer', padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('back') || 'Go back'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{t('subscriptions')}</Text>
        </View>
        <Pressable onPress={() => { setEditingSubscription(null); setShowForm(true); }} style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.primary, padding: 10, borderRadius: 9999 }, pressed && { opacity: 0.7 }]} accessibilityLabel={t('addSubscription') || 'Add Subscription'} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
      >
        {/* Summary Card */}
        {summary && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 24, maxWidth: isDesktop ? 500 : '100%' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 8 }}>{t('monthlyCost')}</Text>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.accent }}>
              {formatCompactCurrency(summary.total_monthly, summary.currency)}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('active')}</Text>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{summary.active_count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('paused')}</Text>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{summary.paused_count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('yearlyCost')}</Text>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  {formatCompactCurrency(summary.total_yearly, summary.currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {isError ? (
          <View style={{ backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger + '33', padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{t('failedToLoadSubscriptions') || 'Failed to load subscriptions'}</Text>
            <Pressable
              onPress={() => refetch()}
              style={{ backgroundColor: colors.danger + '33', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, cursor: 'pointer' }}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_500Medium' }}>{t('retry') || 'Retry'}</Text>
            </Pressable>
          </View>
        ) : isPending ? (
          <SkeletonList count={3} ItemComponent={SkeletonCard} />
        ) : subscriptions.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 24, borderRadius: 12, alignItems: 'center', maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <CreditCard size={48} color={colors.placeholder} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 16 }}>
              {t('noSubscriptions')}
            </Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
              {t('noSubscriptionsDescription')}
            </Text>
          </View>
        ) : (
          <>
            {activeSubscriptions.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 16 }}>
                  {t('active')} ({activeSubscriptions.length})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {activeSubscriptions.map((sub) => (
                    <View key={sub.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <SubscriptionCard subscription={sub} onEdit={handleEdit} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {pausedSubscriptions.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 16 }}>
                  {t('paused')} ({pausedSubscriptions.length})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {pausedSubscriptions.map((sub) => (
                    <View key={sub.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <SubscriptionCard subscription={sub} onEdit={handleEdit} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {cancelledSubscriptions.length > 0 && (
              <View>
                <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 16 }}>
                  {t('cancelled') || 'Cancelled'} ({cancelledSubscriptions.length})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {cancelledSubscriptions.map((sub) => (
                    <View key={sub.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <SubscriptionCard subscription={sub} onEdit={handleEdit} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <SubscriptionFormModal visible={showForm} onClose={handleFormClose} editSubscription={editingSubscription} />
    </SafeAreaView>
  );
}

function SubscriptionCard({ subscription, onEdit }: { subscription: Subscription; onEdit: (sub: Subscription) => void }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const updateMutation = useMutation({
    mutationFn: (status: 'active' | 'paused' | 'cancelled') =>
      api.subscriptions.update(subscription.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      haptics.success();
      showToast(t('subscriptionUpdated') || 'Subscription updated', 'success');
    },
    onError: (err) => {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('failedToUpdate') || 'Failed to update', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.subscriptions.delete(subscription.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      haptics.success();
      showToast(t('subscriptionDeleted') || 'Subscription deleted', 'success');
    },
    onError: (err) => {
      haptics.error();
      showToast(err instanceof Error ? err.message : t('failedToDelete') || 'Failed to delete', 'error');
    },
  });

  const isPaused = subscription.status === 'paused';
  const isCancelled = subscription.status === 'cancelled';
  const isActive = subscription.status === 'active';

  const handleToggle = () => {
    const newStatus = isPaused ? 'active' : 'paused';
    const action = isPaused
      ? t('resumeSubscription') || 'Resume'
      : t('pauseSubscription') || 'Pause';
    haptics.light();
    Alert.alert(
      action,
      isPaused
        ? t('resumeSubscriptionConfirm') || `Resume ${subscription.name}?`
        : t('pauseSubscriptionConfirm') || `Pause ${subscription.name}?`,
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: action, onPress: () => updateMutation.mutate(newStatus) },
      ]
    );
  };

  const handleCancel = () => {
    haptics.warning();
    Alert.alert(
      t('cancelSubscription') || 'Cancel Subscription',
      t('confirmCancelSubscription') || `Are you sure you want to cancel ${subscription.name}? You can reactivate it later.`,
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: t('cancelSubscription') || 'Cancel Subscription', style: 'destructive', onPress: () => updateMutation.mutate('cancelled') },
      ]
    );
  };

  const handleDelete = () => {
    haptics.warning();
    Alert.alert(
      t('confirmDelete') || 'Confirm Delete',
      t('confirmDeleteSubscription') || `Are you sure you want to delete ${subscription.name}? This action cannot be undone.`,
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: t('delete') || 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  const handleEdit = () => {
    haptics.light();
    onEdit(subscription);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, opacity: isCancelled ? 0.5 : isPaused ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ backgroundColor: colors.accent + '33', padding: 8, borderRadius: 8, marginEnd: 12 }}>
            <CreditCard size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>
              {subscription.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, textTransform: 'capitalize' }}>
              {subscription.category || t('uncategorized')}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground }} numberOfLines={1}>
          {formatCompactCurrency(subscription.amount, subscription.currency)}
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>/{t(subscription.billing_cycle)}</Text>
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Calendar size={14} color={colors.placeholder} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginStart: 4 }} numberOfLines={1}>
            {t('nextBilling')}: {formatDate(subscription.next_billing_date)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Pause/Resume toggle - not shown for cancelled */}
          {!isCancelled && (
            <Pressable
              onPress={handleToggle}
              disabled={updateMutation.isPending}
              style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: isPaused ? colors.success + '33' : colors.warning + '33', cursor: 'pointer', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={isPaused ? (t('resumeSubscription') || 'Resume') : (t('pauseSubscription') || 'Pause')}
              accessibilityRole="button"
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" />
              ) : isPaused ? (
                <Play size={16} color={colors.success} />
              ) : (
                <Pause size={16} color={colors.warning} />
              )}
            </Pressable>
          )}

          {/* Edit button */}
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.primary + '33', cursor: 'pointer', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('editSubscription') || 'Edit Subscription'}
            accessibilityRole="button"
          >
            <Pencil size={16} color={colors.primary} />
          </Pressable>

          {/* Cancel button - only when active */}
          {isActive && (
            <Pressable
              onPress={handleCancel}
              disabled={updateMutation.isPending}
              style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.warning + '33', cursor: 'pointer', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={t('cancelSubscription') || 'Cancel Subscription'}
              accessibilityRole="button"
            >
              <XCircle size={16} color={colors.warning} />
            </Pressable>
          )}

          {/* Delete button */}
          <Pressable
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.danger + '33', cursor: 'pointer', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('delete') || 'Delete'}
            accessibilityRole="button"
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Trash2 size={16} color={colors.danger} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SubscriptionFormModal({ visible, onClose, editSubscription }: { visible: boolean; onClose: () => void; editSubscription: Subscription | null }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [category, setCategory] = useState('other');
  const [error, setError] = useState('');

  const isEditing = !!editSubscription;

  useEffect(() => {
    if (editSubscription) {
      setName(editSubscription.name);
      setAmount(String(editSubscription.amount));
      setCurrency(editSubscription.currency);
      setBillingCycle(editSubscription.billing_cycle);
      setCategory(editSubscription.category || 'other');
      setError('');
    } else {
      resetForm();
    }
  }, [editSubscription]);

  const createMutation = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => api.subscriptions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      haptics.success();
      onClose();
      resetForm();
      showToast(t('subscriptionCreated') || 'Subscription created', 'success');
    },
    onError: (err) => {
      haptics.error();
      setError(err instanceof Error ? err.message : t('failedToCreate') || 'Failed to create subscription');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; amount: number; currency: string; billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly'; category: string }) =>
      api.subscriptions.update(editSubscription!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      haptics.success();
      onClose();
      resetForm();
      showToast(t('subscriptionUpdated') || 'Subscription updated', 'success');
    },
    onError: (err) => {
      haptics.error();
      setError(err instanceof Error ? err.message : t('failedToUpdate') || 'Failed to update subscription');
    },
  });

  const resetForm = () => {
    setName('');
    setAmount('');
    setCurrency('USD');
    setBillingCycle('monthly');
    setCategory('other');
    setError('');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('enterName'));
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('enterValidAmount'));
      return;
    }
    setError('');

    if (isEditing) {
      updateMutation.mutate({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        billing_cycle: billingCycle,
        category,
      });
    } else {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      createMutation.mutate({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        billing_cycle: billingCycle,
        category,
        next_billing_date: nextBillingDate.toISOString(),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {isEditing ? (t('editSubscription') || 'Edit Subscription') : t('addSubscription')}
          </Text>
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
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('name')}</Text>
            <TextInput
              style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, color: colors.foreground, outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Netflix, Spotify, etc."
              placeholderTextColor={colors.placeholder}
            />
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

          {/* Currency Picker */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('currency') || 'Currency'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {COMMON_CURRENCIES.map((cur) => {
                const display = getCurrencyDisplay(cur);
                const isSelected = currency === cur;
                return (
                  <Pressable
                    key={cur}
                    onPress={() => { setCurrency(cur); haptics.selection(); }}
                    style={({ pressed }) => [{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: isSelected ? colors.accent : colors.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }, pressed && { opacity: 0.7 }]}
                  >
                    {display.flag ? (
                      <Text style={{ fontSize: 16 }}>{display.flag}</Text>
                    ) : null}
                    <Text style={{
                      color: isSelected ? colors.accentForeground : colors.foreground,
                      fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      fontSize: 14,
                    }}>
                      {cur}
                    </Text>
                    <Text style={{
                      color: isSelected ? colors.accentForeground + 'AA' : colors.mutedForeground,
                      fontSize: 12,
                    }}>
                      {display.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('billingCycle')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BILLING_CYCLES.map((cycle) => (
                <Pressable
                  key={cycle}
                  onPress={() => setBillingCycle(cycle)}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: billingCycle === cycle ? colors.accent : colors.card, cursor: 'pointer' }}
                >
                  <Text
                    style={{ color: billingCycle === cycle ? colors.accentForeground : colors.foreground, fontFamily: billingCycle === cycle ? 'Inter_600SemiBold' : undefined }}
                  >
                    {t(cycle)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>{t('category')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: category === cat ? colors.accent : colors.card, cursor: 'pointer' }}
                >
                  <Text
                    style={{ color: category === cat ? colors.accentForeground : colors.foreground, fontFamily: category === cat ? 'Inter_600SemiBold' : undefined }}
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button variant="primary" size="lg" onPress={handleSubmit} isLoading={isPending}>
            {isEditing ? (t('updateSubscription') || 'Update Subscription') : t('addSubscription')}
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
