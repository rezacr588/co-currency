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
    <View style={{ backgroundColor: colors.card, padding: theme.spacing.xl, borderRadius: theme.radii.md, marginBottom: theme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <Pressable
          onPress={onPreviousWindow}
          style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: colors.secondary }}
          accessibilityRole="button"
          accessibilityLabel={t('previousPeriod')}
          accessibilityHint="Show previous date range"
          hitSlop={8}
        >
          <ChevronLeft size={20} color={colors.mutedForeground} />
        </Pressable>

        <View style={{ flex: 1, backgroundColor: theme.alpha(colors.secondary, 0.4), borderWidth: 1, borderColor: colors.border, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radii.md, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Calendar size={16} color={colors.accent} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginStart: theme.spacing.sm }}>{timelineLabel}</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.xs }}>{rangeLabel}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.xs }}>
            {(t('reportCurrency') || 'Report currency') + `: ${reportCurrency}`}
          </Text>
          {isCurrentWindow ? (
            <Text style={{ color: colors.accent, fontSize: 12, marginTop: theme.spacing.xs }}>{t('currentPeriod')}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onNextWindow}
          style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: isCurrentWindow ? theme.alpha(colors.secondary, 0.3) : colors.secondary, opacity: isCurrentWindow ? 0.5 : 1 }}
          disabled={isCurrentWindow}
          accessibilityRole="button"
          accessibilityLabel={t('nextPeriod')}
          accessibilityHint="Show next date range"
          hitSlop={8}
        >
          <ChevronRight size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md, paddingBottom: 2 }}
      >
        {TIMELINE_PRESETS.map((preset) => {
          const isSelected = preset === timelinePreset;
          return (
            <Pressable
              key={preset}
              onPress={() => onTimelinePresetChange(preset)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.full,
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
          style={{ marginTop: theme.spacing.md, paddingVertical: theme.spacing.sm + 2, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radii.sm, backgroundColor: theme.alpha(colors.accent, 0.15), borderWidth: 1, borderColor: theme.alpha(colors.accent, 0.3), flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t('goToCurrentPeriod')}
          accessibilityHint="Jump back to current date range"
        >
          <RotateCcw size={14} color={colors.accent} />
          <Text style={{ color: colors.accent, fontFamily: 'Inter_500Medium', marginStart: theme.spacing.sm }}>{t('goToCurrentPeriod')}</Text>
        </Pressable>
      ) : null}

      {excludedTransactionCount > 0 ? (
        <Text style={{ color: colors.accent, fontSize: 12, marginTop: theme.spacing.md }}>
          {`${t('excludedFromTotalsNotice')}: ${excludedTransactionCount} (${excludedCurrencies.join(', ')})`}
        </Text>
      ) : null}

      {truncated ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: theme.spacing.xs }}>
          {t('dataLimitedNotice') || 'Large data range limited for performance.'}
        </Text>
      ) : null}
    </View>
  );
}
