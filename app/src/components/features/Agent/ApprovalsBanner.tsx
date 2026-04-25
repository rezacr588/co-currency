/**
 * ApprovalsBanner — high-priority CTA when one or more actions are awaiting
 * the user's approval. Shows the top action's title + estimated impact so the
 * user has a hint of what's waiting before tapping in.
 *
 * Renders nothing when the list is empty.
 */

import { View, Text, Pressable } from 'react-native';
import { AlertCircle, ChevronRight } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { spacing, radii } from '../../../theme';
import type { ActionApproval } from '../../../api/agent';

interface ApprovalsBannerProps {
  approvals: ActionApproval[];
  onPress: () => void;
}

function formatImpact(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? '+' : '-';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K ${currency}`;
  return `${sign}${abs.toFixed(0)} ${currency}`;
}

export function ApprovalsBanner({ approvals, onPress }: ApprovalsBannerProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  if (approvals.length === 0) return null;

  const top = approvals[0];
  const stepTitle = (top.metadata?.step_title as string | undefined) ?? null;
  const impact = top.metadata?.estimated_impact as number | undefined;
  const currency = (top.metadata?.currency as string | undefined) ?? 'USD';
  const more = approvals.length - 1;

  const heading = stepTitle || t('agentApprovalsBannerTitle') || 'Action needed';

  const detail = (() => {
    const parts: string[] = [];
    if (typeof impact === 'number' && Number.isFinite(impact)) {
      parts.push(formatImpact(impact, currency));
    }
    if (more > 0) {
      parts.push(`+${more} ${t('agentApprovalsMore') || 'more waiting'}`);
    }
    if (parts.length === 0) {
      parts.push(t('autopilotReviewActions') || 'Review pending actions');
    }
    return parts.join(' · ');
  })();

  return (
    <Pressable
      onPress={() => {
        haptics.medium();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('autopilotReviewActions') || 'Review pending actions'}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.warningMuted,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: theme.alpha(colors.warning, 0.3),
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.full,
          backgroundColor: theme.alpha(colors.warning, 0.18),
          alignItems: 'center',
          justifyContent: 'center',
          marginEnd: spacing.md,
        }}
      >
        <AlertCircle size={18} color={colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}
          numberOfLines={1}
        >
          {heading}
        </Text>
        <Text
          style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.warning} />
    </Pressable>
  );
}
