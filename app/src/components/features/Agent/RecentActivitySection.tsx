/**
 * RecentActivitySection — what the agent has actually done lately.
 *
 * Builds trust by making executed/failed/auto-approved actions visible. Pulls
 * from `useAgentLogs` (limit 5).
 */

import { View, Text } from 'react-native';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../../context/LanguageContext';
import { useAgentLogs } from '../../../hooks/useAgent';
import { spacing, radii } from '../../../theme';
import type { ActionLog, ActionType } from '../../../api/agent';

const ACTION_LABEL: Record<ActionType, string> = {
  transfer: 'Transfer',
  goal_contribution: 'Goal contribution',
  budget_adjustment: 'Budget adjustment',
  recurring_update: 'Recurring update',
  subscription_cancel: 'Subscription canceled',
  debt_payment: 'Debt payment',
  alert: 'Alert',
  recommendation: 'Recommendation',
};

function formatRelative(iso: string, t: (key: string) => string | undefined): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const deltaMs = Date.now() - when.getTime();
  const mins = Math.round(deltaMs / 60000);
  if (mins < 1) return t('justNow') || 'just now';
  if (mins < 60) return `${mins}m ${t('ago') || 'ago'}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ${t('ago') || 'ago'}`;
  const days = Math.round(hours / 24);
  return `${days}d ${t('ago') || 'ago'}`;
}

function statusVisual(
  status: ActionLog['result_status'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (status) {
    case 'success':
      return { Icon: CheckCircle2, color: colors.success };
    case 'failure':
      return { Icon: XCircle, color: colors.danger };
    case 'partial':
      return { Icon: AlertTriangle, color: colors.warning };
  }
}

function actionTitle(log: ActionLog, t: (key: string) => string | undefined): string {
  const detailsTitle = (log.action_details?.title ?? log.action_details?.description) as
    | string
    | undefined;
  if (detailsTitle) return detailsTitle;
  return t(`agentAction_${log.action_type}`) || ACTION_LABEL[log.action_type] || log.action_type;
}

export function RecentActivitySection() {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { data, isLoading } = useAgentLogs({ limit: 5 });
  const logs = data?.logs || [];

  if (isLoading && logs.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text
        style={{
          fontSize: 18,
          fontFamily: 'Inter_600SemiBold',
          color: colors.foreground,
          marginBottom: spacing.md,
        }}
      >
        {t('agentRecentActivity') || 'Recent activity'}
      </Text>

      {logs.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: 'italic' }}>
            {t('agentNoRecentActivity') ||
              'No actions yet — your agent will report here once it acts on your behalf.'}
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.sm,
          }}
        >
          {logs.map((log, idx) => {
            const visual = statusVisual(log.result_status, colors);
            const StatusIcon = visual.Icon;
            return (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <StatusIcon size={16} color={visual.color} style={{ marginTop: 2, marginEnd: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}
                    numberOfLines={1}
                  >
                    {actionTitle(log, t)}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {formatRelative(log.executed_at, t)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
