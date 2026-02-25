# Backend Architecture

## Overview

The CoFinance backend is built with Go, following clean architecture principles with clear separation of concerns. It provides a REST API for currency conversion, exchange rates, and serves the Expo web app as static files.

## Technology Stack

- **Language**: Go 1.21+
- **Router**: [Chi](https://github.com/go-chi/chi) - Lightweight, idiomatic HTTP router
- **Logging**: [Zerolog](https://github.com/rs/zerolog) - High-performance structured logging
- **Caching**: [go-cache](https://github.com/patrickmn/go-cache) - In-memory cache with TTL
- **Configuration**: [env](https://github.com/caarlos0/env) - Environment variable parsing

## Directory Structure

```
backend/
├── cmd/
│   └── api/
│       └── main.go              # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── handler/
│   │   ├── handler.go           # Handler struct and constructor
│   │   ├── convert.go           # Currency conversion endpoint
│   │   ├── rates.go             # Exchange rates endpoint
│   │   ├── currencies.go        # Available currencies endpoint
│   │   ├── historical.go        # Historical rates endpoint
│   │   └── health.go            # Health check endpoint
│   ├── middleware/
│   │   ├── cors.go              # CORS middleware
│   │   ├── logging.go           # Request logging middleware
│   │   └── ratelimit.go         # Rate limiting middleware
│   ├── model/
│   │   ├── currency.go          # Currency model and metadata
│   │   ├── rate.go              # Rate and rates response models
│   │   └── conversion.go        # Conversion result model
│   ├── repository/
│   │   ├── cache.go             # Cache interface and implementation
│   │   ├── frankfurter.go       # Frankfurter API client
│   │   └── irr.go               # Iranian Rial API client
│   ├── router/
│   │   └── router.go            # Route definitions
│   └── service/
│       └── exchange.go          # Business logic layer
└── pkg/
    └── httputil/
        ├── response.go          # HTTP response helpers
        └── errors.go            # HTTP error helpers
```

## Architecture Layers

### 1. Entry Point (`cmd/api/main.go`)

The main function orchestrates dependency injection and server startup:

```
┌─────────────────────────────────────────────────────────┐
│                        main.go                          │
├─────────────────────────────────────────────────────────┤
│  1. Load configuration from environment                 │
│  2. Setup logging (zerolog)                             │
│  3. Initialize dependencies:                            │
│     - InMemoryCache                                     │
│     - FrankfurterClient                                 │
│     - IRRClient (auto-initialized in ExchangeService)   │
│     - ExchangeService                                   │
│     - Handler                                           │
│     - RateLimiter                                       │
│  4. Create router with middleware                       │
│  5. Serve static web app files (embedded)               │
│  6. Start HTTP server                                   │
└─────────────────────────────────────────────────────────┘
```

### 2. Configuration (`internal/config`)

Environment-based configuration with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `ENVIRONMENT` | `development` | Environment mode |
| `CACHE_TTL` | `5m` | Cache time-to-live |
| `RATE_LIMIT` | `100` | Requests per minute |
| `FRANKFURTER_URL` | `https://api.frankfurter.app` | Frankfurter API base URL |

### 3. Router (`internal/router`)

Route definitions using Chi router:

```
GET  /health                  → Health check (no rate limit)
GET  /api/v1/currencies       → List available currencies
GET  /api/v1/rates/{base}     → Get exchange rates for base currency
GET  /api/v1/convert          → Convert amount between currencies
GET  /api/v1/historical/{date}→ Get historical rates for a date
GET  /*                       → Serve static web app files (SPA)
```

### 4. Middleware (`internal/middleware`)

#### CORS Middleware
- Allows all origins (`*`)
- Supports GET, POST, PUT, DELETE, OPTIONS
- Handles preflight requests

#### Logging Middleware
- Logs every request with method, path, status, and duration
- Uses zerolog for structured logging

#### Rate Limiter
- Token bucket algorithm
- Configurable requests per minute
- Per-IP rate limiting
- Returns `429 Too Many Requests` when exceeded

### 5. Handlers (`internal/handler`)

HTTP handlers that parse requests and return responses:

```go
type Handler struct {
    exchange *service.ExchangeService
}
```

Each handler:
1. Parses request parameters
2. Validates input
3. Calls service layer
4. Returns JSON response

### 6. Service Layer (`internal/service`)

Business logic layer that coordinates between repositories:

```go
type ExchangeService struct {
    client    *repository.FrankfurterClient  // Major currencies
    irrClient *repository.IRRClient          // Iranian Rial
    cache     repository.Cache               // Response caching
    config    *config.Config
}
```

#### Dual-API Conversion Logic

```
┌─────────────────────────────────────────────────────────┐
│                   Convert(from, to, amount)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Is IRR involved? ──────────────────────────────────┐  │
│         │                                            │  │
│         ▼ NO                                    YES ▼  │
│   ┌─────────────┐                         ┌───────────┐│
│   │ Frankfurter │                         │convertWith││
│   │    API      │                         │   IRR()   ││
│   └─────────────┘                         └───────────┘│
│                                                  │      │
│                          ┌───────────────────────┴────┐ │
│                          │                            │ │
│                     FROM IRR              TO IRR      │ │
│                          │                   │        │ │
│                     ┌────┴────┐         ┌────┴────┐   │ │
│                     │         │         │         │   │ │
│              USD/EUR/GBP   Other   USD/EUR/GBP  Other │ │
│                     │         │         │         │   │ │
│              Direct IRR  IRR→USD→X  Direct IRR X→USD→IRR│
│              Client      Bridge     Client     Bridge │ │
│                                                        │ │
└────────────────────────────────────────────────────────┘
```

### 7. Repository Layer (`internal/repository`)

#### FrankfurterClient
- Fetches exchange rates from Frankfurter API
- Supports latest rates, historical rates, and conversion
- 10-second timeout per request

#### IRRClient
- Fetches Iranian Rial rates from Bonbast API wrapper
- 5-minute internal cache
- Fallback rates if API fails
- Supports USD, EUR, GBP ↔ IRR conversions

#### Cache Interface
```go
type Cache interface {
    Get(key string) (interface{}, bool)
    Set(key string, value interface{}, ttl time.Duration)
    Delete(key string)
}
```

### 8. Models (`internal/model`)

#### Currency
```go
type Currency struct {
    Code     string `json:"code"`
    Name     string `json:"name"`
    Symbol   string `json:"symbol"`
    Priority int    `json:"priority"`  // Sort order
}
```

#### Rate
```go
type Rate struct {
    Code   string  `json:"code"`
    Name   string  `json:"name"`
    Rate   float64 `json:"rate"`
    Change float64 `json:"change,omitempty"`
}
```

#### ConversionResult
```go
type ConversionResult struct {
    From      string    `json:"from"`
    To        string    `json:"to"`
    Amount    float64   `json:"amount"`
    Result    float64   `json:"result"`
    Rate      float64   `json:"rate"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

## Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Router  │────▶│ Handler  │────▶│ Service  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │
                      ▼                                  ▼
                ┌──────────┐                      ┌──────────┐
                │Middleware│                      │Repository│
                │  Stack   │                      │  Layer   │
                └──────────┘                      └──────────┘
                      │                                  │
                      │                           ┌──────┴──────┐
                      │                           ▼             ▼
                      │                    ┌──────────┐  ┌──────────┐
                      │                    │  Cache   │  │ External │
                      │                    │          │  │   APIs   │
                      │                    └──────────┘  └──────────┘
                      │
                      ▼
                ┌──────────┐
                │  Static  │
                │  Files   │
                └──────────┘
```

## Caching Strategy

| Data Type | Cache Key Pattern | TTL |
|-----------|-------------------|-----|
| Latest Rates | `rates:latest:{base}` | 5 minutes |
| Historical Rates | `rates:historical:{date}:{base}` | 1 hour |
| Currencies | `currencies:all` | 1 hour |
| IRR Rates | Internal to IRRClient | 5 minutes |

## Error Handling

The `pkg/httputil` package provides consistent error responses:

```go
// 400 Bad Request
httputil.BadRequest(w, "Missing required parameters")

// 404 Not Found
httputil.NotFound(w, "Currency not found")

// 500 Internal Server Error
httputil.InternalServerError(w, "Failed to fetch rates")

// 429 Too Many Requests
httputil.TooManyRequests(w, "Rate limit exceeded")
```

## Static File Serving

The web app is embedded into the binary using Go's `embed` package:

```go
//go:embed static/*
var staticFiles embed.FS
```

This allows single-binary deployment with both API and web app.

## Security Features

1. **Rate Limiting**: Prevents API abuse (100 req/min default)
2. **CORS**: Configured for cross-origin requests
3. **Input Validation**: All handlers validate input parameters
4. **No Secrets in Code**: All sensitive config via environment variables

## Performance Optimizations

1. **In-Memory Caching**: Reduces external API calls
2. **Connection Pooling**: HTTP client reuses connections
3. **Structured Logging**: Zerolog is zero-allocation
4. **Static Embedding**: No filesystem I/O for web app files
