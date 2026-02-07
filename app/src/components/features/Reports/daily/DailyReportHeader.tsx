import { Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { TIMELINE_CONFIG, TIMELINE_PRESETS } from './constants';
import type { TimelinePreset } from './types';

interface DailyReportHeaderProps {
  t: (key: string) => string;
  timelinePreset: TimelinePreset;
  onTimelinePresetChange: (preset: TimelinePreset) => void;
  timelineLabel: string;
  rangeLabel: string;
  reportCurrency: string;
  isCurrentWindow: boolean;
  onPreviousWindow: () => void;
  onNextWindow: () => void;
  onCurrentWindow: () => void;
  excludedTransactionCount: number;
  excludedCurrencies: string[];
  truncated: boolean;
}

export function DailyReportHeader({
  t,
  timelinePreset,
  onTimelinePresetChange,
  timelineLabel,
  rangeLabel,
  reportCurrency,
  isCurrentWindow,
  onPreviousWindow,
  onNextWindow,
  onCurrentWindow,
  excludedTransactionCount,
  excludedCurrencies,
  truncated,
}: DailyReportHeaderProps) {
  return (
    <View className="bg-card p-5 rounded-xl mb-6">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          onPress={onPreviousWindow}
          className="p-3 rounded-xl bg-secondary"
          accessibilityRole="button"
          accessibilityLabel={t('previousPeriod')}
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>

        <View className="flex-1 bg-secondary/40 border border-border px-4 py-3 rounded-xl items-center">
          <View className="flex-row items-center">
            <Calendar size={16} color="rgb(212, 175, 55)" />
            <Text className="text-foreground font-semibold ml-2">{timelineLabel}</Text>
          </View>
          <Text className="text-muted-foreground text-xs mt-1">{rangeLabel}</Text>
          <Text className="text-muted-foreground text-xs mt-1">
            {(t('reportCurrency') || 'Report currency') + `: ${reportCurrency}`}
          </Text>
          {isCurrentWindow ? (
            <Text className="text-accent text-xs mt-1">{t('currentPeriod')}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onNextWindow}
          className={`p-3 rounded-xl ${isCurrentWindow ? 'bg-secondary/30 opacity-50' : 'bg-secondary'}`}
          disabled={isCurrentWindow}
          accessibilityRole="button"
          accessibilityLabel={t('nextPeriod')}
        >
          <ChevronRight size={20} color="#a1a1aa" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 2 }}
      >
        {TIMELINE_PRESETS.map((preset) => {
          const isSelected = preset === timelinePreset;
          return (
            <Pressable
              key={preset}
              onPress={() => onTimelinePresetChange(preset)}
              className={`px-3 py-2 rounded-full border ${
                isSelected ? 'bg-accent border-accent' : 'bg-secondary border-border'
              }`}
              accessibilityRole="button"
              accessibilityLabel={t(TIMELINE_CONFIG[preset].translationKey)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text className={`text-xs font-semibold ${isSelected ? 'text-background' : 'text-foreground'}`}>
                {t(TIMELINE_CONFIG[preset].translationKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!isCurrentWindow ? (
        <Pressable
          onPress={onCurrentWindow}
          className="mt-3 py-2.5 px-4 rounded-lg bg-accent/15 border border-accent/30 flex-row items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('goToCurrentPeriod')}
        >
          <RotateCcw size={14} color="rgb(212, 175, 55)" />
          <Text className="text-accent font-medium ml-2">{t('goToCurrentPeriod')}</Text>
        </Pressable>
      ) : null}

      {excludedTransactionCount > 0 ? (
        <Text className="text-accent text-xs mt-3">
          {`${t('excludedFromTotalsNotice')}: ${excludedTransactionCount} (${excludedCurrencies.join(', ')})`}
        </Text>
      ) : null}

      {truncated ? (
        <Text className="text-muted-foreground text-xs mt-1">
          {t('dataLimitedNotice') || 'Large data range limited for performance.'}
        </Text>
      ) : null}
    </View>
  );
}
