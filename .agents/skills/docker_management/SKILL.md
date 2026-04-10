---
name: docker_management
description: Comprehensive Docker and Docker Compose guidelines for fullstack applications. Covers multi-stage builds for React (Vite) and Python (FastAPI), docker-compose orchestration, networking, security hardening, health checks, volume management, and production optimization.
---

# Docker Management Skill

## Project Docker Structure

```
project/
├── Dockerfile              # Frontend (React + Vite)
├── docker-compose.yml      # Orchestration
├── .dockerignore            # Build context exclusions
├── backend/
│   └── Dockerfile           # Backend (Python FastAPI)
└── nginx/
    └── nginx.conf           # Reverse proxy config (production)
```

---

## Frontend Dockerfile — React + Vite

### Development (Hot Reload)
```dockerfile
# Dockerfile (root) — Development mode
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### Production (Multi-Stage)
```dockerfile
# Dockerfile.prod — Production build
# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

# ── Stage 2: Serve ──
FROM nginx:1.25-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Config for SPA
```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## Backend Dockerfile — Python FastAPI

### Development
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Production
```dockerfile
# backend/Dockerfile.prod
FROM python:3.11-slim AS base

# Security: create non-root user
RUN useradd -m -r appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

# Own files as non-root
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# Production: no --reload, multiple workers
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## Docker Compose

### Development
```yaml
# docker-compose.yml
version: "3.8"

services:
  # ── Frontend (React + Vite dev server) ──
  webapp:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules        # Prevent host node_modules override
    env_file:
      - .env
    environment:
      - CHOKIDAR_USEPOLLING=true  # File watch in Docker
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

  # ── Backend (Python FastAPI) ──
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./logs:/app/logs
    env_file:
      - .env
    environment:
      - VNSTOCK_API_ENABLED=${VNSTOCK_API_ENABLED:-true}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

### Production
```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  webapp:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
    depends_on:
      api:
        condition: service_healthy
    restart: always
    deploy:
      resources:
        limits:
          memory: 256M

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    expose:
      - "8000"          # Not exposed to host; accessed via nginx proxy
    env_file:
      - .env
    restart: always
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
```

---

## .dockerignore

```dockerignore
# Version control
.git
.gitignore

# Dependencies (rebuilt in container)
node_modules
__pycache__
*.pyc
.venv
venv

# Build outputs
dist
build
coverage
htmlcov
.pytest_cache

# Environment & secrets
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json
service-account*.json

# IDE
.vscode
.idea
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Documentation & agents
.agents
docs
README.md
LICENSE
*.md

# Test files
tests
*.test.*
*.spec.*
```

---

## Common Commands

### Build & Run
```bash
# Development
docker compose up --build           # Build and start all services
docker compose up -d                # Detached mode
docker compose logs -f api          # Follow API logs
docker compose logs -f webapp       # Follow frontend logs

# Production
docker compose -f docker-compose.prod.yml up --build -d

# Rebuild single service
docker compose build api
docker compose up -d api
```

### Debug & Inspect
```bash
# Shell into running container
docker compose exec api bash
docker compose exec webapp sh

# Check container health
docker compose ps
docker inspect --format='{{.State.Health.Status}}' <container_id>

# View resource usage
docker stats

# Check image sizes
docker images | grep portfolio
```

### Clean Up
```bash
# Remove stopped containers + unused images
docker compose down
docker system prune -f

# Remove volumes (⚠️ destroys data)
docker compose down -v

# Rebuild from scratch (no cache)
docker compose build --no-cache
```

---

## Networking Rules

1. **Frontend → Backend**: In development, use Vite proxy (`/api` → `http://api:8000`). In production, use Nginx reverse proxy.
2. **Backend → External APIs**: Direct outbound access (vnstock, CoinGecko). Set timeouts.
3. **Backend → Firebase**: Uses Firebase Admin SDK or REST API. Credentials via env vars.
4. **Never expose** database ports or internal service ports to the host in production.

### Vite Proxy Config (Development)
```javascript
// vite.config.js
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',  // Docker service name
        changeOrigin: true,
      },
    },
  },
});
```

---

## Environment Variable Management

### Rules
1. **Never bake secrets into Docker images** — use `env_file` or runtime injection.
2. **Use `.env` file** for local development — docker-compose reads it automatically.
3. **In production**, use Docker secrets, Kubernetes secrets, or cloud provider secret managers.
4. **Validate on startup** — backend should check required env vars exist at boot time:

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    vnstock_api_enabled: bool = True
    vnstock_api_key: str = ""
    coingecko_api_key: str = ""
    log_level: str = "INFO"

    # Firebase
    firebase_project_id: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

---

## Health Check Patterns

### Backend (FastAPI)
```python
@app.get("/health")
def health_check():
    """Comprehensive health check for Docker/orchestrator."""
    checks = {
        "api": "ok",
        "firebase": "unknown",
        "vnstock": "unknown",
    }

    # Check Firebase connectivity
    try:
        from app.services.firebase_service import db
        # Simple read test
        checks["firebase"] = "ok"
    except Exception:
        checks["firebase"] = "error"

    # Check vnstock availability
    try:
        import vnstock
        checks["vnstock"] = "ok"
    except ImportError:
        checks["vnstock"] = "unavailable"

    is_healthy = checks["api"] == "ok"
    return {"status": "healthy" if is_healthy else "degraded", "checks": checks}
```
