import { buildDateKey, getTimeZoneDateParts, shiftCalendarDate } from '../../../utils/dateRange';

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};

export interface ReportHistoryTarget {
  fromDate: string;
  toDate: string;
  category?: string;
}

export function createReportDateFormatter(
  language: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string
): Intl.DateTimeFormat {
  const locale = LANGUAGE_LOCALES[language] || 'en-US';
  const formatOptions: Intl.DateTimeFormatOptions = {
    ...options,
    timeZone,
  };

  if (language === 'fa') {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }

  return new Intl.DateTimeFormat(locale, formatOptions);
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

export function dateKeyToAnchorDate(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatReportDateKey(
  dateKey: string,
  language: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const formatter = createReportDateFormatter(language, options, timeZone);
  return formatter.format(dateKeyToAnchorDate(dateKey));
}

export function formatReportDateRange(
  fromDate: string,
  toDate: string,
  language: string,
  timeZone: string
): string {
  const formatter = createReportDateFormatter(
    language,
    { month: 'short', day: 'numeric', year: 'numeric' },
    timeZone
  );

  return `${formatter.format(dateKeyToAnchorDate(fromDate))} - ${formatter.format(dateKeyToAnchorDate(toDate))}`;
}

export function formatRelativeReportDateLabel(
  dateKey: string,
  language: string,
  timeZone: string,
  t: (key: string) => string
): string {
  const today = getTimeZoneDateParts(new Date(), timeZone);
  const todayKey = buildDateKey(today.year, today.month, today.day);

  if (dateKey === todayKey) {
    return t('today');
  }

  const tomorrow = shiftCalendarDate(today, 1);
  const tomorrowKey = buildDateKey(tomorrow.year, tomorrow.month, tomorrow.day);
  if (dateKey === tomorrowKey) {
    return t('tomorrow') || 'Tomorrow';
  }

  return formatReportDateKey(dateKey, language, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function buildHistoryRouteParams(target: ReportHistoryTarget): Record<string, string> {
  const params: Record<string, string> = {
    from_date: target.fromDate,
    to_date: target.toDate,
  };

  if (target.category) {
    params.category = target.category;
  }

  return params;
}
