.PHONY: dev dev-up dev-down dev-logs dev-reset dev-backend dev-app dev-web build test lint \
	deploy logs status run-local clean \
	ops-doctor gh-summary gh-runs koyeb-list koyeb-redeploy koyeb-logs koyeb-status \
	db-backup db-restore db-list

KOYEB_APP ?= coai
KOYEB_SERVICE ?= co-currency
GH_REPO ?= rezacr588/co-currency

# ─────────────────────────────────────────────────────────────────────────────
# Local development
#
# `make dev`        boots the Docker stack (Postgres + backend + ml-service).
#                   Backend on :8080, Postgres on :5432.
# `make dev-app`    starts the Expo web dev server on :8081 — run in a second
#                   shell. Talks to the Docker backend on :8080 automatically
#                   (app/src/api/base.ts detects localhost).
# `make dev-down`   stop the Docker stack (data preserved in the postgres volume).
# `make dev-reset`  nuke the Postgres volume — useful when migrations diverge.
# ─────────────────────────────────────────────────────────────────────────────

dev: dev-up

dev-up:
	docker-compose up

dev-down:
	docker-compose down

dev-logs:
	docker-compose logs -f --tail=200

dev-reset:
	docker-compose down -v
	@echo "Postgres volume removed. Next 'make dev' starts with a fresh DB."

dev-backend:
	cd backend && go run ./cmd/api

dev-app:
	cd app && npm run start

dev-web:
	cd app && npm run web

# Build
build:
	docker build -t coai .

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-web:
	cd app && npx expo export --platform web

# Test
test:
	cd backend && go test ./...
	cd app && npm test --if-present

test-backend:
	cd backend && go test ./...

test-app:
	cd app && npm test --if-present

# Lint
lint:
	cd backend && if ! command -v golangci-lint &> /dev/null; then go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; fi
	cd backend && golangci-lint run
	cd app && npm run lint

lint-backend:
	cd backend && if ! command -v golangci-lint &> /dev/null; then go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; fi
	cd backend && golangci-lint run

lint-app:
	cd app && npm run lint

# Install dependencies
install:
	cd backend && go mod download
	cd app && npm install

# Deploy (Koyeb)
deploy:
	KOYEB_APP=$(KOYEB_APP) KOYEB_SERVICE=$(KOYEB_SERVICE) scripts/ops/platform-cli.sh koyeb-redeploy

logs:
	KOYEB_APP=$(KOYEB_APP) KOYEB_SERVICE=$(KOYEB_SERVICE) scripts/ops/platform-cli.sh koyeb-logs

status:
	KOYEB_APP=$(KOYEB_APP) KOYEB_SERVICE=$(KOYEB_SERVICE) scripts/ops/platform-cli.sh koyeb-status

koyeb-redeploy: deploy

koyeb-logs: logs

koyeb-status: status

koyeb-list:
	koyeb apps list -o table
	koyeb services list -o table

ops-doctor:
	KOYEB_APP=$(KOYEB_APP) KOYEB_SERVICE=$(KOYEB_SERVICE) GH_REPO=$(GH_REPO) scripts/ops/platform-cli.sh doctor

gh-summary:
	GH_REPO=$(GH_REPO) scripts/ops/platform-cli.sh gh-summary

gh-runs:
	GH_REPO=$(GH_REPO) scripts/ops/platform-cli.sh gh-runs

# Database backup/restore
db-backup:
	scripts/ops/db-backup.sh backup

db-restore:
	@echo "Usage: scripts/ops/db-backup.sh restore <backup-file>"

db-list:
	scripts/ops/db-backup.sh list

# Local production test
run-local:
	docker build -t coai . && \
	docker run -p 8080:8080 -e PORT=8080 -e ENVIRONMENT=production coai

# Clean
clean:
	rm -rf backend/bin backend/tmp
	rm -rf app/dist app/node_modules/.cache
