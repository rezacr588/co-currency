# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoFinance is a currency converter web application with React/TypeScript frontend and Go backend. It supports 160+ currencies, 4 languages (English, Persian, Arabic, Turkish) with RTL support, and has PWA capabilities.

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
```

### Full Stack Commands
```bash
make test               # All tests (backend + frontend)
make lint               # Lint both codebases
make build              # Build Docker image
```

## Architecture

### Frontend (`/frontend/src`)
- **api/**: Fetch-based API client with exponential backoff retry
- **components/ui/**: Reusable design system (Button, Card, Input, Select, Badge, etc.)
- **components/features/**: Page-level components (CurrencyConverter, HistoricalRates, etc.)
- **context/**: React Context for Theme and Language providers
- **hooks/**: Custom hooks (useConvert, useRates, useCurrencies, useHistorical, useDebounce)
- **i18n/**: Translation files for EN, FA, AR, TR
- **types/**: TypeScript type definitions

Key patterns:
- TanStack Query for server state management and caching
- Custom Context API for theme/language (not Redux)
- Browser locale detection for default language
- PWA with Workbox runtime caching via vite-plugin-pwa

### Backend (`/backend`)
- **cmd/api/main.go**: Application entry point
- **internal/handler/**: HTTP request handlers
- **internal/service/**: Business logic layer
- **internal/repository/**: Data access (Frankfurter API client, cache, IRR rates)
- **internal/middleware/**: CORS, rate limiting, structured logging (zerolog)
- **internal/router/**: Chi router configuration
- **pkg/httputil/**: Shared HTTP response utilities

Key patterns:
- Handler → Service → Repository layered architecture
- In-memory caching with go-cache
- Embedded React build in Go binary for single-container deployment
- Special handling for IRR (Iranian Rial) via separate data source

### API Endpoints
- `GET /api/currencies` - List all supported currencies
- `GET /api/rates?base=USD` - Current exchange rates
- `GET /api/convert?from=USD&to=EUR&amount=100` - Convert currency
- `GET /api/historical?base=USD&date=2024-01-01` - Historical rates
- `GET /health` - Health check

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

## Build & Deploy

Single Docker container bundles frontend static files in Go binary:
```bash
make build              # Build image
make run-local          # Test production build locally
```

CI/CD: GitHub Actions runs tests and auto-deploys to Koyeb on main branch push.
