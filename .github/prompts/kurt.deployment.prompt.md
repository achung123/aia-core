---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - editFiles
  - fetch
description: Document deployment configuration — Docker setup, docker-compose services, CI/CD pipelines, environment configuration, and production deployment patterns.
---

## Goal

Produce clear, grounded documentation for the deployment and infrastructure layer — covering Docker configuration, docker-compose service orchestration, CI/CD pipelines, environment variables, and production deployment patterns for both backend and frontend.

---

## Context

The AIA deployment stack:
- **Docker:** `Dockerfile` (backend), `Dockerfile.gpu` (GPU variant for ML), `frontend/Dockerfile` (frontend)
- **Compose:** `docker-compose.yml` — multi-service orchestration
- **Entrypoint:** `docker-entrypoint.sh` — container startup script
- **CI/CD:** `.github/` — GitHub Actions workflows
- **Config:** `pyproject.toml`, `alembic.ini`, `frontend/vite.config.ts`
- **Environment:** environment variables for database URLs, CORS origins, model paths

The system deploys both a FastAPI backend (with optional GPU support for YOLO inference) and a React frontend, backed by SQLite in development and potentially other databases in production.

---

## Instructions

1. **Read Dockerfiles** — load `Dockerfile`, `Dockerfile.gpu`, `frontend/Dockerfile`
2. **Read docker-compose** — load `docker-compose.yml` to understand service definitions, networking, volumes
3. **Read entrypoint scripts** — load `docker-entrypoint.sh` and any startup scripts
4. **Read CI/CD config** — scan `.github/` for GitHub Actions workflows
5. **Read environment config** — search for environment variable usage across the codebase
6. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
7. **Write the document** combining:
   - **Prose:** Explain the deployment architecture, service relationships, and environment differences (dev vs. prod vs. GPU)
   - **Tables:** Service inventory (service, Dockerfile, ports, volumes, dependencies), environment variable reference (var, default, purpose, required)
   - **Mermaid flowchart:** Deployment architecture — services, networking, volume mounts, external access
   - **Mermaid sequence diagram:** Startup sequence — compose up → entrypoint → migrations → app start
   - **Code references:** Dockerfile directives, compose service definitions, entrypoint logic
   - **Commands:** Actual `docker compose` commands from the project
8. **Place the file** at `docs/deployment.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Deployment architecture overview (prose + flowchart)
- Service inventory table
- Per-service sections (Dockerfile breakdown, ports, volumes, health checks)
- Environment variable reference table
- Startup sequence diagram
- CI/CD pipeline section (if present)
- Development vs. production differences
- Source file references

---

## Example

**Input:**
```
@kurt deployment docker setup
```

**Expected output:**
A file at `docs/deployment.md` containing:
- Architecture flowchart: frontend container → backend container → SQLite volume, with optional GPU container
- Service table: frontend (port 5173), backend (port 8000), database (volume mount)
- Dockerfile breakdown: base image, dependencies, build steps, entrypoint
- Env var table: DATABASE_URL, CORS_ORIGINS, MODEL_PATH, etc.
- Startup sequence: docker-compose up → entrypoint.sh → alembic upgrade → uvicorn start
- Dev vs. prod: SQLite vs. external DB, hot-reload vs. production server, GPU vs. CPU inference

---

## Anti-patterns

- **Never** document Docker configuration without reading the actual Dockerfiles
- **Never** fabricate environment variables — search the codebase for actual usage
- **Never** skip the deployment architecture diagram — it's essential for ops understanding
- **Never** omit the startup sequence — it reveals initialization dependencies
- **Never** assume production patterns without evidence in the codebase — flag as `[TODO]`
- **Never** document CI/CD steps without reading the workflow files
