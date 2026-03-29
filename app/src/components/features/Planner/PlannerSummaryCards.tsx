import { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from 'styled-components/native';

export interface SummaryCardItem {
  label: string;
  value: number;
}

export interface PlannerSummaryCardsProps {
  cards: SummaryCardItem[];
  isPhone: boolean;
  isDesktop: boolean;
  summaryGap: number;
  summaryCardWidth: number | undefined;
}

export const PlannerSummaryCards = memo(function PlannerSummaryCards({
  cards,
  isPhone,
  isDesktop,
  summaryGap,
  summaryCardWidth,
}: PlannerSummaryCardsProps) {
  const theme = useTheme();
  const colors = theme.colors;

  if (isPhone) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingEnd: 4 }}>
        {cards.map((metric) => (
          <View
            key={metric.label}
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.card,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
              {metric.label}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
              {metric.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: summaryGap }}>
      {cards.map((metric) => (
        <Animated.View
          key={metric.label}
          entering={FadeInDown.duration(350)}
          accessibilityLabel={`${metric.label}: ${metric.value}`}
          style={[
            {
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              minHeight: 64,
            },
            isDesktop ? { flex: 1 } : { width: summaryCardWidth },
          ]}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{metric.label}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2 }}>{metric.value}</Text>
        </Animated.View>
      ))}
    </View>
  );
});
