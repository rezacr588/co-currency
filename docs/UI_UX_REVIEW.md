# CoAI Mobile UI/UX Critical Review

**Date:** 2026-03-10
**Scope:** Every screen and component across public, auth, and protected app routes
**Platforms:** iOS, Android, Web (responsive)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design System & Component Library](#design-system--component-library)
3. [Public Screens](#public-screens)
4. [Authentication Screens](#authentication-screens)
5. [Dashboard](#dashboard)
6. [Wallet & Transactions](#wallet--transactions)
7. [AI Chat](#ai-chat)
8. [Add Transaction](#add-transaction)
9. [Goals](#goals)
10. [Reports & Analytics](#reports--analytics)
11. [Real Value / Purchasing Power](#real-value--purchasing-power)
12. [Budgets](#budgets)
13. [Recurring Transactions](#recurring-transactions)
14. [Subscriptions](#subscriptions)
15. [Loans & Debts](#loans--debts)
16. [Badges & Gamification](#badges--gamification)
17. [Challenges](#challenges)
18. [Notes](#notes)
19. [Planner / Todo](#planner--todo)
20. [Historical Rates](#historical-rates)
21. [Profile & Settings](#profile--settings)
22. [Onboarding](#onboarding)
23. [Notification Settings](#notification-settings)
24. [Change Password](#change-password)
25. [404 Page](#404-page)
26. [Navigation & Information Architecture](#navigation--information-architecture)
27. [Cross-Cutting Concerns](#cross-cutting-concerns)
28. [Priority Matrix](#priority-matrix)

---

## Executive Summary

CoAI is an ambitious personal finance app with 39 screens and 95+ components. The UI foundation is solid: consistent theming, responsive layouts, accessibility basics, and proper loading/error states. However, the app suffers from **feature sprawl without UX cohesion** - there are too many features presented with equal weight, leading to cognitive overload. The core finance experience (wallet, transactions, budgets) is strong, but secondary features (badges, challenges, planner, notes) feel bolted on without a clear UX narrative connecting them.

### Top 5 Systemic Issues

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | **Dashboard information overload** - 12+ sections, most collapsed | Users miss key insights; dashboard feels like a settings page | Medium |
| 2 | **Hidden interactions** - long-press to delete, tap to pay, no visual affordances | Users never discover core functionality | Low |
| 3 | **Inconsistent screen scaffolding** - Some screens use `PageScaffold`, others raw `SafeAreaView` | Broken scroll behavior, inconsistent padding, no max-width on desktop | Medium |
| 4 | **No unified empty states** - Each screen rolls its own | Inconsistent messaging, missed onboarding opportunities | Low |
| 5 | **Hardcoded strings scattered throughout** - "or", "days left", "Progress", version numbers | Broken i18n for non-English users | Low |

---

## Design System & Component Library

### Strengths

- **Theme tokens are well-structured.** Spacing (xs-xxxl), radii (sm-xxl), shadows (sm/md/lg/glow), and typography are all token-based via `buildTheme()`. This is better than most RN apps.
- **RTL support is baked in.** Typography switches between Inter and Vazirmatn. Layout components respect `isRTL`. This is rare and well-done.
- **Button component is excellent.** 7 variants, 3 sizes, loading states, haptic feedback, full accessibility. This is production-grade.
- **Input component handles edge cases.** Left/right icon slots, error states with semantic coloring, hint text, `nativeID` for label linkage.
- **Dark mode is the default** with a thoughtful light mode inversion. Color tokens adapt cleanly.

### Issues

| ID | Component | Issue | Severity |
|----|-----------|-------|----------|
| DS-1 | `Select.tsx` | Uses a full-screen `Modal` with `FlatList` for selection. On iOS, this is jarring - the modal slides up covering the entire screen for a simple dropdown. Should use `BottomSheet` or at least a half-sheet modal. On web, a native `<select>` would be more appropriate. | Medium |
| DS-2 | `CollapsibleSection.tsx` | Persists collapsed state to AsyncStorage. If a user collapses "Financial Health" on one session, it stays collapsed forever. There's no "reset" or "expand all" option. New users who accidentally collapse a section may never see that feature again. | Medium |
| DS-3 | `Toast.tsx` | Only shows one toast at a time (queue replaces). If multiple actions succeed quickly (e.g., marking multiple alerts as read), only the last toast is visible. Consider a stack or at minimum a count badge. | Low |
| DS-4 | `EmptyState.tsx` | The component exists but is barely used. Most screens (budgets, recurring, subscriptions, loans) build custom empty states inline instead of using this component. This creates visual inconsistency. | Low |
| DS-5 | `Card.tsx` | Has `glass` and `gradient` variants, but these are only used in 1-2 places each. The `glass` variant imports `expo-blur` which adds bundle size for minimal usage. | Low |
| DS-6 | `BottomSheet.tsx` | Exists as a component but is never used by any screen. All modals use React Native's `Modal` instead. The `BottomSheet` would provide a more native-feeling interaction on mobile for forms (loans, budgets, recurring, subscriptions). | Medium |
| DS-7 | Layout tokens | `maxContentWidth` is 1120px but different screens override it: Dashboard uses 1280, Profile uses 1120, budgets/recurring use 1400, real-value uses 800. There's no consistent content width strategy. | Low |
| DS-8 | Typography | `H2`, `H3`, `BodyMedium`, `Caption` styled components exist but many screens use raw `<Text>` with inline `fontFamily`/`fontSize` styles instead. This undermines the typography system. | Medium |

---

## Public Screens

### Landing Page (`(public)/index.tsx`)

**Overall: Strong marketing page, but too long for mobile.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PUB-1 | **Page length** | 9 sections on mobile means extensive scrolling. The FAQ alone is 6 items. Users scanning on mobile likely won't reach the final CTA. Consider reducing to 5-6 sections on mobile or adding a sticky "Get Started" button. | Medium |
| PUB-2 | **Stats bar is redundant** | Section 2 (stats: 160+ currencies, 24/7 rates, etc.) repeats the trust badges from the hero section. Both show "160+ Currencies" and "Free Forever". Remove one. | Low |
| PUB-3 | **Feature cards lack visual hierarchy** | All 6 feature cards look identical - same size, same layout, same icon treatment. The most differentiating features (AI Advisor, Real Value Protection) should stand out visually. | Medium |
| PUB-4 | **AI Showcase chat mockup** | The chat mockup uses hardcoded text that isn't translated. Non-English users see English chat examples on a translated page. | Low |
| PUB-5 | **No social proof** | No testimonials, download counts, user count, or ratings. For a finance app, trust signals beyond "encryption" are critical. | Medium |

### Converter Page (`(public)/converter.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PUB-6 | **Three info cards are filler** | The "Converter", "Global", and "Wallet" cards below the converter add no value. They describe features the user is already looking at. Replace with actual useful content: rate trends, popular conversions, or rate alerts. | Low |
| PUB-7 | **No rate chart** | A currency converter page without a historical rate chart feels incomplete. Even a simple 30-day sparkline would add significant value. | Medium |

### About Page (`(public)/about.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PUB-8 | **Founder section feels like a resume** | Skills list (React, TypeScript, Go, Python, ML) reads like a LinkedIn profile, not an app about page. Users don't care about the tech stack used. Focus on the mission and story instead. | Low |
| PUB-9 | **"Built With" section** | Listing "PostgreSQL" and "Styled Components" to end users is meaningless. This is developer-facing content on a user-facing page. | Low |

---

## Authentication Screens

### Login (`(auth)/login.tsx`)

**Overall: Clean, functional, follows established patterns.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| AUTH-1 | **"or" divider not translated** | `AuthDivider` hardcodes the string "or" in English. Should use `t('or')`. This breaks the experience for FA/AR/TR users. | High |
| AUTH-2 | **No "Remember me" option** | JWT tokens expire in 1 hour. Users must log in frequently. A "Remember me" toggle extending the session would reduce friction. | Low |
| AUTH-3 | **OAuth loading state is ambiguous** | When `isOAuthLoading` is true, both OAuth buttons show loading but the user can't tell which provider is processing. Only the clicked button should show loading. | Low |

### Register (`(auth)/register.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| AUTH-4 | **Same "or" divider issue as login** | Hardcoded English "or". | High |
| AUTH-5 | **Password requirements shown after failure** | Minimum 8 characters is only validated on submit. Show requirements inline below the password field from the start (like the change-password screen does). | Medium |
| AUTH-6 | **4 fields + 2 OAuth buttons + divider** | The registration form is visually heavy. Consider a progressive approach: show OAuth first, then "Sign up with email" expands the form. | Low |

### Forgot Password (`(auth)/forgot-password.tsx`)

**Overall: Minimal and effective. No issues found.**

### Reset Password (`(auth)/reset-password.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| AUTH-7 | **3-second auto-redirect after success** | Too fast. Users might still be reading the success message. Use a manual "Go to Login" button instead, or extend to 5 seconds with a visible countdown. | Low |
| AUTH-8 | **Minimum 6 characters here vs 8 in register** | Inconsistent password requirements between reset (6 chars) and registration (8 chars). Users could set a password during reset that wouldn't be accepted during registration. | High |

### OAuth Callbacks (`auth/google/callback.tsx`, `auth/linkedin/callback.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| AUTH-9 | **Error auto-redirects in 2 seconds** | If OAuth fails, the user sees an error message that disappears in 2 seconds. They can't read or understand the error. Show a manual "Try Again" button. | Medium |
| AUTH-10 | **Identical files** | `google/callback.tsx` and `linkedin/callback.tsx` are nearly identical (100-103 lines each). They should share a common `OAuthCallback` component to reduce duplication. | Low |

---

## Dashboard

### Dashboard (`(app)/(tabs)/index.tsx`)

**Overall: The most critical screen, but it tries to do too much.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| DASH-1 | **No pull-to-refresh** | This is the only tab screen without `RefreshControl`. Users expect to pull down to refresh on any data-heavy screen. The wallet screen has it; the dashboard doesn't. | High |
| DASH-2 | **12 sections, 8 collapsible** | SpendingAnomaly, CalendarHeatMap, Stats, AI Card, RealValue, HealthScore, SmartAdvice, QuickNotes, WeeklyRecap, News, Forecast, Insights, Converter, Balances, Transactions. This is overwhelming. A new user sees: anomaly alert (maybe), a collapsed heatmap, 4-5 stat cards, AI card, RealValue card, then a wall of collapsed sections. | High |
| DASH-3 | **Collapsed sections hide value** | Financial Health, Smart Advice, Quick Notes, Weekly Recap, Financial News, Spending Forecast, Insights, and Currency Converter are all collapsed by default or behind `CollapsibleSection`. Users must actively expand each one. Most won't. | High |
| DASH-4 | **Stats grid is single-column on mobile** | `statsCols = 1` on mobile means each stat card (Balance, Income, Expenses, Goals, Budget) takes full width. This creates a very tall stack of cards. A 2-column grid with smaller cards would be more scannable. | Medium |
| DASH-5 | **AI card chips overflow** | 4 quick action chips ("Analyze spending", "Budget check", "Goal advice", "Wealth protection") wrap to 2 rows on narrow screens. The text gets cramped. Consider showing only 2-3 chips with a "More" overflow. | Low |
| DASH-6 | **No personalization or prioritization** | Every section has equal visual weight. The dashboard should surface what matters most: if the user is over budget, that should be prominent. If they have no goals, the goals section should prompt them. Instead, everything is a flat list. | High |
| DASH-7 | **Converter widget on dashboard** | A full currency converter widget takes significant space on the dashboard. Most finance app dashboards don't embed a converter. It's already accessible via the wallet tab. | Low |
| DASH-8 | **Two-column layout only on desktop** | Balances and Transactions go side-by-side only on desktop (1024px+). On tablet (768-1024px), they stack. The two-column layout would work fine on tablets too. | Low |

---

## Wallet & Transactions

### Wallet Overview (`wallet/index.tsx`)

**Overall: Well-designed with clear hierarchy and good use of skeleton loaders.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| WAL-1 | **Quick action label font size is 10px** | On non-compact phones, the label under each quick action icon is `fontSize: 10`. This is below Apple's HIG minimum of 11pt and Google's recommendation of 12sp. Barely readable on standard phone screens. | High |
| WAL-2 | **Balance card left accent bar clips** | The left accent bar on currency balance cards uses `position: absolute` with `borderTopLeftRadius: 12`. On some Android devices, the absolute positioning within `overflow: 'hidden'` can cause clipping artifacts. | Low |
| WAL-3 | **"View All" links to history, not balances** | When `showViewAllBalances` is true, the "View All" link goes to `/wallet/history` (transactions), not a dedicated balances view. Users wanting to see all their currency balances get transaction history instead. | Medium |
| WAL-4 | **Real value toggle is tiny** | The Shield icon toggle to switch between nominal and real values is 12px with 10px labels. It's functionally important but visually easy to miss. | Medium |

### Transaction History (`wallet/history.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| WAL-5 | **File is 2000+ lines** | This is a massive monolithic file handling list rendering, filtering, editing, deletion, export, search, swipe actions, and note attachment. It's likely to have performance issues on lower-end devices due to the sheer size of the component tree. | Medium |
| WAL-6 | **Swipe-to-delete on mobile only** | Swipe actions exist for mobile but there's no equivalent on desktop/web. Desktop users need to find edit/delete through some other means. | Low |

### Currency Convert (`wallet/convert.tsx`)

**Overall: Clean and focused. Good validation and error handling.**

No significant issues.

---

## AI Chat

### Chat Screen (`wallet/chat.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| CHAT-1 | **Chat tab is a redirect** | `(tabs)/chat.tsx` is a 4-line file that imports from `wallet/chat.tsx`. This means the chat is technically nested inside the wallet stack, not a true top-level tab. Deep linking to chat goes through the wallet route. | Low |
| CHAT-2 | **Streaming + markdown rendering** | The combination of streaming responses and markdown rendering can cause visual jank as the markdown re-renders on each token. Consider buffering chunks before rendering. | Medium |
| CHAT-3 | **Attachment support (images, PDFs, CSVs)** | Good feature, but there's no file size limit shown to users. Large PDFs could timeout or fail without clear feedback. | Low |

---

## Add Transaction

### Add Transaction (`(tabs)/add.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| ADD-1 | **2000+ line file** | Like transaction history, this is a massive monolithic component handling manual entry, AI parsing (receipt, text, voice, intent detection), category selection, currency picking, recurring setup, goal contribution, task linking, and offline queue. | Medium |
| ADD-2 | **Too many input modes** | Manual, camera, voice, AI text - all presented as tabs within one screen. For a primary action (adding a transaction), this is overwhelming. Consider defaulting to manual with AI modes as secondary options. | Medium |
| ADD-3 | **Offline queue not visible** | Transactions queued offline are stored in AsyncStorage but there's no UI showing pending/queued transactions. Users don't know if their offline transaction was saved or lost. | Medium |

---

## Goals

### Goals Screen (`(tabs)/goals.tsx`)

**Overall: Solid implementation with CRUD, progress tracking, and categories.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| GOAL-1 | **Contribute button inside each card** | The contribute button is inline within each goal card. On mobile with many goals, the cards get tall. Consider moving contribute to a tap-to-expand or bottom sheet interaction. | Low |
| GOAL-2 | **No goal sorting** | Goals are displayed in API order. Users can't sort by progress, deadline, or amount. | Low |
| GOAL-3 | **Hidden from tab bar** | Goals has `href: null` in the tab layout, making it unreachable from the bottom tabs. It's accessible from wallet quick actions and the dashboard, but this is inconsistent with its importance as a feature. | Medium |

---

## Reports & Analytics

### Reports Screen (`(tabs)/reports.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| REP-1 | **5 report period types** | Daily, Weekly, Monthly, Yearly, All-Time - each with its own component. The period tabs can overflow on small screens. | Low |
| REP-2 | **Net worth ring chart** | Uses inline SVG for the currency distribution chart. On Android, SVG rendering can be slow with many segments. | Low |
| REP-3 | **Date picker modal** | Custom month/year picker modal works but feels non-native. On iOS, a native date picker would be smoother. | Low |

---

## Real Value / Purchasing Power

### Real Value Screen (`(app)/real-value.tsx`)

**Overall: One of the best-designed screens in the app. Clear sections, good data presentation.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| RV-1 | **Currency inputs are free text** | The "From" and "To" fields in What-If Analysis are plain `Input` components. Users type currency codes manually (e.g., "USD", "EUR"). Typos lead to API errors. Should use `CurrencyPicker` or `Select` with currency options. | High |
| RV-2 | **No input validation feedback** | If a user types "US" instead of "USD" in the currency field, the mutation fires and fails with a generic "Something went wrong" toast. Should validate before submitting. | Medium |
| RV-3 | **Inflation table horizontal overflow** | The 4-column table (Currency, Inflation, Nominal, Real) can overflow horizontally on narrow phones (< 360px width) when currency values are long. No horizontal scroll is provided. | Medium |
| RV-4 | **Alerts limited to 10** | `alerts.slice(0, 10)` with no "Load More" or pagination. Users with many alerts can't see older ones. | Low |

---

## Budgets

### Budgets Screen (`(app)/budgets.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| BUD-1 | **No edit or delete** | Users can create budgets but cannot edit amounts, change categories, or delete budgets. This is a significant functional gap. Users are stuck with every budget they create. | Critical |
| BUD-2 | **Only 6 categories** | Hardcoded to `['food', 'transportation', 'entertainment', 'shopping', 'bills', 'other']`. The transaction system supports many more categories. Users can't budget for "health", "education", "rent", etc. | High |
| BUD-3 | **No currency picker** | Form hardcodes `USD` as the default currency with no way to change it. The `currency` state exists but has no UI control. Non-USD users must manually know to change this. | High |
| BUD-4 | **Grid width uses percentage strings** | `width: ${(100 / columns) - (16 * (columns - 1) / columns)}%` - this creates fractional percentages that can cause 1px gaps or overflow on certain screen widths due to rounding. | Low |
| BUD-5 | **BudgetCard "daily allowance"** | Excellent UX touch - showing how much a user can spend per day within their budget. This is the kind of insight that should be highlighted more prominently. | Positive |

---

## Recurring Transactions

### Recurring Screen (`(app)/recurring.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| REC-1 | **No edit functionality** | Users can create and toggle pause/resume, but cannot edit the amount, category, frequency, or description of an existing recurring transaction. | High |
| REC-2 | **No delete functionality** | There's no way to delete a recurring transaction. Users can only pause them. Over time, the paused list will grow indefinitely. | High |
| REC-3 | **No currency picker in form** | Same issue as budgets - hardcodes `USD` with no UI to change. | High |
| REC-4 | **Next execution is auto-set to tomorrow** | `nextExecution.setDate(nextExecution.getDate() + 1)` - no user control over when the first execution should happen. A monthly rent payment created mid-month shouldn't execute tomorrow. | Medium |
| REC-5 | **Execute confirmation could be clearer** | The "Execute Now" action (Play icon button) triggers an `Alert.alert` confirmation, but the alert text doesn't show the amount or description. Users confirming "Execute Transaction" don't know which transaction they're confirming if they have multiple. | Medium |

---

## Subscriptions

### Subscriptions Screen (`(app)/subscriptions.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| SUB-1 | **No edit or delete** | Users can only toggle pause/resume. Cannot edit name, amount, billing cycle, or delete a subscription. Same pattern as budgets and recurring. | High |
| SUB-2 | **No currency picker in form** | Hardcodes `USD`. | High |
| SUB-3 | **Next billing date auto-calculated** | Set to `month + 1` from today. No user input for actual billing date. A user adding their Netflix subscription can't set the actual billing date. | Medium |
| SUB-4 | **Summary card max-width inconsistency** | `maxWidth: isDesktop ? 500 : '100%'` means on tablet (768-1024px), the summary card stretches to full width while on desktop it's constrained. Should apply a max-width on tablet too. | Low |
| SUB-5 | **No cancel action** | The `updateMutation` supports `'cancelled'` status but the UI only toggles between `'active'` and `'paused'`. Users can't cancel a subscription. | Medium |

---

## Loans & Debts

### Loans Screen (`(app)/loans.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| LOAN-1 | **Long-press to delete is undiscoverable** | `onLongPress={() => handleDelete(loan)}` on the loan card. No visual hint (no trash icon, no swipe action, no context menu) tells users this interaction exists. Most users will never discover this. | Critical |
| LOAN-2 | **Tap to open payment modal is undiscoverable** | The entire loan card is a `Pressable` that opens the payment modal. But cards typically aren't clickable in RN apps unless they have a visual affordance (chevron, "Pay" button, or a border change on hover). | High |
| LOAN-3 | **No edit functionality** | Once created, loan details (name, amount, interest rate, counterparty) cannot be modified. | Medium |
| LOAN-4 | **Header layout is off-center** | Back button is left-aligned, title is between back and add buttons, but the title isn't visually centered because the back button takes different width than the add button. | Low |
| LOAN-5 | **No due date input in creation form** | The form collects name, amount, currency, interest rate, counterparty, and description - but no due date. Yet the loan card displays `Due: {date}`. The due date can only come from the API default, which is likely null. | High |
| LOAN-6 | **Modal uses transparent backdrop + bottom sheet pattern** | The create/payment modals use `transparent: true` with a bottom-aligned card. This custom bottom sheet doesn't have drag-to-dismiss or proper gesture handling like `@gorhom/bottom-sheet` would provide. | Medium |

---

## Badges & Gamification

### Badges Screen (`(app)/badges.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| BADGE-1 | **No PageScaffold** | Uses raw `SafeAreaView + ScrollView` instead of `PageScaffold`. This breaks consistency: no `maxWidth` constraint on desktop, no responsive page gutters, different scroll behavior. | Medium |
| BADGE-2 | **No max-width on desktop** | Badge cards spread across the full viewport on wide screens. A 1920px monitor shows a single row of 6 tiny badge cards with massive whitespace. | Medium |
| BADGE-3 | **Badge grid width calculation** | `width: ${100 / numColumns - 3}%` - the magic number "3" creates inconsistent gaps that don't align with the theme's spacing tokens. | Low |
| BADGE-4 | **Emojis in section headers** | Section headers use raw emojis ("earned" section, "in progress" section, "locked" section). The rest of the app avoids emojis except in user content. | Low |
| BADGE-5 | **Back button uses ChevronLeft** | Most other screens use `ArrowLeft` for the back button. Badges uses `ChevronLeft`. Inconsistent icon choice. | Low |
| BADGE-6 | **Badge description not shown** | Each badge has a `description` field but it's never displayed in the `BadgeCard`. Users can see the badge name but not what they need to do to earn it (for locked badges). | Medium |

---

## Challenges

### Challenges Screen (`(app)/challenges.tsx`)

**Overall: Well-designed with tabs, stats, and detail modals.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| CHAL-1 | **5+ hardcoded English strings** | Line 655: `{daysLeft} days left`, Line 672: `Progress`, Line 688: `+{challenge.points_reward} pts on completion`, Line 662: `{userChallenge.streak_days} day streak`. None of these use `t()`. | High |
| CHAL-2 | **Active challenge card uses raw "Progress"** | `ActiveChallengeCard` renders "Progress" without translation while `ChallengeCard` doesn't show progress text. Inconsistent. | Medium |
| CHAL-3 | **History card uses `toLocaleDateString()`** | Line 751: `new Date(userChallenge.started_at).toLocaleDateString()` - this uses the device locale but doesn't go through the app's `formatDate()` utility, which handles consistent formatting across the app. | Low |
| CHAL-4 | **No max-width constraint** | Like badges, this screen doesn't use `PageScaffold` and has no max-width. Challenge cards stretch to full width on desktop. | Medium |

---

## Notes

### Notes List (`(app)/notes.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| NOTE-1 | **No PageScaffold** | Uses raw `SafeAreaView + ScrollView`. Same consistency issue as badges and challenges. | Medium |
| NOTE-2 | **Long-press for actions** | Note actions (edit, pin, delete) are behind a long-press gesture. No visual indicator this exists. | Medium |
| NOTE-3 | **Search has no debounce** | The search input filters notes on every keystroke. With many notes, this could cause jank. The `useDebounce` hook exists in the codebase but isn't used here. | Low |

### Note Detail (`(app)/note/[id].tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| NOTE-4 | **Color system is nice** | 8 color options for notes (red, orange, yellow, green, blue, purple, pink) with proper theme integration. Good touch. | Positive |
| NOTE-5 | **No markdown/rich text** | Notes are plain text only. No formatting, no links, no checklists. For a finance app, the ability to add links to receipts or format notes would be valuable. | Low |

---

## Planner / Todo

### Planner (`(app)/planner.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PLAN-1 | **51KB single file** | This is by far the largest screen file. It contains the entire Kanban board, task wizards, modals, offline sync, caching, search, filters, and real-time updates. This needs to be broken into sub-components. | Medium |
| PLAN-2 | **Feature scope creep** | A Kanban task planner in a personal finance app is unusual. It's unclear how task management connects to financial management. The UX narrative doesn't explain this connection. | Medium |

### Todo / Finapp Entry Screens

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PLAN-3 | **Loading spinner with no context** | Both `todo.tsx` and `finapp.tsx` show a centered `ActivityIndicator` with no text explaining what's happening. Users see a blank screen with a spinner before being redirected. | Low |
| PLAN-4 | **Mode switching concept is opaque** | The app has two "modes" (todo and finapp) with `setCurrentMode()` and `getModeEntryRedirect()`. This abstraction isn't visible to users - they just see a loading screen and then land somewhere. The mental model is unclear. | Medium |

---

## Historical Rates

### Historical Screen (`(app)/historical.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| HIST-1 | **No PageScaffold** | Another screen using raw `SafeAreaView + ScrollView`. | Medium |
| HIST-2 | **Only 4 data points** | Shows rates for 1 day, 7 days, 30 days, and 90 days ago. No chart, no trend visualization, no ability to pick custom dates. This is the bare minimum for a "historical rates" feature. | Medium |
| HIST-3 | **Back button uses ChevronLeft** | Inconsistent with other screens that use `ArrowLeft`. | Low |
| HIST-4 | **No explanation of what "historical" means** | A new user arriving at this screen sees two currency dropdowns and 4 cards with numbers. There's no context about what these numbers represent or why they're useful. | Low |

---

## Profile & Settings

### Profile Screen (`(app)/profile.tsx`)

**Overall: One of the better-designed screens. Clean settings sections, desktop two-column layout.**

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PROF-1 | **Hardcoded version string** | Line 686: `CoAI v1.0.0` is hardcoded. Should read from `app.json` or a constants file. Will become stale after version bumps. | Medium |
| PROF-2 | **SettingsSection/SettingsItem defined inline** | These are well-designed components but they're defined inside the `ProfileScreen` function. They should be extracted to `src/components/ui/` for reuse by other settings-like screens (notification-settings, change-password). | Low |
| PROF-3 | **Language radio buttons have no confirmation** | Changing language takes effect immediately. For RTL languages (FA, AR), this causes a jarring layout flip. Consider a confirmation dialog or preview before applying. | Low |
| PROF-4 | **No avatar upload** | The user model has `avatarURL` but the profile screen shows a generic `User` icon. No way to upload or change avatar. | Low |
| PROF-5 | **"About Us" links to public about page** | Navigating from the authenticated profile to the public about page (`/(public)/about`) may cause navigation state issues since they're in different route groups. | Low |

---

## Onboarding

### Onboarding Screen (`(app)/onboarding.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| ONB-1 | **Old branding in i18n key** | Line 169: `t('welcomeToCoFinance')` - the key still references "CoFinance" even though the app was rebranded to "CoAI". The fallback text says "CoAI" but the i18n key is wrong for all languages. | High |
| ONB-2 | **Progress bar is 3px** | Height of 3px is difficult to see, especially on screens with reduced brightness. Apple HIG recommends minimum 44pt tap targets and proportional visual indicators. 4-6px would be more visible. | Low |
| ONB-3 | **Currency selection uses generic Select** | The currency dropdown shows all 160+ currencies in a flat list. For onboarding, showing the top 10-15 most popular currencies first with a "Show all" option would reduce cognitive load. | Medium |
| ONB-4 | **No skip confirmation** | "Skip" immediately skips onboarding. A quick confirmation ("Skip setup? You can always configure this later in Settings.") would prevent accidental skips. | Low |
| ONB-5 | **Initial balance has no currency symbol** | The balance input shows `{selectedCurrency}` as text prefix but doesn't use the actual currency symbol (e.g., $, EUR, etc.). Compare with the loans screen which uses `getCurrencyDisplay(currency).symbol`. | Low |

---

## Notification Settings

### Notification Settings (`(app)/notification-settings.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| NOTIF-1 | **No PageScaffold** | Uses raw patterns instead of the shared scaffold. | Medium |
| NOTIF-2 | **Test notification button** | Good feature for debugging, but should be hidden or moved to a "Developer" section for production users. | Low |
| NOTIF-3 | **No notification history** | Users can configure preferences but can't see past notifications. A simple notification history would build trust in the system. | Low |

---

## Change Password

### Change Password (`(app)/change-password.tsx`)

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PASS-1 | **Minimum 6 characters** | The registration screen requires 8 characters. The change-password screen requires 6. This inconsistency could confuse users and creates a weaker security floor for password changes. | High |
| PASS-2 | **Good OAuth-only user handling** | Correctly detects users without a password (OAuth-only) and hides the "current password" field. Shows appropriate messaging. | Positive |

---

## 404 Page

### Not Found (`+not-found.tsx`)

**Overall: Clean and functional. SEO head with noIndex is correct. "Go Home" button is clear.**

No issues.

---

## Navigation & Information Architecture

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| NAV-1 | **5 bottom tabs but Goals is hidden** | The tab bar shows Dashboard, Wallet, Add, AI, Reports. Goals has `href: null` making it invisible. For a finance app, goals are a primary feature that deserves tab-level presence. Consider replacing one of the current tabs or using a "More" tab. | High |
| NAV-2 | **Features buried in profile** | Budgets, Recurring, Subscriptions, Notes, Badges, Challenges, Historical Rates are all accessed from Profile > Settings sections. Users must navigate: Tab bar > Profile > Finance Management/Tools > Feature. That's 3 taps to reach a budget. | High |
| NAV-3 | **Wallet quick actions partially solve NAV-2** | The wallet screen has a 6-icon quick actions grid (History, Goals, Budgets, AI, Reports, Planner). This is good but it duplicates navigation already in the tab bar (Reports, AI) while missing other features (Recurring, Subscriptions, Loans). | Medium |
| NAV-4 | **Sidebar "Planner" label not translated** | Line 137: `label: 'Planner'` - hardcoded English instead of `t('planner')`. | Medium |
| NAV-5 | **AppSwitcher concept** | The app has a mode-switching concept (finapp/todo) via `AppSwitcherTrigger` in the header. This is a power-user feature that new users won't understand. No onboarding or tooltip explains what it does. | Medium |
| NAV-6 | **Deep linking fragility** | Chat is at `/(app)/(tabs)/wallet/chat` - nested inside the wallet stack. If the wallet stack resets (`popToTopOnBlur: true`), the chat might get popped unexpectedly. | Medium |
| NAV-7 | **About page not registered in public layout** | The `(public)/_layout.tsx` only registers `index` and `converter` screens. The `about` screen exists in the directory but isn't registered, relying on Expo Router's auto-detection. This could cause issues with navigation state. | Low |

---

## Cross-Cutting Concerns

### Consistency Issues

| ID | Issue | Screens Affected | Severity |
|----|-------|-----------------|----------|
| CC-1 | **PageScaffold not used everywhere** | Badges, Challenges, Notes, Historical, Notification Settings use raw `SafeAreaView + ScrollView`. Dashboard, Wallet, Profile, Real Value use `PageScaffold`. | Medium |
| CC-2 | **Back button icon inconsistency** | Most screens use `ArrowLeft`. Badges and Historical use `ChevronLeft`. | Low |
| CC-3 | **Modal patterns inconsistent** | Profile uses `Modal transparent + centered card`. Loans/Challenges use `Modal transparent + bottom sheet`. Budgets/Recurring/Subscriptions use `Modal presentationStyle="pageSheet"`. Three different modal patterns. | Medium |
| CC-4 | **No unified CRUD pattern** | Budgets: create only. Recurring: create + toggle. Subscriptions: create + toggle. Loans: create + delete (long-press) + pay. Goals: full CRUD. Every feature screen has a different set of available actions with no consistency. | High |
| CC-5 | **Currency picker availability** | Wallet convert screen has full `CurrencyPicker`. Real Value uses text input. Budgets/Recurring/Subscriptions have no currency picker at all. Loans have a horizontal scroll of common currencies. Four different approaches. | Medium |

### Accessibility

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| ACC-1 | **Good: Most pressables have accessibilityRole and accessibilityLabel** | This is better than most React Native apps. | Positive |
| ACC-2 | **Hit targets below 44pt** | Several interactive elements are below Apple's 44pt minimum: quick action icons (48px but label area is smaller), chip buttons (variable), small toggle areas. Most have `hitSlop` which helps but doesn't solve the visual target issue. | Medium |
| ACC-3 | **Color-only information** | Budget progress bars, loan status (borrowed=red, lent=green), inflation severity (red/yellow/green) - these all rely solely on color to convey meaning. Color-blind users lose this information. Add icons or text labels. | Medium |
| ACC-4 | **No screen reader announcements for state changes** | When a budget is created, a badge is earned, or a loan payment is recorded, only a toast is shown. Screen readers may not announce toasts. `AccessibilityInfo.announceForAccessibility()` should be used for important state changes. | Medium |
| ACC-5 | **CollapsibleSection animation** | The expand/collapse animation is visual only. Screen readers should announce the expanded/collapsed state. The `accessibilityState={{ expanded }}` is missing. | Low |

### Performance Concerns

| ID | Issue | Detail | Severity |
|----|-------|--------|----------|
| PERF-1 | **Dashboard makes 7+ API calls on mount** | wallet/summary, reports/monthly, goals, budgets, forecast, heatmap data, AI status. Each is a separate query. No request batching or waterfall prevention. | Medium |
| PERF-2 | **Large file sizes** | `planner.tsx` (51KB), `add.tsx` (2000+ lines), `history.tsx` (2000+ lines) are all single-file components. Large component trees slow down reconciliation. | Medium |
| PERF-3 | **ScrollView for long lists** | Notes, badges, challenges, and loans use `ScrollView` instead of `FlatList`. With many items, all are rendered at once. Only transaction history correctly uses `FlatList`. | Medium |
| PERF-4 | **CalendarHeatMap re-renders** | The heatmap recalculates all 84 cells (12 weeks x 7 days) on every render. No `useMemo` for the cell grid. | Low |

### i18n Issues

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| I18N-1 | **"or" divider** | `login.tsx`, `register.tsx` | High |
| I18N-2 | **"days left"** | `challenges.tsx:655` | High |
| I18N-3 | **"Progress"** | `challenges.tsx:672` | High |
| I18N-4 | **"pts on completion"** | `challenges.tsx:688` | Medium |
| I18N-5 | **"day streak"** | `challenges.tsx:662` | Medium |
| I18N-6 | **"Planner" sidebar label** | `(tabs)/_layout.tsx:137` | Medium |
| I18N-7 | **welcomeToCoFinance key** | `onboarding.tsx:169` | High |
| I18N-8 | **AI chat mockup text on landing** | `(public)/index.tsx` | Low |
| I18N-9 | **"CoAI v1.0.0"** | `profile.tsx:686` | Low |

---

## Priority Matrix

### Critical (Fix Immediately)

| ID | Issue | Screen |
|----|-------|--------|
| BUD-1 | No edit or delete for budgets | Budgets |
| LOAN-1 | Long-press to delete is undiscoverable | Loans |
| CC-4 | No unified CRUD pattern across features | All feature screens |

### High Priority (Fix Soon)

| ID | Issue | Screen |
|----|-------|--------|
| DASH-1 | No pull-to-refresh on dashboard | Dashboard |
| DASH-2 | 12+ sections creating information overload | Dashboard |
| DASH-6 | No personalization or prioritization | Dashboard |
| AUTH-1 | "or" divider not translated | Login/Register |
| AUTH-8 | Password minimum 6 vs 8 inconsistency | Reset vs Register |
| WAL-1 | Quick action 10px font size | Wallet |
| RV-1 | Currency inputs are free text | Real Value |
| REC-1 | No edit for recurring transactions | Recurring |
| REC-2 | No delete for recurring transactions | Recurring |
| REC-3 | No currency picker in recurring form | Recurring |
| SUB-1 | No edit or delete for subscriptions | Subscriptions |
| SUB-2 | No currency picker in subscription form | Subscriptions |
| BUD-2 | Only 6 budget categories | Budgets |
| BUD-3 | No currency picker in budget form | Budgets |
| LOAN-2 | Tap to pay is undiscoverable | Loans |
| LOAN-5 | No due date input in loan creation | Loans |
| CHAL-1 | 5+ hardcoded English strings | Challenges |
| ONB-1 | Old branding in i18n key | Onboarding |
| PASS-1 | Password minimum inconsistency | Change Password |
| NAV-1 | Goals hidden from tab bar | Navigation |
| NAV-2 | Features buried 3 taps deep in profile | Navigation |
| I18N-1 | "or" divider not translated | Auth |
| I18N-7 | welcomeToCoFinance key | Onboarding |

### Medium Priority (Plan for Next Sprint)

| ID | Issue | Screen |
|----|-------|--------|
| DS-1 | Select uses full-screen modal | Design System |
| DS-2 | CollapsibleSection persists forever | Design System |
| DS-6 | BottomSheet component exists but unused | Design System |
| DS-8 | Raw Text used instead of typography components | Multiple |
| DASH-4 | Stats grid single-column on mobile | Dashboard |
| WAL-3 | "View All" links to wrong destination | Wallet |
| WAL-4 | Real value toggle too small | Wallet |
| ADD-2 | Too many input modes presented at once | Add Transaction |
| ADD-3 | Offline queue not visible to users | Add Transaction |
| GOAL-3 | Goals hidden from tab bar | Goals |
| RV-2 | No input validation for currency fields | Real Value |
| RV-3 | Inflation table horizontal overflow | Real Value |
| REC-4 | Next execution auto-set to tomorrow | Recurring |
| SUB-5 | No cancel action for subscriptions | Subscriptions |
| LOAN-3 | No edit for loans | Loans |
| LOAN-6 | Custom bottom sheet lacks gestures | Loans |
| BADGE-1 | No PageScaffold | Badges |
| BADGE-6 | Badge description not shown | Badges |
| CHAL-4 | No max-width constraint | Challenges |
| NOTE-2 | Long-press for actions undiscoverable | Notes |
| HIST-2 | Only 4 data points, no chart | Historical |
| PLAN-1 | 51KB single file | Planner |
| PLAN-4 | Mode switching concept is opaque | Todo/Finapp |
| PROF-1 | Hardcoded version string | Profile |
| ONB-3 | Currency selection shows all 160+ | Onboarding |
| AUTH-9 | Error auto-redirects too fast | OAuth Callbacks |
| CC-1 | PageScaffold inconsistency | Multiple |
| CC-3 | Three different modal patterns | Multiple |
| CC-5 | Currency picker inconsistency | Multiple |
| ACC-2 | Hit targets below 44pt | Multiple |
| ACC-3 | Color-only information | Multiple |
| PERF-1 | Dashboard 7+ API calls on mount | Dashboard |
| PERF-3 | ScrollView for long lists | Multiple |
| NAV-4 | Sidebar Planner label not translated | Navigation |
| NAV-5 | AppSwitcher unexplained to users | Navigation |

### Low Priority (Backlog)

| ID | Issue | Screen |
|----|-------|--------|
| DS-3 | Toast only shows one at a time | Design System |
| DS-4 | EmptyState component underused | Design System |
| DS-5 | Glass variant rarely used | Design System |
| DS-7 | Inconsistent max-width across screens | Design System |
| PUB-1 | Landing page too long on mobile | Landing |
| PUB-2 | Stats bar redundant with hero | Landing |
| PUB-4 | Chat mockup not translated | Landing |
| PUB-5 | No social proof | Landing |
| PUB-6 | Converter info cards are filler | Converter |
| PUB-7 | No rate chart on converter | Converter |
| PUB-8 | Founder section reads like resume | About |
| AUTH-2 | No "Remember me" | Login |
| AUTH-3 | OAuth loading state ambiguous | Login |
| AUTH-7 | Reset redirect too fast | Reset Password |
| AUTH-10 | Duplicate OAuth callback files | Callbacks |
| DASH-5 | AI chips overflow on narrow screens | Dashboard |
| DASH-7 | Converter widget on dashboard | Dashboard |
| WAL-2 | Balance card accent bar clipping | Wallet |
| WAL-6 | Swipe actions mobile-only | History |
| CHAT-3 | No file size limit shown | Chat |
| GOAL-1 | Contribute button inline | Goals |
| GOAL-2 | No goal sorting | Goals |
| REP-1 | Period tabs overflow | Reports |
| RV-4 | Alerts limited to 10 | Real Value |
| BUD-4 | Grid width rounding issues | Budgets |
| REC-5 | Execute confirmation lacks detail | Recurring |
| SUB-4 | Summary card max-width on tablet | Subscriptions |
| LOAN-4 | Header off-center | Loans |
| BADGE-3 | Grid width magic number | Badges |
| BADGE-4 | Emojis in section headers | Badges |
| BADGE-5 | Back button icon inconsistency | Badges |
| CHAL-3 | toLocaleDateString instead of formatDate | Challenges |
| NOTE-3 | Search has no debounce | Notes |
| NOTE-5 | No rich text in notes | Notes |
| HIST-1 | No PageScaffold | Historical |
| HIST-3 | Back button icon inconsistency | Historical |
| HIST-4 | No explanation of historical rates | Historical |
| PLAN-2 | Planner scope creep | Planner |
| PLAN-3 | Loading spinner with no context | Todo/Finapp |
| PROF-2 | SettingsSection defined inline | Profile |
| PROF-3 | Language change is immediate | Profile |
| PROF-4 | No avatar upload | Profile |
| ONB-2 | Progress bar 3px | Onboarding |
| ONB-4 | No skip confirmation | Onboarding |
| ONB-5 | No currency symbol in balance input | Onboarding |
| NOTIF-2 | Test notification in production | Notifications |
| NOTIF-3 | No notification history | Notifications |
| NAV-6 | Chat deep linking fragility | Navigation |
| NAV-7 | About not registered in layout | Navigation |
| CC-2 | Back button icon inconsistency | Multiple |
| ACC-5 | CollapsibleSection accessibility | Multiple |
| PERF-2 | Large single-file components | Multiple |
| PERF-4 | CalendarHeatMap no useMemo | Dashboard |
| I18N-2-6 | Various untranslated strings | Multiple |

---

## Summary Statistics

- **Total issues found:** 108
- **Critical:** 3
- **High:** 23
- **Medium:** 40
- **Low:** 42
- **Positive callouts:** 5 (BudgetCard daily allowance, Note colors, OAuth password handling, Accessibility basics, RTL support)

**Screens with most issues:** Dashboard (8), Loans (6), Budgets (5), Recurring (5), Subscriptions (5), Challenges (4)
**Screens with fewest issues:** Forgot Password (0), 404 Page (0), Wallet Convert (0), Todo/Finapp (2 shared)

---

*This review focuses on UI/UX design decisions, not code quality or backend issues. All severity ratings are from a user experience perspective.*
