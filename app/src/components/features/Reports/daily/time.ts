import { LANGUAGE_LOCALES } from './constants';

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWindowRange(windowDays: number, windowIndex: number): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const end = addDays(today, -(windowIndex * windowDays));
  const start = addDays(end, -(windowDays - 1));
  return { start, end };
}

export function createDateFormatter(
  language: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const locale = LANGUAGE_LOCALES[language] || 'en-US';
  const formatOptions: Intl.DateTimeFormatOptions = { ...options };

  if (language === 'fa') {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }

  return new Intl.DateTimeFormat(locale, formatOptions);
}

export function isDateInRange(target: Date, start: Date, end: Date): boolean {
  const targetTs = target.getTime();
  return targetTs >= start.getTime() && targetTs <= end.getTime();
}

export function toRFC3339RangeStart(date: Date): string {
  return startOfDay(date).toISOString();
}

export function toRFC3339RangeEnd(date: Date): string {
  return endOfDay(date).toISOString();
}
