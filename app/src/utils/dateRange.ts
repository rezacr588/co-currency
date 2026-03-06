// Date range preset types
import { DEFAULT_REPORT_TIME_ZONE } from './reportTimeZone';

export type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'last_year' | 'all_time' | 'custom';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const REPORT_TIME_ZONE = DEFAULT_REPORT_TIME_ZONE;

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

export interface DateRange {
  year?: number;
  month?: number;
  fromDate?: string;
  toDate?: string;
  label: string;
}

export function buildDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMonthLabelAnchor(monthIndex: number, year = 2024): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 12));
}

export function getTimeZoneDateParts(date: Date, timeZone = REPORT_TIME_ZONE): CalendarDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

export function shiftCalendarDate(parts: CalendarDateParts, days: number): CalendarDateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  shifted.setUTCDate(shifted.getUTCDate() + days);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

// Get date range from preset
export function getDateRangeFromPreset(preset: DatePreset, timeZone = REPORT_TIME_ZONE): DateRange {
  const today = getTimeZoneDateParts(new Date(), timeZone);
  const currentYear = today.year;
  const currentMonth = today.month;

  switch (preset) {
    case 'this_month':
      return { year: currentYear, month: currentMonth, label: `${FULL_MONTH_NAMES[currentMonth - 1]} ${currentYear}` };
    case 'last_month': {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return { year: lastMonthYear, month: lastMonth, label: `${FULL_MONTH_NAMES[lastMonth - 1]} ${lastMonthYear}` };
    }
    case 'last_3_months': {
      const fromDate = new Date(Date.UTC(currentYear, currentMonth - 3, 1, 12));
      const toDate = new Date(Date.UTC(currentYear, currentMonth, 0, 12));
      return {
        fromDate: buildDateKey(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, fromDate.getUTCDate()),
        toDate: buildDateKey(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, toDate.getUTCDate()),
        label: 'Last 3 Months',
      };
    }
    case 'last_6_months': {
      const fromDate = new Date(Date.UTC(currentYear, currentMonth - 6, 1, 12));
      const toDate = new Date(Date.UTC(currentYear, currentMonth, 0, 12));
      return {
        fromDate: buildDateKey(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, fromDate.getUTCDate()),
        toDate: buildDateKey(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, toDate.getUTCDate()),
        label: 'Last 6 Months',
      };
    }
    case 'this_year':
      return {
        fromDate: `${currentYear}-01-01`,
        toDate: `${currentYear}-12-31`,
        label: `${currentYear}`,
      };
    case 'last_year':
      return {
        fromDate: `${currentYear - 1}-01-01`,
        toDate: `${currentYear - 1}-12-31`,
        label: `${currentYear - 1}`,
      };
    case 'all_time':
      return {
        fromDate: '2020-01-01',
        toDate: buildDateKey(today.year, today.month, today.day),
        label: 'All Time',
      };
    default:
      return { year: currentYear, month: currentMonth, label: `${FULL_MONTH_NAMES[currentMonth - 1]} ${currentYear}` };
  }
}

// Get week start/end dates (Monday start)
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date.getTime()); // Clone to avoid mutation
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Format date to YYYY-MM-DD (using local timezone)
export function formatDateKey(date: Date, timeZone?: string): string {
  if (timeZone) {
    const parts = getTimeZoneDateParts(date, timeZone);
    return buildDateKey(parts.year, parts.month, parts.day);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get safe max value (handles empty arrays)
export function safeMax(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return Math.max(...values);
}

// Get safe month name (handles out of bounds)
export function getMonthName(monthIndex: number): string {
  const safeIndex = Math.max(0, Math.min(11, monthIndex));
  return MONTH_NAMES[safeIndex];
}
