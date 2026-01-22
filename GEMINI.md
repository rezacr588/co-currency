# Co-Currency Project Context

## Project Overview
**Co-Currency** is a modern, full-stack currency converter application. It features real-time exchange rates, historical data lookup, and specialized handling for Iranian Rial (IRR) rates alongside standard global currencies. The project is structured as a monorepo containing both the backend API and the frontend client.

### Tech Stack
*   **Backend:** Go (Golang) 1.22+
    *   **Router:** `chi`
    *   **Architecture:** Clean Architecture (Handlers, Services, Repositories)
    *   **Key Libraries:** `zerolog` (logging), `go-cache` (in-memory caching), `pgx` (PostgreSQL driver).
*   **Frontend:** React 18
    *   **Build Tool:** Vite
    *   **Language:** TypeScript
    *   **Styling:** Tailwind CSS
    *   **State Management:** TanStack Query (React Query)
    *   **Testing:** Vitest, Playwright
*   **Infrastructure:** Docker, Docker Compose, Koyeb (deployment target).

### Architecture
*   **Backend (`backend/`)**: Designed with separation of concerns.
    *   `cmd/api`: Entry point.
    *   `internal/handler`: HTTP request handlers.
    *   `internal/service`: Business logic (e.g., routing conversion requests between Frankfurter API and IRR crawler).
    *   `internal/repository`: Data access layer.
*   **Frontend (`frontend/`)**: Component-based React application.
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
make install        # Install dependencies for both backend and frontend
```

**Development:**
```bash
make dev            # Run full stack using Docker Compose
make dev-backend    # Run Go backend locally (default port 8080)
make dev-frontend   # Run React frontend locally (default port 5173)
```

**Testing:**
```bash
make test           # Run all tests
make test-backend   # Run backend Go tests
make test-frontend  # Run frontend Vitest tests
```

**Linting:**
```bash
make lint           # Lint both projects
```

**Build:**
```bash
make build          # Build Docker image
make build-backend  # Compile Go binary
make build-frontend # Build React production assets
```

## Development Conventions

*   **Monorepo:** The repository houses both `backend` and `frontend` directories. Commands should be executed from the root using `make` where possible, or within the respective directories.
*   **Code Style:**
    *   **Go:** Follows standard Go idioms. Use `golangci-lint` for enforcement.
    *   **TypeScript/React:** Uses ESLint.
*   **Architecture constraints:**
    *   The backend serves the frontend static files in production (Single Binary Deployment).
    *   New features should typically involve a vertical slice: Backend (Handler -> Service -> Repository) + Frontend (Component -> Hook -> API Client).
*   **IRR Handling:** This is a key differentiator. Changes to currency conversion logic must respect the dual-API strategy (Frankfurter for global, custom crawler/DB for IRR).
