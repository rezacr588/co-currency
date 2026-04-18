/**
 * AutopilotCard — the 4-stage Cleo-style view of the CoAI Autopilot.
 *
 * Frames the daily autopilot output as four coherent steps so users see the
 * shape of the feature, not a flat "briefing":
 *
 *   Onramp     — where you stand right now (balance snapshot + risk)
 *   Roadmap    — the goals we're tracking toward, with progress
 *   Daily Plan — today's top priorities (bills + top recommendation)
 *   Actions    — what needs your approval before anything moves
 *
 * Reads from `useDailyBriefing` (same source the existing BriefingCard uses).
 * The refresh button fires POST /agent/autopilot/run and re-queries.
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle,
  ChevronRight,
  Gauge,
  Map as MapIcon,
  RefreshCw,
  Target,
  Zap,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import type { ComponentType } from 'react';

import { Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useAutopilotStatus, useDailyBriefing, useTriggerAutopilot } from '../../../hooks/useAgent';
import { haptics } from '../../../utils/haptics';
import { spacing, radii } from '../../../theme';
import type { DailyBriefing, BalanceHealth } from '../../../api/agent';

interface AutopilotCardProps {
  onViewApprovals?: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  // Small-numbers precision, abbreviate thousands for readability.
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    return `${(amount / 1000).toFixed(1)}K ${currency}`;
  }
  return `${amount.toFixed(0)} ${currency}`;
}

function healthTone(status: BalanceHealth['status'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (status) {
    case 'healthy':
      return { color: colors.success, muted: colors.successMuted, label: 'Healthy' };
    case 'warning':
      return { color: colors.warning, muted: colors.warningMuted, label: 'Needs attention' };
    case 'critical':
      return { color: colors.danger, muted: colors.dangerMuted, label: 'Critical' };
    default:
      return { color: colors.mutedForeground, muted: colors.muted, label: status };
  }
}

function StageHeader({
  number,
  label,
  title,
  Icon,
  accent,
}: {
  number: number;
  label: string;
  title: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  accent: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.full,
          backgroundColor: theme.alpha(accent, 0.125),
          alignItems: 'center',
          justifyContent: 'center',
          marginEnd: spacing.md,
        }}
      >
        <Icon size={14} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontSize: 11,
            fontFamily: 'Inter_600SemiBold',
            letterSpacing: 0.6,
          }}
        >
          {`${number.toString().padStart(2, '0')} · ${label.toUpperCase()}`}
        </Text>
        <Text style={{ color: theme.colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function EmptyLine({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.mutedForeground,
        fontSize: 13,
        fontStyle: 'italic',
        marginStart: 40,
        marginBottom: spacing.sm,
      }}
    >
      {label}
    </Text>
  );
}

function OnrampStage({ briefing }: { briefing: DailyBriefing }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const tone = healthTone(briefing.balance_health.status, colors);

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <StageHeader
        number={1}
        label={t('autopilotStageOnrampLabel') || 'Onramp'}
        title={t('autopilotStageOnrampTitle') || 'Where you stand right now'}
        Icon={Gauge}
        accent={colors.info}
      />
      <View
        style={{
          marginStart: 40,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: tone.muted,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radii.full,
            backgroundColor: tone.color,
            marginEnd: spacing.sm,
          }}
        />
        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>
          {t(`autopilotHealth_${briefing.balance_health.status}`) || tone.label}
          {' · '}
          {formatCurrency(briefing.balance_health.projected_balance, briefing.balance_health.currency)}
        </Text>
        {briefing.balance_health.days_until_low !== undefined && briefing.balance_health.days_until_low <= 14 ? (
          <Text style={{ color: tone.color, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
            {briefing.balance_health.days_until_low}d
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RoadmapStage({ briefing }: { briefing: DailyBriefing }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const goals = briefing.goal_opportunities.slice(0, 3);

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <StageHeader
        number={2}
        label={t('autopilotStageRoadmapLabel') || 'Roadmap'}
        title={t('autopilotStageRoadmapTitle') || 'Your active goals'}
        Icon={MapIcon}
        accent={colors.accent}
      />
      {goals.length === 0 ? (
        <EmptyLine label={t('autopilotNoGoals') || 'No goal opportunities surfaced yet.'} />
      ) : (
        goals.map((goal) => {
          const progressPct = Math.max(0, Math.min(100, goal.current_progress));
          return (
            <View
              key={goal.goal_id}
              style={{
                marginStart: 40,
                marginBottom: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <Target size={12} color={colors.accent} style={{ marginEnd: spacing.xs }} />
                <Text
                  style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}
                  numberOfLines={1}
                >
                  {goal.goal_title}
                </Text>
                <Text style={{ color: colors.success, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  +{formatCurrency(goal.suggested_amount, goal.currency)}
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.muted,
                  borderRadius: radii.full,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
              {goal.impact_on_timeline ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: spacing.xs }}>
                  {goal.impact_on_timeline}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function DailyPlanStage({ briefing }: { briefing: DailyBriefing }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  // Build the "today's priorities" list from the top recommendation + near bills.
  // Render only the 3 most urgent items — the rest surface via the full plans view.
  const items: { key: string; title: string; detail?: string; accent: string }[] = [];
  if (briefing.recommended_action) {
    items.push({
      key: 'rec',
      title: briefing.recommended_action.title,
      detail: briefing.recommended_action.description,
      accent: colors.accent,
    });
  }
  for (const bill of briefing.upcoming_bills.slice(0, 3)) {
    items.push({
      key: `bill-${bill.id}`,
      title: bill.title,
      detail:
        bill.days_until <= 0
          ? t('autopilotBillOverdue') || 'Overdue — pay now'
          : `${t('autopilotDueInDays') || 'Due in'} ${bill.days_until}d · ${formatCurrency(bill.amount, bill.currency)}`,
      accent: bill.can_afford ? colors.warning : colors.danger,
    });
  }
  const shown = items.slice(0, 3);

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <StageHeader
        number={3}
        label={t('autopilotStageDailyLabel') || 'Daily Plan'}
        title={t('autopilotStageDailyTitle') || 'Today\u2019s priorities'}
        Icon={Activity}
        accent={colors.success}
      />
      {shown.length === 0 ? (
        <EmptyLine label={t('autopilotNoPriorities') || 'No urgent priorities for today.'} />
      ) : (
        shown.map((item) => (
          <View
            key={item.key}
            style={{
              marginStart: 40,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: radii.full,
                backgroundColor: item.accent,
                marginTop: 7,
                marginEnd: spacing.md,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                {item.title}
              </Text>
              {item.detail ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{item.detail}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ActionsStage({
  briefing,
  onViewApprovals,
}: {
  briefing: DailyBriefing;
  onViewApprovals?: () => void;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const pending = briefing.pending_approvals;

  return (
    <View>
      <StageHeader
        number={4}
        label={t('autopilotStageActionsLabel') || 'Actions'}
        title={t('autopilotStageActionsTitle') || 'Needs your approval'}
        Icon={Zap}
        accent={pending > 0 ? colors.warning : colors.mutedForeground}
      />
      {pending === 0 ? (
        <EmptyLine label={t('autopilotNoActionsPending') || 'Nothing awaiting your approval.'} />
      ) : (
        <Pressable
          onPress={() => {
            haptics.light();
            onViewApprovals?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('autopilotReviewActions') || 'Review pending actions'}
          style={({ pressed }) => [
            {
              marginStart: 40,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radii.md,
              backgroundColor: colors.warningMuted,
            },
            pressed && { opacity: 0.72 },
          ]}
        >
          <AlertCircle size={16} color={colors.warning} style={{ marginEnd: spacing.sm }} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>
            {`${pending} ${pending === 1 ? t('autopilotActionWaitingSingular') || 'action waiting' : t('autopilotActionsWaiting') || 'actions waiting'}`}
          </Text>
          <ChevronRight size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

function formatRelative(iso: string | undefined, t: (key: string) => string | undefined): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const deltaMs = when.getTime() - Date.now();
  const absMins = Math.round(Math.abs(deltaMs) / 60000);
  const past = deltaMs < 0;
  if (absMins < 60) {
    return past ? `${absMins}m ${t('ago') || 'ago'}` : `${t('in') || 'in'} ${absMins}m`;
  }
  const absHours = Math.round(absMins / 60);
  if (absHours < 48) {
    return past ? `${absHours}h ${t('ago') || 'ago'}` : `${t('in') || 'in'} ${absHours}h`;
  }
  const absDays = Math.round(absHours / 24);
  return past ? `${absDays}d ${t('ago') || 'ago'}` : `${t('in') || 'in'} ${absDays}d`;
}

export function AutopilotCard({ onViewApprovals }: AutopilotCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { data, isLoading, isRefetching, refetch } = useDailyBriefing();
  const { data: status, refetch: refetchStatus } = useAutopilotStatus();
  const triggerAutopilot = useTriggerAutopilot();
  const briefing = data?.briefing;

  const lastRunLabel = formatRelative(status?.last_run_at, t);
  const nextRunLabel = formatRelative(status?.next_run_estimate, t);

  const handleRefresh = async () => {
    haptics.light();
    try {
      await triggerAutopilot.mutateAsync();
    } catch {
      // Mutation error is surfaced via the mutation's own state; refetch anyway.
    }
    refetch();
    refetchStatus();
  };

  const isBusy = isLoading || isRefetching || triggerAutopilot.isPending;

  return (
    <Card style={{ padding: spacing.xl }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.lg,
          paddingBottom: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.full,
            backgroundColor: theme.alpha(colors.accent, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            marginEnd: spacing.md,
          }}
        >
          <Bot size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: 'Inter_700Bold' }}>
            {t('autopilotCardTitle') || 'CoAI Autopilot'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={2}>
            {(() => {
              // Priority: status-driven "last · next" copy → briefing date → empty-state.
              if (status) {
                const parts: string[] = [];
                if (lastRunLabel) parts.push(`${t('autopilotLastRun') || 'Last scan'} ${lastRunLabel}`);
                if (status.daily_autopilot_enabled && nextRunLabel) {
                  parts.push(`${t('autopilotNextRun') || 'Next scan'} ${nextRunLabel}`);
                }
                if (parts.length) return parts.join(' · ');
                if (!status.daily_autopilot_enabled) {
                  return t('autopilotNotScheduled') || 'Not scheduled — enable daily autopilot in settings';
                }
              }
              if (briefing) {
                return (t('autopilotLastUpdated') || 'Last updated') + ' · ' + new Date(briefing.date).toLocaleDateString();
              }
              return t('autopilotReady') || 'Ready to scan your finances';
            })()}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t('autopilotRefresh') || 'Refresh autopilot'}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.full,
            backgroundColor: colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isBusy ? 0.5 : 1,
          }}
        >
          {triggerAutopilot.isPending ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <RefreshCw size={16} color={colors.foreground} />
          )}
        </Pressable>
      </View>

      {/* Body */}
      {isLoading && !briefing ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, marginTop: spacing.md }}>
            {t('loadingAutopilot') || 'Scanning your finances...'}
          </Text>
        </View>
      ) : !briefing ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            {t('autopilotEmpty') ||
              'Trigger a scan to see your financial snapshot, active goals, today\u2019s priorities, and actions that need your approval.'}
          </Text>
          <Pressable
            onPress={handleRefresh}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={t('autopilotRunScan') || 'Run autopilot scan'}
            style={({ pressed }) => [
              {
                marginTop: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                backgroundColor: colors.accent,
                borderRadius: radii.md,
              },
              pressed && { opacity: 0.72 },
            ]}
          >
            <CheckCircle size={16} color={colors.accentForeground} style={{ marginEnd: spacing.sm }} />
            <Text style={{ color: colors.accentForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
              {t('autopilotRunScan') || 'Run autopilot scan'}
            </Text>
            <ArrowRight size={14} color={colors.accentForeground} style={{ marginStart: spacing.sm }} />
          </Pressable>
        </View>
      ) : (
        <>
          <OnrampStage briefing={briefing} />
          <RoadmapStage briefing={briefing} />
          <DailyPlanStage briefing={briefing} />
          <ActionsStage briefing={briefing} onViewApprovals={onViewApprovals} />
        </>
      )}
    </Card>
  );
}
