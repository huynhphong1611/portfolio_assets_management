---
name: docker_management
description: Handling Docker and Docker Compose definitions for fullstack apps.
---

# Docker Guidelines

1. **Multi-Stage Builds**: For Vite/React apps, always use a multi-stage Dockerfile:
   - Stage 1: `node:alpine` for `npm run build`
   - Stage 2: `nginx:alpine` to serve static assets from `dist`
2. **Python Containers**: Use `python:3.10-slim` to reduce image size. Create non-root users when possible.
3. **Optimization**: Create `.dockerignore` to block `node_modules`, `.git`, `.venv` from bloating the build context.
4. **Networking**: Ensure `docker-compose.yml` correctly links frontend and backend networks if running locally.
