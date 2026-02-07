import { Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar } from 'lucide-react-native';
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
  return (
    <View className="bg-card p-5 rounded-xl mb-6">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="bg-secondary p-2 rounded-lg mr-3">
            <Calendar size={18} color="rgb(148, 163, 184)" />
          </View>
          <View>
            <Text className="text-foreground font-semibold">{t('dailyTimeline')}</Text>
            <Text className="text-muted-foreground text-xs">{rangeLabel}</Text>
          </View>
        </View>
      </View>

      <Text className="text-muted-foreground text-xs mb-3">{t('tapBarForDetails')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {chartBuckets.map((bucket, index) => {
          const incomeHeight = bucket.income > 0 ? Math.max((bucket.income / maxBucketValue) * 96, 4) : 2;
          const expenseHeight = bucket.expenses > 0 ? Math.max((bucket.expenses / maxBucketValue) * 96, 4) : 2;
          const isSelected = index === selectedBucketIndex;
          const bucketRangeText = formatBucketRange(bucket);

          return (
            <Pressable
              key={bucket.key}
              onPress={() => onSelectBucket(index)}
              className={`items-center rounded-lg px-1 py-1 ${isSelected ? 'bg-accent/10 border border-accent/30' : ''}`}
              style={{ width: timelinePreset === '30D' ? 40 : timelinePreset === '7D' ? 56 : 62 }}
              accessibilityRole="button"
              accessibilityLabel={`${t('selectedRange')}: ${bucketRangeText}. ${bucket.txCount} ${t('transactionsCount')}`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={{ height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                <View
                  className={`w-2 rounded-t ${bucket.income > 0 ? 'bg-success' : 'bg-secondary/50'}`}
                  style={{ height: incomeHeight }}
                />
                <View
                  className={`w-2 rounded-t ${bucket.expenses > 0 ? 'bg-danger' : 'bg-secondary/50'}`}
                  style={{ height: expenseHeight }}
                />
              </View>
              <Text
                className={`text-[10px] mt-1 text-center ${
                  bucket.isCurrentBucket ? 'text-accent font-semibold' : 'text-muted-foreground'
                }`}
                numberOfLines={1}
              >
                {bucket.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-row justify-center gap-4 mt-4">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-success mr-1" />
          <Text className="text-muted-foreground text-xs">{t('income')}</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-danger mr-1" />
          <Text className="text-muted-foreground text-xs">{t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}
