# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Go API server with `cmd/api` entry point and layered `internal/` packages (handler, service, repository, middleware, model).
- `app/`: Expo React Native app for iOS, Android, and web (`app/` routes + `src/` shared modules).
- `docs/`: architecture and API references; start here when you need deeper context.
- Root tooling: `Makefile`, `Dockerfile`, `docker-compose.yml`, and `koyeb.yaml` for build and deploy workflows.

## Build, Test, and Development Commands
- `make install`: install Go modules and app npm deps.
- `make dev`: run backend via Docker Compose.
- `make dev-backend`: run API on `:8080`.
- `make dev-app` / `make dev-web`: run Expo dev server (native) or Expo web on `:5173`.
- `make build` and `make run-local`: build/run the production Docker image locally.
- `make test` / `make lint`: run backend + app tests or linters together.
- App-only: `cd app && npm run web`, `npm run typecheck`, `npm test`.

## Coding Style & Naming Conventions
- Go uses `gofmt` defaults (tabs for indentation) and standard package naming (short, lowercase).
- TypeScript/TSX uses 2-space indentation; lint with `npm run lint` (ESLint, max-warnings=0).
- Naming: React components `PascalCase`, hooks `useX`, and tests in `*_test.go`, `*.test.ts(x)`, or Playwright `*.spec.ts`.

## Testing Guidelines
- Backend: Go `testing` package; unit tests live alongside code; E2E tests in `backend/tests/e2e`.
- App: Jest (`jest-expo`) + React Native Testing Library.
- No explicit coverage threshold is enforced; add tests for new logic and regressions.

## Commit & Pull Request Guidelines
- Commits follow a type prefix like `feat:`, `fix:`, or `debug:` with short, imperative summaries.
- PRs should include a clear description, testing performed (commands + results), and link related issues.
- For UI changes, include before/after screenshots or a short clip.

## Configuration & Secrets
- Copy `backend/.env.example` to configure local development.
- Never commit real credentials; document any new env vars in the examples.

## Automation Notes
- For agent workflows and additional command hints, see `CLAUDE.md`.
