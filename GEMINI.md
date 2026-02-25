# Co-Currency Project Context

## Project Overview
**Co-Currency** is a modern, full-stack personal finance and currency application. It features real-time exchange rates, historical data lookup, specialized handling for Iranian Rial (IRR) rates, and broader finance features. The project is a monorepo containing the backend API and a single Expo React Native client app (web + iOS + Android).

### Tech Stack
*   **Backend:** Go (Golang) 1.22+
    *   **Router:** `chi`
    *   **Architecture:** Clean Architecture (Handlers, Services, Repositories)
    *   **Key Libraries:** `zerolog` (logging), `go-cache` (in-memory caching), `pgx` (PostgreSQL driver).
*   **Client App:** Expo React Native
    *   **Targets:** Web, iOS, Android
    *   **Language:** TypeScript
    *   **Styling:** styled-components
    *   **State Management:** TanStack Query (React Query)
    *   **Testing:** Jest (`jest-expo`), React Native Testing Library
*   **Infrastructure:** Docker, Docker Compose, Koyeb (deployment target).

### Architecture
*   **Backend (`backend/`)**: Designed with separation of concerns.
    *   `cmd/api`: Entry point.
    *   `internal/handler`: HTTP request handlers.
    *   `internal/service`: Business logic (e.g., routing conversion requests between Frankfurter API and IRR crawler).
    *   `internal/repository`: Data access layer.
*   **Client App (`app/`)**: Expo Router application for web/mobile.
    *   `app/`: File-based route screens and navigation groups.
    *   `src/api`: API client configuration.
    *   `src/components`: UI components and feature-specific logic.
    *   `src/hooks`: Custom hooks for data fetching and logic.

## Building and Running

The project includes a `Makefile` to streamline common tasks.

### Prerequisites
*   Go 1.22+
*   Node.js 20+
*   Docker (optional but recommended for full stack testing)

### Key Commands

**Setup:**
```bash
make install        # Install dependencies for backend and app
```

**Development:**
```bash
make dev            # Run full stack using Docker Compose
make dev-backend    # Run Go backend locally (default port 8080)
make dev-app        # Run Expo dev server (native)
make dev-web        # Run Expo web locally (default port 5173)
```

**Testing:**
```bash
make test           # Run all tests
make test-backend   # Run backend Go tests
make test-app       # Run app Jest tests
```

**Linting:**
```bash
make lint           # Lint both projects
```

**Build:**
```bash
make build          # Build Docker image
make build-backend  # Compile Go binary
make build-web      # Export Expo web production assets
```

## Development Conventions

*   **Monorepo:** The repository houses both `backend` and `app` directories. Commands should be executed from the root using `make` where possible, or within the respective directories.
*   **Code Style:**
    *   **Go:** Follows standard Go idioms. Use `golangci-lint` for enforcement.
    *   **TypeScript/React Native:** Uses ESLint.
*   **Architecture constraints:**
    *   The backend serves the Expo web static export in production (Single Binary Deployment).
    *   New features should typically involve a vertical slice: Backend (Handler -> Service -> Repository) + App Client (Screen/Component -> Hook -> API Client).
*   **IRR Handling:** This is a key differentiator. Changes to currency conversion logic must respect the dual-API strategy (Frankfurter for global, custom crawler/DB for IRR).
