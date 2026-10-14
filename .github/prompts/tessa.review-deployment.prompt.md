---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - runInTerminal
  - terminalLastCommand
  - createFile
description: Review Docker, nginx, DNS, TLS, and deployment configurations for security and best practices.
---

# Goal

Review the project's deployment infrastructure — Docker images, Docker Compose, nginx configuration, DNS/mDNS setup, TLS certificates, environment variable handling, and network policies — for security misconfigurations and hardening opportunities. Produce a structured deployment review report with findings and remediation.

# Context

The project uses:
- **Docker**: `backend/Dockerfile` (CPU), `backend/Dockerfile.gpu` (GPU), `frontend/Dockerfile`
- **Orchestration**: `docker-compose.yml` at project root
- **Reverse proxy**: nginx (configured via `npm_data/nginx/`)
- **DNS**: mDNS / local network DNS (see `docs/local-network-setup.md`)
- **Scripts**: `scripts/docker/` contains entry points and sharing scripts
- **Environment**: `.env` files, Docker build args, compose environment blocks
- **Issue tracker**: bd (beads) — use `bd create` to file findings

# Instructions

1. **Resolve the target:**
   - **Specific file** (e.g. `Dockerfile`) → Review that file in context
   - **"docker"** → Review all Dockerfiles and docker-compose.yml
   - **"nginx"** → Review nginx configuration files
   - **"all"** or **"deployment"** → Full infrastructure review
2. **Dockerfile review** — For each Dockerfile, check:
   - Base image: Is it pinned to a specific digest or version? Is it from a trusted source?
   - User: Does the container run as non-root? Is a dedicated user created?
   - Layers: Are secrets passed via build args or copied into layers? Are multi-stage builds used to minimize attack surface?
   - Packages: Are only necessary packages installed? Are package lists cleaned up?
   - Ports: Are only required ports exposed?
   - Health checks: Is a `HEALTHCHECK` instruction present?
   - `.dockerignore`: Does it exclude secrets, `.env`, `.git`, `__pycache__`, and test files?
3. **Docker Compose review** — Check:
   - Network segmentation: Are services on appropriate networks? Is the database exposed externally?
   - Volume mounts: Are bind mounts read-only where possible? Are sensitive paths mounted?
   - Environment variables: Are secrets passed via `env_file` or hardcoded in the compose file?
   - Restart policies: Are they appropriate (no `restart: always` for one-shot containers)?
   - Resource limits: Are CPU/memory limits set to prevent resource exhaustion?
   - Dependency ordering: Are `depends_on` with health checks configured?
4. **Nginx review** — Check:
   - TLS: Is TLS 1.2+ enforced? Are strong cipher suites configured? Is HSTS enabled?
   - Proxy headers: Are `X-Forwarded-For`, `X-Real-IP`, and `Host` headers set correctly?
   - Rate limiting: Are rate limit zones configured for API endpoints?
   - Access control: Are admin endpoints restricted by IP or auth?
   - Error pages: Do custom error pages avoid leaking server information?
   - Timeouts: Are proxy timeouts configured to prevent slowloris attacks?
   - Logging: Are access and error logs configured and rotated?
5. **DNS/Network review** — Check:
   - mDNS configuration for local network discovery
   - DNS records point to correct services
   - No internal service names or IPs leaked in public-facing configs
   - Inter-service communication uses internal Docker networks, not exposed ports
6. **Secrets management** — Check:
   - No secrets in Dockerfiles, compose files, or checked-in configs
   - `.env` files are in `.gitignore`
   - Docker secrets or environment-based injection is used for sensitive values
   - No default passwords or API keys in any configuration
7. **Classify findings** by severity:
   - **CRITICAL** — Exposed secrets, running as root with host network, missing TLS on public endpoints
   - **HIGH** — Database exposed externally, missing network segmentation, weak TLS config
   - **MEDIUM** — Missing health checks, no resource limits, verbose error pages
   - **LOW** — Unpinned base images, missing `.dockerignore` entries, cosmetic config improvements
8. **Write the report** to `docs/agent/security/deployment-review-YYYY-MM-DD.md` using the `tessa.deployment-review.template.md` companion template
9. **File CRITICAL and HIGH findings into beads:**
   ```bash
   bd create "<finding title>" --description="<details with file, line, remediation>" -t bug -p 0 --json  # CRITICAL
   bd create "<finding title>" --description="<details with file, line, remediation>" -t bug -p 1 --json  # HIGH
   ```

# Output Format

A markdown report following `tessa.deployment-review.template.md` placed in `docs/agent/security/`. Plus beads issues for CRITICAL and HIGH findings.

# Examples

**Input:** `@tessa review-deployment docker`

**Output:** A deployment review report containing:
- Scope: `backend/Dockerfile`, `backend/Dockerfile.gpu`, `frontend/Dockerfile`, `docker-compose.yml`
- Summary: 1 CRITICAL, 2 HIGH, 4 MEDIUM, 3 LOW findings
- Finding: [CRITICAL] Backend Dockerfile runs as root — no `USER` instruction after installing dependencies
- Finding: [HIGH] `docker-compose.yml` exposes SQLite database volume with write access to all services
- Finding: [MEDIUM] Base image `python:3.12` is not pinned to a specific digest — supply chain risk

**Input:** `@tessa review-deployment nginx`

**Output:** A deployment review report containing:
- Scope: `npm_data/nginx/` configuration files
- Summary: 0 CRITICAL, 1 HIGH, 3 MEDIUM, 2 LOW
- Finding: [HIGH] TLS 1.0 and 1.1 not explicitly disabled — vulnerable to POODLE/BEAST
- Finding: [MEDIUM] Missing `X-Content-Type-Options: nosniff` header

# Anti-patterns

- Do NOT modify any configuration files — Tessa reviews and reports, she does not change configs
- Do NOT assume Docker defaults are secure — explicitly check every layer
- Do NOT skip checking `.env` and environment variable handling — this is where secrets most often leak
- Do NOT flag issues that are intentionally configured for development (e.g., `DEBUG=true` in a dev-only compose override) without noting the context
- Do NOT produce findings without remediation — every issue must include a specific fix
- Do NOT check only the happy path — verify error handling, edge cases, and failure modes in configs
