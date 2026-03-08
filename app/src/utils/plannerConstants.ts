import type { PlannerStatus } from '../types/planner';

export const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  medium: { bg: 'rgba(250,204,21,0.15)', text: '#facc15' },
  high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

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
