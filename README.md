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
- PWA support

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/currencies` | List all currencies |
| GET | `/api/v1/rates/:base` | Get latest rates |
| GET | `/api/v1/convert` | Convert currency |
| GET | `/api/v1/historical/:date` | Get historical rates |
| GET | `/health` | Health check |

## Deployment

Deploy to Koyeb:

```bash
# Via GitHub (recommended)
# 1. Push to GitHub
# 2. Connect repo in Koyeb console
# 3. Select Dockerfile builder

# Via CLI
koyeb app create currency-converter \
  --git github.com/yourusername/currency-converter \
  --git-branch main \
  --git-builder dockerfile \
  --ports 8080:http \
  --routes /:8080 \
  --regions fra \
  --instance-type free
```

## License

MIT
