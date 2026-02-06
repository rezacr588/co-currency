// Date range preset types
export type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'last_year' | 'all_time' | 'custom';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface DateRange {
  year?: number;
  month?: number;
  fromDate?: string;
  toDate?: string;
  label: string;
}

// Get date range from preset
export function getDateRangeFromPreset(preset: DatePreset): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  switch (preset) {
    case 'this_month':
      return { year: currentYear, month: currentMonth, label: `${FULL_MONTH_NAMES[currentMonth - 1]} ${currentYear}` };
    case 'last_month': {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return { year: lastMonthYear, month: lastMonth, label: `${FULL_MONTH_NAMES[lastMonth - 1]} ${lastMonthYear}` };
    }
    case 'last_3_months': {
      const fromDate = new Date(currentYear, currentMonth - 3, 1);
      const toDate = new Date(currentYear, currentMonth, 0);
      return {
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        label: 'Last 3 Months',
      };
    }
    case 'last_6_months': {
      const fromDate = new Date(currentYear, currentMonth - 6, 1);
      const toDate = new Date(currentYear, currentMonth, 0);
      return {
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
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
      return { label: 'All Time' };
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

// Format date to YYYY-MM-DD
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
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
