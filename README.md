# Currency Converter v2

A modern, full-stack currency converter application with real-time exchange rates, historical data, and a responsive PWA interface.

## Tech Stack

- **Backend:** Go (Golang) with Chi router
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Cache:** In-memory (go-cache)
- **Deployment:** Koyeb (single service)

## Features

- Real-time currency conversion
- Exchange rates grid with auto-refresh
- Quick conversion cards
- Historical rates lookup
- Responsive design
- PWA support with offline caching

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- Docker (optional)

### Development

```bash
# Install dependencies
make install

# Run backend (port 8080)
make dev-backend

# Run frontend (port 5173) - in another terminal
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

# Run backend tests only
make test-backend
```

## API Endpoints

| Method | Endpoint | Description | Example |
|--------|----------|-------------|---------|
| GET | `/api/v1/currencies` | List all currencies | `/api/v1/currencies` |
| GET | `/api/v1/rates/:base` | Get latest rates | `/api/v1/rates/USD` |
| GET | `/api/v1/convert` | Convert currency | `/api/v1/convert?from=USD&to=EUR&amount=100` |
| GET | `/api/v1/historical/:date` | Get historical rates | `/api/v1/historical/2024-01-15?base=USD` |
| GET | `/health` | Health check | `/health` |

## Deployment to Koyeb

### Option 1: Deploy via GitHub (Recommended)

1. **Push your code to GitHub**

2. **Create a Koyeb account** at [app.koyeb.com](https://app.koyeb.com) (free, no credit card required)

3. **Create a new App:**
   - Click "Create App"
   - Select "GitHub"
   - Authorize Koyeb to access your repository
   - Select this repository

4. **Configure the deployment:**
   - **Builder:** Dockerfile
   - **Dockerfile path:** `Dockerfile`
   - **Port:** 8080
   - **Region:** Frankfurt (fra) or Washington (was)
   - **Instance type:** Free

5. **Set environment variables (optional, defaults are fine):**
   - `PORT`: 8080
   - `ENVIRONMENT`: production
   - `CACHE_TTL`: 5m
   - `RATE_LIMIT`: 100

6. **Deploy!**

Your app will be available at: `https://<app-name>-<username>.koyeb.app`

### Option 2: Deploy via Koyeb CLI

```bash
# Install Koyeb CLI
curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | bash

# Login to Koyeb
koyeb login

# Deploy from GitHub
koyeb app create currency-converter \
  --git github.com/yourusername/co-currency \
  --git-branch main \
  --git-builder dockerfile \
  --ports 8080:http \
  --routes /:8080 \
  --regions fra \
  --instance-type free \
  --env PORT=8080 \
  --env ENVIRONMENT=production
```

### CI/CD with GitHub Actions

This repository includes GitHub Actions workflows for:
- **CI** (`.github/workflows/ci.yml`): Runs tests on every push/PR
- **Deploy** (`.github/workflows/deploy.yml`): Auto-deploys to Koyeb on push to main

To enable auto-deployment:
1. Go to your GitHub repo settings
2. Navigate to Secrets and Variables > Actions
3. Add a new secret: `KOYEB_TOKEN`
4. Get your token from: Koyeb Console > Account > API Tokens

### Verify Deployment

```bash
# Health check
curl https://your-app.koyeb.app/health

# Get rates
curl https://your-app.koyeb.app/api/v1/rates/USD

# Convert currency
curl "https://your-app.koyeb.app/api/v1/convert?from=USD&to=EUR&amount=100"
```

## Project Structure

```
├── backend/                 # Go API server
│   ├── cmd/api/            # Entry point
│   ├── internal/           # Private packages
│   │   ├── config/         # Configuration
│   │   ├── handler/        # HTTP handlers
│   │   ├── middleware/     # Middleware
│   │   ├── model/          # Data models
│   │   ├── repository/     # Data access
│   │   ├── router/         # Route setup
│   │   └── service/        # Business logic
│   └── pkg/httputil/       # HTTP utilities
├── frontend/               # React application
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # UI components
│   │   ├── hooks/         # React hooks
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utilities
│   └── public/            # Static assets
├── .github/workflows/      # CI/CD
├── Dockerfile             # Production build
├── docker-compose.yml     # Development
├── koyeb.yaml            # Koyeb config
└── Makefile              # Build commands
```

## License

MIT
