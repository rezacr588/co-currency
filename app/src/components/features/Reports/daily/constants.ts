import type { TimelineConfig, TimelinePreset } from './types';

export const REPORT_CURRENCY = 'USD';
export const PAGE_SIZE = 500;
export const FETCH_CAP = 5000;

export const TIMELINE_CONFIG: Record<TimelinePreset, TimelineConfig> = {
  '7D': { windowDays: 7, bucketGranularity: 'day', translationKey: 'timeline7d' },
  '30D': { windowDays: 30, bucketGranularity: 'day', translationKey: 'timeline30d' },
  '3M': { windowDays: 90, bucketGranularity: 'week', translationKey: 'timeline3m' },
  '6M': { windowDays: 180, bucketGranularity: 'week', translationKey: 'timeline6m' },
  '1Y': { windowDays: 365, bucketGranularity: 'month', translationKey: 'timeline1y' },
};

export const TIMELINE_PRESETS: TimelinePreset[] = ['7D', '30D', '3M', '6M', '1Y'];

export const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};
