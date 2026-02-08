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

- `cmd/api/main.go`: Entry point, initializes DB and services
- `internal/router/router.go`: All route definitions
- `internal/handler/`: HTTP handlers
- `internal/service/`: Business logic
- `internal/repository/`: Data access (pgxpool)
- `internal/middleware/`: Middleware stack
- `internal/model/`: Domain models

**Middleware order:** Trace → Recovery → Logging → CORS → (per-route) Rate Limiting → Auth

**Context helpers:**
- `middleware.GetUserIDFromContext(ctx) (uuid.UUID, bool)`
- `middleware.GetUserEmailFromContext(ctx) (string, bool)`
- `ctxkeys.GetTraceID(ctx) string`

**Key patterns:**
- PostgreSQL with pgx/pgxpool (connection pool with health checks, retry logic)
- In-memory caching with go-cache for exchange rates
- JWT auth: access tokens (15min), refresh tokens (7 days)
- Zerolog logging (console in dev, JSON in prod)
- Swagger docs at `/swagger/`
- Transaction API handler limit is 500 (`parsePaginationParams`), repository limit is 10,000

**Graceful degradation:** Services initialize only when deps are available. No DATABASE_URL → currency-only mode. No AI_API_KEY → AI disabled. Qdrant failure → falls back to PostgreSQL-only memory. Nil handlers are skipped in route registration; `requireService()` returns 503 for unavailable services.

**AI Chat:** `internal/service/ai_chat_service.go` builds a rich system prompt with user financial context (balances, transactions, budgets, goals, rates). Optional Qdrant vector memory (`QDRANT_ENABLED=true`) provides semantic search across short-term (24h TTL) and long-term memory collections, with PostgreSQL fallback.

### Frontend (`/frontend/src`)

- **Path alias:** `@/*` → `src/*`
- **api/client.ts**: Fetch-based API client with exponential backoff retry, JWT auth headers
- **components/ui/**: Reusable design system; **components/features/**: Domain components
- **context/**: React Context for Theme, Language, Auth (JWT in localStorage)
- **hooks/**: useConvert, useRates, useCurrencies, useHistorical, useDebounce

Key patterns: TanStack Query for server state, protected routes redirect to /login with return path, PWA with Workbox via vite-plugin-pwa.

**Test setup:** Vitest with jsdom env. Playwright E2E is chromium-only (Desktop Chrome).

### Mobile App (`/app`)

- **Path alias:** `@/*` → `./*` (app root)
- **Expo Router**: File-based routing — `app/(public)/` for public, `app/(app)/(tabs)/` for authenticated
- **src/api/**: API client with JWT auth (Expo SecureStore for tokens)
- **src/context/**: Auth, Theme, Language contexts
- NativeWind (Tailwind for RN), TanStack Query, EAS Update for OTA

**Mobile-specific patterns:**
- i18n: `const { t } = useLanguage()` with fallback `t('key') || 'Fallback'`
- Toast: `const { showToast } = useToast()` then `showToast(message, 'success'|'error'|'info')`
- Confirmations: `Alert.alert(title, message, [{text: 'Cancel'}, {text: 'Confirm', onPress, style: 'destructive'}])`
- Safe areas: Always use `useSafeAreaInsets()` from `react-native-safe-area-context`
- Sub-components must call `useLanguage()` themselves — hooks can't be passed from parent
- Translations file (`src/i18n/translations.ts`) has 4 parallel sections (en, fa, ar, tr) — new keys must be added to ALL four

## API Routes

All routes defined in `internal/router/router.go`. Groups:

- **Public:** `/health`, `/swagger/*`, exchange rates (`/api/v1/currencies`, `/rates`, `/convert`, `/historical`)
- **Auth:** register, login, OAuth (Google, LinkedIn), password reset, profile (protected)
- **Wallet** (protected): balances, summary, transactions (CRUD + import/export), categories, convert
- **Goals** (protected): CRUD, categories, contribute
- **Budgets** (protected): CRUD
- **Recurring** (protected): CRUD, frequencies, execute
- **Reports** (protected): monthly, yearly, category, trends, networth, forecast, insights, health-score, weekly-recap
- **AI** (protected): receipt/text parsing, chat conversations, smart-parse
- **Subscriptions** (protected): CRUD, summary, upcoming, billing-cycles, categories
- **Badges** (mixed): list (public), earned/progress/check (protected)
- **Notes** (protected): CRUD, pin, transaction notes, colors
- **Loans** (protected): CRUD, payments, summary, upcoming
- **Notifications** (protected): register/unregister device, preferences, budget/loan alerts
- **Challenges** (mixed): list/featured (public), browse/join/active/history/stats/check-progress/abandon (protected)
- **XP** (protected): stats, history, level, daily-reward, leaderboard

## CI/CD Pipeline

**Web (`.github/workflows/ci.yml`):**
- Push to main → Docker build → push to ghcr.io → deploy to Koyeb (tests not blocking)
- PRs → Go tests (`go test ./...`) + frontend typecheck (`npx tsc --noEmit`)

**Mobile (`.github/workflows/mobile-build.yml`):**
- Push to main (app/** paths) → always runs OTA update to production branch
- Conditionally builds APK when native files change or commit contains `[build-apk]`
- Auto-bumps version with `node scripts/bump-version.js build` before APK build

**Pre-push hook** (`.githooks/pre-push`):
- Runs Docker build then EAS OTA updates to internal/development/preview channels
- Skip vars: `SKIP_DEPLOY=1` (skip all), `SKIP_BUILD=1` (skip Docker), `SKIP_EAS=1` (skip OTA)
- Takes ~2 minutes

## Build & Deploy

**Docker** (3-stage): Expo web export (node:20-alpine) → Go binary with embedded static files (golang:1.24-alpine) → Alpine 3.19 non-root runtime. **Important:** Production serves the Expo web build, NOT the Vite frontend.

```bash
make build       # Build Docker image
make run-local   # Test production build locally on :8080
```

**Koyeb** (use `koyeb` MCP server):
- App: `terrible-moselle`, Service: `co-currency`
- URL: https://terrible-moselle-airez-1828dc33.koyeb.app

## Configuration

See `backend/.env.example` for full list. Critical variables:

- `DATABASE_URL`: PostgreSQL connection (required for user features; without it, currency-only mode)
- `JWT_SECRET`: JWT signing key
- `AI_PROVIDER` + `AI_API_KEY`: LLM provider (cerebras/openai/googleai) and key
- `QDRANT_ENABLED` + `QDRANT_URL` + `QDRANT_API_KEY`: Optional vector memory for AI semantic search

## Database

Neon PostgreSQL — Project ID: `royal-cake-50541080`. Use `postgres` MCP server to query directly.

Tables (auto-created on startup): `users`, `wallet_balances`, `transactions`, `categories`, `refresh_tokens`, `goals`, `tags`, `transaction_tags`, `budgets`, `recurring_transactions`, `subscriptions`, `badges`, `user_badges`, `chat_conversations`, `chat_messages`, `user_memories`, `oauth_states`, `notes`, `loans`, `loan_payments`, `user_devices`, `notification_preferences`, `challenges`, `user_challenges`, `user_xp`.
