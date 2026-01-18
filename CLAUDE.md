# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoFinance is a full-stack personal finance application with:
- **Currency Converter**: 160+ currencies with real-time rates from ECB
- **User Authentication**: JWT-based auth with access/refresh tokens, password reset, account lockout
- **Multi-Currency Wallet**: Track balances, transactions, categories, and convert between currencies
- **Financial Goals**: Set savings targets with progress tracking and contributions
- **Budgets**: Category-based spending limits with period tracking (monthly/yearly)
- **Recurring Transactions**: Automated income/expense scheduling with execution
- **Reports & Analytics**: Monthly summaries, category breakdowns, trends, net worth
- **AI Receipt Parser**: Extract transaction data from text using Cerebras LLM
- **Multi-Language**: English, Persian, Arabic, Turkish with RTL support
- **PWA**: Installable, works offline

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
npm run test:e2e        # Playwright E2E tests
```

### Backend Commands (run from /backend)
```bash
go run ./cmd/api        # Run server
go test ./...           # Run all tests
go test -v ./internal/service/...  # Test specific package
go test -cover ./...    # Run with coverage
```

### Full Stack Commands
```bash
make test               # All tests (backend + frontend)
make lint               # Lint both codebases
make build              # Build Docker image
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

**AI:**
- `GET /api/v1/ai/status` - Check AI configuration
- `POST /api/v1/ai/parse-text` - Parse receipt text
- `POST /api/v1/ai/apply-parsed` (protected) - Apply to wallet

## Configuration

Backend environment variables (see `/backend/.env.example`):
- `DATABASE_URL`: PostgreSQL connection string (required for auth/wallet/goals/budgets)
- `JWT_SECRET`: Secret for signing JWT tokens
- `AI_PROVIDER`: LLM provider (cerebras)
- `AI_API_KEY`: API key for AI provider
- `RATE_LIMIT`: Requests per minute

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
