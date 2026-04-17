# GitHub Copilot Instructions for CoAI

## Project Overview

CoAI is a full-stack personal finance platform with multi-currency wallet, AI financial advisor, budgets, goals, reports, and gamification. Built with Go backend + Expo React Native (web, iOS, Android).

**Repository**: `github.com/rezacr588/co-currency`  
**Tech Stack**: Go 1.24, PostgreSQL, Expo ~54, React Native 0.81, Qdrant (vector DB)

---

## Build, Test, and Lint Commands

### Quick Start
```bash
make install                         # Install all dependencies (Go + npm)
cp backend/.env.example backend/.env # Configure environment
make dev                             # Run full stack with Docker Compose
```

### Backend (Go)
```bash
# Development
make dev-backend                     # Run on :8080
go run ./cmd/api                     # Run from /backend directory

# Testing
make test-backend                    # Run all backend tests
go test ./...                        # From /backend directory
go test -v -run TestTransactionService ./internal/service  # Single test
go test -cover ./internal/...        # With coverage

# Linting
make lint-backend                    # Run golangci-lint
```

### App (Expo React Native)
```bash
# Development
make dev-web                         # Web on :5173
make dev-app                         # Native dev server
cd app && npm run web                # Web from app directory
cd app && npm run ios/android        # iOS/Android simulator

# Testing
make test-app                        # Run all app tests
cd app && npm test                   # Jest tests
cd app && npm run test:watch         # Watch mode
cd app && npm run test:coverage      # With coverage

# Type checking & linting
make lint-app                        # ESLint (strict, max-warnings=0)
cd app && npm run typecheck          # TypeScript check
cd app && npm run lint:fix           # Auto-fix ESLint issues
```

### Combined Commands
```bash
make test                            # Test backend + app
make lint                            # Lint backend + app
make build                           # Build Docker image
make run-local                       # Test production build locally
```

### Deployment & Operations
```bash
make deploy                          # Deploy to Koyeb
make logs / make status              # Check deployment
make db-backup                       # Backup PostgreSQL
make db-restore / make db-list       # Restore/list backups
make ops-doctor                      # Check tool readiness
```

---

## Architecture

### Backend Structure (Go)

**Layered Architecture**: Handler → Service → Repository

```
backend/
├── cmd/api/               # Entry point + embedded static files
│   ├── main.go           # Server initialization
│   └── bootstrap.go      # Service injection
├── internal/
│   ├── handler/          # HTTP handlers (30 files)
│   ├── service/          # Business logic (39 files)
│   ├── repository/       # Data access with pgxpool (31 files)
│   ├── middleware/       # Auth, CORS, rate limiting, security, metrics
│   ├── model/            # Domain models (24 files)
│   ├── migrations/       # Embedded SQL migrations (//go:embed)
│   ├── router/           # Route definitions (5 files)
│   └── config/           # Environment config (caarlos0/env/v9)
└── pkg/
    ├── httputil/         # HTTP error/response utilities
    └── ctxkeys/          # Type-safe context keys
```

**Middleware Order**: Trace → Recovery → Logging → CORS → Security → Metrics → Rate Limiting → Auth

**Key Patterns**:
- PostgreSQL connection pooling (MaxConns: 10, MinConns: 2, 30min lifetime)
- In-memory caching with go-cache + singleflight (prevents cache stampede)
- JWT auth with access tokens (1h) + refresh tokens (7d)
- Rate limiting per IP with token bucket (100/min default, configurable)
- Graceful degradation (services work without optional deps like AI/Qdrant)

**Context Helpers**:
```go
middleware.GetUserIDFromContext(ctx) (uuid.UUID, bool)
middleware.GetUserEmailFromContext(ctx) (string, bool)
ctxkeys.GetTraceID(ctx) string
```

### App Structure (Expo React Native)

**File-based Routing** with Expo Router:

```
app/
├── app/                   # Routes (screens)
│   ├── (public)/         # Welcome, converter, about
│   ├── (auth)/           # Login, register, password reset
│   ├── auth/             # OAuth callbacks
│   └── (app)/            # Protected screens (auth guard in _layout.tsx)
│       ├── (tabs)/       # Tab navigation
│       │   ├── index.tsx         # Dashboard
│       │   ├── chat.tsx          # AI chat (redirect)
│       │   ├── add.tsx           # Add transaction
│       │   ├── goals.tsx         # Goals
│       │   ├── reports.tsx       # Reports
│       │   └── wallet/           # Nested stack
│       └── [other screens]       # Budgets, recurring, profile, etc.
└── src/
    ├── api/              # 23 API modules (auth, wallet, ai, chat, etc.)
    ├── components/
    │   ├── ui/           # Primitives (Button, Card, Input, etc.)
    │   └── features/     # Feature-specific (Chat, CoAI, Reports, etc.)
    ├── context/          # Providers (Auth, Theme, Language, Settings)
    ├── hooks/            # Custom hooks (useConvert, useRates, etc.)
    ├── i18n/             # 4 languages (en, fa, ar, tr)
    ├── theme/            # Design tokens + styled-components
    ├── types/            # TypeScript types
    └── utils/            # Utilities (format, haptics, validation)
```

**Context Provider Order** (in `app/(app)/_layout.tsx`):
1. GestureHandlerRootView
2. SafeAreaProvider
3. QueryClientProvider (TanStack Query)
4. ThemeProvider (dark/light)
5. StyledThemeWrapper (styled-components bridge)
6. LanguageProvider (EN/FA/AR/TR)
7. SettingsProvider
8. AuthProvider (route protection)
9. ToastProvider
10. BiometricLock

**API Client** (`src/api/base.ts`):
- Relative `/api/v1` on koyeb.app web, full URL on native
- Token caching: in-memory + SecureStore (native) / AsyncStorage (web)
- Auto-retry: 1 retry, 1s base delay, 30s timeout
- Streaming support: WebSocket (native) + SSE fallback (web)

---

## Key Conventions

### Backend (Go)

1. **Error Handling**:
   - Use `pkg/httputil` for consistent HTTP errors
   - `ErrorWithContext()` logs stack traces for 5xx, includes trace ID
   - Repository errors use custom types: `ErrUserAlreadyExists`, `ErrInsufficientBalance`

2. **Database Patterns**:
   - All queries use `pgxpool` context-aware methods
   - Decimal(20,8) for monetary amounts
   - `TIMESTAMP WITH TIME ZONE` for all temporal fields
   - `gen_random_uuid()` for UUIDs
   - Migrations embedded with `//go:embed sql/main/*.sql`

3. **Service Initialization**:
   - Dependencies injected via constructor functions
   - Graceful degradation when optional services unavailable
   - Use `requireService()` to return 503 for missing deps

4. **AI Integration**:
   - 4 providers: GoogleAI, OpenAI, Cerebras, Groq
   - 3 thinking modes: auto, fast, thinking
   - 11 dynamic tools for financial queries
   - Dual memory: PostgreSQL (source of truth) + Qdrant (semantic search)
   - Short-term memory: 24h TTL, async fire-and-forget
   - Long-term memory: stored in both DB and vector DB

5. **Rate Limiting**:
   - Per-IP token bucket with `golang.org/x/time/rate`
   - Separate limits: anonymous (100/min), authenticated, login (5/min), AI (20/min)
   - Auto-cleanup every 10min (30min entry TTL)

### App (Expo React Native)

1. **Path Alias**: `@/*` → `./` (app root)

2. **Internationalization**:
   - Use `const { t } = useLanguage()` with fallback: `t('key') || 'Fallback'`
   - **Sub-components must call `useLanguage()` themselves** (hooks can't be passed from parent)
   - New translation keys must be added to **ALL 4 language files** (en.ts, fa.ts, ar.ts, tr.ts)

3. **Theme & Styling**:
   - Use styled-components/native: `const theme = useTheme()`
   - Access colors: `theme.colors.primary`, spacing: `theme.spacing.md`
   - RTL support via `theme.isRTL` (auto-detected from language)
   - Dark mode default, system detection with manual toggle

4. **Native Features**:
   - Haptic feedback: `import { haptics } from '@/utils/haptics'`
   - Biometrics: `expo-local-authentication` (Face ID, Touch ID)
   - Safe areas: Always use `useSafeAreaInsets()` from `react-native-safe-area-context`
   - Platform checks: `Platform.OS === 'web'` for web-specific code

5. **Data Fetching**:
   - Use TanStack Query hooks: `useQuery`, `useMutation`
   - Offline queue: AsyncStorage-based, max 100 items, 3 retries
   - Planner has dedicated offline sync engine

6. **Toast Notifications**:
   - Use `const { showToast } = useToast()`
   - Types: `showToast(message, 'success' | 'error' | 'info')`

7. **Confirmations**:
   - Use `Alert.alert(title, message, [{ text, onPress, style }])`
   - Style `'destructive'` for delete actions

8. **Component Organization**:
   - UI primitives in `src/components/ui/`
   - Feature components in `src/components/features/[FeatureName]/`
   - Export via `index.ts` barrel files

9. **Type Safety**:
   - API types defined in respective modules (`src/api/`)
   - Shared types in `src/types/`
   - Use `as const` for literal type narrowing

10. **Testing**:
    - Framework: jest-expo + @testing-library/react-native
    - Mocks in `jest.setup.js` (12+ Expo modules)
    - Run: `cd app && npm test`

---

## AI System Architecture

### Backend AI Components

**AI Chat Service** (`internal/service/ai_chat_service.go`):
- Orchestrates LLM calls with comprehensive financial context (15+ data categories)
- Tool execution system with 11 available tools
- Streaming support via SSE + WebSocket
- Token/cost tracking per message

**Memory Service** (`internal/service/memory_service.go`):
- Dual storage: PostgreSQL (source of truth) + Qdrant (semantic search)
- Short-term: 24h TTL, async workers (2 concurrent, 256 queue capacity)
- Long-term: unlimited storage with importance scoring

**Embedding Service** (`internal/service/embedding_service.go`):
- 3 providers: HuggingFace (default), Ollama (local), GoogleAI
- Model: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)

**AI Handlers** (`internal/handler/ai.go`, `ai_chat.go`):
- 20+ endpoints for chat, parsing, actions, usage tracking
- Vision model support for receipt/invoice parsing
- Audio transcription via Groq Whisper

### App AI Components

**AI Chat UI** (`app/(app)/(tabs)/wallet/chat.tsx`):
- 1700+ lines (being refactored into smaller components)
- Dual streaming: WebSocket (native) + SSE (web)
- Voice input, file attachments, markdown rendering
- Tool usage visualization

**AI-Powered Features**:
- Smart transaction parsing (`api.ai.smartParse`)
- CoAI brief on dashboard (`api.coai.getBrief`)
- Recommended actions with deep linking
- Smart advice card (daily tips)
- Weekly recap with AI insights

---

## Database Schema

**Key Tables**:
- `users` - User accounts with OAuth support
- `wallet_balances` - Multi-currency balances (composite PK: user_id + currency)
- `transactions` - Credit/debit/convert with AI extraction metadata
- `categories` - User-defined with icons
- `budgets`, `goals`, `recurring_transactions`
- `chat_conversations`, `chat_messages`
- `user_memories` - AI memory storage
- `tasks`, `task_subtasks` - Task/planner management
- `subscriptions`, `loans`, `notes`
- `badges`, `user_badges`, `challenges`, `user_challenges` - Gamification

**Pagination**:
- Default limit: 50, API handler max: 500, repository max: 10,000
- Returns: `limit`, `offset`, `total`
- Filters: category, type, currency, date range, search

---

## Configuration

### Backend Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key (validated in production)
- `FRONTEND_URL` - OAuth redirect base URL

**AI (Optional)**:
- `AI_PROVIDER` - googleai|openai|cerebras|groq
- `AI_API_KEY` - API key for chosen provider
- `AI_MODEL`, `AI_FAST_MODEL`, `AI_THINKING_MODEL`
- `AI_THINKING_MODE_DEFAULT` - auto|fast|thinking
- `TAVILY_API_KEY` - Web search in AI chat

**Vector DB (Optional)**:
- `QDRANT_ENABLED`, `QDRANT_URL`, `QDRANT_API_KEY`
- `EMBEDDING_PROVIDER` - huggingface|ollama|googleai

**OAuth (Optional)**:
- `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`
- `LINKEDIN_CLIENT_ID/SECRET/REDIRECT_URI`

**Other**:
- `PORT` (8080), `ENVIRONMENT` (development|production)
- `RATE_LIMIT_*` - Rate limiting configs
- `METRICS_ENABLED` - Prometheus metrics

### App Configuration

**Path Alias**: `@/*` → `./` in `tsconfig.json`

**Expo Router**: Typed routes enabled (`experiments.typedRoutes: true`)

**New Architecture**: Enabled (`newArchEnabled: true`)

---

## CI/CD

### Workflows

**CI** (`.github/workflows/ci.yml`):
- On push to main: pre-deploy DB backup → Docker build → push to ghcr.io → deploy to Koyeb
- On PRs: Go tests + app typecheck
- Backup artifacts retained for 7 days

**Database Backup** (`.github/workflows/db-backup.yml`):
- Daily at 03:00 UTC + manual trigger
- 30-day artifact retention

**Mobile Build** (`.github/workflows/mobile-build.yml`):
- On push to main (app/** paths): lint + typecheck → OTA update
- Conditional APK build when native files change or `[build-apk]` in commit

---

## Mobile-Specific Notes

### OAuth Flow
- Handler appends `:mobile` to OAuth state when `?platform=mobile`
- On callback, redirects to `coai://` custom scheme
- App uses `WebBrowser.openAuthSessionAsync()` to intercept redirect

### OTA Updates
- Production channel: stable releases
- Preview channel: beta testing
- Development/Internal: rapid iteration
- Command: `eas update --branch [channel] --message "description"`

### Version Bumping
```bash
cd app && node scripts/bump-version.js patch|minor|major|build
```

Updates `app.json` and `package.json` versions.

---

## Documentation References

- `README.md` - Project overview and setup
- `CLAUDE.md` - Detailed development guide for Claude AI
- `AGENTS.md` - Repository guidelines summary
- `docs/ARCHITECTURE.md` - System architecture
- `docs/BACKEND_ARCHITECTURE.md` - Backend deep dive
- `docs/API.md` - API endpoint reference
- `docs/FEATURES.md` - Feature documentation
- `CURRENCY_CONVERTER_DOCS.md` - Currency converter specifics

---

## Common Tasks

### Adding a New Backend Endpoint
1. Define route in `internal/router/routes_*.go`
2. Create handler in `internal/handler/`
3. Implement service in `internal/service/`
4. Add repository methods in `internal/repository/`
5. Update models in `internal/model/` if needed
6. Add tests (`*_test.go` files)

### Adding a New App Screen
1. Create route file in `app/app/(app)/[screen-name].tsx`
2. Add to tab navigator in `app/app/(app)/(tabs)/_layout.tsx` if needed
3. Create components in `src/components/features/[FeatureName]/`
4. Add API methods in `src/api/[module].ts`
5. Add translations to all 4 i18n files
6. Add tests in `__tests__` directories

### Adding a New AI Tool
1. Add tool definition in `internal/service/ai_tools.go`
2. Implement tool execution logic
3. Update system prompt in `ai_chat_context.go`
4. Add tool usage tracking if needed
5. Test with AI chat endpoint

### Adding a New Language
1. Create `src/i18n/[lang].ts` with all keys
2. Add to `src/i18n/translations.ts`
3. Update `LanguageProvider` in `src/context/LanguageContext.tsx`
4. Add flag/icon to language selector
5. Test RTL support if applicable
