/**
 * Agent Dashboard - Main screen for Autonomous AI Financial Agent
 * 
 * Features:
 * - Daily financial briefing
 * - Active plans list
 * - Pending approvals
 * - Agent configuration access
 * - Quick actions
 */

import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Settings, TrendingUp, AlertCircle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAgentDashboard, useAgentStatus } from '@/src/hooks/useAgent';
import { BriefingCard, PlanCard, ApprovalCard } from '@/src/components/features/Agent';
import { LoadingSpinner, EmptyState } from '@/src/components/ui';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';

export default function AgentDashboardScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();

  const { isEnabled, isLoading: statusLoading } = useAgentStatus();
  const {
    plans,
    pendingApprovals,
    briefing,
    config,
    isLoading,
    isError,
    error,
    refetchAll,
  } = useAgentDashboard({ enabled: isEnabled });

  const handleRefresh = async () => {
    haptics.light();
    await refetchAll();
  };

  const handleCreatePlan = () => {
    haptics.medium();
    router.push('/agent/create-plan' as any);
  };

  const handleViewConfig = () => {
    haptics.light();
    router.push('/agent/settings' as any);
  };

  const handleViewPlan = (planId: string) => {
    haptics.light();
    router.push(`/agent/plans/${planId}` as any);
  };

  const handleViewApprovals = () => {
    haptics.light();
    router.push('/agent/approvals' as any);
  };

  // If agent is not enabled, show onboarding
  if (!statusLoading && !isEnabled) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: theme.alpha(colors.accent, 0.125),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.xxl,
            }}
          >
            <TrendingUp size={40} color={colors.accent} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Inter_700Bold',
              color: colors.foreground,
              textAlign: 'center',
              marginBottom: spacing.md,
            }}
          >
            {t('autonomousAgentTitle') || 'AI Financial Agent'}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.mutedForeground,
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: spacing.xxxl,
              maxWidth: 400,
            }}
          >
            {t('agentOnboardingDescription') ||
              'Let AI manage your finances autonomously. Create plans, set approval thresholds, and let CoAI handle recurring optimizations for you.'}
          </Text>
          <Pressable
            onPress={handleViewConfig}
            accessibilityRole="button"
            accessibilityLabel={t('enableAgent') || 'Enable Agent'}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: spacing.xxxl,
              paddingVertical: spacing.lg,
              borderRadius: radii.md,
            }}
          >
            <Text
              style={{
                color: colors.accentForeground,
                fontSize: 16,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {t('enableAgent') || 'Enable Agent'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Loading state
  if (isLoading || statusLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner />
        <Text style={{ color: colors.mutedForeground, marginTop: spacing.lg }}>
          {t('loadingAgent') || 'Loading agent...'}
        </Text>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        >
          <EmptyState
            icon={AlertCircle}
            title={t('errorLoadingAgent') || 'Error Loading Agent'}
            description={error?.message || t('tryAgainLater') || 'Please try again later'}
            actionLabel={t('retry') || 'Retry'}
            onAction={handleRefresh}
          />
        </ScrollView>
      </View>
    );
  }

  const activePlans = plans.data?.plans.filter(p => p.status === 'active') || [];
  const approvals = pendingApprovals.data?.approvals || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
              {t('agentDashboard') || 'AI Agent'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: spacing.xs }}>
              {t('autonomousFinancialManagement') || 'Autonomous Financial Management'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={handleCreatePlan}
              accessibilityRole="button"
              accessibilityLabel={t('a11yAdd') || 'Add'}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              <Plus size={20} color={colors.accentForeground} />
            </Pressable>
            <Pressable
              onPress={handleViewConfig}
              accessibilityRole="button"
              accessibilityLabel={t('agentSettings') || 'Agent Settings'}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={plans.isRefetching || briefing.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Daily Briefing */}
        {briefing.data?.briefing && (
          <View style={{ marginBottom: spacing.xl }}>
            <BriefingCard
              onViewApprovals={handleViewApprovals}
            />
          </View>
        )}

        {/* Pending Approvals */}
        {approvals.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginBottom: spacing.md,
              }}
            >
              {t('pendingApprovals') || 'Pending Approvals'} ({approvals.length})
            </Text>
            {approvals.slice(0, 3).map((approval) => (
              <View key={approval.id} style={{ marginBottom: spacing.md }}>
                <ApprovalCard
                  approval={approval}
                  planId={approval.metadata?.plan_id as string || ''}
                  planTitle={approval.metadata?.plan_title as string}
                  stepTitle={approval.metadata?.step_title as string}
                  estimatedImpact={approval.metadata?.estimated_impact as number}
                  currency={approval.metadata?.currency as string}
                  onApproved={handleRefresh}
                  onRejected={handleRefresh}
                />
              </View>
            ))}
            {approvals.length > 3 && (
              <Pressable
                onPress={handleViewApprovals}
                accessibilityRole="button"
                accessibilityLabel={t('viewAllApprovals') || 'View all approvals'}
                style={{
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                  {t('viewAllApprovals') || `View all ${approvals.length} approvals`}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Active Plans */}
        {activePlans.length > 0 ? (
          <View style={{ marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginBottom: spacing.md,
              }}
            >
              {t('activePlans') || 'Active Plans'} ({activePlans.length})
            </Text>
            {activePlans.map((plan) => (
              <View key={plan.id} style={{ marginBottom: spacing.md }}>
                <PlanCard
                  plan={plan}
                  onViewDetails={handleViewPlan}
                  showSteps={false}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginBottom: spacing.xl }}>
            <EmptyState
              icon={TrendingUp}
              title={t('noActivePlans') || 'No Active Plans'}
              description={t('createFirstPlan') || 'Create your first financial plan to get started'}
              actionLabel={t('createPlan') || 'Create Plan'}
              onAction={handleCreatePlan}
            />
          </View>
        )}

        {/* Agent Status */}
        {config.data?.config && (
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: radii.md,
              padding: spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                color: colors.foreground,
                marginBottom: spacing.md,
              }}
            >
              {t('agentConfiguration') || 'Agent Configuration'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('autoApproveBelow') || 'Auto-approve below'}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {config.data.config.auto_approve_threshold} {config.data.config.auto_approve_currency}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('dailyAutopilot') || 'Daily autopilot'}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {config.data.config.daily_autopilot_enabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
              </Text>
            </View>
            <Pressable
              onPress={handleViewConfig}
              accessibilityRole="button"
              accessibilityLabel={t('editSettings') || 'Edit Settings'}
              style={{
                marginTop: spacing.md,
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                {t('editSettings') || 'Edit Settings'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
