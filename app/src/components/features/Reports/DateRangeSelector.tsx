import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import type { DatePreset } from '../../../utils/dateRange';
import { MonthYearPicker } from './MonthYearPicker';

interface DateRangeSelectorProps {
  selectedPreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  selectedYear: number;
  selectedMonth: number;
  onMonthSelect: (year: number, month: number) => void;
  dateLabel: string;
  monthLabels: string[];
  selectDateRangeLabel: string;
  previousYearLabel: string;
  nextYearLabel: string;
  t: (key: string) => string;
  currentYear: number;
  currentMonth: number;
}

const DATE_SELECTOR_BOTTOM_MARGIN = 24;
const DATE_SELECTOR_CARD_RADIUS = 12;
const DATE_SELECTOR_CARD_PADDING = 16;

export function DateRangeSelector({
  selectedPreset,
  onPresetChange,
  selectedYear,
  selectedMonth,
  onMonthSelect,
  dateLabel,
  monthLabels,
  selectDateRangeLabel,
  previousYearLabel,
  nextYearLabel,
  t,
  currentYear,
  currentMonth,
}: DateRangeSelectorProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const datePresets: { value: DatePreset; label: string }[] = [
    { value: 'this_month', label: t('thisMonth') || 'This Month' },
    { value: 'last_month', label: t('lastMonth') || 'Last Month' },
    { value: 'last_3_months', label: t('threeMonths') || '3 Months' },
    { value: 'last_6_months', label: t('sixMonths') || '6 Months' },
    { value: 'this_year', label: t('thisYear') || 'This Year' },
    { value: 'last_year', label: t('lastYear') || 'Last Year' },
  ];

  return (
    <View style={{ marginBottom: DATE_SELECTOR_BOTTOM_MARGIN }}>
      <View style={{ backgroundColor: colors.card, borderRadius: DATE_SELECTOR_CARD_RADIUS, padding: DATE_SELECTOR_CARD_PADDING, marginBottom: DATE_SELECTOR_CARD_PADDING }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: theme.spacing.md }}>
          {selectDateRangeLabel}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {datePresets.map((preset) => (
            <Pressable
              key={preset.value}
              onPress={() => onPresetChange(preset.value)}
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.full,
                backgroundColor: selectedPreset === preset.value ? colors.primary : colors.secondary,
              }}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              accessibilityState={{ selected: selectedPreset === preset.value }}
              accessibilityHint={`Select ${preset.label} date range`}
            >
              <Text
                style={{
                  color: selectedPreset === preset.value ? colors.primaryForeground : colors.foreground,
                  fontSize: 14,
                  fontFamily: selectedPreset === preset.value ? 'Inter_500Medium' : 'Inter_400Regular',
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Custom month selector */}
      <Pressable
        onPress={() => setShowMonthPicker(true)}
        style={{
          backgroundColor: colors.card,
          padding: DATE_SELECTOR_CARD_PADDING,
          borderRadius: DATE_SELECTOR_CARD_RADIUS,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('selectMonth') || 'Select Month'}: ${dateLabel}`}
        accessibilityHint="Open month picker"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.alpha(colors.primary, 0.094), padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
            <Calendar size={20} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{dateLabel}</Text>
        </View>
      </Pressable>

      <MonthYearPicker
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSelect={(year, month) => {
          onMonthSelect(year, month);
          setShowMonthPicker(false);
        }}
        monthLabels={monthLabels}
        previousYearLabel={previousYearLabel}
        nextYearLabel={nextYearLabel}
        t={t}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />
    </View>
  );
}
