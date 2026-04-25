/**
 * TodaySection — top recommendation + nearest bills (max 3 items).
 */

import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../../context/LanguageContext';
import { useDailyBriefing } from '../../../hooks/useAgent';
import { spacing, radii } from '../../../theme';

function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) return `${(amount / 1000).toFixed(1)}K ${currency}`;
  return `${amount.toFixed(0)} ${currency}`;
}

export function TodaySection() {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const { data } = useDailyBriefing();
  const briefing = data?.briefing;
  if (!briefing) return null;

  // Top recommendation always wins the lead slot; nearest bills fill the rest.
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
      <Text
        style={{
          fontSize: 18,
          fontFamily: 'Inter_600SemiBold',
          color: colors.foreground,
          marginBottom: spacing.md,
        }}
      >
        {t('agentSectionToday') || 'Today'}
      </Text>

      {shown.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
          }}
        >
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            {t('autopilotNoPriorities') || 'No urgent priorities for today.'}
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
          {shown.map((item, idx) => (
            <View
              key={item.key}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: radii.full,
                  backgroundColor: item.accent,
                  marginTop: 7,
                  marginEnd: spacing.md,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                  {item.title}
                </Text>
                {item.detail ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {item.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
