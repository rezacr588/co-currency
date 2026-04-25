# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoAI (`github.com/rezacr588/co-currency`) is a full-stack personal finance app: Go backend plus a single Expo/React Native client app that targets web, iOS, and Android. Features include multi-currency wallet, budgets, goals, recurring transactions, reports, AI chat advisor with vector memory, subscriptions, badges/XP gamification, task/planner management with offline sync, and multi-language support (EN, FA, AR, TR with RTL).

## Development Commands

### Getting Started

The fast path is Docker for the backend stack + native Expo for the app:

```bash
make install     # Install all dependencies (go mod download + npm install)
make dev         # Docker stack: Postgres :5433, backend :8080, ml-service :5001
# in a second shell:
make dev-app     # Expo web/native bundler on :8081 (talks to Docker backend automatically)
```

`docker-compose.yml` provisions Postgres locally — no external DB needed. Migrations auto-run on backend startup. App's [src/api/base.ts](app/src/api/base.ts) auto-detects `localhost` and points at `http://localhost:8080/api/v1`. Override anywhere with `EXPO_PUBLIC_API_URL`.

Useful targets: `make dev-down` (stop), `make dev-logs` (tail), `make dev-reset` (nuke Postgres volume — fresh DB next boot). Postgres is mapped to host `:5433` so a Homebrew Postgres on `:5432` keeps working alongside.

**Admin gate**: backend reads `ADMIN_EMAIL` (default `rez.zet.int@gmail.com`); the matching user gets access to `/admin` in-app + `GET /api/v1/admin/overview`. Override per-environment when needed.

### Backend (run from /backend)
```bash
go run ./cmd/api                           # Run server on :8080
go test ./...                              # Run all tests
go test -v -run TestName ./internal/service/... # Single test
go test -cover ./...                       # Coverage
```

### App (run from /app)
```bash
npm run web              # Expo web dev server on :5173
npm run lint             # ESLint (strict, max-warnings=0)
npm run typecheck        # TypeScript check (also: npx tsc --noEmit)
npm test                 # Jest (jest-expo)
npx expo start           # Native dev server (press i/a for simulator)
```

### Make Targets
```bash
make dev / dev-down / dev-logs / dev-reset  # Docker stack lifecycle
make dev-backend / dev-app / dev-web        # Run a single piece natively
make test / test-backend / test-app
make lint / lint-backend / lint-app
make build / build-backend / build-web      # Docker / Go binary / Expo web export
make run-local                              # Test production build locally on :8080
make deploy / logs / status                 # Koyeb deployment
make db-backup / db-restore / db-list       # Database backup management
```

## Architecture

### Backend (`/backend`)

**Layered architecture:** Handler → Service → Repository with Chi router.

- `cmd/api/main.go` + `bootstrap.go`: Entry point and service dependency injection
- `internal/router/`: Route definitions split across `router.go`, `routes_auth.go`, `routes_wallet.go`, `routes_public.go`, `routes_features.go`
- `internal/handler/`: HTTP handlers
- `internal/service/`: Business logic
- `internal/repository/`: Data access with pgxpool
- `internal/middleware/`: Auth, logging, trace, rate limiting, CORS, recovery, security, metrics
- `internal/model/`: Domain models
- `internal/migrations/`: Embedded SQL migrations (`//go:embed sql/main/`, `sql/irr/`)
- `internal/config/`: Struct-based config with `caarlos0/env/v9` tags
- `pkg/httputil/`: HTTP error/response utilities with `ErrorWithContext()` (logs stack trace for 5xx, includes trace ID)
- `pkg/ctxkeys/`: Type-safe context key constants

**Middleware order:** Trace → Recovery → Logging → CORS → Security → Metrics → (per-route) Rate Limiting → Auth

**Context helpers:**
```go
middleware.GetUserIDFromContext(ctx) (uuid.UUID, bool)
middleware.GetUserEmailFromContext(ctx) (string, bool)
ctxkeys.GetTraceID(ctx) string
```

**Key backend patterns:**
- PostgreSQL with pgx/pgxpool (MaxConns: 50, MinConns: 10, MaxConnLifetime: 30min); `AfterConnect` registers `pgx-shopspring-decimal` so future `decimal.Decimal` fields scan directly
- In-memory caching with go-cache + singleflight (prevents cache stampede)
- JWT auth: access tokens (1 hour), refresh tokens (7 days)
- Custom migration runner with `//go:embed` SQL files, auto-runs on startup
- Graceful degradation: no DATABASE_URL → currency-only mode, no AI_API_KEY → AI disabled, Qdrant failure → PostgreSQL-only memory. Nil handlers skipped in route registration; `requireService()` returns 503 for unavailable services
- Rate limiting: per-IP token bucket — anonymous (100/min), login (5/min), AI (20/min, configurable). `rateLimiter.AllowPerKey("reset", email)` provides secondary per-email throttling (used for password reset)
- Schema conventions: Decimal(20,8) for monetary amounts, `TIMESTAMP WITH TIME ZONE`, `gen_random_uuid()`, `ON DELETE CASCADE` foreign keys
- Request bodies decoded via `handler.decodeJSON` are capped at 1 MiB via `http.MaxBytesReader`
- CORS + WebSocket use the same origin list: `middleware.AllowedOrigins()` / `middleware.IsOriginAllowed()` (exported for reuse by `handler.WebSocketHandler`)

**Monetary precision (in-flight refactor):**
Money fields are still `float64` in `internal/model/*.go`, but `shopspring/decimal` and the pgx numeric codec are already wired in. The full type migration is deferred to a dedicated session (touches ~20 model files + repos + mobile types). Don't unwire the codec registration in `internal/repository/database.go` — it's the groundwork for the migration.

**AI system:**
- `ai_chat_service.go`: Builds system prompt with financial context, manages conversation history (last 20 messages), semantic memory search
- `AIToolExecutor`: executes tool calls (wallet balance, category stats, subscriptions, loans, budgets)
- Three thinking modes: auto, fast, thinking (via `AI_THINKING_MODE_DEFAULT`)
- 4 providers: GoogleAI (default), OpenAI, Cerebras, Groq
- Memory: PostgreSQL (source of truth) + Qdrant (semantic search). Short-term: 24h TTL, async. Long-term: both DB + Qdrant with embeddings
- Embeddings: HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (384-dim), Ollama, GoogleAI

### App Client (`/app`)

**Tech stack:** Expo ~54, React Native 0.81, React 19, Expo Router ~6, styled-components/native, TanStack Query 5, TypeScript ~5.9

- **Path alias:** `@/*` → `./*` (app root)
- **Expo Router**: File-based routing with typed routes (`experiments.typedRoutes: true`)
- **New Architecture** enabled

**Route structure:**
```
app/
├── (public)/            # Welcome, converter, about, download (web-only APK download page)
├── (auth)/              # Login, register, password reset (Stack-based)
├── auth/                # OAuth callbacks (google, linkedin)
└── (app)/               # Protected (auth guard in _layout.tsx)
    ├── (tabs)/           # Dashboard, chat, add transaction, goals, reports, wallet/
    └── [screens]         # budgets, recurring, subscriptions, planner, todo, profile, etc.
```

**Context providers** wrap the app in `_layout.tsx`: GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → ThemeProvider → StyledThemeWrapper → LanguageProvider → SettingsProvider → AuthProvider → ToastProvider → BiometricLock

**API client (`src/api/base.ts`):** Relative `/api/v1` on koyeb.app web, full backend URL on native. Token storage: in-memory cache + SecureStore (native) or AsyncStorage (web). 1 retry, 30s timeout.

**Theme system (`src/theme/index.ts`):** `buildTheme(colors, isDark, isRTL)` returns `AppTheme`. Dark mode default. Font: Inter + Vazirmatn (RTL). Type declarations in `src/theme/styled.d.ts`.

**Design tokens — no hardcoded hex or spacing literals** (enforced via repo convention, not lint — audit added 2026-04-18):
- Semantic colors: `colors.{primary, primaryForeground, success, successMuted, danger, dangerMuted, warning, warningMuted, info, infoMuted, accent, accentForeground, foreground, mutedForeground, subtleForeground, background, card, border, ...}` in `src/constants/colors.ts` (light + dark).
- Brand/category palette: `colors.palette.{red, orange, yellow, green, blue, purple, pink, teal, lime, cyan, gray}` each with a `*Muted` variant. Use for note colors, badge rarities, priority chips, category icons, heatmap — anywhere the intent isn't semantic success/danger/warning.
- Alpha helper: `theme.alpha(color, opacity)` for flat transparency. **Never** use `colors.X + '20'` hex-suffix concat (replaced in the 2026-04-18 sweep). Prefer pre-built `*Muted` tokens for theme-consistent pill backgrounds; use `alpha()` only when a specific opacity is required.
- Spacing: `theme.spacing.{xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32}`. Exported as module-level `spacing` from `src/theme/index.ts` so it works inside `StyleSheet.create({ row: { padding: spacing.lg } })` without `useTheme`.
- Radii: `theme.radii.{sm:8, md:12, lg:16, xl:20, xxl:24, full:9999}`. `lg` and `xl` are distinct — don't collapse them.
- Icon colors via hook: `const iconColors = useIconColors()` returns theme-reactive `{muted, subtle, accent, success, danger, warning, info, foreground, secondary}`. Don't import `ICON_COLOR_*` constants — they were removed.
- Legitimate exceptions for raw hex: RN `shadowColor` strings (RN requires `'#000'` etc.), splash screen (`AnimatedSplash.tsx`, renders pre-theme), external brand colors (LinkedIn `#0077B5`, Android green `#3ddc84`, Google brand colors). Module-level meta tags in `app/+html.tsx`.

**Offline support:** AsyncStorage-based offline queue (max 100 items, 3 retries, auto-sync on reconnect). Planner has dedicated cache/outbox/sync engine in `src/offline/`:
- `plannerOutbox.ts`: Outbox queue with promise-based mutex (`withOutboxLock`) serializing all writes to prevent AsyncStorage race conditions. **All mutations** (`enqueuePlannerOp`, `updatePlannerOutboxOp`, `removePlannerOutboxOp`, `retryFailedPlannerOps`, `discardFailedPlannerOps`) must use the mutex. Compaction only targets `'pending'` ops, never in-flight `'syncing'` ops. Max 500 ops. Includes temp-ID map with automatic cleanup after sync.
- `plannerSyncEngine.ts`: Processes outbox ops with ID-based while-loop (not index-based for-loop) and exponential backoff (max 6 attempts, up to 60s). Re-reads ops from storage after each write. Normalizes stuck `'syncing'` ops to `'pending'` on startup (crash recovery). Uses `processedOpIDs` set to prevent infinite loops.
- `plannerBackup.ts`: Local board backup with timestamp tracking and write mutex (`withBackupLock`). `plannerBoardsEqual()` compares summary counts + sorted item ID sets (order-independent). `shouldUseLocalPlannerBackup()` uses timestamp comparison to avoid resurrecting intentionally cleared boards.
- `plannerCache.ts`: Separate board cache + funding-required map storage with write mutex (`withCacheLock`).
- `src/api/planner.ts`: Dedicated `plannerRequest()` with 30s `AbortController` timeout (separate from base API client).

## Critical Conventions

### Internationalization (i18n)
- Use `const { t } = useLanguage()` with fallback: `t('key') || 'Fallback'`
- **Sub-components must call `useLanguage()` themselves** — hooks can't be passed from parent
- Translations split into `src/i18n/en.ts`, `fa.ts`, `ar.ts`, `tr.ts` — **new keys must be added to ALL four files**

### App UI Patterns
- Toast: `const { showToast } = useToast()` then `showToast(message, 'success'|'error'|'info')`
- Confirmations: `Alert.alert(title, message, [{text: 'Cancel'}, {text: 'Confirm', onPress, style: 'destructive'}])`
- Safe areas: Always use `useSafeAreaInsets()` from `react-native-safe-area-context`
- Styled-components: `const theme = useTheme()` for colors, spacing, RTL detection
- Nested modals: On iOS, nested `<Modal>` components cause z-order issues. Render inner modals (e.g. `DatePickerModal`) as siblings using `<Fragment>`, not children of the outer modal.
- Async handlers in Alert: When `Alert.alert` `onPress` calls async operations (e.g. delete), use `async () => { try { await op(); onClose(); } catch { showError(); } }` — never fire-and-forget with `void`.

### Web-Only UI
- The `/download` page and download nav links must only render on web (`Platform.OS === 'web'`). Never show download/install prompts in the native app — the user already has it installed.
- The `SettingsProvider` blocks rendering with `if (!isLoaded) return null` until settings load from AsyncStorage. Do not remove this guard — it prevents race conditions with biometric lock and auth state on Android.

### React Hook Dependency Guidelines
- Never put `useQuery()` result objects (e.g. `boardQuery`) in `useCallback` deps — they are new objects every render. Extract stable references (`queryClient.invalidateQueries`) instead.
- When a `useEffect` reads state A, computes new value, then calls `setState(A)`, omit A from deps to avoid infinite loops. Use a ref to track the previous value and compare before setting.
- Always include all captured state variables in `useCallback` dependency arrays. Common misses: `undoOriginalStatus`, translation function `t`, boolean flags like `isOnline`.
- Clean up `setTimeout`/`setInterval` refs in a `useEffect` cleanup function to prevent timer leaks on unmount.
- When `due_date` or similar optional fields are empty strings, send `undefined` instead of `""` to the API (`value.trim() || undefined`).
- Hooks that return theme-dependent values (e.g. `useIconColors()`, `useCategoryColors()`, `usePriorityColors()`) must be called at the **top** of the component body, before any early return. ESLint will flag conditional hook calls — don't work around it by moving derivations around.
- Don't leave unused derivations in the codebase suppressed with `void varName;`. If a feature isn't wired up yet, delete the computation; re-add it when you wire the UI.

### Backend Error Handling
- Use `pkg/httputil` methods: `BadRequestWithContext()`, `UnauthorizedWithContext()`, `NotFoundWithContext()`, `InternalServerErrorWithContext()`, `ServiceUnavailableWithContext()`
- Custom repo errors: `ErrUserAlreadyExists`, `ErrInsufficientBalance`, `ErrTransactionNotFound`, etc.

### OAuth & WebSocket Auth (platform-split)
- **OAuth callback — web**: backend serves a same-origin HTML page that `window.opener.postMessage(...)` the tokens and closes. Target origin derived from `FrontendURL` via `h.frontendOrigin()`; never `"*"`. Web client opens the OAuth URL as a popup and listens for `{type:"coai:oauth"}` messages (see `app/app/(auth)/login.tsx`). Don't revert to URL-fragment delivery — it leaks JWTs into browser history.
- **OAuth callback — native**: unchanged. State suffix `:mobile` routes the callback to a `coai://` deep-link with the token in the fragment.
- **WebSocket auth — web**: client calls `POST /api/v1/auth/ws-ticket` for a 60s single-use ticket, then opens WS with `?ticket=...`. Tickets are backed by an in-memory `repository.Cache` on `AuthService` (`IssueWSTicket` / `ConsumeWSTicket`).
- **WebSocket auth — native**: unchanged. `Authorization: Bearer <jwt>` header.
- The legacy `?token=<jwt>` query-string path on `/ws` is kept as a transitional fallback; remove after web clients fully migrate.

### Commit & PR Style
- Commits use type prefix: `feat:`, `fix:`, `debug:` with short, imperative summaries
- PRs should include description, testing performed, and link related issues
- For UI changes, include before/after screenshots

## Common Workflows

### Adding a New Backend Endpoint
1. Define route in `internal/router/routes_*.go`
2. Create handler in `internal/handler/`
3. Implement service in `internal/service/`
4. Add repository methods in `internal/repository/`
5. Update models in `internal/model/` if needed

### Adding a New App Screen
1. Create route file in `app/app/(app)/[screen-name].tsx`
2. Add to tab navigator in `app/app/(app)/(tabs)/_layout.tsx` if needed
3. Create components in `src/components/features/[FeatureName]/`
4. Add API methods in `src/api/[module].ts`
5. Add translations to all 4 i18n files

### Adding a New AI Tool
1. Add tool definition in `internal/service/ai_tools.go`
2. Implement execution logic
3. Update system prompt in `ai_chat_context.go`

## Configuration

See `backend/.env.example` for the full list. Key groups: Server (`PORT`, `ENVIRONMENT`), Database (`DATABASE_URL`), Auth (`JWT_SECRET`, `FRONTEND_URL`), OAuth (Google, LinkedIn), AI (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_THINKING_MODE_DEFAULT`), Vector memory (`QDRANT_*`), Embeddings (`EMBEDDING_PROVIDER`).

Without `DATABASE_URL`, backend runs in currency-only mode. Without `AI_API_KEY`, AI features are disabled.

## Build & Deploy

**Docker** (3-stage): Expo web export → Go binary with embedded static files → Alpine non-root runtime.

**Koyeb:** App `coai`, service `co-currency`, URL `https://coai.koyeb.app`. Scale-to-zero enabled.
```bash
koyeb services update coai/co-currency --env "KEY=VALUE"
koyeb services redeploy coai/co-currency
koyeb services logs coai/co-currency -t runtime
```

**CI/CD:**
- Push to main → pre-deploy DB backup → Docker build → ghcr.io → Koyeb deploy
- PRs → backend `go test` + app typecheck + app `npm run lint` + app `npm test --ci` (all blocking). Aligned with mobile-build.yml post-merge checks so lint/jest failures block merge, not the OTA push.
- Mobile: push to main (app/** paths) → OTA update to `production` + non-fatal OTA updates to `internal`/`development`/`preview` + publish latest APK to GitHub Releases; APK rebuilt when native files change or `[build-apk]` in commit
- APK download URL: `https://github.com/rezacr588/co-currency/releases/download/latest/coai.apk`
- **No pre-push hook**: the `.githooks/pre-push` hook was removed on 2026-04-18 in favor of CI. Use plain `git push` — never prefix with `SKIP_DEPLOY=1` / `SKIP_BUILD=1` / `SKIP_EAS=1`.
- **Koyeb keepalive**: UptimeRobot (5-min HTTP monitor) is primary. `.github/workflows/koyeb-keepalive.yml` is the backup, cron on odd minute offsets (`3,13,23,33,43,53`) to avoid GitHub's crowded round-minute cron slots; failures exit 0 with a warning so a single cold-start miss doesn't turn the workflow red.
- `/health` and `/health/detailed` accept both GET and HEAD so HEAD-by-default monitors (UptimeRobot free tier) don't hit 405. Don't remove the `r.Head(...)` registrations in `internal/router/routes_public.go`.

## Database

Aiven PostgreSQL (free tier). Migrations auto-run on startup via embedded SQL in `internal/migrations/sql/`. Two tracking tables: `schema_migrations` (main), `schema_migrations_irr` (rates).

## Project Documentation

- `docs/ARCHITECTURE.md` / `docs/BACKEND_ARCHITECTURE.md` — Architecture deep dives
- `docs/API.md` — API endpoint reference
- `docs/FEATURES.md` — Feature documentation
- `TASKS.md` — Active task tracking

## Claude Code Skills

Project-level skills live in `.claude/skills/`. Invoke with `/<skill>`:
- `/verify` — run backend build + test, app typecheck + lint + jest; summarize failures.
- `/deploy-status` — unpushed commits + latest CI runs + Koyeb + health endpoint.
- `/add-translation` — add an i18n key to all four files (en/fa/ar/tr) safely.
