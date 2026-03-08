#!/usr/bin/env bash

set -euo pipefail

KOYEB_APP="${KOYEB_APP:-terrible-moselle}"
KOYEB_SERVICE="${KOYEB_SERVICE:-co-currency}"
GH_REPO="${GH_REPO:-rezacr588/co-currency}"

cmd="${1:-help}"
shift || true

usage() {
  cat <<'EOF'
Usage: scripts/ops/platform-cli.sh <command>

Commands:
  doctor          Check gh/koyeb installation and auth readiness
  gh-summary      Show repo details + open pull requests
  gh-runs         Show recent GitHub Actions runs
  koyeb-status    Show Koyeb service status/details
  koyeb-logs      Tail Koyeb runtime logs
  koyeb-redeploy  Trigger Koyeb service redeploy and wait
  db-backup       Create a database backup
  db-restore      Restore from a backup file
  db-list         List available backups

Environment:
  GH_REPO         GitHub repo (default: rezacr588/co-currency)
  KOYEB_APP       Koyeb app name (default: terrible-moselle)
  KOYEB_SERVICE   Koyeb service name (default: co-currency)
  DATABASE_URL    PostgreSQL connection string (auto-reads from backend/.env)
  BACKUP_DIR      Backup directory (default: backups/)
EOF
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "error: required command not found: $name" >&2
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
    if command -v psql >/dev/null 2>&1; then
      printf "  %-8s %s\n" "psql" "$(psql --version | head -n 1)"
    else
      printf "  %-8s %s\n" "psql" "missing"
    fi
    if command -v pg_dump >/dev/null 2>&1; then
      printf "  %-8s %s\n" "pg_dump" "$(pg_dump --version | head -n 1)"
    else
      printf "  %-8s %s\n" "pg_dump" "missing"
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

  db-backup)
    "$(dirname "$0")/db-backup.sh" backup
    ;;

  db-restore)
    "$(dirname "$0")/db-backup.sh" restore "$@"
    ;;

  db-list)
    "$(dirname "$0")/db-backup.sh" list
    ;;

  *)
    echo "error: unknown command '$cmd'" >&2
    echo >&2
    usage >&2
    exit 1
    ;;
esac
