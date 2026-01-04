# ============ Stage 1: Build Frontend ============
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

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

LABEL org.opencontainers.image.source="https://github.com/rezacr588/co-currency"
LABEL org.opencontainers.image.description="Currency Converter API with React frontend"

# Add non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

RUN apk --no-cache add ca-certificates tzdata

COPY --from=backend-builder /api /api

# Use non-root user
USER appuser

# Koyeb uses PORT environment variable
ENV PORT=8080
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/api"]
