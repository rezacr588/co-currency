import { View, Text, Pressable, ScrollView } from 'react-native';
import { useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { haptics } from '../../../utils/haptics';
import { formatCompactCurrency } from '../../../utils/format';
import { LANGUAGE_LOCALES } from '../Reports/daily/constants';

interface DayData {
  date: string; // YYYY-MM-DD
  amount: number;
  count: number;
}

interface CalendarHeatMapProps {
  data: DayData[];
  weeks?: number; // Number of weeks to show (default 12)
  onDayPress?: (date: string, amount: number) => void;
  currency?: string;
}

const DAY_SIZE = 14;
const DAY_GAP = 2;

function getColor(amount: number, maxAmount: number, isDark: boolean, emptyColor: string): string {
  if (amount === 0) return emptyColor;

  const ratio = amount / maxAmount;

  if (isDark) {
    if (ratio <= 0.25) return '#14532d';
    if (ratio <= 0.5) return '#166534';
    if (ratio <= 0.75) return '#22c55e';
    return '#86efac';
  }

  if (ratio <= 0.25) return '#bbf7d0';
  if (ratio <= 0.5) return '#86efac';
  if (ratio <= 0.75) return '#22c55e';
  return '#16a34a';
}

export function CalendarHeatMap({
  data,
  weeks = 12,
  onDayPress,
  currency = 'USD',
}: CalendarHeatMapProps) {
  const { t, language } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = theme.isDark;

  const locale = LANGUAGE_LOCALES[language] || 'en-US';

  // Create a map of date -> data
  const dataMap = useMemo(() => {
    const map: Record<string, DayData> = {};
    data.forEach((d) => {
      map[d.date] = d;
    });
    return map;
  }, [data]);

  // Calculate max amount for color scaling
  const maxAmount = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.amount));
  }, [data]);

  // Generate calendar grid
  const calendarData = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - weeks * 7 + (7 - startDate.getDay()));

    const grid: { date: Date; dateStr: string }[][] = [];
    let currentWeek: { date: Date; dateStr: string }[] = [];

    for (let i = 0; i < weeks * 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      currentWeek.push({ date, dateStr });

      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      grid.push(currentWeek);
    }

    return grid;
  }, [weeks]);

  // Locale-aware month labels
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short' }),
    [locale]
  );

  const monthLabels = useMemo(() => {
    const labels: { month: string; offset: number }[] = [];
    let lastMonth = -1;

    calendarData.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.date.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: monthFormatter.format(firstDayOfWeek.date),
          offset: weekIndex * (DAY_SIZE + DAY_GAP),
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [calendarData, monthFormatter]);

  // Locale-aware weekday labels (narrow single-letter)
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    // Generate labels for Sun-Sat using a known week (Jan 4 2026 = Sunday)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 4 + i);
      return fmt.format(d);
    });
  }, [locale]);

  const handleDayPress = useCallback(
    (dateStr: string) => {
      haptics.light();
      const dayData = dataMap[dateStr];
      if (onDayPress) {
        onDayPress(dateStr, dayData?.amount || 0);
      }
    },
    [dataMap, onDayPress]
  );

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
      {/* Title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
          {t('spendingCalendar') || 'Spending Calendar'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          {t('last12Weeks') || 'Last 12 weeks'}
        </Text>
      </View>

      {/* Calendar Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Month labels */}
          <View style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 24 }}>
            {monthLabels.map((label, idx) => (
              <Text
                key={idx}
                style={{
                  fontSize: 12,
                  color: colors.mutedForeground,
                  position: 'absolute',
                  left: 24 + label.offset,
                }}
              >
                {label.month}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            {/* Weekday labels */}
            <View style={{ marginRight: 8 }}>
              {weekdayLabels.map((label, idx) => (
                <View
                  key={idx}
                  style={{
                    height: DAY_SIZE,
                    marginBottom: DAY_GAP,
                    justifyContent: 'center',
                  }}
                >
                  {idx % 2 === 1 && (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{label}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={{ flexDirection: 'row' }}>
              {calendarData.map((week, weekIdx) => (
                <View key={weekIdx} style={{ marginRight: DAY_GAP }}>
                  {week.map((day) => {
                    const dayData = dataMap[day.dateStr];
                    const amount = dayData?.amount || 0;
                    const isToday =
                      day.dateStr === new Date().toISOString().split('T')[0];
                    const isFuture = day.date > new Date();

                    return (
                      <Pressable
                        key={day.dateStr}
                        onPress={() => !isFuture && handleDayPress(day.dateStr)}
                        style={[
                          {
                            width: DAY_SIZE,
                            height: DAY_SIZE,
                            borderRadius: 2,
                            marginBottom: DAY_GAP,
                            backgroundColor: isFuture
                              ? 'transparent'
                              : getColor(amount, maxAmount, isDark, colors.muted),
                          },
                          isToday && {
                            borderWidth: 1,
                            borderColor: colors.accent,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 16 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginRight: 8 }}>
              {t('heatmapLess') || 'Less'}
            </Text>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <View
                key={idx}
                style={{
                  width: DAY_SIZE,
                  height: DAY_SIZE,
                  borderRadius: 2,
                  marginRight: 2,
                  backgroundColor: getColor(ratio * maxAmount, maxAmount, isDark, colors.muted),
                }}
              />
            ))}
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>
              {t('heatmapMore') || 'More'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Summary */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {data.reduce((sum, d) => sum + d.count, 0)}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t('transactions') || 'Transactions'}
          </Text>
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {formatCompactCurrency(data.reduce((sum, d) => sum + d.amount, 0), currency)}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t('totalSpent') || 'Total Spent'}
          </Text>
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {data.filter((d) => d.amount > 0).length}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t('activeDays') || 'Active Days'}
          </Text>
        </View>
      </View>
    </View>
  );
}
