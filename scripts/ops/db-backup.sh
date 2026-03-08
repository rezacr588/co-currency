#!/usr/bin/env bash
set -euo pipefail

# Database backup script for CoFinance
# Usage: scripts/ops/db-backup.sh [backup|restore|list]
#
# Environment:
#   DATABASE_URL  - PostgreSQL connection string (reads from backend/.env if not set)
#   BACKUP_DIR    - Directory for backups (default: backups/)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

# Always load DATABASE_URL from backend/.env (override shell env to avoid stale values)
ENV_FILE="$PROJECT_ROOT/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  _env_url=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2-)
  if [[ -n "$_env_url" ]]; then
    DATABASE_URL="$_env_url"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL not set. Set it in backend/.env" >&2
  exit 1
fi

# Prefer latest pg_dump/psql (macOS: libpq from Homebrew has latest)
for dir in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
  if [[ -x "$dir/pg_dump" ]]; then
    export PATH="$dir:$PATH"
    break
  fi
done

cmd="${1:-help}"
shift || true

case "$cmd" in
  help|-h|--help)
    cat <<'EOF'
Usage: scripts/ops/db-backup.sh <command>

Commands:
  backup          Create a new database backup
  restore <file>  Restore from a backup file (.sql or .sql.gz)
  list            List available backups

Environment:
  DATABASE_URL    PostgreSQL connection string (auto-reads from backend/.env)
  BACKUP_DIR      Backup directory (default: backups/)
EOF
    ;;

  backup)
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

    echo "Creating backup..."
    pg_dump "$DATABASE_URL" --no-owner --no-privileges --clean --if-exists | gzip > "$BACKUP_FILE"

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

    # Keep only last 10 local backups
    ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +11 | while read -r old; do
      echo "Removing old backup: $old"
      rm -f "$old"
    done
    ;;

  restore)
    RESTORE_FILE="${1:-}"
    if [[ -z "$RESTORE_FILE" ]]; then
      echo "error: specify a backup file to restore" >&2
      echo "usage: scripts/ops/db-backup.sh restore <file>" >&2
      exit 1
    fi

    if [[ ! -f "$RESTORE_FILE" ]]; then
      # Try relative to BACKUP_DIR
      if [[ -f "$BACKUP_DIR/$RESTORE_FILE" ]]; then
        RESTORE_FILE="$BACKUP_DIR/$RESTORE_FILE"
      else
        echo "error: file not found: $RESTORE_FILE" >&2
        exit 1
      fi
    fi

    echo "WARNING: This will overwrite the current database!"
    read -rp "Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Aborted."
      exit 0
    fi

    echo "Restoring from: $RESTORE_FILE"
    if [[ "$RESTORE_FILE" == *.gz ]]; then
      gunzip -c "$RESTORE_FILE" | psql "$DATABASE_URL" --single-transaction
    else
      psql "$DATABASE_URL" --single-transaction < "$RESTORE_FILE"
    fi
    echo "Restore complete."
    ;;

  list)
    if [[ ! -d "$BACKUP_DIR" ]]; then
      echo "No backups found. Run 'scripts/ops/db-backup.sh backup' first."
      exit 0
    fi

    echo "Available backups in $BACKUP_DIR:"
    ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'  || echo "  (none)"
    ;;

  *)
    echo "error: unknown command '$cmd'" >&2
    exit 1
    ;;
esac
