import { Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
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
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 12, marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Pressable
          onPress={onPreviousWindow}
          style={{ padding: 12, borderRadius: 12, backgroundColor: colors.secondary }}
          accessibilityRole="button"
          accessibilityLabel={t('previousPeriod')}
          accessibilityHint="Show previous date range"
        >
          <ChevronLeft size={20} color="#a1a1aa" />
        </Pressable>

        <View style={{ flex: 1, backgroundColor: colors.secondary + '66', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Calendar size={16} color={colors.accent} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>{timelineLabel}</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{rangeLabel}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            {(t('reportCurrency') || 'Report currency') + `: ${reportCurrency}`}
          </Text>
          {isCurrentWindow ? (
            <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>{t('currentPeriod')}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onNextWindow}
          style={{ padding: 12, borderRadius: 12, backgroundColor: isCurrentWindow ? colors.secondary + '4d' : colors.secondary, opacity: isCurrentWindow ? 0.5 : 1 }}
          disabled={isCurrentWindow}
          accessibilityRole="button"
          accessibilityLabel={t('nextPeriod')}
          accessibilityHint="Show next date range"
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
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 9999,
                borderWidth: 1,
                backgroundColor: isSelected ? colors.accent : colors.secondary,
                borderColor: isSelected ? colors.accent : colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={t(TIMELINE_CONFIG[preset].translationKey)}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={`Set timeline to ${t(TIMELINE_CONFIG[preset].translationKey)}`}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isSelected ? colors.background : colors.foreground }}>
                {t(TIMELINE_CONFIG[preset].translationKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!isCurrentWindow ? (
        <Pressable
          onPress={onCurrentWindow}
          style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.accent + '26', borderWidth: 1, borderColor: colors.accent + '4d', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t('goToCurrentPeriod')}
          accessibilityHint="Jump back to current date range"
        >
          <RotateCcw size={14} color={colors.accent} />
          <Text style={{ color: colors.accent, fontFamily: 'Inter_500Medium', marginStart: 8 }}>{t('goToCurrentPeriod')}</Text>
        </Pressable>
      ) : null}

      {excludedTransactionCount > 0 ? (
        <Text style={{ color: colors.accent, fontSize: 12, marginTop: 12 }}>
          {`${t('excludedFromTotalsNotice')}: ${excludedTransactionCount} (${excludedCurrencies.join(', ')})`}
        </Text>
      ) : null}

      {truncated ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
          {t('dataLimitedNotice') || 'Large data range limited for performance.'}
        </Text>
      ) : null}
    </View>
  );
}
