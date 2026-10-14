---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
  - createFile
  - fetch
description: Design an authentication and authorization architecture for a given requirement.
---

# Goal

Design a complete authentication and/or authorization system for the given requirement. Produce an auth design document that covers token strategy, credential storage, role/permission model, middleware integration, and implementation guidance — ready for Jean to plan and Hank to build.

# Context

The project uses:
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, SQLite
- **Structure**: `backend/src/app/` (main, routes, database), `backend/src/pydantic_models/`, `backend/test/`
- **Infra**: Docker, Docker Compose, nginx reverse proxy
- **Conventions**: Type hints, dependency injection via FastAPI `Depends`, Pydantic models for request/response
- **Current state**: The project may or may not already have authentication — always check first

# Instructions

1. **Understand the requirement** — Parse what the user is asking for: full auth system, API key protection, role-based access, OAuth integration, or a specific auth feature
2. **Survey existing auth** — Search the codebase for:
   - Existing auth middleware, dependencies, or decorators
   - User/account models in `database/database_models.py`
   - Login/signup routes
   - Token generation or validation logic
   - Environment variables related to secrets, JWT, or OAuth
   - Any `Depends()` chains that check credentials
3. **Survey the API surface** — List all routes and classify them:
   - **Public** — no auth needed (health check, public read endpoints)
   - **Authenticated** — requires a valid session/token
   - **Authorized** — requires a specific role or permission
4. **Design the auth architecture:**
   - **Identity model** — User table schema, unique identifiers, profile fields
   - **Credential storage** — Password hashing algorithm (bcrypt or argon2), salt strategy, migration path for existing users
   - **Token strategy** — JWT vs opaque tokens vs session cookies; access token lifetime, refresh token rotation, token revocation
   - **Session management** — Storage backend, session lifetime, concurrent session policy, logout/invalidation
   - **Role/permission model** — RBAC or ABAC; role definitions, permission granularity, default roles
   - **Middleware integration** — Where in the FastAPI middleware/dependency chain auth checks are placed; `Depends()` hierarchy
   - **Endpoint protection** — Which endpoints need which level of protection; decorator/dependency patterns
   - **Secure defaults** — Fail-closed (deny by default), secure cookie flags, HTTPS-only tokens
5. **Address edge cases:**
   - Password reset flow
   - Account lockout after failed attempts
   - Token refresh race conditions
   - Session fixation prevention
   - CSRF protection for cookie-based auth
   - Multi-device session management
6. **Write the design document** to `docs/agent/security/auth-design-YYYY-MM-DD.md` using the `tessa.auth-design.template.md` companion template
7. **Summarize** integration points and recommended implementation order so Jean can turn this into tasks

# Output Format

A markdown design document following `tessa.auth-design.template.md` placed in `docs/agent/security/`.

# Examples

**Input:** `@tessa design-auth JWT-based API authentication for the poker backend`

**Output:** An auth design document containing:
- Token strategy: Short-lived JWT access tokens (15min) + rotating refresh tokens (7d)
- Identity model: `User` table with `id`, `email`, `password_hash`, `role`, `created_at`
- Password storage: argon2id with recommended parameters
- Middleware: `get_current_user` dependency using `Depends(oauth2_scheme)`
- Endpoint classification: 4 public, 12 authenticated, 3 admin-only
- Implementation order: 1) User model + migration, 2) Auth routes, 3) Token middleware, 4) Protect endpoints

**Input:** `@tessa design-auth role-based access control for admin vs player`

**Output:** An auth design document containing:
- Role model: `admin`, `player`, `spectator` roles with permission matrix
- Permission granularity: endpoint-level with optional resource-level for game ownership
- Implementation: `require_role()` dependency that checks `current_user.role`
- Migration path: default all existing records to `player` role

# Anti-patterns

- Do NOT design in a vacuum — always survey the existing codebase first to understand what's already there
- Do NOT recommend deprecated or weak cryptographic algorithms (MD5, SHA1 for passwords, HS256 with shared secrets for multi-service)
- Do NOT store tokens or sessions in the database without considering cleanup/expiration strategies
- Do NOT design auth that requires the frontend to store tokens insecurely (localStorage for JWTs with sensitive claims)
- Do NOT skip edge cases like token refresh, session fixation, or account lockout
- Do NOT recommend overly complex solutions when simpler ones suffice — match complexity to the project's scale
- Do NOT implement code — Tessa designs, she does not build
