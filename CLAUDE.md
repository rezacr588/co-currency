# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoFinance is a full-stack financial application with:
- **Currency Converter**: 160+ currencies with real-time rates from ECB
- **User Authentication**: JWT-based auth with register/login
- **Multi-Currency Wallet**: Track balances, transactions, and convert between currencies
- **AI Receipt Parser**: Extract transaction data from receipt/invoice text using Cerebras LLM
- **Multi-Language**: English, Persian, Arabic, Turkish with RTL support
- **PWA**: Installable, works offline

## Development Commands

### Quick Start
```bash
make install            # Install all dependencies
make dev                # Docker Compose development (recommended)
```

### Separate Development (alternative)
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
npm run test:e2e:headed # E2E with browser UI
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
- **components/features/**: Page-level components (CurrencyConverter, Wallet, AIReceiptParser, etc.)
- **components/ProtectedRoute.tsx**: HOC for auth-required routes
- **context/**: React Context for Theme, Language, and Auth (JWT token management)
- **hooks/**: Custom hooks (useConvert, useRates, useCurrencies, useHistorical, useDebounce)
- **i18n/**: Translation files for EN, FA, AR, TR (173 keys each)
- **pages/**: Login.tsx, Register.tsx
- **types/**: TypeScript definitions including wallet.ts for auth/wallet/AI types

Key patterns:
- TanStack Query for server state management and caching
- AuthContext for JWT token persistence in localStorage
- Protected routes redirect to /login with return path
- Browser locale detection for default language
- PWA with Workbox runtime caching via vite-plugin-pwa

### Backend (`/backend`)
- **cmd/api/main.go**: Application entry point, initializes DB and services
- **internal/handler/**: HTTP handlers (auth.go, wallet.go, ai.go, convert.go, etc.)
- **internal/service/**: Business logic (auth_service.go, wallet_service.go, ai_service.go, exchange.go)
- **internal/repository/**: Data access (database.go, user_db.go, wallet_db.go, frankfurter.go, cache.go)
- **internal/middleware/**: CORS, rate limiting, logging, JWT auth (auth.go)
- **internal/model/**: Domain models (user.go, wallet.go, currency.go)
- **internal/router/**: Chi router configuration
- **pkg/httputil/**: Shared HTTP response utilities
- **tests/e2e/**: End-to-end API tests

Key patterns:
- Handler → Service → Repository layered architecture
- PostgreSQL with pgx for user data, wallet balances, transactions
- In-memory caching with go-cache for exchange rates
- JWT authentication with golang-jwt/v5
- LangChainGo with Cerebras for AI text parsing
- Embedded React build in Go binary for single-container deployment
- Special handling for IRR (Iranian Rial) via separate data source

### API Endpoints

**Public (no auth):**
- `GET /api/currencies` - List all supported currencies
- `GET /api/rates?base=USD` - Current exchange rates
- `GET /api/convert?from=USD&to=EUR&amount=100` - Convert currency
- `GET /api/historical?base=USD&date=2024-01-01` - Historical rates
- `GET /health` - Health check

**Auth:**
- `POST /api/v1/auth/register` - Create account (email, password, name)
- `POST /api/v1/auth/login` - Get JWT token
- `GET /api/v1/auth/profile` - Get user info (requires JWT)

**Wallet (requires JWT in Authorization header):**
- `GET /api/v1/wallet/balances` - Get all currency balances
- `GET /api/v1/wallet/summary` - Get balances + recent transactions
- `GET /api/v1/wallet/transactions` - Get transaction history (paginated)
- `POST /api/v1/wallet/transaction` - Add credit/debit
- `POST /api/v1/wallet/convert` - Convert between wallet currencies

**AI (requires JWT):**
- `POST /api/v1/ai/parse` - Parse receipt/invoice text, returns extracted transactions
- `POST /api/v1/ai/apply` - Apply parsed transaction to wallet

## Testing

- **Unit tests**: Vitest + Testing Library for React components
- **E2E tests**: Playwright (Chromium only) against localhost:5173
- **Backend tests**: Standard Go testing with coverage

Run a single frontend test file:
```bash
cd frontend && npm test -- src/hooks/useConvert.test.ts
```

Run E2E tests in debug mode:
```bash
cd frontend && npm run test:e2e:debug
```

## Configuration

Frontend API proxy: Vite proxies `/api` requests to backend at :8080

Backend environment variables (see `/backend/.env.example`):
- `PORT`: Server port (default: 8080)
- `ENVIRONMENT`: development/production
- `CACHE_TTL`: Cache duration
- `RATE_LIMIT`: Requests per minute
- `DATABASE_URL`: PostgreSQL connection string (required for auth/wallet)
- `JWT_SECRET`: Secret for signing JWT tokens (required, change in production)
- `AI_PROVIDER`: LLM provider (cerebras)
- `AI_API_KEY`: API key for AI provider

## Build & Deploy

Single Docker container bundles frontend static files in Go binary:
```bash
make build              # Build image
make run-local          # Test production build locally
```

CI/CD: GitHub Actions runs tests and auto-deploys to Koyeb on main branch push.

## Database Schema

PostgreSQL tables (auto-created on startup if DATABASE_URL is set):
- `users`: id, email, password_hash, name, created_at, updated_at
- `wallet_balances`: id, user_id, currency, balance, updated_at (unique on user_id+currency)
- `transactions`: id, user_id, type, amount, currency, to_amount, to_currency, rate, source, ai_extracted_data, description, created_at
