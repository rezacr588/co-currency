import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Briefcase,
  Clock3,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../../src/api';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { RecommendedActionCards } from '../../../src/components/features/CoAI/RecommendedActionCards';
import { Card, PageHeader, PageScaffold, SectionBlock } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCompactCurrency } from '../../../src/utils/format';
import { openRecommendedAction } from '../../../src/utils/coaiActions';

function SnapshotMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.secondary,
        padding: 14,
      }}
    >
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          color: theme.colors.foreground,
          fontSize: 20,
          marginTop: 8,
          fontFamily: theme.typography.h2.fontFamily,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CoAIHomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: briefData,
    isPending,
    isError,
    refetch: refetchBrief,
  } = useQuery({
    queryKey: ['coai-brief'],
    queryFn: () => api.coai.getBrief(),
    staleTime: 60 * 1000,
  });

  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.chat.listConversations(),
    staleTime: 30 * 1000,
  });

  const recentConversation = conversationsData?.conversations?.[0];
  const snapshot = briefData?.context_snapshot;
  const hasSetupData = Boolean(
    snapshot &&
      (snapshot.recent_transaction_count > 0 ||
        snapshot.active_budget_count > 0 ||
        snapshot.active_goal_count > 0 ||
        snapshot.total_balance > 0)
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning') || 'Good morning';
    if (hour < 18) return t('goodAfternoon') || 'Good afternoon';
    return t('goodEvening') || 'Good evening';
  }, [t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBrief(), refetchConversations()]);
    setRefreshing(false);
  }, [refetchBrief, refetchConversations]);

  const handleAskCoAI = useCallback(() => {
    router.push('/(app)/coai-chat' as any);
  }, [router]);

  const handleResumeConversation = useCallback(() => {
    if (!recentConversation) return;
    router.push({
      pathname: '/(app)/coai-chat',
      params: { conversationId: recentConversation.id },
    } as any);
  }, [recentConversation, router]);

  const toolLinks = [
    {
      title: 'Planner',
      description: 'Keep tasks and money actions connected.',
      href: '/planner',
      icon: Briefcase,
    },
    {
      title: 'Subscriptions',
      description: 'Review recurring services and upcoming renewals.',
      href: '/(app)/subscriptions',
      icon: Clock3,
    },
    {
      title: t('tools') || 'Tools',
      description: 'Open badges, notes, challenges, and historical tools.',
      href: '/(app)/tools',
      icon: Sparkles,
    },
  ];

  return (
    <PageScaffold
      scroll
      maxWidth={1120}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />,
      }}
    >
      <PageHeader
        title="CoAI"
        subtitle="Your personal finance copilot. Ask questions, review what changed, and act from one place."
        actions={<AppSwitcherTrigger variant="header_inline" />}
      />

      <Card variant="gradient" style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <Text style={{ color: theme.colors.primaryForeground + 'CC', fontSize: 13 }}>
              {greeting}, {user?.name || 'there'}
            </Text>
            <Text
              style={{
                color: theme.colors.primaryForeground,
                fontSize: 30,
                lineHeight: 38,
                marginTop: 8,
                fontFamily: theme.typography.h1.fontFamily,
              }}
            >
              {hasSetupData ? 'CoAI Home' : 'Set up CoAI'}
            </Text>
            <Text
              style={{
                color: theme.colors.primaryForeground + 'D8',
                fontSize: 15,
                lineHeight: 22,
                marginTop: 12,
                maxWidth: 680,
              }}
            >
              {briefData?.brief ||
                'Add a balance, transaction, budget, or goal and CoAI will start turning your numbers into guidance.'}
            </Text>
            {briefData?.generated_at ? (
              <Text style={{ color: theme.colors.primaryForeground + 'B8', fontSize: 12, marginTop: 12 }}>
                Updated {new Date(briefData.generated_at).toLocaleString()}
              </Text>
            ) : null}
          </View>

          <View style={{ minWidth: 240, gap: 10 }}>
            <Pressable
              onPress={handleAskCoAI}
              accessibilityRole="button"
              accessibilityLabel="Ask CoAI"
              style={({ pressed }) => [
                {
                  minHeight: 46,
                  borderRadius: theme.radii.lg,
                  backgroundColor: theme.colors.background,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                pressed && { opacity: 0.76 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Bot size={18} color={theme.colors.foreground} />
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontSize: 14,
                    fontFamily: theme.typography.bodyMedium.fontFamily,
                  }}
                >
                  Ask CoAI
                </Text>
              </View>
              <ArrowRight size={16} color={theme.colors.foreground} />
            </Pressable>

            {recentConversation ? (
              <Pressable
                onPress={handleResumeConversation}
                accessibilityRole="button"
                accessibilityLabel="Resume recent conversation"
                style={({ pressed }) => [
                  {
                    minHeight: 46,
                    borderRadius: theme.radii.lg,
                    borderWidth: 1,
                    borderColor: theme.colors.primaryForeground + '44',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexDirection: 'row',
                  },
                  pressed && { opacity: 0.76 },
                ]}
              >
                <View style={{ flex: 1, marginEnd: 12 }}>
                  <Text style={{ color: theme.colors.primaryForeground + 'CC', fontSize: 11 }}>
                    Recent conversation
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.primaryForeground,
                      fontSize: 13,
                      marginTop: 3,
                      fontFamily: theme.typography.bodyMedium.fontFamily,
                    }}
                    numberOfLines={1}
                  >
                    {recentConversation.title}
                  </Text>
                </View>
                <ArrowRight size={16} color={theme.colors.primaryForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>

      {isPending && !briefData ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : null}

      {isError ? (
        <Card style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={18} color={theme.colors.warning} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                }}
              >
                CoAI brief is unavailable right now.
              </Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                Chat and the rest of the app still work. Pull to retry.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <SectionBlock
        title="Recommended actions"
        subtitle="Guided steps CoAI thinks are worth doing next."
      >
        <RecommendedActionCards
          actions={briefData?.recommended_actions ?? []}
          onActionPress={(action) => openRecommendedAction(router, action)}
        />
      </SectionBlock>

      <SectionBlock
        title="Top priorities"
        subtitle="The short list CoAI wants you to pay attention to."
      >
        <View style={{ gap: 12 }}>
          {(briefData?.priorities ?? []).map((priority) => (
            <Card key={priority.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.foreground,
                      fontSize: 16,
                      fontFamily: theme.typography.bodyMedium.fontFamily,
                    }}
                  >
                    {priority.title}
                  </Text>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
                    {priority.description}
                  </Text>
                </View>
                {priority.target_route ? (
                  <Pressable
                    onPress={() => router.push(priority.target_route as any)}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <ArrowRight size={18} color={theme.colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}

          {(briefData?.priorities?.length ?? 0) === 0 ? (
            <Card>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                CoAI has no urgent priorities yet.
              </Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                Add a few transactions or a goal and the priority stack will become more specific.
              </Text>
            </Card>
          ) : null}
        </View>
      </SectionBlock>

      <SectionBlock
        title="Alerts"
        subtitle="Budget risk, anomalies, and follow-ups CoAI surfaced from your data."
      >
        <View style={{ gap: 12 }}>
          {(briefData?.alerts ?? []).map((alert) => (
            <Card key={alert.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      alert.severity === 'critical'
                        ? theme.colors.danger + '18'
                        : alert.severity === 'warning'
                          ? theme.colors.warning + '18'
                          : theme.colors.info + '18',
                  }}
                >
                  <AlertTriangle
                    size={16}
                    color={
                      alert.severity === 'critical'
                        ? theme.colors.danger
                        : alert.severity === 'warning'
                          ? theme.colors.warning
                          : theme.colors.info
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.foreground,
                      fontSize: 15,
                      fontFamily: theme.typography.bodyMedium.fontFamily,
                    }}
                  >
                    {alert.title}
                  </Text>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
                    {alert.description}
                  </Text>
                </View>
              </View>
            </Card>
          ))}

          {(briefData?.alerts?.length ?? 0) === 0 ? (
            <Card>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                No proactive alerts right now.
              </Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                CoAI will surface anomalies, budget risk, and recurring spend signals here.
              </Text>
            </Card>
          ) : null}
        </View>
      </SectionBlock>

      <SectionBlock
        title="Context snapshot"
        subtitle="The data footprint CoAI is using right now."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <SnapshotMetric
            label="Balance"
            value={formatCompactCurrency(snapshot?.total_balance ?? 0, briefData?.currency || user?.preferred_currency || 'USD')}
          />
          <SnapshotMetric
            label="Recent transactions"
            value={String(snapshot?.recent_transaction_count ?? 0)}
          />
          <SnapshotMetric
            label="Budgets"
            value={String(snapshot?.active_budget_count ?? 0)}
          />
          <SnapshotMetric
            label="Goals"
            value={String(snapshot?.active_goal_count ?? 0)}
          />
          <SnapshotMetric
            label="Subscriptions"
            value={String(snapshot?.active_subscription_count ?? 0)}
          />
          <SnapshotMetric
            label="Currencies"
            value={String(snapshot?.balance_currency_count ?? 0)}
          />
        </View>
      </SectionBlock>

      <SectionBlock
        title="Supporting layers"
        subtitle="These remain available, but CoAI stays the primary experience."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {toolLinks.map((item) => {
            const Icon = item.icon;

            return (
              <View key={item.href} style={{ width: '100%', maxWidth: 340, flexGrow: 1 }}>
                <Pressable onPress={() => router.push(item.href as any)} accessibilityRole="button">
                  <Card>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: theme.radii.lg,
                        backgroundColor: theme.colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Icon size={18} color={theme.colors.secondaryForeground} />
                    </View>
                    <Text
                      style={{
                        color: theme.colors.foreground,
                        fontSize: 16,
                        fontFamily: theme.typography.bodyMedium.fontFamily,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                      {item.description}
                    </Text>
                  </Card>
                </Pressable>
              </View>
            );
          })}
        </View>
      </SectionBlock>
    </PageScaffold>
  );
}
