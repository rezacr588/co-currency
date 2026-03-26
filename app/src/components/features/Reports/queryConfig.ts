export const REPORT_QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const REPORT_QUERY_STALE_TIME_SHORT_MS = 2 * 60 * 1000;
export const REPORT_QUERY_RETRY = 1;

export interface ReportsOverviewQueryParams {
  year?: number;
  month?: number;
  fromDate?: string;
  toDate?: string;
  reportTimeZone?: string;
}

export function buildReportsOverviewQueryKey({
  year,
  month,
  fromDate,
  toDate,
  reportTimeZone,
}: ReportsOverviewQueryParams) {
  return [
    'reports',
    'overview',
    year ?? null,
    month ?? null,
    fromDate ?? null,
    toDate ?? null,
    reportTimeZone ?? null,
  ] as const;
}
