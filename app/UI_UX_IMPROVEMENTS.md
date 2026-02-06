# UI/UX Improvements — Mobile App

## Phase 1: Layout & Safe Areas

- [x] **1A.** Fix tab bar safe area on notched devices (`_layout.tsx`) — replaced hardcoded `height: 80, paddingBottom: 20` with `useSafeAreaInsets()`
- [x] **1B.** Fix OfflineBanner safe area (`OfflineBanner.tsx`) — replaced `Platform.OS` check with `useSafeAreaInsets().top`
- [x] **1C.** Fix Toast keyboard overlap (`Toast.tsx`) — added Keyboard listener for dynamic bottom offset
- [x] **1D.** Add KeyboardAvoidingView to onboarding (`onboarding.tsx`) — wrapped ScrollView with KeyboardAvoidingView

## Phase 2: Missing Confirmations & User Feedback

- [x] **2A.** Add confirmation dialogs for destructive actions
  - [x] `recurring.tsx` — Alert.alert for execute transaction and toggle pause
  - [x] `subscriptions.tsx` — Alert.alert for pause/resume toggle
  - [x] `wallet/chat.tsx` — already had delete conversation confirm
  - [x] `challenges.tsx` — already had abandon confirmation
- [x] **2B.** Add success feedback after mutations
  - [x] `add.tsx` — success toast after transaction created
  - [x] `wallet/convert.tsx` — success toast after conversion
  - [x] `goals.tsx` — success toast after contribution
  - [x] `budgets.tsx` — success toast after budget created
  - [x] `recurring.tsx` — success toast after execute/create
  - [x] `subscriptions.tsx` — success toast after create
  - [x] `loans.tsx` — already had success toasts
- [x] **2C.** Add error states to screens missing them
  - [x] `budgets.tsx` — added error state with retry button
  - [x] `recurring.tsx` — added error handlers on execute/toggle mutations
  - [x] `subscriptions.tsx` — added error state with retry button

## Phase 3: Hardcoded Strings / i18n

- [x] **3A.** Dashboard — translate hardcoded strings (`index.tsx`) — "This month", "Active goals", "Get personalized advice", "Spending Forecast", "Based on last 30 days", "Daily Spend", "Daily Income", "Net Flow", "Insights", "No balances yet", "No transactions yet", "Add Transaction", all insight strings
- [x] **3B.** Challenges — translate "Featured" badge (`challenges.tsx`)
- [x] **3C.** Add all missing translation keys (`translations.ts`) — added 25 new keys in EN, FA, AR, TR

## User-Reported Bugs

- [x] **Bug 1.** Claim rewards modal does not hide (`badges.tsx`) — added `showNewlyEarned` state with dismiss (X) button, also added toast feedback when no new badges found and error toast on failure
- [x] **Bug 2.** Daily report showing error — already fixed in commits d5f3611 (SQL date filters, raised query limit) and ababf23 (local timezone date formatting)
- [x] **Bug 3.** Notification permission not retrieved (`usePushNotifications.ts`, `_layout.tsx`, `notification-settings.tsx`) — initialized `usePushNotifications()` at app root layout so permissions are requested on authentication; added `isLoading` state to properly show loading/error/setup states in notification settings screen

## Verification

- [x] TypeScript check passes (`npx tsc --noEmit` — 0 errors)
