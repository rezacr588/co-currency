/**
 * Agent Dashboard — main screen for the Autonomous AI Financial Agent.
 *
 * Layout (top to bottom):
 *   1. Header                 → title + Settings + Create plan icons
 *   2. ApprovalsBanner        → only when pending > 0; previews top action
 *   3. AgentStatusHero        → health pill · projected balance · run scan
 *   4. TodaySection           → top recommendation + nearest bills
 *   5. RoadmapSection         → goal opportunities with progress bars
 *   6. Active Plans / starter → list of plans, or 3 starter ideas
 *   7. RecentActivitySection  → last few actions the agent took
 */

import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Plus,
  Settings,
  Bot,
  AlertCircle,
  Check,
  ChevronRight,
  PiggyBank,
  Scissors,
  CreditCard,
  CalendarClock,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTheme } from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAgentDashboard, useAgentStatus } from '@/src/hooks/useAgent';
import {
  AgentStatusHero,
  ApprovalsBanner,
  TodaySection,
  RoadmapSection,
  RecentActivitySection,
  PlanCard,
} from '@/src/components/features/Agent';
import { LoadingSpinner, EmptyState } from '@/src/components/ui';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';

interface StarterIdea {
  key: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  titleKey: string;
  fallbackTitle: string;
  descKey: string;
  fallbackDesc: string;
}

const STARTER_IDEAS: StarterIdea[] = [
  {
    key: 'emergency',
    Icon: PiggyBank,
    titleKey: 'agentStarterEmergency',
    fallbackTitle: 'Emergency fund',
    descKey: 'agentStarterEmergencyDesc',
    fallbackDesc: 'Build a 3-month safety cushion',
  },
  {
    key: 'subscriptions',
    Icon: Scissors,
    titleKey: 'agentStarterCleanup',
    fallbackTitle: 'Subscription cleanup',
    descKey: 'agentStarterCleanupDesc',
    fallbackDesc: 'Find and cancel what you don\u2019t use',
  },
  {
    key: 'debt',
    Icon: CreditCard,
    titleKey: 'agentStarterDebt',
    fallbackTitle: 'Debt payoff',
    descKey: 'agentStarterDebtDesc',
    fallbackDesc: 'Pay down loans faster',
  },
];

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

  // Onboarding — agent is disabled
  if (!statusLoading && !isEnabled) {
    const onboardingExamples = [
      t('agentOnboardingExampleSubs') || 'Cancel unused subscriptions',
      t('agentOnboardingExampleGoals') || 'Top up your savings goals',
      t('agentOnboardingExampleBills') || 'Pay bills before they overdraft',
    ];
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          <View style={{ alignItems: 'center', maxWidth: 480, alignSelf: 'center' }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.full,
                backgroundColor: theme.alpha(colors.accent, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.xl,
              }}
            >
              <Bot size={36} color={colors.accent} />
            </View>
            <Text
              style={{
                fontSize: 26,
                fontFamily: 'Inter_700Bold',
                color: colors.foreground,
                textAlign: 'center',
                marginBottom: spacing.sm,
              }}
            >
              {t('agentOnboardingHeadline') || 'Your financial copilot'}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: colors.mutedForeground,
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: spacing.xxl,
              }}
            >
              {t('agentOnboardingTagline') ||
                'Scans your money daily and proposes specific actions to save, plan, and pay on time.'}
            </Text>

            {/* Concrete examples — what it'll actually do */}
            <View
              style={{
                width: '100%',
                backgroundColor: colors.card,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              }}
            >
              {onboardingExamples.map((example, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: radii.full,
                      backgroundColor: theme.alpha(colors.success, 0.18),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginEnd: spacing.md,
                    }}
                  >
                    <Check size={12} color={colors.success} />
                  </View>
                  <Text
                    style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 }}
                  >
                    {example}
                  </Text>
                </View>
              ))}
            </View>

            {/* Reassurance — counter to the "autonomous" word */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.successMuted,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radii.full,
                marginBottom: spacing.xxl,
              }}
            >
              <Check size={14} color={colors.success} style={{ marginEnd: spacing.xs }} />
              <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                {t('agentOnboardingReassurance') || 'You approve every action. Nothing happens without you.'}
              </Text>
            </View>

            <Pressable
              onPress={handleViewConfig}
              accessibilityRole="button"
              accessibilityLabel={t('agentOnboardingCta') || t('enableAgent') || 'Get started'}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.xxxl,
                  paddingVertical: spacing.lg,
                  borderRadius: radii.full,
                  alignSelf: 'stretch',
                  alignItems: 'center',
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: colors.accentForeground,
                  fontSize: 16,
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                {t('agentOnboardingCta') || t('enableAgent') || 'Get started'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Loading state
  if (isLoading || statusLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}
      >
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
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.accent} />
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

  const activePlans = plans.data?.plans?.filter((p) => p.status === 'active') || [];
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
        {/* Approvals banner — previews top action when pending > 0 */}
        <ApprovalsBanner approvals={approvals} onPress={handleViewApprovals} />

        {/* Status hero — health pill + balance + run scan button */}
        <AgentStatusHero />

        {/* Today — top recommendation + nearest bills */}
        <TodaySection />

        {/* Roadmap — goal opportunities */}
        <RoadmapSection />

        {/* Active Plans — list, or starter ideas if user has none yet */}
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
                <PlanCard plan={plan} onViewDetails={handleViewPlan} showSteps={false} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <CalendarClock size={18} color={colors.foreground} style={{ marginEnd: spacing.sm }} />
              <Text
                style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}
              >
                {t('agentStarterIdeasTitle') || 'Try a starter idea'}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.sm,
              }}
            >
              {STARTER_IDEAS.map((idea, idx) => {
                const Icon = idea.Icon;
                return (
                  <Pressable
                    key={idea.key}
                    onPress={handleCreatePlan}
                    accessibilityRole="button"
                    accessibilityLabel={t(idea.titleKey) || idea.fallbackTitle}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.lg,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.borderSubtle,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radii.full,
                        backgroundColor: theme.alpha(colors.accent, 0.12),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginEnd: spacing.md,
                      }}
                    >
                      <Icon size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}
                      >
                        {t(idea.titleKey) || idea.fallbackTitle}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {t(idea.descKey) || idea.fallbackDesc}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent activity — what the agent has actually done */}
        <RecentActivitySection />
      </ScrollView>
    </View>
  );
}
