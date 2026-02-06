import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ReportPeriodTabsProps {
  selected: ReportPeriod;
  onSelect: (period: ReportPeriod) => void;
}

export function ReportPeriodTabs({ selected, onSelect }: ReportPeriodTabsProps) {
  const { t } = useLanguage();

  const tabs: { key: ReportPeriod; label: string }[] = [
    { key: 'daily', label: t('dailyReport') },
    { key: 'weekly', label: t('weeklyReport') },
    { key: 'monthly', label: t('monthlyReport') },
    { key: 'yearly', label: t('yearlyReport') },
  ];

  return (
    <View className="mb-4" accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            className={`px-5 py-2.5 rounded-full ${
              selected === tab.key
                ? 'bg-accent'
                : 'bg-secondary border border-border'
            }`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: selected === tab.key }}
          >
            <Text
              className={`text-sm font-semibold ${
                selected === tab.key ? 'text-background' : 'text-foreground'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
