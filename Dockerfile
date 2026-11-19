# Multi-stage Dockerfile for ScribeBA / KAFKON AIOps Platform

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Unified Production Runtime
FROM python:3.12-slim AS runner

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy backend source, skills catalogs, and assets
COPY backend/ ./backend/
COPY skills/ ./skills/
COPY demo/ ./demo/
COPY .env.example ./.env.example

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose HTTP port
EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
# Container deployments are public by default and must supply the two auth secrets.
ENV SCRIBEBA_PUBLIC_MODE=true

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-8000}/api/health" || exit 1

# Launch production server
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 4 --timeout 120 backend.api:app"]
