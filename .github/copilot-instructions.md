# GitHub Copilot Instructions for CoAI

> **Canonical reference: [`CLAUDE.md`](../CLAUDE.md)** — architecture, conventions, workflows, and gotchas live there. This file is a short orientation for GitHub Copilot / coding agents and highlights only Copilot-relevant notes.

## What this repo is

CoAI: Go 1.24 backend (Chi router, pgx/pgxpool, JWT, embedded migrations) plus a single Expo ~54 / React Native 0.81 client app targeting web, iOS, and Android. Deployed as one Docker image on Koyeb with the Expo web export embedded in the Go binary.

## Commands Copilot tends to reach for

```bash
# Dependencies
make install                         # Go modules + npm deps

# Dev servers
make dev-backend                     # API on :8080
make dev-web                         # Expo web on :5173
make dev-app                         # Expo native dev server

# Tests / checks
make test                            # backend + app
cd backend && go test -v -run TestName ./internal/service  # single Go test
cd app && npx tsc --noEmit           # TypeScript check
cd app && npm run lint               # ESLint (max-warnings=0)
cd app && npm test                   # Jest

# Build / deploy
make build                           # Docker image
make deploy / make logs / make status  # Koyeb
```

`git push` alone is correct — there is **no pre-push hook** (removed 2026-04-18). CI handles Docker build + Koyeb deploy + EAS OTA. Don't reach for `SKIP_DEPLOY=1`.

## Things Copilot gets wrong without guidance

- **i18n**: any new string needs keys added to all four of `app/src/i18n/{en,fa,ar,tr}.ts`. Sub-components must call `useLanguage()` themselves — you can't thread `t` through props.
- **Monetary fields on the wire** are currently `float64` / JSON numbers. `shopspring/decimal` + pgx codec are already wired at the DB layer for a future migration; don't remove them, but also don't flip individual model fields piecemeal.
- **OAuth tokens, web**: delivered via `postMessage` from a backend-served HTML page (see `backend/internal/handler/oauth.go`). Don't revert to URL fragments.
- **WebSocket auth, web**: client calls `POST /api/v1/auth/ws-ticket` first, then connects with `?ticket=…`. Native keeps the `Authorization: Bearer` header. The legacy `?token=` query param is a transitional fallback only.
- **`Alert.alert` onPress with async work**: wrap in `async () => { try { await op(); } catch { showError(); } }`. Fire-and-forget `void` swallows errors.
- **Nested iOS modals**: use sibling `<Fragment>`, not children of the outer `<Modal>`. Otherwise z-order breaks on iOS.

## Key database tables (for query-writing Copilot)

- `users` — accounts + OAuth state
- `wallet_balances` — multi-currency, composite PK `(user_id, currency)`
- `transactions` — credit / debit / convert, with AI extraction metadata
- `categories`, `budgets`, `goals`, `recurring_transactions`
- `chat_conversations`, `chat_messages`, `user_memories` (AI memory)
- `tasks`, `task_subtasks` (planner), `notes`, `subscriptions`, `loans`
- `badges`, `user_badges`, `challenges`, `user_challenges` (gamification)

Pagination defaults: handler limit 50, max 500; repository max 10,000. Response includes `limit`, `offset`, `total`.

## Path aliases

- Backend: no alias; use module path `github.com/rezacr588/currency-converter/...`
- App: `@/*` → app root (see `tsconfig.json`). Example: `import { api } from '@/src/api'`.

## More detail

See [`CLAUDE.md`](../CLAUDE.md) for the full architecture, middleware order, offline planner sync, hook guidelines, and rollout notes.
