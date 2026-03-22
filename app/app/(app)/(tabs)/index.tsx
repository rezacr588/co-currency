import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../../src/api';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { DashboardCharts } from '../../../src/components/features/Dashboard';
import { Card, PageHeader, PageScaffold, SectionBlock } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { formatCurrency } from '../../../src/utils/format';
import { openRecommendedAction } from '../../../src/utils/coaiActions';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';

function QuickAction({
  icon: Icon,
  label,
  onPress,
  color,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          gap: 8,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={color || theme.colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.foreground,
          fontFamily: theme.typography.bodyMedium.fontFamily,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CoAIHomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useScreenLayout();
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

  const quickActions = [
    {
      label: t('addTransaction') || 'Add',
      icon: Plus,
      onPress: () => router.push('/(app)/(tabs)/add' as any),
      color: theme.colors.primary,
    },
    {
      label: t('chat') || 'Chat',
      icon: MessageCircle,
      onPress: () => router.push('/(app)/coai-chat' as any),
      color: theme.colors.accent,
    },
    {
      label: t('convert') || 'Convert',
      icon: ArrowLeftRight,
      onPress: () => router.push('/(app)/(tabs)/wallet/convert' as any),
      color: theme.colors.secondaryForeground,
    },
    {
      label: t('reports') || 'Reports',
      icon: BarChart3,
      onPress: () => router.push('/(app)/(tabs)/reports' as any),
      color: theme.colors.secondaryForeground,
    },
  ];

  // Responsive quick actions layout (2x2 on small screens)
  const { width } = useScreenLayout();
  const isSmallScreen = width < 375;
  const quickActionsPerRow = isSmallScreen ? 2 : 4;

  return (
    <PageScaffold
      scroll
      maxWidth={1120}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />,
      }}
    >
      <PageHeader
        title={greeting + (user?.name ? `, ${user.name}` : '')}
        subtitle={t('homeSubtitle') || 'Your financial overview and AI insights.'}
        actions={<AppSwitcherTrigger variant="header_inline" />}
      />

      {/* Hero Balance Card */}
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.xl,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, fontFamily: theme.typography.bodyMedium.fontFamily }}>
              {t('totalBalance') || 'Total Balance'}
            </Text>
            {isPending && !briefData ? (
              <ActivityIndicator size="small" color={theme.colors.mutedForeground} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
            ) : (
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontSize: 32,
                  fontFamily: theme.typography.h1.fontFamily,
                  marginTop: 4,
                  lineHeight: 40,
                }}
              >
                {formatCurrency(snapshot?.total_balance ?? 0, briefData?.currency || user?.preferred_currency || 'USD')}
              </Text>
            )}
          </View>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={24} color={theme.colors.secondaryForeground} />
          </View>
        </View>

        {/* Quick Stats if available */}
        {snapshot && (snapshot.recent_transaction_count > 0 || snapshot.active_budget_count > 0 || snapshot.active_goal_count > 0) && (
          <View style={{ marginTop: 16, flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            {snapshot.balance_currency_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 18, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  {snapshot.balance_currency_count}
                </Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
                  {snapshot.balance_currency_count === 1 ? 'currency' : 'currencies'}
                </Text>
              </View>
            )}
            {snapshot.active_budget_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 18, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  {snapshot.active_budget_count}
                </Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
                  {snapshot.active_budget_count === 1 ? t('budget') || 'budget' : t('budgets') || 'budgets'}
                </Text>
              </View>
            )}
            {snapshot.active_goal_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 18, fontFamily: theme.typography.bodyMedium.fontFamily }}>
                  {snapshot.active_goal_count}
                </Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
                  {snapshot.active_goal_count === 1 ? t('goal') || 'goal' : t('goals') || 'goals'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AI Brief inside Hero */}
        {briefData?.brief ? (
          <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
             <View style={{ flexDirection: 'row', gap: 8 }}>
                <Bot size={16} color={theme.colors.accent} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
                  {briefData.brief}
                </Text>
             </View>
          </View>
        ) : null}
      </View>

      {/* Quick Actions */}
      <View
        style={{
          marginBottom: 32,
          paddingHorizontal: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {quickActions.map((action, index) => (
          <View
            key={index}
            style={{
              width: quickActionsPerRow === 2 ? '45%' : 'auto',
              flex: quickActionsPerRow === 4 ? 1 : undefined,
            }}
          >
            <QuickAction {...action} />
          </View>
        ))}
      </View>

      {isPending && !briefData ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : null}

      {isError && !briefData ? (
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

      {/* Empty State for New Users */}
      {briefData && !hasSetupData && !isPending ? (
        <Card style={{ marginBottom: 24, padding: 20 }}>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.primary + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={28} color={theme.colors.primary} />
            </View>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: theme.typography.h2.fontFamily,
                  color: theme.colors.foreground,
                  textAlign: 'center',
                }}
              >
                {t('homeGetStartedWelcome') || 'Welcome to CoAI!'}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.mutedForeground,
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 400,
                }}
              >
                {t('homeGetStartedDescription') || 'Start tracking your finances by adding your first transaction, setting up a budget, or creating a savings goal.'}
              </Text>
            </View>
            <View style={{ width: '100%', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/add' as any)}
                style={({ pressed }) => [
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radii.lg,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Plus size={18} color={theme.colors.primaryForeground} />
                <Text
                  style={{
                    color: theme.colors.primaryForeground,
                    fontFamily: theme.typography.bodyMedium.fontFamily,
                    fontSize: 14,
                  }}
                >
                  {t('homeAddFirstTransaction') || 'Add First Transaction'}
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => router.push('/(app)/budgets' as any)}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: theme.colors.secondary,
                      borderRadius: theme.radii.lg,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Briefcase size={16} color={theme.colors.secondaryForeground} />
                  <Text
                    style={{
                      color: theme.colors.secondaryForeground,
                      fontFamily: theme.typography.bodyMedium.fontFamily,
                      fontSize: 13,
                    }}
                  >
                    {t('homeCreateFirstBudget') || 'Create Budget'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(app)/(tabs)/goals' as any)}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: theme.colors.secondary,
                      borderRadius: theme.radii.lg,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Target size={16} color={theme.colors.secondaryForeground} />
                  <Text
                    style={{
                      color: theme.colors.secondaryForeground,
                      fontFamily: theme.typography.bodyMedium.fontFamily,
                      fontSize: 13,
                    }}
                  >
                    {t('homeSetFirstGoal') || 'Set Savings Goal'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {briefData && hasSetupData ? (
        <>
          {/* Separator */}
          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.border,
              marginVertical: 16,
              marginHorizontal: -theme.spacing.lg,
            }}
          />

          {/* Priorities & Alerts */}
          {((briefData.priorities?.length ?? 0) > 0 || (briefData.alerts?.length ?? 0) > 0) && (
             <SectionBlock title={t('insights') || 'Insights'} subtitle="Key updates for your attention.">
                <View style={{ gap: 12 }}>
                  {/* Alerts first */}
                  {(briefData.alerts ?? []).map((alert) => (
                    <Card key={alert.id} style={{ borderColor: theme.colors.warning + '40', backgroundColor: theme.colors.warning + '05' }}>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                         <AlertTriangle size={18} color={theme.colors.warning} style={{ marginTop: 2 }} />
                         <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>{alert.title}</Text>
                            <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>{alert.description}</Text>
                         </View>
                      </View>
                    </Card>
                  ))}
                  {/* Then Priorities */}
                  {(briefData.priorities ?? []).map((priority) => (
                    <Card key={priority.id}>
                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                             <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }}>{priority.title}</Text>
                             <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>{priority.description}</Text>
                          </View>
                          {priority.target_route && (
                             <Pressable onPress={() => router.push(priority.target_route as any)}>
                                <ArrowRight size={18} color={theme.colors.mutedForeground} />
                             </Pressable>
                          )}
                       </View>
                    </Card>
                  ))}
                </View>
             </SectionBlock>
          )}

          {/* Financial Charts */}
          <SectionBlock
            title={t('financialOverview') || 'Financial Overview'}
            subtitle={t('financialOverviewSubtitle') || 'Quick insights from your recent activity'}
          >
            <DashboardCharts currency={briefData.currency || user?.preferred_currency || 'USD'} />
          </SectionBlock>

          {/* Recent Conversation - if exists */}
          {recentConversation && (
            <SectionBlock title="Recent Chat">
               <Pressable
                  onPress={() => router.push({ pathname: '/(app)/coai-chat', params: { conversationId: recentConversation.id } } as any)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
               >
                 <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                             <Bot size={20} color={theme.colors.secondaryForeground} />
                          </View>
                          <View style={{ flex: 1 }}>
                             <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily }} numberOfLines={1}>
                                {recentConversation.title}
                             </Text>
                             <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>Resume conversation</Text>
                          </View>
                       </View>
                       <ArrowRight size={16} color={theme.colors.mutedForeground} />
                    </View>
                 </Card>
               </Pressable>
            </SectionBlock>
          )}
        </>
      ) : null}
    </PageScaffold>
  );
}
