---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - createFile
  - editFiles
  - search
  - usages
description: Generate a full API reference for a FastAPI route file or endpoint, with optional OpenAPI 3.0 YAML.
---

## Goal

Produce an accurate, audience-complete API reference document for a FastAPI route — covering all endpoints, request/response shapes, error codes, poker-domain context, and a gap-analysis Open Questions section. Optionally emit an OpenAPI 3.0 YAML fragment.

---

## Context

**Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, SQLite.

**Domain:** Texas Hold'em poker analytics backend — game sessions, hands, players, community cards, card detection from uploaded images, stats, CSV upload.

**Card notation:** rank + suit string, e.g. `"AH"` (Ace of Hearts), `"10S"` (Ten of Spades).

**Audience:** Internal Python developers AND front-end engineers. Front-end engineers especially need accurate request/response shapes and example payloads.

---

## Instructions

1. **Resolve the target:**
   - File path (e.g., `src/app/routes/game.py`) → read that file directly
   - Endpoint path (e.g., `/game/{game_id}`) → search the codebase for a matching `@router.` decorator
   - Domain keyword (e.g., `game`) → find all route files with that domain prefix via `search`

2. **Read the route file** — extract each decorated handler: HTTP method, full path (including router prefix from the main app registration), path/query/body parameters, response model annotation, status codes, and dependencies (e.g., `Depends(get_db)`)

3. **Find the router prefix** — search `src/app/main.py` for `app.include_router` to get the prefix and tags for this router

4. **Trace each handler's call chain** — follow to service functions and/or database query functions; read the query logic to understand exactly what data is fetched, filtered, or written

5. **Read all related Pydantic schemas** — for request bodies and response models; use `usages` and `search` to find them in `src/pydantic_models/`; extract every field with its type, validators, and default

6. **Read related ORM models** to understand the underlying data structure and map ORM fields to API response fields

7. **Identify all HTTP error responses** — look for `HTTPException` raises, explicit `status_code` returns, and database error handling; include 422 from FastAPI validation as a standard entry

8. **Write poker-domain context for each endpoint** — explain WHY this endpoint exists in a poker analytics system, not just WHAT it technically does

9. **Run gap analysis:**
   - Missing error responses (handler returns `None` but no 404 raised on not-found)
   - Undocumented or implicit query parameters
   - Response fields whose poker-domain meaning is unclear from the field name alone
   - Mismatches between ORM column names and API response keys for the same concept
   - Endpoints that accept card strings without validating rank/suit notation
   - Endpoints missing expected resource-level operations (e.g., a GET-by-ID with no PUT/DELETE)

10. **Generate the Markdown doc** using `remy.api-reference.template.md`, writing to `docs/api/<route-name>.md`

11. **If `--openapi` flag is present:** also generate `docs/api/<route-name>.openapi.yaml` using `remy.openapi.template.yaml`

---

## Output Format

`docs/api/<route-name>.md` — Markdown API reference following `remy.api-reference.template.md`.  
Optionally `docs/api/<route-name>.openapi.yaml` — OpenAPI 3.0 path definitions when `--openapi` is specified.

---

## Example

**Input:** `@remy document api src/app/routes/hands.py`

**Output:** `docs/api/hands.md` containing:
- Module header: `src/app/routes/hands.py` · prefix `/hands`
- Quick-index table: all endpoints in the router
- Per-endpoint sections: request params table, response shape table, error responses table, poker context paragraph
- Open Questions: "Endpoint `POST /hands/record` accepts `community_cards` as a list with no length constraint. Texas Hold'em boards have exactly 5 cards (3 flop + 1 turn + 1 river) — should a `max_items=5` constraint be added to the Pydantic field?"

**Input:** `@remy document api src/app/routes/game.py --openapi`

**Output:** `docs/api/game.md` + `docs/api/game.openapi.yaml`

---

## Anti-patterns

- Do NOT document only the happy path — include all known error responses
- Do NOT describe request/response shapes from memory — always read the actual Pydantic models
- Do NOT invent poker context that isn't supported by the handler's actual behavior
- Do NOT generate OpenAPI YAML unless `--openapi` is explicitly specified
- Do NOT skip cross-references to related ORM models and Pydantic schemas
- Do NOT skip the router prefix lookup in `main.py` — full endpoint paths are required
