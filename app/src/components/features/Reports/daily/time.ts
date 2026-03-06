import { LANGUAGE_LOCALES } from './constants';
import { getTimeZoneDateParts, REPORT_TIME_ZONE } from '../../../../utils/dateRange';

function createReportAnchorDate(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  const { year, month, day } = getTimeZoneDateParts(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const second = Number(parts.find((part) => part.type === 'second')?.value);

  return Date.UTC(year, month - 1, day, hour, minute, second, date.getUTCMilliseconds()) - date.getTime();
}

function createUTCDateForTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): Date {
  if (timeZone === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const initialOffset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timeZone);
  let adjustedTime = utcGuess - initialOffset;
  const adjustedOffset = getTimeZoneOffsetMilliseconds(new Date(adjustedTime), timeZone);

  if (adjustedOffset !== initialOffset) {
    adjustedTime = utcGuess - adjustedOffset;
  }

  return new Date(adjustedTime);
}

export function startOfDay(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  return createReportAnchorDate(date, timeZone);
}

export function endOfDay(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  return createReportAnchorDate(date, timeZone);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getWindowRange(windowDays: number, windowIndex: number, timeZone = REPORT_TIME_ZONE): { start: Date; end: Date } {
  const today = startOfDay(new Date(), timeZone);
  const end = addDays(today, -(windowIndex * windowDays));
  const start = addDays(end, -(windowDays - 1));
  return { start, end };
}

export function createDateFormatter(
  language: string,
  options: Intl.DateTimeFormatOptions,
  timeZone = REPORT_TIME_ZONE
): Intl.DateTimeFormat {
  const locale = LANGUAGE_LOCALES[language] || 'en-US';
  const formatOptions: Intl.DateTimeFormatOptions = { ...options, timeZone };

  if (language === 'fa') {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }

  return new Intl.DateTimeFormat(locale, formatOptions);
}

export function isDateInRange(target: Date, start: Date, end: Date): boolean {
  const targetTs = target.getTime();
  return targetTs >= start.getTime() && targetTs <= end.getTime();
}

export function toRFC3339RangeStart(date: Date, timeZone = REPORT_TIME_ZONE): string {
  const { year, month, day } = getTimeZoneDateParts(date, timeZone);
  return createUTCDateForTimeZone(year, month, day, 0, 0, 0, 0, timeZone).toISOString();
}

export function toRFC3339RangeEnd(date: Date, timeZone = REPORT_TIME_ZONE): string {
  const { year, month, day } = getTimeZoneDateParts(date, timeZone);
  return createUTCDateForTimeZone(year, month, day, 23, 59, 59, 999, timeZone).toISOString();
}
