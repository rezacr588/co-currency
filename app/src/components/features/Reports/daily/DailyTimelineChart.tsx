import { Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import type { ChartBucket, TimelinePreset } from './types';

interface DailyTimelineChartProps {
  t: (key: string) => string;
  chartBuckets: ChartBucket[];
  selectedBucketIndex: number;
  onSelectBucket: (index: number) => void;
  maxBucketValue: number;
  timelinePreset: TimelinePreset;
  rangeLabel: string;
  formatBucketRange: (bucket: ChartBucket) => string;
}

export function DailyTimelineChart({
  t,
  chartBuckets,
  selectedBucketIndex,
  onSelectBucket,
  maxBucketValue,
  timelinePreset,
  rangeLabel,
  formatBucketRange,
}: DailyTimelineChartProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 12, marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 8, marginEnd: 12 }}>
            <Calendar size={18} color={colors.mutedForeground} />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('dailyTimeline')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rangeLabel}</Text>
          </View>
        </View>
      </View>

      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 12 }}>{t('tapBarForDetails')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingEnd: 8 }}>
        {chartBuckets.map((bucket, index) => {
          const incomeHeight = bucket.income > 0 ? Math.max((bucket.income / maxBucketValue) * 96, 4) : 2;
          const expenseHeight = bucket.expenses > 0 ? Math.max((bucket.expenses / maxBucketValue) * 96, 4) : 2;
          const isSelected = index === selectedBucketIndex;
          const bucketRangeText = formatBucketRange(bucket);

          return (
            <Pressable
              key={bucket.key}
              onPress={() => onSelectBucket(index)}
              style={{
                alignItems: 'center',
                borderRadius: 8,
                paddingHorizontal: 4,
                paddingVertical: 4,
                width: timelinePreset === '30D' ? 40 : timelinePreset === '7D' ? 56 : 62,
                ...(isSelected ? { backgroundColor: colors.accent + '1a', borderWidth: 1, borderColor: colors.accent + '4d' } : {}),
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('selectedRange')}: ${bucketRangeText}. ${bucket.txCount} ${t('transactionsCount')}`}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint="Select this bar to inspect transactions"
            >
              <View style={{ height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                <View
                  style={{
                    width: 8,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: bucket.income > 0 ? colors.success : colors.secondary + '80',
                    height: incomeHeight,
                  }}
                />
                <View
                  style={{
                    width: 8,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: bucket.expenses > 0 ? colors.danger : colors.secondary + '80',
                    height: expenseHeight,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  textAlign: 'center',
                  color: bucket.isCurrentBucket ? colors.accent : colors.mutedForeground,
                  fontFamily: bucket.isCurrentBucket ? 'Inter_600SemiBold' : undefined,
                }}
                numberOfLines={1}
              >
                {bucket.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.success, marginEnd: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.danger, marginEnd: 4 }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}
