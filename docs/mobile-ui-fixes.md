# Mobile UI Fix Tracker

## Web Mobile Fixes (frontend/)
- [x] AI chat mobile functional gap resolved in `/frontend/src/pages/AIChat.tsx` by adding a mobile conversation drawer with conversation list, new chat action, delete conversation action, and close behaviors (select, outside tap, Escape).
- [x] AI chat double-shell conflict resolved in `/frontend/src/App.tsx` by moving AI chat routes out of `AuthenticatedLayout` and wrapping them with `ProtectedRoute` directly.
- [x] Bottom nav accessibility fixed in `/frontend/src/components/layout/BottomNav.tsx` by adding explicit `aria-label` names for icon-only items.
- [x] Mobile first-paint desktop flash fixed in `/frontend/src/components/layout/AppLayout.tsx` by synchronous breakpoint initialization and `matchMedia` change listener updates.
- [x] Offline banner interaction blocking fixed in `/frontend/src/components/ui/OfflineBanner.tsx` by disabling pointer events while keeping status visibility.
- [x] Bottom nav active-state ambiguity on `/wallet/add` fixed in `/frontend/src/components/layout/BottomNav.tsx` with explicit per-item active matching.
- [x] Build validation passed: `cd frontend && npm run build`.
- [x] Unit validation passed: `cd frontend && npm run test:run`.
- [ ] Lint validation blocked by pre-existing unrelated repo lint errors (`any` usage and E2E regex escapes in untouched files).

## Mobile App Daily Report Fixes (app/)
- [x] Daily report range reworked to rolling 30-day windows in `/app/src/components/features/Reports/DailyReportView.tsx` (window index navigation with historical windows).
- [x] Transactions query now uses computed 30-day `from_date` and `to_date`, and renders a continuous 30-day series including zero-activity days.
- [x] UI now makes history explicit with localized range header, previous/next window controls, and a quick return-to-current-period action.
- [x] Daily report visual polish applied in `/app/src/components/features/Reports/DailyReportView.tsx` (improved summary cards, clearer timeline bars, spacing/typography tuning, subtle today highlight).
- [x] Localization and accessibility cleanup completed by removing hardcoded day labels/accessibility text and adding new translation keys in all four app languages in `/app/src/i18n/translations.ts`.
- [x] Type validation passed: `cd app && npx tsc --noEmit`.
- [ ] Manual device QA pending (simulator/phone interaction checks were not runnable in this terminal-only environment).
