# Mobile UI Fix Tracker

## Archived Web Fixes
- [x] Legacy `frontend/` fixes were completed before the React Native-only consolidation.
- [x] Legacy `frontend/` was removed from this repository; all active UI work now lives in `app/`.

## Mobile App Daily Report Fixes (app/)
- [x] Daily report range reworked to rolling 30-day windows in `/app/src/components/features/Reports/DailyReportView.tsx` (window index navigation with historical windows).
- [x] Transactions query now uses computed 30-day `from_date` and `to_date`, and renders a continuous 30-day series including zero-activity days.
- [x] UI now makes history explicit with localized range header, previous/next window controls, and a quick return-to-current-period action.
- [x] Daily report visual polish applied in `/app/src/components/features/Reports/DailyReportView.tsx` (improved summary cards, clearer timeline bars, spacing/typography tuning, subtle today highlight).
- [x] Localization and accessibility cleanup completed by removing hardcoded day labels/accessibility text and adding new translation keys in all four app languages in `/app/src/i18n/translations.ts`.
- [x] Type validation passed: `cd app && npx tsc --noEmit`.
- [ ] Manual device QA pending (simulator/phone interaction checks were not runnable in this terminal-only environment).
