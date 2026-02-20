.PHONY: dev dev-backend dev-frontend build test lint deploy logs status run-local clean

# Development
dev:
	docker-compose up

dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

# Build
build:
	docker build -t currency-converter .

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
	koyeb service redeploy currency-converter/currency-converter

logs:
	koyeb service logs currency-converter/currency-converter

status:
	koyeb service describe currency-converter/currency-converter

# Local production test
run-local:
	docker build -t currency-converter . && \
	docker run -p 8080:8080 -e PORT=8080 -e ENVIRONMENT=production currency-converter

# Clean
clean:
	rm -rf backend/bin backend/tmp
	rm -rf frontend/dist frontend/node_modules/.vite
