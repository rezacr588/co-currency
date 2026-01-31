import { View, Text, Pressable, ScrollView } from 'react-native';
import { useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { formatCompactCurrency } from '../../../utils/format';

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
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Get color intensity based on amount (GitHub-style contribution colors)
function getColor(amount: number, maxAmount: number): string {
  if (amount === 0) return '#27272a'; // bg-muted

  const ratio = amount / maxAmount;

  if (ratio <= 0.25) return '#14532d'; // green-900
  if (ratio <= 0.5) return '#166534'; // green-800
  if (ratio <= 0.75) return '#22c55e'; // green-500
  return '#86efac'; // green-300
}

export function CalendarHeatMap({
  data,
  weeks = 12,
  onDayPress,
  currency = 'USD',
}: CalendarHeatMapProps) {
  const { t } = useLanguage();

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

  // Get month labels
  const monthLabels = useMemo(() => {
    const labels: { month: string; offset: number }[] = [];
    let lastMonth = -1;

    calendarData.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.date.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: MONTHS[month],
          offset: weekIndex * (DAY_SIZE + DAY_GAP),
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [calendarData]);

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
    <View className="bg-card border border-border p-4 rounded-xl">
      {/* Title */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-semibold text-foreground">
          {t('spendingCalendar') || 'Spending Calendar'}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {t('last12Weeks') || 'Last 12 weeks'}
        </Text>
      </View>

      {/* Calendar Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Month labels */}
          <View className="flex-row mb-1" style={{ paddingLeft: 24 }}>
            {monthLabels.map((label, idx) => (
              <Text
                key={idx}
                className="text-xs text-muted-foreground"
                style={{
                  position: 'absolute',
                  left: 24 + label.offset,
                }}
              >
                {label.month}
              </Text>
            ))}
          </View>

          <View className="flex-row mt-4">
            {/* Weekday labels */}
            <View className="mr-2">
              {WEEKDAYS.map((day, idx) => (
                <View
                  key={day}
                  style={{
                    height: DAY_SIZE,
                    marginBottom: DAY_GAP,
                    justifyContent: 'center',
                  }}
                >
                  {idx % 2 === 1 && (
                    <Text className="text-xs text-muted-foreground">{day[0]}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View className="flex-row">
              {calendarData.map((week, weekIdx) => (
                <View key={weekIdx} style={{ marginRight: DAY_GAP }}>
                  {week.map((day, dayIdx) => {
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
                              : getColor(amount, maxAmount),
                          },
                          isToday && {
                            borderWidth: 1,
                            borderColor: 'rgb(212, 175, 55)',
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
          <View className="flex-row items-center justify-end mt-4">
            <Text className="text-xs text-muted-foreground mr-2">
              {t('less') || 'Less'}
            </Text>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <View
                key={idx}
                style={{
                  width: DAY_SIZE,
                  height: DAY_SIZE,
                  borderRadius: 2,
                  marginRight: 2,
                  backgroundColor: getColor(ratio * maxAmount, maxAmount),
                }}
              />
            ))}
            <Text className="text-xs text-muted-foreground ml-1">
              {t('more') || 'More'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Summary */}
      <View className="flex-row justify-between mt-4 pt-4 border-t border-border">
        <View className="items-center flex-1">
          <Text className="text-2xl font-bold text-foreground">
            {data.reduce((sum, d) => sum + d.count, 0)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('transactions') || 'Transactions'}
          </Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-2xl font-bold text-foreground">
            {formatCompactCurrency(data.reduce((sum, d) => sum + d.amount, 0), currency)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('totalSpent') || 'Total Spent'}
          </Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-2xl font-bold text-foreground">
            {data.filter((d) => d.amount > 0).length}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('activeDays') || 'Active Days'}
          </Text>
        </View>
      </View>
    </View>
  );
}
