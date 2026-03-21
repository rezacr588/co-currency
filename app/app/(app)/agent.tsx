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
import { useLanguage } from '../../context/LanguageContext';
import { useAgentDashboard, useAgentStatus } from '../../hooks/useAgent';
import { BriefingCard, PlanCard, ApprovalCard } from '../../components/features/Agent';
import { LoadingSpinner, EmptyState } from '../../components/ui';
import { haptics } from '../../utils/haptics';

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
    // TODO: Navigate to create plan screen
    router.push('/agent/create-plan');
  };

  const handleViewConfig = () => {
    haptics.light();
    router.push('/agent/settings');
  };

  const handleViewPlan = (planId: string) => {
    haptics.light();
    router.push(`/agent/plans/${planId}`);
  };

  const handleViewApprovals = () => {
    haptics.light();
    router.push('/agent/approvals');
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
            padding: 20,
          }}
        >
          <View 
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: `${colors.accent}20`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
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
              marginBottom: 12,
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
              marginBottom: 32,
              maxWidth: 400,
            }}
          >
            {t('agentOnboardingDescription') || 
              'Let AI manage your finances autonomously. Create plans, set approval thresholds, and let CoAI handle recurring optimizations for you.'}
          </Text>
          <Pressable
            onPress={handleViewConfig}
            style={{ 
              backgroundColor: colors.accent,
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 12,
            }}
          >
            <Text 
              style={{ 
                color: colors.background, 
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
        <Text style={{ color: colors.mutedForeground, marginTop: 16 }}>
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
            padding: 20,
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
            action={{
              label: t('retry') || 'Retry',
              onPress: handleRefresh,
            }}
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
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
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
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}>
              {t('autonomousFinancialManagement') || 'Autonomous Financial Management'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={handleCreatePlan}
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Plus size={20} color={colors.background} />
            </Pressable>
            <Pressable
              onPress={handleViewConfig}
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
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
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
          <View style={{ marginBottom: 20 }}>
            <BriefingCard 
              onViewApprovals={handleViewApprovals}
            />
          </View>
        )}

        {/* Pending Approvals */}
        {approvals.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text 
              style={{ 
                fontSize: 18, 
                fontFamily: 'Inter_600SemiBold', 
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              {t('pendingApprovals') || 'Pending Approvals'} ({approvals.length})
            </Text>
            {approvals.slice(0, 3).map((approval) => (
              <View key={approval.id} style={{ marginBottom: 12 }}>
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
                style={{ 
                  alignItems: 'center', 
                  paddingVertical: 12,
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
          <View style={{ marginBottom: 20 }}>
            <Text 
              style={{ 
                fontSize: 18, 
                fontFamily: 'Inter_600SemiBold', 
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              {t('activePlans') || 'Active Plans'} ({activePlans.length})
            </Text>
            {activePlans.map((plan) => (
              <View key={plan.id} style={{ marginBottom: 12 }}>
                <PlanCard
                  plan={plan}
                  onViewDetails={handleViewPlan}
                  showSteps={false}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <EmptyState
              title={t('noActivePlans') || 'No Active Plans'}
              description={t('createFirstPlan') || 'Create your first financial plan to get started'}
              action={{
                label: t('createPlan') || 'Create Plan',
                onPress: handleCreatePlan,
              }}
            />
          </View>
        )}

        {/* Agent Status */}
        {config.data?.config && (
          <View 
            style={{ 
              backgroundColor: colors.muted,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text 
              style={{ 
                fontSize: 14, 
                fontFamily: 'Inter_600SemiBold', 
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              {t('agentConfiguration') || 'Agent Configuration'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('autoApproveBelow') || 'Auto-approve below'}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {config.data.config.auto_approve_threshold} {config.data.config.auto_approve_currency}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {t('dailyAutopilot') || 'Daily autopilot'}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {config.data.config.daily_autopilot_enabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
              </Text>
            </View>
            <Pressable
              onPress={handleViewConfig}
              style={{ 
                marginTop: 12,
                paddingTop: 12,
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
