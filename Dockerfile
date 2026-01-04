# ============ Stage 1: Build Frontend ============
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ============ Stage 2: Build Backend ============
FROM golang:1.22-alpine AS backend-builder

WORKDIR /app

# Install dependencies
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend static folder
COPY --from=frontend-builder /app/frontend/dist ./cmd/api/static/

# Build the binary with embedded static files
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /api ./cmd/api

# ============ Stage 3: Final Image ============
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

COPY --from=backend-builder /api /api

EXPOSE 8080

CMD ["/api"]
