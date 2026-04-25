/**
 * AgentStatusHero — at-a-glance verdict at the top of the agent dashboard.
 *
 *   [● Healthy] · 4.2K USD · 12d to low      [Run scan]
 *   Last scan 2h ago · Next scan in 22h
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Bot, RefreshCw } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../../context/LanguageContext';
import { useAutopilotStatus, useDailyBriefing, useTriggerAutopilot } from '../../../hooks/useAgent';
import { useToast } from '../../ui/Toast';
import { haptics } from '../../../utils/haptics';
import { spacing, radii } from '../../../theme';
import type { BalanceHealth, DailyBriefing } from '../../../api/agent';

function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) return `${(amount / 1000).toFixed(1)}K ${currency}`;
  return `${amount.toFixed(0)} ${currency}`;
}

function healthTone(
  status: BalanceHealth['status'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (status) {
    case 'healthy':
      return { color: colors.success, muted: colors.successMuted };
    case 'warning':
      return { color: colors.warning, muted: colors.warningMuted };
    case 'critical':
      return { color: colors.danger, muted: colors.dangerMuted };
    default:
      return { color: colors.mutedForeground, muted: colors.muted };
  }
}

function buildContextLine(
  briefing: DailyBriefing,
  t: (key: string) => string | undefined,
): string | null {
  // Explain the health status with concrete signals from the briefing.
  const upcomingCount = briefing.upcoming_bills.length;
  const cantAffordCount = briefing.upcoming_bills.filter((b) => !b.can_afford).length;
  const goalCount = briefing.goal_opportunities.length;
  const parts: string[] = [];

  if (cantAffordCount > 0) {
    parts.push(
      `${cantAffordCount} ${
        cantAffordCount === 1
          ? t('agentBillCantAffordSingular') || 'bill at risk'
          : t('agentBillCantAffordPlural') || 'bills at risk'
      }`,
    );
  } else if (upcomingCount > 0) {
    parts.push(
      `${upcomingCount} ${
        upcomingCount === 1
          ? t('agentBillDueSingular') || 'bill due soon'
          : t('agentBillDuePlural') || 'bills due soon'
      }`,
    );
  }
  if (goalCount > 0) {
    parts.push(
      `${goalCount} ${
        goalCount === 1
          ? t('agentGoalOppSingular') || 'goal opportunity'
          : t('agentGoalOppPlural') || 'goal opportunities'
      }`,
    );
  }
  return parts.length ? parts.join(' · ') : null;
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

export function AgentStatusHero() {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { showToast } = useToast();
  const { data, isLoading, refetch: refetchBriefing } = useDailyBriefing();
  const { data: status } = useAutopilotStatus();
  const triggerAutopilot = useTriggerAutopilot();

  const briefing = data?.briefing;
  const tone = briefing ? healthTone(briefing.balance_health.status, colors) : null;
  const contextLine = briefing ? buildContextLine(briefing, t) : null;

  const lastRunLabel = formatRelative(status?.last_run_at, t);
  const nextRunLabel = formatRelative(status?.next_run_estimate, t);
  const isBusy = isLoading || triggerAutopilot.isPending;

  const handleRunScan = async () => {
    haptics.medium();
    try {
      await triggerAutopilot.mutateAsync();
      // Briefing is invalidated by the mutation; await a fresh fetch so the toast
      // can quote the new pending-approval count.
      const fresh = await refetchBriefing();
      const pending = fresh.data?.briefing?.pending_approvals ?? 0;
      const message =
        pending > 0
          ? `${t('agentScanComplete') || 'Scan complete'} · ${pending} ${
              pending === 1
                ? t('autopilotActionWaitingSingular') || 'action waiting'
                : t('autopilotActionsWaiting') || 'actions waiting'
            }`
          : t('agentScanAllClear') || 'Scan complete · all clear';
      showToast(message, pending > 0 ? 'info' : 'success');
    } catch {
      showToast(t('agentScanFailed') || 'Scan failed — try again', 'error');
    }
  };

  // Build the timing line shown under the status row.
  const timingLine = (() => {
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
    return null;
  })();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.xl,
      }}
    >
      {/* Top row: status pill + run scan */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
          {briefing && tone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: tone.muted,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  marginEnd: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radii.full,
                    backgroundColor: tone.color,
                    marginEnd: spacing.xs,
                  }}
                />
                <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  {t(`autopilotHealth_${briefing.balance_health.status}`) || briefing.balance_health.status}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                {formatCurrency(briefing.balance_health.projected_balance, briefing.balance_health.currency)}
              </Text>
              {briefing.balance_health.days_until_low !== undefined &&
                briefing.balance_health.days_until_low <= 14 && (
                  <Text
                    style={{
                      color: tone.color,
                      fontSize: 12,
                      fontFamily: 'Inter_500Medium',
                      marginStart: spacing.sm,
                    }}
                  >
                    {`· ${briefing.balance_health.days_until_low}d ${t('agentToLow') || 'to low'}`}
                  </Text>
                )}
            </View>
          ) : (
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
              {t('autopilotCardTitle') || 'CoAI Autopilot'}
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleRunScan}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t('autopilotRunScan') || 'Run autopilot scan'}
          hitSlop={8}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.full,
              backgroundColor: colors.accent,
              marginStart: spacing.sm,
              opacity: isBusy ? 0.5 : 1,
            },
            pressed && { opacity: 0.72 },
          ]}
        >
          {triggerAutopilot.isPending ? (
            <ActivityIndicator size="small" color={colors.accentForeground} />
          ) : (
            <RefreshCw size={14} color={colors.accentForeground} />
          )}
          <Text
            style={{
              color: colors.accentForeground,
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              marginStart: spacing.xs,
            }}
          >
            {t('agentRunScanShort') || 'Run scan'}
          </Text>
        </Pressable>
      </View>

      {/* Why-this-status line — explains the health pill with concrete signals */}
      {contextLine && (
        <Text
          style={{
            color: colors.foreground,
            fontSize: 13,
            fontFamily: 'Inter_500Medium',
            marginTop: spacing.sm,
            marginStart: 36 + spacing.md,
          }}
          numberOfLines={2}
        >
          {contextLine}
        </Text>
      )}

      {/* Timing line — only when we have something useful to say */}
      {timingLine && (
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            marginTop: contextLine ? 2 : spacing.sm,
            marginStart: 36 + spacing.md,
          }}
          numberOfLines={2}
        >
          {timingLine}
        </Text>
      )}

      {/* Empty briefing helper — first scan hasn't run yet */}
      {!briefing && !isLoading && (
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            marginTop: spacing.sm,
            marginStart: 36 + spacing.md,
            lineHeight: 18,
          }}
        >
          {t('autopilotEmpty') ||
            'Trigger a scan to see your financial snapshot, active goals, today\u2019s priorities, and actions that need your approval.'}
        </Text>
      )}
    </View>
  );
}
