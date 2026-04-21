---
name: new-endpoint
description: Scaffold a new FastAPI endpoint end-to-end (route + Pydantic schema + DB access + test) following aia-core backend conventions. Use when a task requires adding a new REST endpoint.
---

# New Endpoint

Add a new REST endpoint to the `aia-core` backend with its request/response schemas, database access, router registration, and a pytest test — all matching the conventions already used in `backend/src/app/routes/`.

## When to use

- A task requires exposing new data or behavior over HTTP
- You are adding a sibling endpoint to an existing router (e.g. a new action on games, hands, or players)

Do **not** use this skill for schema-only changes (update the Pydantic model in place) or for DB-only changes (use the `db-migration` skill).

## Context

- Routers live in `backend/src/app/routes/` — one file per endpoint group
- Pydantic schemas live in `backend/src/pydantic_models/` (installed as an editable package)
- DB models + query helpers live in `backend/src/app/database/`
- Routers are registered in `backend/src/app/main.py`
- Tests live in `backend/test/` named `test_<feature>_api.py` and use the `TestClient` + in-memory DB fixture from `conftest.py`

## Instructions

1. **Locate the right router.** Scan `backend/src/app/routes/` for an existing file matching the resource. If none fits, create `routes/<resource>.py` with an `APIRouter(prefix="/<resource>", tags=["<resource>"])`.
2. **Define request/response schemas** in `backend/src/pydantic_models/` — reuse existing models where possible; add new ones with Pydantic v2 syntax matching neighbors.
3. **Follow the `tdd-cycle` skill.** Before writing the handler, add a `test_<feature>_api.py` under `backend/test/` that exercises the new endpoint through `TestClient`. Assert status code, response shape, and any DB side effects. Confirm Red.
4. **Implement the handler.**
   - Inject the DB session via the existing dependency (`Depends(get_db)` or project equivalent)
   - Delegate persistence to helpers in `app/database/` — routes stay thin
   - Return a response model, never a raw dict, unless the resource conventions differ
5. **Register the router** in `backend/src/app/main.py` if the file was newly created (`app.include_router(...)`).
6. **Green the test**, run the full suite (`cd backend && uv run pytest test/`), then refactor per the `tdd-cycle` skill.
7. **If the request touches new DB columns or tables** → stop and run the `db-migration` skill first.
8. **Pre-commit gate** — `pre-commit run --all-files` must be clean.

## Output format

```
## New Endpoint — <METHOD> /<path>

**Router:** src/app/routes/<file>.py
**Schemas:** src/pydantic_models/<file>.py (added: <Request>, <Response>)
**DB helpers:** src/app/database/<file>.py (added: <function>)
**Test:** test/test_<feature>_api.py::<test_name>
**Suite:** X passed, 0 failed
**Pre-commit:** clean
```

## Anti-patterns

- Returning raw dicts instead of response models (breaks OpenAPI schema)
- Putting SQLAlchemy queries directly in the route function — they belong in `app/database/`
- Calling `Base.metadata.create_all()` anywhere in the production path — schema changes go through Alembic
- Forgetting to register the router in `main.py`
- Skipping the `TestClient`-based test — unit tests on the handler function alone do not count
- Introducing new dependencies without matching existing patterns for auth, validation, and error handling
