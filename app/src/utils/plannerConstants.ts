import { useTheme } from 'styled-components/native';
import type { AppTheme } from '../theme';
import type { PlannerStatus } from '../types/planner';

export const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

export type PriorityKey = 'low' | 'medium' | 'high';
export type PriorityPalette = Record<PriorityKey, { bg: string; text: string }>;

export function isPriorityKey(value: unknown): value is PriorityKey {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function lookupPriority(
  palette: PriorityPalette,
  value: string | undefined | null,
): { bg: string; text: string } | undefined {
  if (!value || !isPriorityKey(value)) return undefined;
  return palette[value];
}

// Build a priority palette from the theme. Lower priority is greener (success),
// higher priority is redder (danger) — these mappings are semantic.
export function buildPriorityColors(theme: AppTheme): PriorityPalette {
  const { colors } = theme;
  return {
    low: { bg: theme.alpha(colors.success, 0.15), text: colors.success },
    medium: { bg: theme.alpha(colors.warning, 0.15), text: colors.warning },
    high: { bg: theme.alpha(colors.danger, 0.15), text: colors.danger },
  };
}

// Hook for components. Reads the current theme and derives priority colors.
export function usePriorityColors(): PriorityPalette {
  const theme = useTheme();
  return buildPriorityColors(theme);
}

export function getStatusLabel(
  status: PlannerStatus,
  t: (key: string) => string | undefined,
): string {
  const map: Record<PlannerStatus, string> = {
    todo: t('plannerToDo') || 'To Do',
    in_progress: t('plannerInProgress') || 'In Progress',
    done: t('plannerDone') || 'Done',
    archived: t('plannerArchived') || 'Archived',
  };
  return map[status];
}

export function getLocalizedMonthNames(
  t: (key: string) => string | undefined,
): string[] {
  return [
    t('monthJanuary') || 'January',
    t('monthFebruary') || 'February',
    t('monthMarch') || 'March',
    t('monthApril') || 'April',
    t('monthMay') || 'May',
    t('monthJune') || 'June',
    t('monthJuly') || 'July',
    t('monthAugust') || 'August',
    t('monthSeptember') || 'September',
    t('monthOctober') || 'October',
    t('monthNovember') || 'November',
    t('monthDecember') || 'December',
  ];
}

export function getLocalizedMonthShortNames(
  t: (key: string) => string | undefined,
): string[] {
  return [
    t('monthJanShort') || 'Jan',
    t('monthFebShort') || 'Feb',
    t('monthMarShort') || 'Mar',
    t('monthAprShort') || 'Apr',
    t('monthMayShort') || 'May',
    t('monthJunShort') || 'Jun',
    t('monthJulShort') || 'Jul',
    t('monthAugShort') || 'Aug',
    t('monthSepShort') || 'Sep',
    t('monthOctShort') || 'Oct',
    t('monthNovShort') || 'Nov',
    t('monthDecShort') || 'Dec',
  ];
}
