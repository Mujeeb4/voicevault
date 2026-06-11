# Multi-stage Dockerfile for VoiceVault (Django + Next.js)
# For Railway: Both services run in one container via supervisord

# ─────────────────────────────────────────────────────────────
# Stage 1: Build Next.js Frontend
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

ARG BACKEND_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV BACKEND_API_URL=${BACKEND_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# Copy package files first for layer caching
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2: Final Image (Python + Node runtime)
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    NEXTJS_PORT=3000

WORKDIR /app

# Install system dependencies: Node.js + postgres client + curl
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    postgresql-client \
    supervisor \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy Django backend
COPY . .

# Copy Next.js standalone build from builder stage
# standalone output: .next/standalone contains a self-contained node server
COPY --from=frontend-builder /app/frontend/.next/standalone ./nextjs/
COPY --from=frontend-builder /app/frontend/.next/static ./nextjs/.next/static/
COPY --from=frontend-builder /app/frontend/public ./nextjs/public/

# Collect Django static files
RUN python manage.py collectstatic --noinput || true

# Copy supervisord config and startup script
COPY supervisord.conf /app/supervisord.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose Django (8000) and Next.js (3000)
EXPOSE 8000 3000

# Health check on Django
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/users/health/ || exit 1

CMD ["/app/start.sh"]
