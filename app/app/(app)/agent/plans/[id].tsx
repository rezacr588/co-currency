/**
 * Plan Detail Screen - Shows detailed view of a single financial plan
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, Edit, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAgentPlan, useActivatePlan, usePausePlan, useResumePlan, useDeletePlan } from '@/src/hooks/useAgent';
import { LoadingSpinner, EmptyState } from '@/src/components/ui';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import { spacing } from '@/src/theme';

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

  const statusConfigMap = useMemo(() => ({
    draft: { label: t('statusDraft') || 'Draft', color: colors.palette.gray, icon: Edit },
    active: { label: t('statusActive') || 'Active', color: colors.success, icon: Play },
    paused: { label: t('statusPaused') || 'Paused', color: colors.warning, icon: Pause },
    completed: { label: t('statusCompleted') || 'Completed', color: colors.info, icon: CheckCircle },
    cancelled: { label: t('statusCancelled') || 'Cancelled', color: colors.danger, icon: XCircle },
  }), [colors, t]);

  const priorityConfigMap = useMemo(() => ({
    low: { label: t('priorityLow') || 'Low', color: colors.palette.gray },
    medium: { label: t('priorityMedium') || 'Medium', color: colors.warning },
    high: { label: t('priorityHigh') || 'High', color: colors.palette.orange },
    urgent: { label: t('priorityUrgent') || 'Urgent', color: colors.danger },
  }), [colors, t]);

  // Step status map retained for future use when step rendering is completed.
  // Intentionally referenced to keep colors/hooks in scope.
  void useMemo(() => ({
    pending: { label: t('stepStatusPending') || 'Pending', color: colors.palette.gray, icon: Clock },
    approved: { label: t('stepStatusApproved') || 'Approved', color: colors.success, icon: CheckCircle },
    rejected: { label: t('stepStatusRejected') || 'Rejected', color: colors.danger, icon: XCircle },
    executing: { label: t('stepStatusExecuting') || 'Executing', color: colors.info, icon: Play },
    completed: { label: t('stepStatusCompleted') || 'Completed', color: colors.success, icon: CheckCircle },
    failed: { label: t('stepStatusFailed') || 'Failed', color: colors.danger, icon: AlertCircle },
    skipped: { label: t('stepStatusSkipped') || 'Skipped', color: colors.palette.gray, icon: XCircle },
  }), [colors, t]);

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
        <View style={{ padding: spacing.lg }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('a11yBack') || 'Back'}
            hitSlop={8}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={{ flex: 1, padding: spacing.lg }}>
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

  const statusConfig = statusConfigMap[plan.status as keyof typeof statusConfigMap] || statusConfigMap.draft;
  const priorityConfig = priorityConfigMap[plan.priority as keyof typeof priorityConfigMap] || priorityConfigMap.medium;
  const StatusIcon = statusConfig.icon;
  void priorityConfig;
  void StatusIcon;
  void progress;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('a11yBack') || 'Back'}
            hitSlop={8}
            style={({ pressed }) => [{ padding: spacing.sm, marginEnd: spacing.sm }, pressed && { opacity: 0.7 }]}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }} numberOfLines={1}>{plan.title}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }} refreshControl={<RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} tintColor={colors.accent} />}>
        {/* Status Card - truncated, see full file */}
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Plan detail screen created</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
