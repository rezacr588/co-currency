import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

interface ReportPeriodTabsProps {
  selected: ReportPeriod;
  onSelect: (period: ReportPeriod) => void;
}

export function ReportPeriodTabs({ selected, onSelect }: ReportPeriodTabsProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const tabs: { key: ReportPeriod; label: string }[] = [
    { key: 'daily', label: t('dailyReport') },
    { key: 'weekly', label: t('weeklyReport') },
    { key: 'monthly', label: t('monthlyReport') },
    { key: 'yearly', label: t('yearlyReport') },
    { key: 'all_time', label: t('allTime') },
  ];

  return (
    <View style={{ marginBottom: 16 }} accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 9999,
              backgroundColor: selected === tab.key ? colors.accent : colors.secondary,
              borderWidth: selected === tab.key ? 0 : 1,
              borderColor: colors.border,
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: selected === tab.key }}
            accessibilityHint={`Switch to ${tab.label} report view`}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                color: selected === tab.key ? colors.background : colors.foreground,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
