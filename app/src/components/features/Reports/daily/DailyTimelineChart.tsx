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
    <View style={{ backgroundColor: colors.card, padding: theme.spacing.xl, borderRadius: theme.radii.md, marginBottom: theme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.secondary, padding: theme.spacing.sm, borderRadius: theme.radii.sm, marginEnd: theme.spacing.md }}>
            <Calendar size={18} color={colors.mutedForeground} />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{t('dailyTimeline')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rangeLabel}</Text>
          </View>
        </View>
      </View>

      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: theme.spacing.md }}>{t('tapBarForDetails')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingEnd: theme.spacing.sm }}>
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
                borderRadius: theme.radii.sm,
                paddingHorizontal: theme.spacing.xs,
                paddingVertical: theme.spacing.xs,
                width: timelinePreset === '30D' ? 40 : timelinePreset === '7D' ? 56 : 62,
                ...(isSelected ? { backgroundColor: theme.alpha(colors.accent, 0.1), borderWidth: 1, borderColor: theme.alpha(colors.accent, 0.3) } : {}),
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
                    backgroundColor: bucket.income > 0 ? colors.success : theme.alpha(colors.secondary, 0.5),
                    height: incomeHeight,
                  }}
                />
                <View
                  style={{
                    width: 8,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: bucket.expenses > 0 ? colors.danger : theme.alpha(colors.secondary, 0.5),
                    height: expenseHeight,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  marginTop: theme.spacing.xs,
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

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.success, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('income')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: colors.danger, marginEnd: theme.spacing.xs }} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}
