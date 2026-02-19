# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoFinance (`github.com/rezacr588/currency-converter`) is a full-stack personal finance app: Go backend, React web frontend, and Expo/React Native mobile app. Features include multi-currency wallet, budgets, goals, recurring transactions, reports, AI chat advisor with vector memory, subscriptions, badges/XP gamification, and multi-language support (EN, FA, AR, TR with RTL).

## Development Commands

### Getting Started
```bash
make install                        # Install all dependencies (go mod download + npm install)
./scripts/setup-githooks.sh         # Set up pre-push hook
cp backend/.env.example backend/.env # Configure environment
make dev                            # Docker Compose development (recommended)
```

### Backend (run from /backend)
```bash
go run ./cmd/api                           # Run server on :8080
go test ./...                              # Run all tests
go test -v -run TestName ./internal/service/... # Single test
go test -cover ./...                       # Coverage
```

### Frontend (run from /frontend)
```bash
npm run dev              # Vite dev server on :5173
npm run build            # tsc && vite build (production)
npm run lint             # ESLint (strict, max-warnings=0)
npm test                 # Vitest watch mode
npm run test:run         # Run tests once
npm run test:e2e         # Playwright E2E (headless, chromium-only)
```

### Mobile App (run from /app)
```bash
npx expo start                    # Dev server (press i/a for simulator)
npm run ios / npm run android     # Build and run on simulator
npx tsc --noEmit                  # TypeScript check
eas update --branch production --message "description"  # Push OTA update
eas build --platform android --profile production       # Build APK
node scripts/bump-version.js patch|minor|major|build    # Version bump
```

### Make Targets
```bash
make dev-backend / dev-frontend   # Run separately
make test / test-backend / test-frontend
make lint / lint-backend / lint-frontend
make build                        # Build Docker image
make build-backend / build-frontend
make run-local                    # Test production build locally
make deploy / logs / status       # Koyeb deployment
make clean                        # Remove build artifacts
```

## Architecture

### Backend (`/backend`)

**Structure:** Handler → Service → Repository layered architecture with Chi router.

- `cmd/api/main.go`: Entry point (~598 lines), initializes DB and services
- `internal/router/router.go`: All route definitions
- `internal/handler/`: HTTP handlers (27 source files + 9 test files)
- `internal/service/`: Business logic (20 source files + 12 test files)
- `internal/repository/`: Data access with pgxpool (27 source files + 8 test files)
- `internal/middleware/`: Middleware stack (7 source files + 6 test files: auth, logging, trace, rate limiting, CORS, recovery, security)
- `internal/model/`: Domain models (18 source files + 3 test files)
- `internal/migrations/`: Embedded SQL migrations (`//go:embed sql/main/`, `sql/irr/`)
- `internal/config/`: Struct-based config with `caarlos0/env/v9` tags (1 source + 1 test)
- `pkg/httputil/`: HTTP error/response utilities (2 source + 2 test files)
- `pkg/ctxkeys/`: Type-safe context key constants

**Middleware order:** Trace → Recovery → Logging → CORS → Security → (per-route) Rate Limiting → Auth

**Security middleware (`security.go`):** Adds X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy headers. HSTS (Strict-Transport-Security) is only set in non-development environments.

**Context helpers:**
- `middleware.GetUserIDFromContext(ctx) (uuid.UUID, bool)`
- `middleware.GetUserEmailFromContext(ctx) (string, bool)`
- `ctxkeys.GetTraceID(ctx) string`

**Key Go dependencies:**
- `go-chi/chi/v5` (router), `jackc/pgx/v5` (PostgreSQL), `golang-jwt/jwt/v5` (JWT)
- `patrickmn/go-cache` (in-memory cache), `rs/zerolog` (logging), `swaggo/swag` (Swagger)
- `tmc/langchaingo` (LLM framework), `qdrant/go-client` (vector DB), `caarlos0/env/v9` (config)
- `golang.org/x/sync/singleflight` (cache stampede prevention), `golang.org/x/time/rate` (rate limiting)
- `google/uuid` (UUID generation)

**Key patterns:**
- PostgreSQL with pgx/pgxpool (MaxConns: 10, MinConns: 2, MaxConnLifetime: 30min, HealthCheck: 30s)
- Connection retry on startup: 3 attempts with exponential backoff (2s, 4s)
- In-memory caching with go-cache + singleflight for exchange rates (prevents cache stampede)
- JWT auth: access tokens (1 hour), refresh tokens (7 days)
- Zerolog logging (console in dev, JSON in prod)
- Swagger docs at `/swagger/`
- Transaction API handler limit is 500 (`parsePaginationParams`), repository limit is 10,000
- Pagination returns `limit`, `offset`, `total` with filters for category, type, currency, date range, search

**Error handling (`pkg/httputil/errors.go`):**
- `ErrorResponse` struct with Error, Code, Message, Details (optional), TraceID
- `ErrorWithContext()` logs stack trace for 5xx, includes trace ID
- `EXPOSE_ERROR_DETAILS` atomic bool controls internal error detail visibility
- Standard methods: `BadRequestWithContext()`, `UnauthorizedWithContext()`, `NotFoundWithContext()`, `InternalServerErrorWithContext()`, `ServiceUnavailableWithContext()`
- Custom repo errors: `ErrUserAlreadyExists`, `ErrInsufficientBalance`, `ErrTransactionNotFound`, etc.

**Database migrations:**
- Custom migration runner with `//go:embed` SQL files (not external tool)
- Two migration tables: `schema_migrations` (main), `schema_migrations_irr` (rates)
- Auto-runs on startup with per-migration transactions
- 11 migrations: init, oauth_states, oauth_providers, notes, notes_transaction, loans, push_notifications, challenges, xp_levels, daily_rewards, categories_constraints
- Schema uses Decimal(20,8) for monetary amounts, `TIMESTAMP WITH TIME ZONE`, `gen_random_uuid()`, JSONB

**Rate limiting:**
- Per-IP token bucket (`golang.org/x/time/rate.Limiter`)
- Separate limits: anonymous (100/min, burst 50), authenticated (configurable), login (5/min, burst 2), AI endpoints (configurable, default 20/min)
- `RateLimiterConfig` struct with: `RequestsPerMinute`, `AuthRequestsPerMinute`, `LoginAttemptsPerMinute`, `AIRequestsPerMinute`, `CleanupInterval`, `EntryTTL`
- Three middlewares: `Middleware` (general), `LoginMiddleware` (login/password reset), `AIMiddleware` (AI endpoints)
- Auto-cleanup goroutine (every 10min, entry TTL 30min)
- IP extracted from X-Forwarded-For → X-Real-IP → RemoteAddr

**Background workers:**
- IRR Crawler: runs every `IRR_CRAWLER_INTERVAL` (default 5m, min 1m), fetches from PriceDB/TGJU, daily cleanup of rates >30 days old
- No WebSocket/real-time — chat is request-response based

**Graceful degradation:** Services initialize only when deps are available. No DATABASE_URL → currency-only mode. No AI_API_KEY → AI disabled. Qdrant failure → falls back to PostgreSQL-only memory. Nil handlers are skipped in route registration; `requireService()` returns 503 for unavailable services.

**AI Chat system (`internal/service/ai_chat_service.go`):**
- Builds rich system prompt with: user info, financial context (balances, income/expenses, budgets, goals, loans, spending trends), conversation history (last 20 messages), semantic memory search results
- `AIToolExecutor`: executes tool calls (wallet balance, category stats, subscription summary, loan info, budget status)
- Handles temp conversation IDs (prefixed `temp-`), validates UUID, verifies user ownership
- Memory service orchestrates PostgreSQL (source of truth) + Qdrant (semantic search)
- Short-term memory: async fire-and-forget with 30s timeout, 24h TTL
- Long-term memory: stores in both DB and Qdrant with embedding
- Embedding providers: HuggingFace (`sentence-transformers/all-MiniLM-L6-v2`, 384-dim), Ollama, Google AI
- Qdrant collections: `short_term_memory` (24h TTL), `long_term_memory` via gRPC+TLS

**AI Handler (`internal/handler/ai.go`):**
- `AIHandler` struct holds aiService, walletService, recurringService, goalService
- Supports dependency injection via `SetRecurringService()` and `SetGoalService()`
- Endpoints: parse-receipt, parse-text, detect-intent, smart-parse, apply-parsed, apply-recurring, apply-goal-contribution, advice, status
- Vision model support: accepts base64-encoded images for receipt/invoice parsing (`ParseReceipt`)
- Vision models per provider: Groq (`llama-3.2-90b-vision-preview`), OpenAI (`gpt-4o-mini`), GoogleAI (`gemini-1.5-flash`), Cerebras (falls back to text)

**News Service (`internal/service/news_service.go`):**
- Fetches financial news from RSS feeds (MarketWatch, Yahoo Finance, CNBC)
- Cached with configurable TTL (`NEWS_CACHE_TTL`, default 30min)
- Returns up to 30 items sorted by publication date

**Advice Service (`internal/service/advice_service.go`):**
- AI-powered personalized financial advice based on user context (balances, spending trends, categories)
- 5 static fallback tips when AI is unavailable
- Cached for 6 hours per user
- Returns: title, detail, category (spending/saving/budgeting/investing/general), isAI flag

**Key models:**
- User: ID, Email, PasswordHash, Name, FailedLoginAttempts, LockedUntil, OnboardingCompleted, LinkedInID, GoogleID, AvatarURL — `ToProfile()` strips sensitive fields
- Transaction: types `credit`/`debit`/`convert`, sources `manual`/`ai_receipt`/`ai_invoice`, AIExtractedData (JSON)
- FinancialContext: comprehensive snapshot (balances, monthly income/expenses, budgets, goals, recurring, trends, loans, categories, days until month end)

### Frontend (`/frontend/src`)

**Tech stack:** React 18, React Router v7, TanStack Query 5, Tailwind CSS 3, TypeScript 5.6, Vite 5, Recharts 3

- **Path alias:** `@/*` → `src/*`
- **Routing:** React Router v7 with `<BrowserRouter>`, 27 routes, lazy-loaded with code splitting
- **Three layout types:** `PublicLayout` (header/footer), `AuthenticatedLayout` (sidebar/nav), `HybridLayout` (auth-aware public pages)
- **Protected routes:** `<ProtectedRoute>` component redirects to `/login` with `state.from` for post-login redirect

**Directory structure:**
```
src/
├── api/           # 14 endpoint files + base client (base.ts) + index + 1 test
├── components/
│   ├── ui/        # 20 reusable components + 4 test files (Button, Card, Input, Modal, CurrencyInput, ConfirmDialog, EmptyState, ErrorMessage, ErrorBoundary, HamburgerMenu, InfoMessage, LanguageToggle, LoadingSpinner, OfflineBanner, RateChange, Select, Skeleton, StatusBadge, ThemeToggle, Toast/ToastContainer)
│   ├── layout/    # 14 layout components (PublicLayout, AuthenticatedLayout, AppLayout, Header, MobileHeader, Sidebar, BottomNav, Footer, Container, Grid, BalanceDisplay, HybridLayout, UserDropdown, index)
│   └── features/  # 16 domain folders (AboutUs, Badges, Budgets, Converter [5], Dashboard, Goals, Historical, NotFound, Onboarding, QuickConvert, RatesGrid, Recurring, Subscriptions, Wallet [8])
├── context/       # AuthContext, ThemeContext, LanguageContext, ToastContext
├── hooks/         # useConvert, useRates, useCurrencies, useHistorical, useDebounce, useMutationAction, index
├── pages/         # 12 page components (AIChat, Badges, Converter, ForgotPassword, Home, Login, OAuthCallback, Profile, Register, Reports, ResetPassword, Subscriptions)
├── types/         # wallet.ts, currency.ts, goal.ts, index.ts
├── utils/         # format.ts (currency/date formatting with Jalali), storage.ts (localStorage), constants.ts + 2 test files
├── constants/     # routes.ts (27 routes), navigation.ts, icons.tsx
├── i18n/          # translations.ts (2398 lines, 4 languages) + 1 test file
└── styles/        # globals.css (Tailwind + design tokens)
```

**API client (`api/base.ts`):**
- Fetch-based with exponential backoff (maxRetries=3, baseDelay=1s, maxDelay=10s, 10% jitter)
- JWT in localStorage + in-memory cache, refresh token handling (single attempt + retry)
- 401 → attempts token refresh → retries request → or redirects to login
- Only retries on network errors (TypeError) and 5xx, never on 4xx

**Key frontend patterns:**
- TanStack Query: retry=3 with exponential backoff (1s→2s→4s, max 30s), `refetchOnWindowFocus: false`
- `useMutationAction` hook: wraps `useMutation` with auto-invalidation, toast notifications, type-safe
- Forms: uncontrolled with `useState()` (no form library)
- Vite: dev proxy `/api` and `/health` → `localhost:8080`, manual chunks (vendor: React libs, ui: Recharts+Lucide)
- **No PWA plugin** currently installed (no vite-plugin-pwa)

**Design system:**
- Colors: Navy blue (primary), Gold (accent `#d4af37`), Emerald (success), Red (danger)
- CSS custom properties: `--primary`, `--accent`, `--success`, `--danger`, `--muted`, `--border`
- Fonts: Plus Jakarta Sans (serif), JetBrains Mono (mono), Vazirmatn (Persian)
- Dark mode: class-based (`dark:` prefix), tabular figures for financial data (`font-feature-settings: "tnum" 1`)
- Component variants: Button (`primary`/`secondary`/`outline`/`ghost`, sizes `sm`/`md`/`lg`), Card (`primary`/`secondary`/`gradient`/`glass`)

**i18n (LanguageContext):**
- Detection priority: localStorage → URL param (`?lang=fa`) → browser locale → IP detection (ipapi.co, 3s timeout)
- RTL: `fa` and `ar` automatically set `dir="rtl"` on `document.documentElement`
- Usage: `const { t, isRTL, language, setLanguage } = useLanguage()`

**SEO:** react-helmet-async with Open Graph, hreflang (4 languages), JSON-LD (WebApplication, FAQPage, BreadcrumbList)

**Test setup:** Vitest with jsdom, mocks localStorage/fetch/clipboard globally. Playwright E2E is chromium-only (Desktop Chrome, auto-starts dev server).

### Mobile App (`/app`)

**Tech stack:** Expo ~54.0, React Native 0.81.5, React 19.1, Expo Router ~6.0, styled-components 6 (styled-components/native), TanStack Query 5, TypeScript ~5.9

- **Path alias:** `@/*` → `./*` (app root)
- **Expo Router**: File-based routing with typed routes (`experiments.typedRoutes: true`)
- **New Architecture** enabled (`newArchEnabled: true`)

**Route structure:**
```
app/
├── _layout.tsx          # Root: providers stack
├── +not-found.tsx       # 404
├── (public)/            # Welcome, converter, about
├── (auth)/              # login, register, forgot-password, reset-password (Stack-based)
├── auth/google|linkedin/callback.tsx  # OAuth callbacks
└── (app)/               # Protected (auth guard in _layout.tsx)
    ├── (tabs)/           # Tab navigation
    │   ├── index.tsx     # Dashboard
    │   ├── chat.tsx      # AI chat
    │   ├── add.tsx       # Add transaction
    │   ├── goals.tsx     # Goals
    │   ├── reports.tsx   # Reports/analytics
    │   └── wallet/       # Nested stack (index, history, chat, convert)
    ├── budgets, recurring, subscriptions, badges, notes, loans, challenges
    ├── historical, profile, change-password, notification-settings
    └── onboarding.tsx    # fullScreenModal
```

**Context providers (order in _layout.tsx):**
1. GestureHandlerRootView (gesture handling wrapper)
2. SafeAreaProvider (safe area insets)
3. QueryClientProvider (TanStack Query: retry=2, staleTime=30s)
4. ThemeProvider (dark/light, persisted in AsyncStorage)
5. StyledThemeWrapper (SCThemeProvider — bridges ThemeProvider colors to styled-components via `buildTheme()`)
6. LanguageProvider (4 languages, RTL support)
7. SettingsProvider (biometric, notifications, display)
8. AuthProvider (user state + route protection)
9. ToastProvider (from `src/components/ui/Toast.tsx`, not a separate context file)
10. BiometricLock (biometric authentication UI)

**API client (`src/api/base.ts`):**
- URL logic: relative `/api/v1` on koyeb.app web, full backend URL on native
- Token storage: in-memory cache + Expo SecureStore (native) or AsyncStorage (web)
- Retry: 1 retry, 1s base delay, 10s max, 30s request timeout, 15s for refresh
- 21 API modules: auth, wallet, ai, chat, goals, budgets, recurring, subscriptions, reports, badges, notes, loans, xp, challenges, notifications, tags, exchange, news, utils

**Key native features:**
- Biometric auth: `expo-local-authentication` (Face ID, Touch ID, Fingerprint)
- Push notifications: via `usePushNotifications` hook (uses notification API endpoints)
- Haptic feedback: `expo-haptics` (light/medium/heavy impact, success/warning/error notification)
- Offline queue: AsyncStorage-based, max 100 items, 3 retries, auto-sync on reconnect
- OTA updates: `expo-updates` with `useAppUpdates()` hook (production only)
- App store reviews: `expo-store-review`

**Custom hooks:**
- Data: `useConvert`, `useRates`, `useCurrencies`, `useHistorical` (same as frontend)
- App: `useAppUpdates`, `useAndroidNavigationBar`, `usePushNotifications`, `useOfflineSync`, `useDebounce`
- State: `useAuth`, `useTheme`, `useColors`, `useLanguage`, `useSettings`

**Theme system (`src/theme/index.ts`):**
- Built with `buildTheme(colors, isDark)` returning `AppTheme` interface
- Design tokens: `spacing`, `radii`, `shadows`, `typography`, `gradients`, `animation`, `glass`
- Dark mode (default): bg `#09090b`, card `#141416`, text `#fafafa`, accent gold `#d4af37`, success `#22c55e`, danger `#ef4444`
- Light mode: inverted values, system detection via `useColorScheme()`
- Font: Inter (400/500/600/700 via `@expo-google-fonts/inter`)
- Type declarations in `src/theme/styled.d.ts`

**Component library (`src/components/`):**
- UI (22+ files): Badge, Button (6 variants), BiometricLock, BottomSheet (@gorhom), Card, CollapsibleSection, CurrencyBadge, CurrencyPicker, EmptyState, ErrorBoundary, FormError, Input, LoadingSpinner, OfflineBanner, ProgressBar, Select, Skeleton, SwipeableRow, AnimatedSplash, Toast (includes ToastProvider), Toggle, index
- UI styled primitives (`src/components/ui/styled/`): StyledText (H1-H3, Body, Caption, Label), StyledCard (Card, CardHeader, CardTitle, CardContent, CardFooter), StyledButton, StyledInput, StyledToggle, StyledBadge, StyledProgressBar, StyledSkeleton (SkeletonCard, SkeletonTransaction)
- Features: CurrencyConverter, DailyReward (DailyRewardModal), DailyTip (DailyTipCard), HealthScore (HealthScoreCard), Reports (Monthly/Yearly/Weekly/Daily views, CashFlowProjectionCard, SpendingAnomalyCard, ReportPeriodTabs, daily/ subdirectory), WeeklyRecap (WeeklyRecapCard), CalendarHeatMap, Notes (NoteCard, NoteFormModal), SmartAdvice (SmartAdviceCard), News (FinancialNewsCard), Chat (VoiceRecorder, AttachmentPicker)
- Charts: `react-native-gifted-charts`, Markdown: `react-native-markdown-display`
- Animations: `react-native-reanimated` (useSharedValue, withTiming, withSpring, withSequence)

**Mobile-specific patterns:**
- i18n: `const { t } = useLanguage()` with fallback `t('key') || 'Fallback'`
- Toast: `const { showToast } = useToast()` then `showToast(message, 'success'|'error'|'info')`
- Confirmations: `Alert.alert(title, message, [{text: 'Cancel'}, {text: 'Confirm', onPress, style: 'destructive'}])`
- Safe areas: Always use `useSafeAreaInsets()` from `react-native-safe-area-context`
- Sub-components must call `useLanguage()` themselves — hooks can't be passed from parent
- Translations file (`src/i18n/translations.ts`) has 4 parallel sections (en, fa, ar, tr) — new keys must be added to ALL four

**Test infrastructure:**
- Framework: jest-expo with @testing-library/react-native and @testing-library/jest-native
- Config: `jest.config.js` (jest-expo preset, `@/*` alias mapping, transformIgnorePatterns for 30+ packages)
- Setup: `jest.setup.js` (mocks for 12+ Expo modules and React Native dependencies)
- Existing tests: Button, ErrorBoundary, FormError components; color palette validation; haptics utilities
- Run: `cd app && npm test`

## API Routes

All routes defined in `internal/router/router.go`. Groups:

- **Public:** `/health`, `/health/detailed`, `/swagger/*`, exchange rates (`/api/v1/currencies`, `/rates/{base}`, `/convert`, `/historical/{date}`), `/api/v1/news`
- **Auth:** register, login, OAuth (Google, LinkedIn), password reset (login-rate-limited), refresh, logout, profile/onboarding (protected)
- **Wallet** (protected): balances, summary, transactions (CRUD + import/export), categories (CRUD), convert
- **AI** (mixed): status (public); parse-receipt (vision support), parse-text, detect-intent, smart-parse, apply-parsed, apply-recurring, apply-goal-contribution, chat, advice (protected + AI rate limited)
- **Goals** (protected): CRUD, categories, contribute
- **Tags** (protected): CRUD
- **Budgets** (protected): CRUD
- **Recurring** (protected): CRUD, frequencies, execute
- **Reports** (protected): monthly, yearly, category, trends, networth, forecast, insights, health-score, weekly-recap, cashflow, anomalies
- **Subscriptions** (protected): CRUD, summary, upcoming, billing-cycles, categories
- **Badges** (mixed): list (public), earned/progress/check (protected)
- **Notes** (protected): CRUD, pin, transaction notes, colors
- **Loans** (protected): CRUD, payments, summary, upcoming
- **Notifications** (protected): register/unregister device, preferences, budget/loan alerts
- **Challenges** (mixed): list/featured (public), browse/join/active/history/stats/check-progress/abandon (protected)
- **XP** (protected): stats, history, level, daily-reward, daily-reward/status, leaderboard

## CI/CD Pipeline

**Web (`.github/workflows/ci.yml`):**
- Push to main → Docker build → push to ghcr.io → deploy to Koyeb (tests not blocking)
- PRs → Go tests (`go test ./...`) + frontend typecheck (`npx tsc --noEmit`)

**Mobile (`.github/workflows/mobile-build.yml`):**
- Push to main (app/** paths) → lint + typecheck → OTA update to production branch
- Conditionally builds APK when: native files change (package.json, app.json, eas.json, new Expo/RN deps), commit contains `[build-apk]`, or manual trigger
- Auto-bumps version with `node scripts/bump-version.js build` before APK build

**Pre-push hook** (`.githooks/pre-push`):
- Runs Docker build then EAS OTA updates to internal/development/preview channels
- Skip vars: `SKIP_DEPLOY=1` (skip all), `SKIP_BUILD=1` (skip Docker), `SKIP_EAS=1` (skip OTA)
- Additional env vars: `EAS_PLATFORM` (default: all), `EAS_CHANNELS` (default: internal,development,preview), `EAS_MESSAGE`, `DEPLOY_CMD`

## Build & Deploy

**Docker** (3-stage): Expo web export (node:20-alpine) → Go binary with embedded static files (golang:1.24-alpine, `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 -w -s`) → Alpine 3.19 non-root runtime (UID 1001). Health check: `wget` to `/health` at 30s interval. **Important:** Production serves the Expo web build, NOT the Vite frontend.

**Docker Compose (dev):** Backend mounts full `./backend` directory, runs `go run ./cmd/api`. Frontend mounts `src/` and `public/` for Vite HMR, runs `npm run dev -- --host`.

```bash
make build       # Build Docker image
make run-local   # Test production build locally on :8080
```

**Koyeb** (use `koyeb` MCP server):
- App: `terrible-moselle`, Service: `co-currency`
- URL: https://terrible-moselle-airez-1828dc33.koyeb.app
- Instance: free tier, region: Frankfurt, scaling: min=0 (scale to zero when idle), max=1

**EAS Build profiles (app/eas.json):**
- Development: dev client, internal distribution, debug APK, channel `development`
- Preview: internal distribution, APK, channel `preview`
- Production: app store distribution, AAB (Android App Bundle), channel `production`

## Configuration

See `backend/.env.example` for full list. Key variable groups:

**Server:** `PORT` (8080), `ENVIRONMENT` (development/production), `CACHE_TTL` (5m), `RATE_LIMIT` (100), `EXPOSE_ERROR_DETAILS` (true in dev)

**Database:** `DATABASE_URL` (PostgreSQL, required for user features; without it, currency-only mode)

**Auth:** `JWT_SECRET` (validated in production — fails if default/empty), `FRONTEND_URL` (for OAuth redirects)

**OAuth:** `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `LINKEDIN_CLIENT_ID/SECRET/REDIRECT_URI`

**AI:** `AI_PROVIDER` (googleai/openai/cerebras/groq, default: googleai), `AI_API_KEY`, `AI_MODEL` (model name), `AI_VISION_MODEL` (vision model override), `AI_CLOUD_PROJECT` (Google Cloud project ID)

**Vector memory:** `QDRANT_ENABLED`, `QDRANT_URL`, `QDRANT_API_KEY`

**Embeddings:** `EMBEDDING_PROVIDER` (huggingface/ollama/googleai), `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` (default: `sentence-transformers/all-MiniLM-L6-v2`), `EMBEDDING_DIMENSIONS` (384), `OLLAMA_URL`

**Memory:** `SHORT_TERM_MEMORY_TTL` (24h), `MAX_MEMORY_RESULTS` (1-100, default 10)

**IRR Crawler:** `IRR_CRAWLER_ENABLED` (true), `IRR_CRAWLER_INTERVAL` (5m)

**News:** `NEWS_CACHE_TTL` (default 30m)

**External APIs:** `FRANKFURTER_URL` (https://api.frankfurter.app)

## Database

Neon PostgreSQL — Project ID: `royal-cake-50541080`. Use `postgres` MCP server to query directly.

**Migration system:** Custom runner with `//go:embed` SQL files in `internal/migrations/sql/main/` and `sql/irr/`. Auto-runs on startup with per-migration transactions. Two tracking tables: `schema_migrations` (main), `schema_migrations_irr` (rates).

**Schema conventions:** Decimal(20,8) for monetary amounts, `TIMESTAMP WITH TIME ZONE` for all temporal fields, `gen_random_uuid()` for UUIDs, `ON DELETE CASCADE` foreign keys, composite unique constraints (e.g., wallet_balances: user_id + currency).

Tables (auto-created on startup): `users`, `wallet_balances`, `transactions`, `categories`, `refresh_tokens`, `goals`, `tags`, `transaction_tags`, `budgets`, `recurring_transactions`, `subscriptions`, `badges`, `user_badges`, `chat_conversations`, `chat_messages`, `user_memories`, `oauth_states`, `notes`, `loans`, `loan_payments`, `user_devices`, `notification_preferences`, `challenges`, `user_challenges`, `user_xp`.

## Project Documentation

- `AGENTS.md` — Guidelines for agent workflows and module organization
- `TASKS.md` — Active task tracking
- `FINANCE_APP_PLAN.md` — Comprehensive feature planning
- `FREE_FEATURES_PLAN.md` — Feature roadmap
- `GEMINI.md` — Gemini AI integration docs
- `CURRENCY_CONVERTER_DOCS.md` — Currency converter documentation
- `README.md` — Project README
- `app/UI_UX_IMPROVEMENTS.md` — UI/UX improvement tracking
- `docs/API.md` — API documentation
- `docs/ARCHITECTURE.md` — Architecture overview
- `docs/BACKEND_ARCHITECTURE.md` — Backend architecture details
- `docs/FEATURES.md` — Features documentation
- `docs/FREE_IMPROVEMENTS.md` — Free tier improvements
- `docs/mobile-ui-fixes.md` — Mobile UI fix notes
- `docs/mobile-backend-fixes.md` — Mobile backend fix notes
