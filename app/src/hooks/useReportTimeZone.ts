import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import {
  getReportTimeZonePreferenceLabel,
  resolveReportTimeZone,
} from '../utils/reportTimeZone';
import { useLanguage } from '../context/LanguageContext';

export function useReportTimeZone() {
  const { settings } = useSettings();
  const { t } = useLanguage();

  const preference = settings.reportTimeZonePreference;
  const reportTimeZone = useMemo(
    () => resolveReportTimeZone(preference),
    [preference]
  );
  const reportTimeZoneLabel = useMemo(
    () => getReportTimeZonePreferenceLabel(preference, t),
    [preference, t]
  );

  return {
    preference,
    reportTimeZone,
    reportTimeZoneLabel,
  };
}
