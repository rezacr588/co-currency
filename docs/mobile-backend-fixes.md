# Mobile + Backend Fix Tracker

Purpose: Track completed backend and mobile app fixes with evidence-based checkbox status and required test-case results.

## Backend Fixes (backend/)
- [x] IRR E2E tests are opt-in via `RUN_IRR_E2E_TESTS=1` in `/Users/rezazeraat/dev/cofinance/backend/internal/repository/irr_e2e_test.go`.
- [x] IRR DB integration tests require `DATABASE_URL` and skip when missing in `/Users/rezazeraat/dev/cofinance/backend/internal/repository/irr_e2e_test.go`.
- [x] Standard backend test path is deterministic without external DB dependency failures in `/Users/rezazeraat/dev/cofinance/backend/internal/repository/irr_e2e_test.go`.

## Mobile App Fixes (app/)
- [x] Reports month picker year is synchronized on reopen to avoid stale year state in `/Users/rezazeraat/dev/cofinance/app/app/(app)/(tabs)/reports.tsx`.
- [x] Month labels are locale-aware (not hardcoded English) in `/Users/rezazeraat/dev/cofinance/app/app/(app)/(tabs)/reports.tsx`.
- [x] Date-range accessibility labels are localized in `/Users/rezazeraat/dev/cofinance/app/app/(app)/(tabs)/reports.tsx` and `/Users/rezazeraat/dev/cofinance/app/src/i18n/translations.ts`.
- [x] Date-range preset labels use localized text for non-custom presets in `/Users/rezazeraat/dev/cofinance/app/app/(app)/(tabs)/reports.tsx`.

## Required Test Cases
- [x] `cd /Users/rezazeraat/dev/cofinance/backend && go test ./...` -> PASS
- [x] `cd /Users/rezazeraat/dev/cofinance/backend && go test ./... -short` -> PASS
- [x] `cd /Users/rezazeraat/dev/cofinance/backend && go vet ./...` -> PASS
- [x] `cd /Users/rezazeraat/dev/cofinance/app && npx tsc --noEmit` -> PASS
- [ ] Manual app QA on device/simulator -> BLOCKED (no simulator/device session in this terminal run)

## Manual QA Scenarios (Mobile App)
- [ ] Open Reports month picker, change year, close, reopen, verify selected year syncs correctly. Blocker: requires device/simulator interaction.
- [ ] Switch app languages (`en`, `fa`, `ar`, `tr`) and verify month grid labels localize. Blocker: requires device/simulator interaction.
- [ ] Verify localized accessibility labels for date-range controls (screen reader labels). Blocker: requires device/simulator and accessibility tooling.

## Tracking Rules
- Mark `[x]` only after validation is executed and observed.
- Keep `[ ]` with blocker note when validation cannot be executed locally.
- Last validated: `2026-02-07T16:36:16Z`.
