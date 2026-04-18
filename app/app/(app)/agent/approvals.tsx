/**
 * Agent Approvals Screen
 * View all pending approvals - approve/reject from plan detail screen
 */

import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { usePendingApprovals } from '@/src/hooks/useAgent';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';
import type { ActionApproval } from '@/src/api/agent';

type FilterType = 'all' | 'pending' | 'expired';

function ApprovalCard({ approval }: { approval: ActionApproval }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const isPending = approval.approval_status === 'pending';
  const isExpired = approval.approval_status === 'expired';
  const expiresAt = approval.expires_at ? new Date(approval.expires_at) : null;
  const isExpiringSoon = expiresAt && isPending && (expiresAt.getTime() - Date.now() < 3600000); // < 1 hour

  const statusColor = isPending
    ? (isExpiringSoon ? colors.warning : colors.info)
    : isExpired ? colors.danger : colors.success;

  const statusLabel = isPending
    ? (t('pending') || 'Pending')
    : approval.approval_status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: isExpiringSoon ? colors.warning : colors.border, marginBottom: spacing.md, overflow: 'hidden' }}>
      {isExpiringSoon && (
        <View style={{ backgroundColor: theme.alpha(colors.warning, 0.125), flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: 6 }}>
          <AlertTriangle size={14} color={colors.warning} />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.warning }}>
            {t('expiringSoon') || 'Expiring Soon'}
          </Text>
        </View>
      )}

      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: spacing.xs }}>
              {t('stepApproval') || 'Step Approval'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              ID: {approval.step_id.slice(0, 8)}...
            </Text>
          </View>
          <View style={{ backgroundColor: theme.alpha(statusColor, 0.125), borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {expiresAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
            <Clock size={14} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {isPending ? (t('expiresAt') || 'Expires at') : (t('expiredAt') || 'Expired at')}: {expiresAt.toLocaleString()}
            </Text>
          </View>
        )}

        {approval.rejection_reason && (
          <View style={{ backgroundColor: theme.alpha(colors.danger, 0.08), borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.md }}>
            <Text style={{ fontSize: 12, color: colors.danger }}>
              {t('rejectionReason') || 'Rejection Reason'}: {approval.rejection_reason}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={{ backgroundColor: theme.alpha(colors.info, 0.08), borderRadius: radii.sm, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ExternalLink size={14} color={colors.info} />
            <Text style={{ fontSize: 12, color: colors.info, flex: 1 }}>
              {t('approveFromPlan') || 'Approve or reject from the plan detail screen'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const [filter, setFilter] = useState<FilterType>('all');

  const { data: approvalsData, isLoading, refetch, isRefetching } = usePendingApprovals();

  const approvals = approvalsData?.approvals ?? [];

  const filters: { value: FilterType; label: string }[] = useMemo(() => [
    { value: 'all', label: t('filterAll') || 'All' },
    { value: 'pending', label: t('pending') || 'Pending' },
    { value: 'expired', label: t('expired') || 'Expired' },
  ], [t]);

  const filteredApprovals = useMemo(() => {
    if (filter === 'all') return approvals;
    if (filter === 'pending') return approvals.filter(a => a.approval_status === 'pending');
    if (filter === 'expired') return approvals.filter(a => a.approval_status === 'expired');
    return approvals;
  }, [approvals, filter]);

  const pendingCount = approvals.filter(a => a.approval_status === 'pending').length;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <LoadingSpinner size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('a11yBack') || 'Back'}
          hitSlop={8}
          style={({ pressed }) => [{ padding: spacing.sm, marginEnd: spacing.sm }, pressed && { opacity: 0.7 }]}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, flex: 1 }}>
          {t('approvals') || 'Approvals'}
        </Text>
        {pendingCount > 0 && (
          <View style={{ backgroundColor: colors.warning, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primaryForeground }}>
              {pendingCount} {t('pending') || 'pending'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        style={{ flexGrow: 0 }}
      >
        {filters.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => { setFilter(f.value); haptics.light(); }}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            accessibilityState={{ selected: filter === f.value }}
            style={({ pressed }) => [{
              backgroundColor: filter === f.value ? colors.accent : colors.card,
              borderWidth: 1,
              borderColor: filter === f.value ? colors.accent : colors.border,
              borderRadius: radii.xl,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: filter === f.value ? colors.accentForeground : colors.foreground }}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
      >
        {filteredApprovals.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t('noApprovals') || 'No Approvals'}
            description={t('noApprovalsDesc') || 'All caught up! No actions need your approval.'}
          />
        ) : (
          filteredApprovals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
