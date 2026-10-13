---
mode: agent
tools: []
description: "DEPRECATED — replaced by kurt.backend-api.prompt.md which covers API routes with poker game logic context."
---

> **DEPRECATED** — This generic API prompt has been replaced by `kurt.backend-api.prompt.md`.
> Use: `@kurt backend-api <target>`

---

## Context

The AIA backend uses FastAPI with:
- **Routers:** `src/app/routes/` — one file per endpoint group
- **Pydantic schemas:** `src/pydantic_models/` — request/response models
- **Database models:** `src/app/database/database_models.py`
- **Main app:** `src/app/main.py` — router registration and middleware

FastAPI auto-generates OpenAPI specs, but Kurt produces richer human- and agent-readable documentation that includes context, diagrams, and cross-references.

---

## Instructions

1. **Identify the target** — determine which router file(s) or endpoint(s) the user wants documented
2. **Read the router file(s)** — extract all route definitions: HTTP method, path, path/query parameters, request body type, response model, status codes, and dependencies
3. **Read the Pydantic models** — load the request and response schemas from `src/pydantic_models/`, document every field with type and description
4. **Read the database models** — understand the underlying data model to explain what the API persists or retrieves
5. **Read related tests** — scan `test/` files for the endpoint to extract example payloads and edge case behaviors
6. **Read the mermaid style guide** — load `.github/prompts/templates/kurt.mermaid-style.template.md`
7. **Write the API reference** with these sections:
   - Metadata header
   - Overview (purpose of this endpoint group, who uses it)
   - Endpoints table (method, path, summary, auth)
   - Per-endpoint detail sections:
     - Description and purpose
     - Path/query parameters
     - Request body schema (table with field, type, required, description)
     - Response schema (table format)
     - Status codes and error responses
     - Example request/response (curl + JSON)
   - Mermaid sequence diagram showing the full request lifecycle (client → API → DB → response)
   - Cross-references to related routers, specs, and database models
8. **Place the file** at `docs/api/<router-slug>.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Endpoints summary table
- Per-endpoint detailed sections with schema tables
- Example curl commands and JSON responses
- At least one mermaid sequence diagram per router
- Source file references

---

## Example

**Input:**
```
@kurt api game sessions
```

**Expected output:**
A file at `docs/api/game-sessions.md` documenting all endpoints in the game session router:
- `POST /game-sessions` — create a new session
- `GET /game-sessions` — list all sessions
- `GET /game-sessions/{id}` — get session details
- `PATCH /game-sessions/{id}` — update session
- etc.
Each with full schema tables, example payloads from tests, and a sequence diagram showing create-session flow.

---

## Anti-patterns

- **Never** guess at endpoint signatures — read the router source code
- **Never** fabricate Pydantic field names or types — read the schema files
- **Never** omit status codes or error responses — document all explicitly handled cases
- **Never** skip the mermaid sequence diagram — every API doc gets at least one
- **Never** document internal/private functions — only public API endpoints
- **Never** produce example payloads that don't match the actual schema
