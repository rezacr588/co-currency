/**
 * Daily Briefing Card - Shows the user's daily financial summary
 * 
 * Displays:
 * - Balance health status
 * - Upcoming bills
 * - Goal opportunities
 * - Pending approvals badge
 * - Top recommendation
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  RefreshCw,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useDailyBriefing, useTriggerAutopilot } from '../../../hooks/useAgent';
import { haptics } from '../../../utils/haptics';
import { HIT_SLOP_SM } from '../../../constants/hitSlop';
import type { DailyBriefing, BalanceHealth, UpcomingBill, GoalOpportunity } from '../../../api/agent';

interface BriefingCardProps {
  compact?: boolean;
  onViewApprovals?: () => void;
  onViewPlan?: (planId: string) => void;
}

function HealthBadge({ health }: { health: BalanceHealth }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'warning': return colors.warning;
      case 'critical': return colors.danger;
      default: return colors.mutedForeground;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'critical': return AlertCircle;
      default: return CheckCircle;
    }
  };

  const StatusIcon = getStatusIcon(health.status);
  const color = getStatusColor(health.status);

  return (
    <View 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: `${color}20`,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
      }}
    >
      <StatusIcon size={14} color={color} />
      <Text 
        style={{ 
          marginLeft: 6, 
          color, 
          fontSize: 12, 
          fontFamily: 'Inter_600SemiBold',
          textTransform: 'capitalize',
        }}
      >
        {t(health.status) || health.status}
      </Text>
    </View>
  );
}

function UpcomingBillItem({ bill }: { bill: UpcomingBill }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  return (
    <View 
      style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
          {bill.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Clock size={12} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 4 }}>
            {bill.days_until === 0 
              ? t('dueToday') || 'Due today'
              : bill.days_until === 1 
                ? t('dueTomorrow') || 'Due tomorrow'
                : `${t('in') || 'In'} ${bill.days_until} ${t('days') || 'days'}`
            }
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text 
          style={{ 
            color: bill.can_afford ? colors.foreground : colors.danger, 
            fontSize: 14, 
            fontFamily: 'Inter_600SemiBold' 
          }}
        >
          {bill.amount.toFixed(2)} {bill.currency}
        </Text>
        {!bill.can_afford && (
          <Text style={{ color: colors.danger, fontSize: 11 }}>
            {t('insufficientFunds') || 'Insufficient funds'}
          </Text>
        )}
      </View>
    </View>
  );
}

function GoalOpportunityItem({ opportunity }: { opportunity: GoalOpportunity }) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View 
        style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 16, 
          backgroundColor: `${colors.accent}20`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Target size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
          {opportunity.goal_title}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {opportunity.impact_on_timeline}
        </Text>
      </View>
      <Text style={{ color: colors.success, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
        +{opportunity.suggested_amount.toFixed(0)} {opportunity.currency}
      </Text>
    </View>
  );
}

export function BriefingCard({ compact = false, onViewApprovals, onViewPlan }: BriefingCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { data, isLoading, refetch, isRefetching } = useDailyBriefing();
  const triggerAutopilot = useTriggerAutopilot();

  const briefing = data?.briefing;

  const handleRefresh = async () => {
    haptics.light();
    await triggerAutopilot.mutateAsync();
    refetch();
  };

  const handleViewApprovals = () => {
    haptics.light();
    onViewApprovals?.();
  };

  if (isLoading) {
    return (
      <Card style={{ padding: 20 }}>
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
            {t('loadingBriefing') || 'Loading briefing...'}
          </Text>
        </View>
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card style={{ padding: 20 }}>
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Calendar size={32} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
            {t('noBriefingYet') || 'No briefing available yet.\nAdd some transactions to get started.'}
          </Text>
        </View>
      </Card>
    );
  }

  // Compact view for dashboard
  if (compact) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: `${colors.accent}20`, 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Zap size={20} color={colors.accent} />
            </View>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {t('dailyBriefing') || 'Daily Briefing'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <HealthBadge health={briefing.balance_health} />
                {briefing.pending_approvals > 0 && (
                  <View 
                    style={{ 
                      marginLeft: 8, 
                      backgroundColor: colors.warning,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: colors.background, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                      {briefing.pending_approvals} {t('pending') || 'pending'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {onViewApprovals && briefing.pending_approvals > 0 && (
            <Pressable onPress={handleViewApprovals} hitSlop={HIT_SLOP_SM} style={{ padding: 8 }}>
              <ChevronRight size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </Card>
    );
  }

  // Full briefing view
  return (
    <Card style={{ padding: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: `${colors.accent}20`, 
              alignItems: 'center', 
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Zap size={20} color={colors.accent} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('dailyBriefing') || 'Daily Briefing'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {new Date(briefing.date).toLocaleDateString(undefined, { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isRefetching || triggerAutopilot.isPending}
          style={{ padding: 8 }}
        >
          <RefreshCw 
            size={18} 
            color={colors.mutedForeground}
            style={(isRefetching || triggerAutopilot.isPending) ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
      </View>

      {/* Balance Health */}
      <View 
        style={{ 
          backgroundColor: colors.muted, 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16 
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
              {t('balanceHealth') || 'Balance Health'}
            </Text>
            <HealthBadge health={briefing.balance_health} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>
              {t('projected') || 'Projected'}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
              {briefing.balance_health.projected_balance.toFixed(2)} {briefing.balance_health.currency}
            </Text>
          </View>
        </View>
        {briefing.balance_health.days_until_low && (
          <View 
            style={{ 
              marginTop: 12, 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: `${colors.warning}20`,
              padding: 8,
              borderRadius: 8,
            }}
          >
            <AlertCircle size={14} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, marginLeft: 6 }}>
              {t('balanceMayBeLowIn') || 'Balance may be low in'} {briefing.balance_health.days_until_low} {t('days') || 'days'}
            </Text>
          </View>
        )}
      </View>

      {/* Pending Approvals Banner */}
      {briefing.pending_approvals > 0 && (
        <Pressable
          onPress={handleViewApprovals}
          style={{ 
            backgroundColor: `${colors.warning}15`,
            borderWidth: 1,
            borderColor: colors.warning,
            borderRadius: 12, 
            padding: 16, 
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View 
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 18, 
                backgroundColor: colors.warning,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ color: colors.background, fontSize: 16, fontFamily: 'Inter_700Bold' }}>
                {briefing.pending_approvals}
              </Text>
            </View>
            <View>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                {t('pendingApprovals') || 'Pending Approvals'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {t('tapToReview') || 'Tap to review'}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.warning} />
        </Pressable>
      )}

      {/* Upcoming Bills */}
      {briefing.upcoming_bills.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
            {t('upcomingBills') || 'Upcoming Bills'}
          </Text>
          {briefing.upcoming_bills.slice(0, 3).map((bill) => (
            <UpcomingBillItem key={bill.id} bill={bill} />
          ))}
        </View>
      )}

      {/* Goal Opportunities */}
      {briefing.goal_opportunities.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
            {t('goalOpportunities') || 'Goal Opportunities'}
          </Text>
          {briefing.goal_opportunities.slice(0, 2).map((opp) => (
            <GoalOpportunityItem key={opp.goal_id} opportunity={opp} />
          ))}
        </View>
      )}

      {/* Insights */}
      {briefing.insights.length > 0 && (
        <View style={{ marginBottom: briefing.recommended_action ? 16 : 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
            {t('insights') || 'Insights'}
          </Text>
          {briefing.insights.slice(0, 3).map((insight, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              <Text style={{ color: colors.accent, marginRight: 8 }}>•</Text>
              <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top Recommendation */}
      {briefing.recommended_action && (
        <View 
          style={{ 
            backgroundColor: `${colors.accent}10`,
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: colors.accent,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TrendingUp size={16} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginLeft: 6 }}>
              {t('topRecommendation') || 'TOP RECOMMENDATION'}
            </Text>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>
            {briefing.recommended_action.title}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            {briefing.recommended_action.description}
          </Text>
        </View>
      )}
    </Card>
  );
}

export default BriefingCard;
