#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

git config core.hooksPath "$ROOT/.githooks"
chmod +x "$ROOT/.githooks/pre-push"

echo "Git hooks configured: core.hooksPath=$ROOT/.githooks"
