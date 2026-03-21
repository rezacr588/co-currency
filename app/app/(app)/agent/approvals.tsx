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
import type { ActionApproval } from '@/src/api/agent';

type FilterType = 'all' | 'pending' | 'expired';

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
];

function ApprovalCard({ approval }: { approval: ActionApproval }) {
  const router = useRouter();
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
    <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: isExpiringSoon ? colors.warning : colors.border, marginBottom: 12, overflow: 'hidden' }}>
      {isExpiringSoon && (
        <View style={{ backgroundColor: colors.warning + '20', flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6 }}>
          <AlertTriangle size={14} color={colors.warning} />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.warning }}>
            {t('expiringSoon') || 'Expiring Soon'}
          </Text>
        </View>
      )}
      
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 4 }}>
              {t('stepApproval') || 'Step Approval'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              ID: {approval.step_id.slice(0, 8)}...
            </Text>
          </View>
          <View style={{ backgroundColor: statusColor + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {expiresAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <Clock size={14} color={colors.muted} />
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {isPending ? (t('expiresAt') || 'Expires at') : (t('expiredAt') || 'Expired at')}: {expiresAt.toLocaleString()}
            </Text>
          </View>
        )}

        {approval.rejection_reason && (
          <View style={{ backgroundColor: colors.danger + '10', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: colors.danger }}>
              {t('rejectionReason') || 'Rejection Reason'}: {approval.rejection_reason}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={{ backgroundColor: colors.info + '10', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} hitSlop={8}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, flex: 1 }}>
          {t('approvals') || 'Approvals'}
        </Text>
        {pendingCount > 0 && (
          <View style={{ backgroundColor: colors.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.background }}>
              {pendingCount} {t('pending') || 'pending'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => { setFilter(f.value); haptics.light(); }}
            style={({ pressed }) => [{
              backgroundColor: filter === f.value ? colors.accent : colors.card,
              borderWidth: 1,
              borderColor: filter === f.value ? colors.accent : colors.border,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: filter === f.value ? colors.background : colors.foreground }}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
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
