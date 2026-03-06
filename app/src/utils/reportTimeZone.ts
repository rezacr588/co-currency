export type ReportTimeZonePreference = 'turkish' | 'device' | 'utc';

export const DEFAULT_REPORT_TIME_ZONE = 'Europe/Istanbul';
export const DEFAULT_REPORT_TIME_ZONE_PREFERENCE: ReportTimeZonePreference = 'turkish';

export function getDeviceTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function resolveReportTimeZone(preference: ReportTimeZonePreference): string {
  switch (preference) {
    case 'device':
      return getDeviceTimeZone();
    case 'utc':
      return 'UTC';
    case 'turkish':
    default:
      return DEFAULT_REPORT_TIME_ZONE;
  }
}

export function getReportTimeZonePreferenceLabel(
  preference: ReportTimeZonePreference,
  t: (key: string) => string
): string {
  switch (preference) {
    case 'device':
      return t('analyticsTimeZoneDevice');
    case 'utc':
      return t('analyticsTimeZoneUtc');
    case 'turkish':
    default:
      return t('analyticsTimeZoneTurkish');
  }
}
