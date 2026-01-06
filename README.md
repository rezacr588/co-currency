# CoFinance

A modern, full-stack currency converter application with real-time exchange rates, multi-language support, and a responsive PWA interface.

[![CI](https://github.com/rezacr588/co-currency/actions/workflows/ci.yml/badge.svg)](https://github.com/rezacr588/co-currency/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Real-time Currency Conversion** - Convert between 160+ world currencies instantly
- **Live Exchange Rates** - Auto-refreshing rates grid with visual indicators
- **Historical Data** - Look up past exchange rates by date
- **Multi-language Support** - English, Persian (فارسی), Arabic (العربية), Turkish (Türkçe)
- **Dark/Light Theme** - System-aware with manual toggle
- **PWA Support** - Install as app, works offline
- **Responsive Design** - Optimized for mobile, tablet, and desktop

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, Custom Design System |
| **State** | TanStack Query (React Query) |
| **Routing** | React Router DOM |
| **Backend** | Go 1.22+, Chi Router |
| **Cache** | go-cache (in-memory) |
| **API** | Frankfurter API (ECB rates) |
| **Deploy** | Docker, Koyeb |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │  TanStack   │  │    Service Worker       │  │
│  │   App       │◄─┤   Query     │◄─┤    (PWA Cache)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Go Backend Server                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Router  │─►│ Handlers │─►│ Services │─►│   Repositories   │ │
│  │  (Chi)   │  │          │  │          │  │                  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┬─────────┘ │
│       │                                              │           │
│  ┌────┴────┐                                   ┌─────┴─────┐    │
│  │Middleware│                                  │  Cache    │    │
│  │- CORS   │                                   │ (go-cache)│    │
│  │- Rate   │                                   └───────────┘    │
│  │  Limit  │                                                    │
│  │- Logger │                                                    │
│  └─────────┘                                                    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP
                                  ▼
                    ┌─────────────────────────┐
                    │   Frankfurter API       │
                    │   (European Central     │
                    │    Bank Rates)          │
                    └─────────────────────────┘
```

### Frontend Architecture

```
frontend/src/
├── api/                    # API client with retry logic
│   └── client.ts           # Axios instance, error handling
├── components/
│   ├── ui/                 # Reusable UI components (Design System)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── CurrencyBadge.tsx
│   │   └── RateChange.tsx
│   └── features/           # Feature-specific components
│       ├── Converter/      # Main converter widget
│       ├── RatesGrid/      # Exchange rates display
│       ├── QuickConvert/   # Quick conversion cards
│       ├── Historical/     # Historical rates lookup
│       ├── AboutUs/        # About page
│       └── NotFound/       # 404 page
├── context/                # React Context providers
│   ├── ThemeContext.tsx    # Dark/light theme
│   └── LanguageContext.tsx # i18n with 4 languages
├── hooks/                  # Custom React hooks
│   ├── useConvert.ts       # Currency conversion
│   ├── useRates.ts         # Exchange rates fetching
│   ├── useCurrencies.ts    # Currency list
│   ├── useHistorical.ts    # Historical rates
│   └── useDebounce.ts      # Input debouncing
├── i18n/                   # Internationalization
│   └── translations.ts     # Translation strings
├── styles/                 # Global styles
│   └── globals.css         # Design system & Tailwind
├── types/                  # TypeScript definitions
│   └── currency.ts         # API types
└── utils/                  # Utility functions
    ├── format.ts           # Number/currency formatting
    └── constants.ts        # Currency symbols & flags
```

### Backend Architecture

```
backend/
├── cmd/api/                # Application entry point
│   └── main.go
├── internal/               # Private application code
│   ├── config/             # Environment configuration
│   ├── handler/            # HTTP request handlers
│   │   ├── currencies.go   # GET /currencies
│   │   ├── rates.go        # GET /rates/:base
│   │   ├── convert.go      # GET /convert
│   │   ├── historical.go   # GET /historical/:date
│   │   └── health.go       # GET /health
│   ├── middleware/         # HTTP middleware
│   │   ├── cors.go         # CORS headers
│   │   ├── ratelimit.go    # Request throttling
│   │   └── logging.go      # Request logging
│   ├── model/              # Domain models
│   │   ├── currency.go
│   │   ├── rate.go
│   │   └── conversion.go
│   ├── repository/         # Data access layer
│   │   ├── frankfurter.go  # External API client
│   │   ├── cache.go        # In-memory caching
│   │   └── irr.go          # IRR rate handling
│   ├── router/             # Route definitions
│   │   └── router.go
│   └── service/            # Business logic
│       └── exchange.go     # Conversion calculations
└── pkg/httputil/           # Shared HTTP utilities
    ├── response.go         # JSON response helpers
    └── errors.go           # Error handling
```

### Design System

The frontend includes a custom finance-focused design system (`globals.css`):

| Category | Classes |
|----------|---------|
| **Cards** | `.card`, `.card-header`, `.card-body`, `.card-title` |
| **Buttons** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` |
| **Forms** | `.input`, `.input-lg`, `.select`, `.form-label` |
| **Finance** | `.currency-badge`, `.rate-display`, `.rate-up`, `.rate-down` |
| **Status** | `.status-success`, `.status-warning`, `.status-error` |
| **Feedback** | `.error-message`, `.info-message`, `.skeleton` |

---

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- Docker (optional)

### Development

```bash
# Install all dependencies
make install

# Run backend (port 8080)
make dev-backend

# Run frontend (port 5173) - separate terminal
make dev-frontend
```

Or with Docker:

```bash
make dev
```

### Production Build

```bash
# Build Docker image
make build

# Run locally
make run-local
```

### Running Tests

```bash
# Run all tests
make test

# Frontend tests only
cd frontend && npm test

# Backend tests only
make test-backend
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/currencies` | List all supported currencies |
| `GET` | `/api/v1/rates/:base` | Get latest rates for base currency |
| `GET` | `/api/v1/convert` | Convert amount between currencies |
| `GET` | `/api/v1/historical/:date` | Get rates for specific date |
| `GET` | `/health` | Health check endpoint |

### Examples

```bash
# List currencies
curl https://your-app.koyeb.app/api/v1/currencies

# Get USD rates
curl https://your-app.koyeb.app/api/v1/rates/USD

# Convert 100 USD to EUR
curl "https://your-app.koyeb.app/api/v1/convert?from=USD&to=EUR&amount=100"

# Historical rates
curl "https://your-app.koyeb.app/api/v1/historical/2024-01-15?base=USD"
```

### Response Format

```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "EUR",
    "amount": 100,
    "result": 92.45,
    "rate": 0.9245
  }
}
```

---

## Deployment

### Koyeb (Recommended)

1. **Push to GitHub**

2. **Create Koyeb App**
   - Go to [app.koyeb.com](https://app.koyeb.com)
   - Click "Create App" → Select "GitHub"
   - Choose this repository

3. **Configure**
   - Builder: `Dockerfile`
   - Port: `8080`
   - Instance: `Free`

4. **Environment Variables** (optional)
   ```
   PORT=8080
   ENVIRONMENT=production
   CACHE_TTL=5m
   RATE_LIMIT=100
   ```

### CI/CD

GitHub Actions workflows included:
- **CI** (`.github/workflows/ci.yml`) - Tests on push/PR
- **Deploy** (`.github/workflows/deploy.yml`) - Auto-deploy to Koyeb

Add `KOYEB_TOKEN` secret for auto-deployment.

---

## Project Structure

```
co-currency/
├── backend/                # Go API server
├── frontend/               # React application
├── .github/workflows/      # CI/CD pipelines
├── Dockerfile              # Production build
├── docker-compose.yml      # Development setup
├── koyeb.yaml              # Koyeb configuration
├── Makefile                # Build commands
└── README.md
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

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**Reza Zeraat** - Full Stack Developer & ML Engineer

- [LinkedIn](https://linkedin.com/in/rezazeraat)
- [GitHub](https://github.com/rezacr588)
