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
  History,
  LayoutGrid,
  MessageCircle,
  Plus,
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
import { formatCompactCurrency, formatCurrency } from '../../../src/utils/format';
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
      onPress: () => router.push('/(app)/(tabs)/chat' as any),
      color: theme.colors.accent,
    },
    {
      label: t('convert') || 'Convert',
      icon: ArrowLeftRight,
      onPress: () => router.push('/(app)/(tabs)/wallet/convert' as any),
      color: theme.colors.secondaryForeground,
    },
    {
      label: t('tools') || 'Tools',
      icon: LayoutGrid,
      onPress: () => router.push('/(app)/tools' as any),
      color: theme.colors.secondaryForeground,
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
        title={greeting + (user?.name ? `, ${user.name}` : '')}
        subtitle="Your financial overview and AI insights."
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
      <View style={{ flexDirection: 'row', marginBottom: 32, paddingHorizontal: 8 }}>
        {quickActions.map((action, index) => (
          <QuickAction key={index} {...action} />
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

      {briefData ? (
        <>
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

          {/* Recommended Actions */}
          {(briefData.recommended_actions?.length ?? 0) > 0 && (
            <SectionBlock
              title="Recommended actions"
              subtitle="Guided steps CoAI thinks are worth doing next."
            >
              <RecommendedActionCards
                actions={briefData.recommended_actions ?? []}
                onActionPress={(action) => openRecommendedAction(router, action)}
              />
            </SectionBlock>
          )}

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
