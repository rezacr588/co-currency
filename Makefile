.PHONY: dev dev-backend dev-frontend build test lint deploy logs status run-local clean \
	ops-doctor gh-summary gh-runs koyeb-list koyeb-redeploy koyeb-logs koyeb-status \
	neon-projects neon-branches neon-cs

KOYEB_APP ?= terrible-moselle
KOYEB_SERVICE ?= co-currency
GH_REPO ?= rezacr588/co-currency

# Development
dev:
	docker-compose up

dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

# Build
build:
	docker build -t cofinance .

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-frontend:
	cd frontend && npm run build

# Test
test:
	cd backend && go test ./...
	cd frontend && npm test --if-present

test-backend:
	cd backend && go test ./...

test-frontend:
	cd frontend && npm test --if-present

# Lint
lint:
	cd backend && if ! command -v golangci-lint &> /dev/null; then go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; fi
	cd backend && golangci-lint run
	cd frontend && npm run lint

lint-backend:
	cd backend && if ! command -v golangci-lint &> /dev/null; then go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; fi
	cd backend && golangci-lint run

lint-frontend:
	cd frontend && npm run lint

# Install dependencies
install:
	cd backend && go mod download
	cd frontend && npm install

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

neon-projects:
	scripts/ops/platform-cli.sh neon-projects

neon-branches:
	scripts/ops/platform-cli.sh neon-branches

neon-cs:
	scripts/ops/platform-cli.sh neon-cs

# Local production test
run-local:
	docker build -t cofinance . && \
	docker run -p 8080:8080 -e PORT=8080 -e ENVIRONMENT=production cofinance

# Clean
clean:
	rm -rf backend/bin backend/tmp
	rm -rf frontend/dist frontend/node_modules/.vite
