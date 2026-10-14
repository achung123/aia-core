---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
  - runInTerminal
  - terminalLastCommand
  - createFile
description: Perform a comprehensive security and infrastructure audit of a target component, module, or the entire backend.
---

# Goal

Audit the target for security vulnerabilities, infrastructure weaknesses, and compliance gaps. Produce a structured audit report with severity-classified findings, evidence, and remediation steps. File CRITICAL and HIGH findings into beads.

# Context

The project uses:
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, SQLite
- **Structure**: `backend/src/app/` (main, routes, database), `backend/src/pydantic_models/`, `backend/test/`
- **Infra**: Docker, Docker Compose, nginx reverse proxy, mDNS/DNS for local network
- **Conventions**: Type hints, dependency injection via FastAPI `Depends`, Pydantic models for request/response, SQLAlchemy ORM models
- **Linter**: Ruff (config in `ruff.toml`)
- **Issue tracker**: bd (beads) — use `bd create` to file findings
- **Security baseline**: OWASP Top 10 (2021)

# Instructions

1. **Resolve the target:**
   - **File or folder path** → Read those files directly
   - **Module name** (e.g. "routes", "database") → Locate and read all files in that module
   - **"backend"** or **"all"** → Full backend audit — read routes, models, middleware, configs, Dockerfiles, and compose files
2. **Gather context** — Read `main.py` for middleware stack and router registration. Read route files for endpoint definitions. Read database models for schema. Read Dockerfiles and `docker-compose.yml` for infra config
3. **OWASP Top 10 checklist:**
   - **A01 Broken Access Control** — Check every route for authentication/authorization. Flag unprotected endpoints, missing role checks, IDOR vulnerabilities
   - **A02 Cryptographic Failures** — Check for hardcoded secrets, weak hashing, missing TLS, plaintext sensitive data in logs or responses
   - **A03 Injection** — Check for SQL injection (raw queries, f-strings in filters), command injection, path traversal, XSS in any HTML responses
   - **A04 Insecure Design** — Check for missing rate limiting, no account lockout, predictable resource IDs, missing CSRF protection
   - **A05 Security Misconfiguration** — Check CORS policy, debug mode, default credentials, unnecessary features enabled, missing security headers
   - **A06 Vulnerable Components** — Check `pyproject.toml` and `uv.lock` for known CVE-affected versions. Run `uv run pip audit` if available
   - **A07 Authentication Failures** — Check password policies, session management, token validation, credential storage
   - **A08 Data Integrity Failures** — Check for insecure deserialization, unsigned updates, missing integrity checks
   - **A09 Logging Failures** — Check that security-relevant events are logged, sensitive data is NOT logged, log injection is prevented
   - **A10 SSRF** — Check for user-controlled URLs in server-side requests
4. **Secrets scan** — Search for API keys, passwords, tokens, and credentials in source code, config files, `.env` files, and Dockerfiles. Check `.gitignore` covers sensitive files
5. **Input validation** — For every endpoint, verify that request parameters are validated via Pydantic models, path parameters are typed, and query parameters have bounds
6. **Error handling** — Verify no stack traces, internal paths, database schema, or SQL errors leak to clients in error responses
7. **Dependency check** — Review `pyproject.toml` for dependencies with known vulnerabilities
8. **Classify findings** by severity:
   - **CRITICAL** — Actively exploitable vulnerabilities (injection, auth bypass, exposed secrets)
   - **HIGH** — Exploitable with additional conditions (missing auth on non-critical endpoint, weak crypto)
   - **MEDIUM** — Defense-in-depth gaps (missing headers, verbose errors, missing rate limiting)
   - **LOW** — Best-practice deviations (logging improvements, minor config hardening)
9. **Write the report** to `docs/agent/security/security-audit-YYYY-MM-DD.md` using the `tessa.security-audit-report.template.md` companion template
10. **File CRITICAL and HIGH findings into beads:**
    ```bash
    bd create "<finding title>" --description="<details with file, line, remediation>" -t bug -p 0 --json  # CRITICAL
    bd create "<finding title>" --description="<details with file, line, remediation>" -t bug -p 1 --json  # HIGH
    ```

# Output Format

A markdown report following `tessa.security-audit-report.template.md` placed in `docs/agent/security/`. Plus beads issues for CRITICAL and HIGH findings.

# Examples

**Input:** `@tessa audit backend`

**Output:** A security audit report containing:
- OWASP coverage matrix showing which categories were checked
- Summary: 1 CRITICAL, 3 HIGH, 7 MEDIUM, 4 LOW findings
- Finding: [CRITICAL] No authentication middleware — all endpoints are publicly accessible
- Finding: [HIGH] CORS allows all origins (`allow_origins=["*"]`) in production config
- Finding: [MEDIUM] Error responses include SQLAlchemy exception details
- Beads issues created for CRITICAL and HIGH findings

**Input:** `@tessa audit src/app/routes/`

**Output:** A scoped audit report for the routes module:
- Summary: 0 CRITICAL, 2 HIGH, 5 MEDIUM, 3 LOW findings
- Finding: [HIGH] Missing input length validation on `player_name` — no max length constraint
- Finding: [MEDIUM] `DELETE /game/{id}` has no soft-delete — cascading hard delete with no audit trail

# Anti-patterns

- Do NOT audit in isolation — always read the full middleware stack, router registration, and related modules before flagging issues
- Do NOT flag issues that are already mitigated by other layers (e.g., don't flag "no input validation" if Pydantic models handle it)
- Do NOT produce vague findings — every issue needs a specific file, line, evidence, and remediation step
- Do NOT run destructive commands or modify any files other than the report
- Do NOT log, store, or display real secrets found during the audit — redact immediately (e.g., `sk-****`)
- Do NOT skip the OWASP checklist — every category must be evaluated even if no issues are found
- Do NOT assume "no finding" means "secure" — explicitly mark categories as PASS in the coverage matrix
