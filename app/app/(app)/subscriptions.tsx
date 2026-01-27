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
import {
  Plus,
  ArrowLeft,
  X,
  CreditCard,
  Calendar,
  Play,
  Pause,
  XCircle,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { formatCompactCurrency, formatDate } from '../../src/utils/format';
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

  const { data, isPending } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.list(),
  });

  const { data: summary } = useQuery({
    queryKey: ['subscriptions', 'summary'],
    queryFn: () => api.subscriptions.getSummary(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    setRefreshing(false);
  };

  const subscriptions = data?.subscriptions || [];
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
  const pausedSubscriptions = subscriptions.filter((s) => s.status === 'paused');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border" style={{ maxWidth: 1400, width: '100%', alignSelf: 'center' }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 mr-2" style={{ cursor: 'pointer' }}>
            <ArrowLeft size={24} color="rgb(248, 250, 252)" />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{t('subscriptions')}</Text>
        </View>
        <Pressable onPress={() => setShowForm(true)} className="bg-primary p-2 rounded-full" style={{ cursor: 'pointer' }}>
          <Plus size={24} color="#09090b" />
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
        {/* Summary Card */}
        {summary && (
          <View className="bg-card p-4 rounded-xl mb-6" style={{ maxWidth: isDesktop ? 500 : '100%' }}>
            <Text className="text-muted-foreground mb-2">{t('monthlyCost')}</Text>
            <Text className="text-3xl font-bold text-accent">
              {formatCompactCurrency(summary.total_monthly, summary.currency)}
            </Text>
            <View className="flex-row mt-3 pt-3 border-t border-border">
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">{t('active')}</Text>
                <Text className="text-foreground font-semibold">{summary.active_count}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">{t('paused')}</Text>
                <Text className="text-foreground font-semibold">{summary.paused_count}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">{t('yearlyCost')}</Text>
                <Text className="text-foreground font-semibold">
                  {formatCompactCurrency(summary.total_yearly, summary.currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {isPending ? (
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
        ) : subscriptions.length === 0 ? (
          <View className="bg-card p-8 rounded-xl items-center" style={{ maxWidth: isDesktop ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <CreditCard size={48} color="rgb(148, 163, 184)" />
            <Text className="text-lg font-semibold text-foreground mt-4">
              {t('noSubscriptions')}
            </Text>
            <Text className="text-muted-foreground text-center mt-2">
              {t('noSubscriptionsDescription')}
            </Text>
          </View>
        ) : (
          <>
            {activeSubscriptions.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-semibold text-foreground mb-4">
                  {t('active')} ({activeSubscriptions.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {activeSubscriptions.map((sub) => (
                    <View key={sub.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <SubscriptionCard subscription={sub} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {pausedSubscriptions.length > 0 && (
              <View>
                <Text className="text-lg font-semibold text-muted-foreground mb-4">
                  {t('paused')} ({pausedSubscriptions.length})
                </Text>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {pausedSubscriptions.map((sub) => (
                    <View key={sub.id} style={{
                      width: columns === 1 ? '100%' : `${(100 / columns) - (12 * (columns - 1) / columns)}%`,
                      minWidth: columns === 1 ? '100%' : 300,
                    }}>
                      <SubscriptionCard subscription={sub} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <SubscriptionFormModal visible={showForm} onClose={() => setShowForm(false)} />
    </SafeAreaView>
  );
}

function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (status: 'active' | 'paused' | 'cancelled') =>
      api.subscriptions.update(subscription.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const isPaused = subscription.status === 'paused';

  return (
    <View className={`bg-card p-4 rounded-xl ${isPaused ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className="bg-accent/20 p-2 rounded-lg mr-3">
            <CreditCard size={24} color="rgb(212, 175, 55)" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-foreground" numberOfLines={1}>
              {subscription.name}
            </Text>
            <Text className="text-muted-foreground text-sm capitalize">
              {subscription.category || t('uncategorized')}
            </Text>
          </View>
        </View>
        <Text className="text-lg font-bold text-foreground">
          {formatCompactCurrency(subscription.amount, subscription.currency)}
          <Text className="text-sm text-muted-foreground">/{t(subscription.billing_cycle)}</Text>
        </Text>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-border">
        <View className="flex-row items-center">
          <Calendar size={14} color="rgb(148, 163, 184)" />
          <Text className="text-muted-foreground text-sm ml-1">
            {t('nextBilling')}: {formatDate(subscription.next_billing_date)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => updateMutation.mutate(isPaused ? 'active' : 'paused')}
            disabled={updateMutation.isPending}
            className={`p-2 rounded-lg ${isPaused ? 'bg-success/20' : 'bg-warning/20'}`}
            style={{ cursor: 'pointer' }}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" />
            ) : isPaused ? (
              <Play size={16} color="rgb(16, 185, 129)" />
            ) : (
              <Pause size={16} color="rgb(212, 175, 55)" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SubscriptionFormModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>(
    'monthly'
  );
  const [category, setCategory] = useState('other');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => api.subscriptions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
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

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    mutation.mutate({
      name: name.trim(),
      amount: parsedAmount,
      currency,
      billing_cycle: billingCycle,
      category,
      next_billing_date: nextBillingDate.toISOString(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Text className="text-xl font-bold text-foreground">{t('addSubscription')}</Text>
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
            <Text className="text-muted-foreground mb-2">{t('name')}</Text>
            <TextInput
              className="bg-card p-4 rounded-xl text-foreground"
              style={{ outlineStyle: 'none' } as any}
              value={name}
              onChangeText={setName}
              placeholder="Netflix, Spotify, etc."
              placeholderTextColor="rgb(148, 163, 184)"
            />
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
              placeholderTextColor="rgb(148, 163, 184)"
            />
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('billingCycle')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {BILLING_CYCLES.map((cycle) => (
                <Pressable
                  key={cycle}
                  onPress={() => setBillingCycle(cycle)}
                  className={`px-4 py-2 rounded-lg ${
                    billingCycle === cycle ? 'bg-accent' : 'bg-card'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <Text
                    className={
                      billingCycle === cycle
                        ? 'text-accent-foreground font-semibold'
                        : 'text-foreground'
                    }
                  >
                    {t(cycle)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-muted-foreground mb-2">{t('category')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg ${category === cat ? 'bg-accent' : 'bg-card'}`}
                  style={{ cursor: 'pointer' }}
                >
                  <Text
                    className={
                      category === cat ? 'text-accent-foreground font-semibold' : 'text-foreground'
                    }
                  >
                    {t(cat) || cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={mutation.isPending}
            className={`bg-primary p-4 rounded-xl items-center ${mutation.isPending ? 'opacity-50' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <Text className="text-primary-foreground font-semibold text-lg">{t('addSubscription')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
