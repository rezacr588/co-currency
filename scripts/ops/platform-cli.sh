#!/usr/bin/env bash

set -euo pipefail

KOYEB_APP="${KOYEB_APP:-terrible-moselle}"
KOYEB_SERVICE="${KOYEB_SERVICE:-co-currency}"
GH_REPO="${GH_REPO:-rezacr588/co-currency}"

NEON_PROJECT_ID="${NEON_PROJECT_ID:-}"
NEON_BRANCH="${NEON_BRANCH:-main}"
NEON_DATABASE="${NEON_DATABASE:-neondb}"
NEON_ROLE="${NEON_ROLE:-neondb_owner}"
NEON_API_KEY="${NEON_API_KEY:-}"

cmd="${1:-help}"
shift || true

usage() {
  cat <<'EOF'
Usage: scripts/ops/platform-cli.sh <command>

Commands:
  doctor          Check gh/koyeb/neonctl installation and auth readiness
  gh-summary      Show repo details + open pull requests
  gh-runs         Show recent GitHub Actions runs
  koyeb-status    Show Koyeb service status/details
  koyeb-logs      Tail Koyeb runtime logs
  koyeb-redeploy  Trigger Koyeb service redeploy and wait
  neon-projects   List Neon projects (requires NEON_API_KEY)
  neon-branches   List Neon branches (requires NEON_API_KEY + NEON_PROJECT_ID)
  neon-cs         Print Neon connection string (requires NEON_API_KEY + NEON_PROJECT_ID)

Environment:
  GH_REPO         GitHub repo (default: rezacr588/co-currency)
  KOYEB_APP       Koyeb app name (default: terrible-moselle)
  KOYEB_SERVICE   Koyeb service name (default: co-currency)
  NEON_API_KEY    Neon API key for non-interactive CLI usage
  NEON_PROJECT_ID Neon project id for branch/cs commands
  NEON_BRANCH     Neon branch name/id (default: main)
  NEON_DATABASE   Neon database name (default: neondb)
  NEON_ROLE       Neon role name (default: neondb_owner)
EOF
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "error: required command not found: $name" >&2
    exit 1
  fi
}

require_neon_api_key() {
  if [[ -z "$NEON_API_KEY" ]]; then
    echo "error: NEON_API_KEY is required for non-interactive Neon commands." >&2
    echo "hint: export NEON_API_KEY=... or run neonctl auth manually." >&2
    exit 1
  fi
}

require_neon_project_id() {
  if [[ -z "$NEON_PROJECT_ID" ]]; then
    echo "error: NEON_PROJECT_ID is required for this Neon command." >&2
    exit 1
  fi
}

case "$cmd" in
  help|-h|--help)
    usage
    ;;

  doctor)
    echo "== Tool Versions =="
    if command -v gh >/dev/null 2>&1; then
      printf "  %-8s %s\n" "gh" "$(gh --version | head -n 1)"
    else
      printf "  %-8s %s\n" "gh" "missing"
    fi
    if command -v koyeb >/dev/null 2>&1; then
      printf "  %-8s %s\n" "koyeb" "$(koyeb version | head -n 1)"
    else
      printf "  %-8s %s\n" "koyeb" "missing"
    fi
    if command -v neonctl >/dev/null 2>&1; then
      printf "  %-8s %s\n" "neonctl" "$(neonctl --version | head -n 1)"
    else
      printf "  %-8s %s\n" "neonctl" "missing"
    fi

    echo
    echo "== Auth Readiness =="
    if command -v gh >/dev/null 2>&1; then
      if gh auth status >/dev/null 2>&1; then
        echo "  gh       authenticated"
      else
        echo "  gh       not authenticated (run: gh auth login)"
      fi
    fi

    if command -v koyeb >/dev/null 2>&1; then
      if koyeb services list -o table >/dev/null 2>&1; then
        echo "  koyeb    authenticated"
      else
        echo "  koyeb    not authenticated or token scope issue"
      fi
    fi

    if command -v neonctl >/dev/null 2>&1; then
      if [[ -n "$NEON_API_KEY" ]]; then
        if neonctl projects list --api-key "$NEON_API_KEY" -o table >/dev/null 2>&1; then
          echo "  neonctl  authenticated (via NEON_API_KEY)"
        else
          echo "  neonctl  invalid NEON_API_KEY"
        fi
      else
        echo "  neonctl  set NEON_API_KEY for non-interactive usage"
      fi
    fi
    ;;

  gh-summary)
    require_cmd gh
    gh repo view "$GH_REPO" --json nameWithOwner,defaultBranchRef,url --jq '.nameWithOwner + " | default: " + .defaultBranchRef.name + " | " + .url'
    echo
    gh pr list -R "$GH_REPO" --state open --limit 20
    ;;

  gh-runs)
    require_cmd gh
    gh run list -R "$GH_REPO" --limit 20
    ;;

  koyeb-status)
    require_cmd koyeb
    koyeb services describe "$KOYEB_SERVICE" -a "$KOYEB_APP"
    ;;

  koyeb-logs)
    require_cmd koyeb
    koyeb services logs "$KOYEB_SERVICE" -a "$KOYEB_APP" --tail --type runtime
    ;;

  koyeb-redeploy)
    require_cmd koyeb
    koyeb services redeploy "$KOYEB_SERVICE" -a "$KOYEB_APP" --wait
    ;;

  neon-projects)
    require_cmd neonctl
    require_neon_api_key
    neonctl projects list --api-key "$NEON_API_KEY" -o table
    ;;

  neon-branches)
    require_cmd neonctl
    require_neon_api_key
    require_neon_project_id
    neonctl branches list --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID" -o table
    ;;

  neon-cs)
    require_cmd neonctl
    require_neon_api_key
    require_neon_project_id
    neonctl connection-string "$NEON_BRANCH" \
      --api-key "$NEON_API_KEY" \
      --project-id "$NEON_PROJECT_ID" \
      --database-name "$NEON_DATABASE" \
      --role-name "$NEON_ROLE"
    ;;

  *)
    echo "error: unknown command '$cmd'" >&2
    echo >&2
    usage >&2
    exit 1
    ;;
esac
