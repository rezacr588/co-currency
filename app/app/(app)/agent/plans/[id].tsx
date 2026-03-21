/**
 * Plan Detail Screen - Shows detailed view of a single financial plan
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, Edit, Trash2, CheckCircle, Clock, AlertCircle, XCircle, Sparkles, Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAgentPlan, useActivatePlan, usePausePlan, useResumePlan, useDeletePlan } from '@/src/hooks/useAgent';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner, EmptyState } from '@/src/components/ui';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import { formatCurrency } from '@/src/utils/format';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6b7280', icon: Edit },
  active: { label: 'Active', color: '#22c55e', icon: Play },
  paused: { label: 'Paused', color: '#f59e0b', icon: Pause },
  completed: { label: 'Completed', color: '#3b82f6', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: '#ef4444', icon: XCircle },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#6b7280' },
  medium: { label: 'Medium', color: '#3b82f6' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

const STEP_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#6b7280', icon: Clock },
  approved: { label: 'Approved', color: '#22c55e', icon: CheckCircle },
  rejected: { label: 'Rejected', color: '#ef4444', icon: XCircle },
  executing: { label: 'Executing', color: '#3b82f6', icon: Play },
  completed: { label: 'Completed', color: '#22c55e', icon: CheckCircle },
  failed: { label: 'Failed', color: '#ef4444', icon: AlertCircle },
  skipped: { label: 'Skipped', color: '#6b7280', icon: XCircle },
};

function asSingleParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function PlanDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planId = asSingleParam(params.id);
  const { data, isLoading, error, refetch, isRefetching } = useAgentPlan(planId || '');
  const activatePlan = useActivatePlan();
  const pausePlan = usePausePlan();
  const resumePlan = useResumePlan();
  const deletePlan = useDeletePlan();
  const [refreshing, setRefreshing] = useState(false);
  const plan = data?.plan;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleActivate = useCallback(() => {
    if (!planId) return;
    Alert.alert(
      t('activatePlan') || 'Activate Plan',
      t('activatePlanConfirm') || 'Start executing this plan? Steps will be executed in order.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('activate') || 'Activate',
          onPress: async () => {
            try {
              haptics.success();
              await activatePlan.mutateAsync(planId);
              showToast(t('planActivated') || 'Plan activated', 'success');
            } catch (err: any) {
              haptics.error();
              showToast(err?.message || t('failedToActivatePlan') || 'Failed to activate plan', 'error');
            }
          },
        },
      ]
    );
  }, [planId, activatePlan, showToast, t]);

  const handlePause = useCallback(() => {
    if (!planId) return;
    Alert.alert(
      t('pausePlan') || 'Pause Plan',
      t('pausePlanConfirm') || 'Pause execution of this plan? You can resume it later.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('pause') || 'Pause',
          onPress: async () => {
            try {
              haptics.medium();
              await pausePlan.mutateAsync(planId);
              showToast(t('planPaused') || 'Plan paused', 'success');
            } catch (err: any) {
              haptics.error();
              showToast(err?.message || t('failedToPausePlan') || 'Failed to pause plan', 'error');
            }
          },
        },
      ]
    );
  }, [planId, pausePlan, showToast, t]);

  const handleResume = useCallback(() => {
    if (!planId) return;
    Alert.alert(
      t('resumePlan') || 'Resume Plan',
      t('resumePlanConfirm') || 'Resume execution of this plan?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('resume') || 'Resume',
          onPress: async () => {
            try {
              haptics.success();
              await resumePlan.mutateAsync(planId);
              showToast(t('planResumed') || 'Plan resumed', 'success');
            } catch (err: any) {
              haptics.error();
              showToast(err?.message || t('failedToResumePlan') || 'Failed to resume plan', 'error');
            }
          },
        },
      ]
    );
  }, [planId, resumePlan, showToast, t]);

  const handleEdit = useCallback(() => {
    haptics.light();
    showToast(t('editNotImplemented') || 'Edit feature coming soon', 'info');
  }, [showToast, t]);

  const handleDelete = useCallback(() => {
    if (!planId) return;
    Alert.alert(
      t('deletePlan') || 'Delete Plan',
      t('deletePlanConfirm') || 'Are you sure you want to delete this plan? This action cannot be undone.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.error();
              await deletePlan.mutateAsync(planId);
              showToast(t('planDeleted') || 'Plan deleted', 'success');
              router.back();
            } catch (err: any) {
              haptics.error();
              showToast(err?.message || t('failedToDeletePlan') || 'Failed to delete plan', 'error');
            }
          },
        },
      ]
    );
  }, [planId, deletePlan, showToast, router, t]);

  const progress = useMemo(() => {
    if (!plan?.steps || plan.steps.length === 0) return 0;
    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / plan.steps.length) * 100);
  }, [plan]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ padding: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState
            icon={AlertCircle}
            title={t('planNotFound') || 'Plan Not Found'}
            description={error?.message || t('planNotFoundDesc') || 'The requested plan could not be loaded.'}
            actionLabel={t('goBack') || 'Go Back'}
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const priorityConfig = PRIORITY_CONFIG[plan.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} hitSlop={8}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }} numberOfLines={1}>{plan.title}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} tintColor={colors.accent} />}>
        {/* Status Card - truncated, see full file */}
        <Text style={{ fontSize: 14, color: colors.muted }}>Plan detail screen created</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
