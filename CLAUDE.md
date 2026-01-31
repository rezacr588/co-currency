# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoFinance is a full-stack personal finance application with **three clients**: Web (React), Mobile (Expo/React Native), and a Go backend.

**Features:**
- **Currency Converter**: 160+ currencies with real-time rates from ECB + IRR rates
- **User Authentication**: JWT-based auth with access/refresh tokens, OAuth (Google, LinkedIn)
- **Multi-Currency Wallet**: Track balances, transactions, categories, convert between currencies
- **Financial Goals**: Savings targets with progress tracking and contributions
- **Budgets**: Category-based spending limits with period tracking
- **Recurring Transactions**: Automated income/expense scheduling
- **Reports & Analytics**: Monthly summaries, category breakdowns, trends, net worth, forecasting
- **AI Chat Advisor**: Cerebras-powered financial advisor with user context and long-term memories
- **AI Receipt Parser**: Extract transaction data from text
- **Subscriptions & Badges**: Track recurring subscriptions, gamification with achievement badges
- **Multi-Language**: English, Persian, Arabic, Turkish with RTL support
- **PWA + Mobile**: Web app is installable PWA, mobile app uses Expo with EAS for OTA updates

## Development Commands

### Quick Start
```bash
make install            # Install all dependencies
make dev                # Docker Compose development (recommended)
```

### Separate Development
```bash
make dev-backend        # Go server on :8080
make dev-frontend       # Vite dev server on :5173
```

### Frontend Commands (run from /frontend)
```bash
npm run dev             # Start Vite dev server
npm run build           # Production build
npm run lint            # ESLint (strict, max-warnings=0)
npm test                # Vitest unit tests (watch mode)
npm run test:run        # Run tests once
npm run test:coverage   # Generate coverage report
npm run test:e2e        # Playwright E2E tests (headless)
npm run test:e2e:ui     # Playwright with UI mode
npm run test:e2e:headed # Playwright with browser visible
npm run test:e2e:debug  # Playwright debug mode
```

### Backend Commands (run from /backend)
```bash
go run ./cmd/api        # Run server
go test ./...           # Run all tests
go test -v ./internal/service/...  # Test specific package
go test -cover ./...    # Run with coverage
```

### Mobile App Commands (run from /app)
```bash
npx expo start          # Start Expo dev server (press i/a for simulator)
npm run ios             # Build and run on iOS simulator (native)
npm run android         # Build and run on Android emulator (native)
npm run web             # Start Expo web version
npx tsc --noEmit        # TypeScript check
eas update --branch production --message "description" # Push OTA update
eas build --platform android --profile production # Build APK
```

### Full Stack Commands
```bash
make test               # All tests (backend + frontend)
make test-backend       # Backend tests only
make test-frontend      # Frontend tests only
make lint               # Lint both codebases
make lint-backend       # Go lint with golangci-lint
make lint-frontend      # ESLint
make build              # Build Docker image
make clean              # Remove build artifacts
```

## Architecture

### Frontend (`/frontend/src`)
- **api/client.ts**: Fetch-based API client with exponential backoff retry, JWT auth headers
- **components/ui/**: Reusable design system (Button, Card, Input, Select, Badge, etc.)
- **components/features/**: Feature components organized by domain (Wallet/, Goals/, Budgets/, Recurring/, etc.)
- **context/**: React Context for Theme, Language, and Auth (JWT token management)
- **hooks/**: Custom hooks (useConvert, useRates, useCurrencies, useHistorical, useDebounce)
- **i18n/translations.ts**: Translation keys for EN, FA, AR, TR
- **types/**: TypeScript definitions (wallet.ts, goal.ts)

Key patterns:
- TanStack Query for server state management and caching
- AuthContext for JWT token persistence in localStorage
- Protected routes redirect to /login with return path
- PWA with Workbox runtime caching via vite-plugin-pwa

### Mobile App (`/app`)
- **Expo Router**: File-based routing in `app/` directory
- **app/(public)/**: Public screens (login, register, converter)
- **app/(app)/(tabs)/**: Authenticated tab screens (dashboard, wallet, chat, add, profile)
- **app/(app)/(tabs)/wallet/**: Wallet sub-screens (history, convert, transaction details)
- **src/api/**: API client using `fetchAPI` with JWT auth headers
- **src/components/features/**: Shared feature components (CurrencyConverter, etc.)
- **src/context/**: Auth, Theme, Language contexts
- **src/hooks/**: Custom hooks mirroring frontend (useConvert, useCurrencies, etc.)

Key patterns:
- NativeWind (Tailwind for React Native) for styling
- TanStack Query for server state
- Expo SecureStore for token persistence
- EAS Update for OTA deployments (no app store review needed for JS changes)
- Same API client pattern as web frontend

### Backend (`/backend`)
- **cmd/api/main.go**: Application entry point, initializes DB and services
- **internal/handler/**: HTTP handlers (auth.go, wallet.go, goal.go, budget.go, recurring.go, reports.go, ai.go)
- **internal/service/**: Business logic layer
- **internal/repository/**: Data access with pgxpool connection pooling
- **internal/middleware/**: CORS, rate limiting (per-user), logging, JWT auth
- **internal/model/**: Domain models
- **internal/router/router.go**: Chi router configuration with all routes

Key patterns:
- Handler → Service → Repository layered architecture
- PostgreSQL with pgx/pgxpool (connection pool with health checks, retry logic)
- In-memory caching with go-cache for exchange rates
- JWT authentication with access tokens (15min) and refresh tokens (7 days)
- Embedded React build in Go binary for single-container deployment

### API Endpoints

**Public:**
- `GET /api/v1/currencies` - List supported currencies
- `GET /api/v1/rates/{base}` - Current exchange rates
- `GET /api/v1/convert?from=&to=&amount=` - Convert currency
- `GET /api/v1/historical/{date}` - Historical rates
- `GET /health` - Health check with pool stats

**Auth:**
- `POST /api/v1/auth/register`, `/login`, `/forgot-password`, `/reset-password`
- `POST /api/v1/auth/refresh`, `/logout`
- `GET /api/v1/auth/profile` (protected)

**Wallet (protected):**
- `GET /api/v1/wallet/balances`, `/summary`, `/transactions`, `/categories`
- `GET /api/v1/wallet/transactions/export?format=csv`
- `GET/PUT/DELETE /api/v1/wallet/transactions/{id}`
- `POST /api/v1/wallet/transaction`, `/convert`

**Tags (protected):**
- `GET/POST /api/v1/tags`
- `DELETE /api/v1/tags/{id}`

**Goals (protected):**
- `GET/POST /api/v1/goals`, `GET /api/v1/goals/categories`
- `GET/PUT/DELETE /api/v1/goals/{id}`
- `POST /api/v1/goals/{id}/contribute`

**Budgets (protected):**
- `GET/POST /api/v1/budgets`
- `PUT/DELETE /api/v1/budgets/{id}`

**Recurring (protected):**
- `GET/POST /api/v1/recurring`, `GET /api/v1/recurring/frequencies`
- `PUT/DELETE /api/v1/recurring/{id}`
- `POST /api/v1/recurring/{id}/execute`

**Reports (protected):**
- `GET /api/v1/reports/monthly?year=&month=&currency=`
- `GET /api/v1/reports/category?currency=`
- `GET /api/v1/reports/trends?months=&currency=`
- `GET /api/v1/reports/networth?currency=`

**AI & Chat (protected):**
- `GET /api/v1/ai/status` - Check AI configuration
- `POST /api/v1/ai/parse-text` - Parse receipt text
- `POST /api/v1/ai/apply-parsed` - Apply parsed to wallet
- `GET /api/v1/ai/conversations` - List chat conversations
- `POST /api/v1/ai/conversations` - Create new conversation
- `GET /api/v1/ai/conversations/{id}` - Get conversation with messages
- `DELETE /api/v1/ai/conversations/{id}` - Delete conversation
- `POST /api/v1/ai/chat` - Send message to AI advisor

**Subscriptions (protected):**
- `GET/POST /api/v1/subscriptions`
- `PUT/DELETE /api/v1/subscriptions/{id}`

**Badges (protected):**
- `GET /api/v1/badges` - List all badges with unlock status
- `GET /api/v1/badges/check` - Check and unlock new badges

## Configuration

Backend environment variables (see `/backend/.env.example`):
- `DATABASE_URL`: PostgreSQL connection string (required for auth/wallet/goals/budgets)
- `JWT_SECRET`: Secret for signing JWT tokens
- `FRONTEND_URL`: Frontend URL for OAuth redirects (default: `http://localhost:5173`)
- `RATE_LIMIT`: Requests per minute
- `EXPOSE_ERROR_DETAILS`: Show error details in API responses (dev only)

**IRR Rate Crawler:**
- `IRR_CRAWLER_ENABLED`: Enable Iranian Rial rate crawling (`true`/`false`)
- `IRR_CRAWLER_INTERVAL`: Crawl interval (default: `5m`)

**OAuth Providers:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Google OAuth
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`: LinkedIn OAuth

**AI Service:**
- `AI_PROVIDER`: LLM provider (cerebras, openai, googleai)
- `AI_API_KEY`: API key for AI provider
- `AI_MODEL`: Model name (e.g., `gpt-oss-120b` for Cerebras)
- `AI_CLOUD_PROJECT`: Google Cloud project ID (for googleai provider)

**Qdrant Vector Memory** (optional, for semantic AI memory):
- `QDRANT_ENABLED`: Enable vector memory (`true`/`false`)
- `QDRANT_URL`: Qdrant Cloud cluster URL
- `QDRANT_API_KEY`: Qdrant API key
- `EMBEDDING_PROVIDER`: Embedding provider (`huggingface`, `ollama`, `googleai`)
- `EMBEDDING_API_KEY`: HuggingFace or Google AI API key
- `EMBEDDING_MODEL`: Model name (default: `sentence-transformers/all-MiniLM-L6-v2`)
- `EMBEDDING_DIMENSIONS`: Vector dimensions (384 for MiniLM, 768 for others)
- `OLLAMA_URL`: Ollama server URL (if using `ollama` provider, default: `http://localhost:11434`)
- `SHORT_TERM_MEMORY_TTL`: Short-term memory expiration (default: `24h`)
- `MAX_MEMORY_RESULTS`: Max memories returned per query (default: `10`)

## Database Schema

PostgreSQL tables (auto-created on startup):
- `users`: id, email, password_hash, name, failed_login_attempts, locked_until, password_reset_token/expires
- `wallet_balances`: user_id, currency, balance (unique on user_id+currency)
- `transactions`: user_id, type, amount, currency, category, description, notes, icon, to_amount, to_currency, rate
- `categories`: user_id, name, icon, color, is_default
- `refresh_tokens`: user_id, token_hash, expires_at
- `goals`: user_id, name, target_amount, current_amount, currency, category, deadline
- `tags`: user_id, name, color (unique on user_id+name)
- `transaction_tags`: transaction_id, tag_id (junction table)
- `budgets`: user_id, category, amount, currency, period, spent (unique on user_id+category+period)
- `recurring_transactions`: user_id, type, amount, currency, category, description, frequency, next_execution, is_active
- `subscriptions`: user_id, name, amount, currency, billing_cycle, next_billing, category, is_active
- `badges`: id, name, description, icon, category, criteria
- `user_badges`: user_id, badge_id, unlocked_at
- `chat_conversations`: id, user_id, title, created_at, updated_at
- `chat_messages`: id, conversation_id, role, content, tokens_used, created_at
- `user_memories`: id, user_id, category, content, source, created_at (AI long-term memory)
- `oauth_states`: state, user_id, provider, expires_at (OAuth flow state management)

## Build & Deploy

Single Docker container bundles frontend static files in Go binary:
```bash
make build              # Build image
make run-local          # Test production build locally
```

CI/CD: GitHub Actions runs tests and auto-deploys to Koyeb on main branch push.

Pre-commit hook runs Go tests and frontend TypeScript/tests before commits.

## Deployment

Production deployment is on Koyeb. Use `koyeb` MCP server to manage:
- App: `terrible-moselle`
- Service: `co-currency`
- URL: https://terrible-moselle-airez-1828dc33.koyeb.app

## Database Access

Neon PostgreSQL database:
- Project ID: `royal-cake-50541080`
- Use the `postgres` MCP server to query directly (connection pre-configured)

Example queries:
```sql
SELECT * FROM wallet_balances WHERE user_id = '...';
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;
```

## Mobile Deployment

Mobile app uses Expo Application Services (EAS):
- **OTA Updates**: JavaScript changes pushed via `eas update` (no app store review)
- **Native Builds**: Full APK/IPA builds via `eas build` when native dependencies change
- **GitHub Actions**: `.github/workflows/mobile-build.yml` auto-deploys OTA on push to main

The workflow detects native changes and either pushes OTA update or triggers full build.

## AI Chat Architecture

The AI Chat service (`internal/service/ai_chat_service.go`) provides:
- **Financial Context**: User's balances, transactions, budgets, goals, recurring items
- **Long-term Memory**: Stored insights about user preferences across conversations
- **Semantic Memory** (with Qdrant): Vector similarity search for relevant past conversations
- **Live Exchange Rates**: Real-time currency rates for accurate financial advice
- **Conversation History**: Full chat history maintained per conversation

The AI receives a rich system prompt with all user financial data, enabling personalized advice.

### Vector Memory Architecture

When `QDRANT_ENABLED=true`, the system uses hybrid PostgreSQL + Qdrant storage:
- **PostgreSQL**: Source of truth for all memories
- **Qdrant**: Semantic search index with two collections:
  - `short_term_memory`: Recent conversation context (24h TTL)
  - `long_term_memory`: User preferences and insights (permanent)
- **Embedding**: HuggingFace Inference API (free) generates 384-dim vectors
- **Fallback**: Gracefully degrades to PostgreSQL `GetRecent()` if Qdrant unavailable

Key files:
- `internal/repository/qdrant_client.go`: Qdrant connection and collection management
- `internal/repository/vector_memory_repo.go`: Vector upsert and similarity search
- `internal/service/embedding_service.go`: Text-to-vector embedding generation
- `internal/service/memory_service.go`: Orchestrates PostgreSQL + Qdrant with fallback
