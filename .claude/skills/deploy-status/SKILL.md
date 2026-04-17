---
name: deploy-status
description: Diagnose the current state of the production CoAI deployment — unpushed commits, latest GitHub Actions runs, Koyeb service state, and a live /health ping. Use when the user asks "what's deployed", "check the deployment", "did the last push go out", or wants to know if production is healthy.
---

# /deploy-status

Read-only diagnostic. Pulls four signals and presents them as a table the user can scan in 5 seconds.

## What to run

Run these **in parallel** (they're all independent):

1. **Unpushed commits** — `git -C /Users/rezazeraat/dev/co-currency log --oneline origin/main..main`
   - First fetch if it's been a while: `git -C /Users/rezazeraat/dev/co-currency fetch origin main --quiet`
2. **Recent CI runs** — `gh run list --limit 5 --repo rezacr588/co-currency --json status,conclusion,name,headSha,displayTitle,createdAt`
3. **Health endpoint** — `curl -s -o /dev/null -w "%{http_code} in %{time_total}s" https://coai.koyeb.app/health`
4. **Koyeb service** — `koyeb services describe coai/co-currency -o yaml 2>&1 | head -40` (skip if koyeb CLI not installed — don't error the user)

## Output shape

```
Production status (coai.koyeb.app)
──────────────────────────────────
Unpushed:  2 commits (ahead of origin/main)
             6c7625bc chore: tighten koyeb keepalive
             417e2ed7 fix: 9 bugs from review

CI:        ✓ CI success (e6a7f2c3, 3 min ago)
           ✓ Mobile Build & Update success
           
Health:    200 in 0.77s  (warm)

Koyeb:     coai/co-currency — healthy, 1 instance, last deploy 12min ago
```

## Interpretation hints to surface

- **Health >5s** → cold start; mention it.
- **Health >30s or non-200** → real problem; suggest `make logs` to investigate.
- **CI most recent = failure** → flag it prominently.
- **Unpushed commits exist** → remind the user CI hasn't run for these yet.
- **Mobile Build failed but CI passed** → the OTA may not have gone out; note the fail channel if visible.

## Don't

- Don't redeploy, don't rollback, don't tail logs unless the user asks.
- Don't make noise about the keepalive workflow — it runs every 10 min, that's expected.
- Don't suggest `make deploy` unless the user explicitly asks to redeploy.
