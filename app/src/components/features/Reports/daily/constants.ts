import type { TimelineConfig, TimelinePreset } from './types';

export const REPORT_CURRENCY = 'USD';
export const PAGE_SIZE = 500;
export const FETCH_CAP = 5000;

export const TIMELINE_CONFIG: Record<TimelinePreset, TimelineConfig> = {
  '7D': { windowDays: 7, bucketGranularity: 'day', translationKey: 'timeline7d' },
  '30D': { windowDays: 30, bucketGranularity: 'day', translationKey: 'timeline30d' },
};

export const TIMELINE_PRESETS: TimelinePreset[] = ['7D', '30D'];

export const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
};
