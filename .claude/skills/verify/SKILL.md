---
name: verify
description: Run the full verification loop on the CoAI monorepo — backend build + tests, app typecheck + lint + jest — and summarize what's broken. Use before pushing to main (there is no pre-push hook anymore). Use when the user says "verify", "run checks", "pre-push check", or after making non-trivial changes.
---

# /verify

Goal: end-to-end pass on the repo in one shot, tell the user what's broken, nothing else.

## What to run

In this order. Stop on the first failure *only for build* — keep going on test/lint failures so the user sees all breakage in one pass.

1. **Backend build** — `go build -C /Users/rezazeraat/dev/co-currency/backend ./...`
2. **Backend tests** — `go test -C /Users/rezazeraat/dev/co-currency/backend -count=1 ./...`
3. **App typecheck** — `cd /Users/rezazeraat/dev/co-currency/app && npx tsc --noEmit`
4. **App lint** — `cd /Users/rezazeraat/dev/co-currency/app && npm run lint`
5. **App tests** — `cd /Users/rezazeraat/dev/co-currency/app && npm test -- --watchAll=false`

If the user mentions touching only backend or only app, skip the other side — don't run unnecessary work.

## Output shape

One line per check, `✓` or `✗`, then a summary block for failures only. No verbose logs. Example:

```
✓ backend build
✗ backend tests (1 failing: TestNewRateLimiterWithConfig_Defaults — pre-existing on main, safe to ignore)
✓ app typecheck
✓ app lint
✗ app tests (3 failing in src/context/__tests__/authQueryScope.test.ts — pre-existing on main)
```

## Known pre-existing failures on `main` — do NOT flag as regressions

These fail on `main` too. Check whether the user's branch introduces *new* failures; don't panic about these:

- **`TestNewRateLimiterWithConfig_Defaults`** in `backend/internal/middleware/ratelimit_test.go` — test expects 10-min/30-min defaults but code has 5-min/15-min. Test assertion is stale, not the code.
- **`src/context/__tests__/authQueryScope.test.ts`** — one `isAuthScopedQueryKey` assertion fails.
- **`src/context/__tests__/authCacheClear.test.ts`** — snapshot assertion.
- **`src/components/ui/__tests__/layout.test.tsx`** — layout test.

If the user's changes introduce *new* failures on top of these, that's the real signal.

## Don't

- Don't run `npm install` or `go mod download` unless the user asked — assume deps are in place.
- Don't start the dev server (`go run ./cmd/api`, `npm run web`, `expo start`).
- Don't commit or push. Verification only.
- Don't re-run a check that passed just to "double-check". Time matters.
