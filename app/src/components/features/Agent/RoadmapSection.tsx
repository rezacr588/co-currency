/**
 * RoadmapSection — goal opportunities with progress bars (max 3 items).
 */

import { View, Text } from 'react-native';
import { Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../../context/LanguageContext';
import { useDailyBriefing } from '../../../hooks/useAgent';
import { spacing, radii } from '../../../theme';

function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) return `${(amount / 1000).toFixed(1)}K ${currency}`;
  return `${amount.toFixed(0)} ${currency}`;
}

export function RoadmapSection() {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { data } = useDailyBriefing();
  const briefing = data?.briefing;
  if (!briefing) return null;

  const goals = briefing.goal_opportunities.slice(0, 3);

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
        {t('agentSectionRoadmap') || 'Roadmap'}
      </Text>

      {goals.length === 0 ? (
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
            {t('autopilotNoGoals') || 'No goal opportunities surfaced yet.'}
          </Text>
        </View>
      ) : (
        goals.map((goal) => {
          const progressPct = Math.max(0, Math.min(100, goal.current_progress));
          return (
            <View
              key={goal.goal_id}
              style={{
                backgroundColor: colors.card,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Target size={14} color={colors.accent} style={{ marginEnd: spacing.sm }} />
                <Text
                  style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 }}
                  numberOfLines={1}
                >
                  {goal.goal_title}
                </Text>
                <Text style={{ color: colors.success, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                  +{formatCurrency(goal.suggested_amount, goal.currency)}
                </Text>
              </View>
              <View
                style={{
                  height: 6,
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
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: spacing.sm }}>
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
