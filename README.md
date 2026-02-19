# CoFinance

A full-stack personal finance platform with multi-currency wallet, budgets, goals, AI financial advisor, reports, gamification, and multi-language support. Available as a web app and native mobile app (iOS/Android).

[![CI](https://github.com/rezacr588/co-currency/actions/workflows/ci.yml/badge.svg)](https://github.com/rezacr588/co-currency/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Multi-Currency Wallet** — Track balances in 160+ currencies, convert between them instantly
- **Transaction Management** — Credit, debit, and conversion transactions with categories, tags, and CSV export
- **Budgets** — Category-based spending limits with monthly/yearly tracking and alerts
- **Financial Goals** — Savings targets with progress tracking and contributions
- **Recurring Transactions** — Scheduled income/expenses with daily, weekly, monthly, or yearly frequency
- **AI Financial Advisor** — Context-aware chat powered by Groq, OpenAI, Google AI, or Cerebras with semantic memory
- **AI Receipt/Invoice Parsing** — Extract transactions from text or images (vision model support)
- **Smart Financial Advice** — Personalized AI-generated tips based on your spending patterns
- **Financial News** — Aggregated news feed from MarketWatch, Yahoo Finance, and CNBC
- **Reports & Analytics** — Monthly/yearly summaries, category breakdowns, trends, net worth, forecasts, anomaly detection
- **Subscriptions Tracking** — Monitor recurring subscriptions with billing cycles and upcoming payments
- **Loans Management** — Track loans, payments, and upcoming due dates
- **Notes** — Pinned, color-coded notes linked to transactions
- **Badges, XP & Challenges** — Gamification with daily rewards, leaderboard, and financial challenges
- **Multi-Language Support** — English, Persian (فارسی), Arabic (العربية), Turkish (Türkçe) with RTL
- **Dark/Light Theme** — System-aware with manual toggle on all platforms

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.24, Chi Router, JWT auth |
| **Database** | PostgreSQL (Neon), pgx/pgxpool |
| **Vector DB** | Qdrant (semantic memory for AI) |
| **AI** | Multi-provider: Groq, OpenAI, Google AI, Cerebras |
| **Web Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| **Mobile App** | Expo ~54, React Native 0.81, styled-components, Expo Router |
| **Cache** | go-cache (in-memory) with singleflight |
| **Deploy** | Docker, Koyeb, EAS (mobile OTA updates) |

---

## Architecture

```
┌──────────────────────┐  ┌───────────────────────┐
│   Web (React/Vite)   │  │  Mobile (Expo/RN)     │
│   Tailwind CSS       │  │  styled-components    │
│   TanStack Query     │  │  TanStack Query       │
└──────────┬───────────┘  └──────────┬────────────┘
           │                         │
           └────────────┬────────────┘
                        │ HTTPS / REST
                        ▼
┌─────────────────────────────────────────────────┐
│              Go Backend (Single Binary)          │
│  Router → Middleware → Handlers → Services       │
│                                  → Repositories  │
│  Embedded Expo Web Build (production)            │
└────┬──────────┬──────────────┬──────────────────┘
     │          │              │
     ▼          ▼              ▼
┌──────────┐ ┌──────────┐ ┌────────────────────┐
│PostgreSQL│ │  Qdrant  │ │   External APIs    │
│  (Neon)  │ │(Vector DB)│ │ ECB, PriceDB/TGJU │
│          │ │          │ │ AI Providers       │
│          │ │          │ │ RSS News Feeds     │
└──────────┘ └──────────┘ └────────────────────┘
```

---

## Project Structure

```
co-currency/
├── backend/                # Go API server
│   ├── cmd/api/            # Entry point + embedded static files
│   ├── internal/
│   │   ├── handler/        # HTTP handlers (27 files)
│   │   ├── service/        # Business logic (20 files)
│   │   ├── repository/     # Data access (27 files)
│   │   ├── middleware/     # Auth, CORS, rate limiting, security
│   │   ├── model/          # Domain models
│   │   ├── migrations/     # Embedded SQL migrations
│   │   ├── router/         # Route definitions
│   │   └── config/         # Environment config
│   └── pkg/                # Shared HTTP utilities
│
├── frontend/               # React web application
│   └── src/
│       ├── api/            # API client with retry logic
│       ├── components/     # UI, features, and layout components
│       ├── context/        # Auth, Theme, Language, Toast
│       ├── hooks/          # Custom React hooks
│       ├── pages/          # Route pages
│       └── i18n/           # Translations (4 languages)
│
├── app/                    # Expo mobile application
│   ├── app/                # File-based routing (Expo Router)
│   │   ├── (public)/       # Welcome, converter, about
│   │   ├── (auth)/         # Login, register, password reset
│   │   └── (app)/          # Protected screens + tab navigation
│   └── src/
│       ├── api/            # 21 API modules
│       ├── components/     # UI primitives, features, charts
│       ├── context/        # Providers (theme, auth, language, settings)
│       ├── hooks/          # Platform-specific hooks
│       └── theme/          # Design tokens and styled-components theme
│
├── .github/workflows/      # CI/CD pipelines
├── docs/                   # Documentation
├── Dockerfile              # 3-stage production build
├── docker-compose.yml      # Development setup
├── Makefile                # Build commands
└── koyeb.yaml              # Koyeb deployment config
```

---

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker (optional, recommended)

### Development (Docker — recommended)

```bash
# Clone and set up
git clone https://github.com/rezacr588/currency-converter.git
cd currency-converter
make install
cp backend/.env.example backend/.env  # Configure environment

# Start all services
make dev
```

### Development (Manual)

```bash
# Backend (port 8080)
make dev-backend

# Frontend (port 5173) — separate terminal
make dev-frontend
```

### Mobile App

```bash
cd app
npm install
npx expo start          # Press i for iOS, a for Android
```

### Production Build

```bash
make build              # Build Docker image
make run-local          # Test production build on :8080
```

---

## Running Tests

```bash
# All tests
make test

# Backend only
make test-backend

# Frontend only
cd frontend && npm test

# Mobile app
cd app && npm test

# TypeScript checks
cd frontend && npx tsc --noEmit
cd app && npx tsc --noEmit
```

---

## API Reference

All endpoints are prefixed with `/api/v1` unless noted. Protected endpoints require `Authorization: Bearer <token>`.

| Group | Endpoints | Auth |
|-------|-----------|------|
| **Health** | `GET /health`, `GET /health/detailed` | No |
| **Exchange** | `GET /currencies`, `GET /rates/{base}`, `GET /convert`, `GET /historical/{date}` | No |
| **News** | `GET /news?limit=N` | No |
| **Auth** | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | Partial |
| **Profile** | `GET /auth/profile`, `PUT /auth/profile`, `POST /auth/onboarding` | Yes |
| **Wallet** | `GET /wallet/balances`, `/summary`, `/transactions`, `POST /wallet/transaction`, `/convert` | Yes |
| **Categories** | `GET /wallet/categories`, `POST`, `PUT`, `DELETE` | Yes |
| **Goals** | `GET /goals`, `POST`, `PUT`, `DELETE`, `POST /{id}/contribute` | Yes |
| **Budgets** | `GET /budgets`, `POST`, `PUT`, `DELETE` | Yes |
| **Recurring** | `GET /recurring`, `POST`, `PUT`, `DELETE`, `POST /{id}/execute` | Yes |
| **Subscriptions** | `GET /subscriptions`, `/summary`, `/upcoming`, `POST`, `PUT`, `DELETE` | Yes |
| **Reports** | `GET /reports/monthly`, `/yearly`, `/category`, `/trends`, `/networth`, `/forecast`, `/insights`, `/health-score`, `/weekly-recap`, `/cashflow`, `/anomalies` | Yes |
| **AI** | `GET /ai/status` (public), `POST /ai/parse-receipt`, `/parse-text`, `/smart-parse`, `/chat`, `GET /ai/advice` | Mixed |
| **Badges** | `GET /badges` (public), `GET /badges/earned`, `/progress`, `/check` | Mixed |
| **Notes** | `GET /notes`, `POST`, `PUT`, `DELETE`, `POST /{id}/pin` | Yes |
| **Loans** | `GET /loans`, `/summary`, `/upcoming`, `POST`, `PUT`, `DELETE`, `POST /{id}/payments` | Yes |
| **Challenges** | `GET /challenges` (public), `POST /join`, `GET /active`, `/history`, `/stats` | Mixed |
| **XP** | `GET /xp/stats`, `/history`, `/level`, `/leaderboard`, `POST /xp/daily-reward` | Yes |
| **Tags** | `GET /tags`, `POST`, `DELETE` | Yes |
| **Notifications** | `POST /notifications/register`, `/unregister`, `GET /preferences` | Yes |

See [docs/API.md](docs/API.md) for full endpoint documentation with request/response examples.

---

## CI/CD

### Web
- **Push to main** → Docker build → push to ghcr.io → deploy to Koyeb
- **Pull requests** → Go tests + frontend TypeScript check

### Mobile
- **Push to main** (app/ changes) → lint + typecheck → OTA update to production
- **APK builds** triggered when native dependencies change, `[build-apk]` in commit, or manual dispatch

---

## Deployment

### Koyeb (Production)

The app auto-deploys on push to main via GitHub Actions. The Docker image serves the Expo web build embedded in the Go binary.

```bash
make deploy             # Manual deploy
make logs               # View logs
make status             # Check status
```

### Mobile OTA Updates

```bash
cd app
eas update --branch production --message "description"
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Reza Zeraat** — Full Stack Developer & ML Engineer

- [LinkedIn](https://linkedin.com/in/rezazeraat)
- [GitHub](https://github.com/rezacr588)
