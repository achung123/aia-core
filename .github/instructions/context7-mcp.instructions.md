---
description: "Use when an agent needs up-to-date library documentation, API references, code examples, or setup/configuration steps for any third-party library or framework. Covers Context7 MCP tool usage: resolve-library-id, query-docs."
---

# Context7 MCP — Library Documentation Lookup

Context7 is an MCP server that fetches **up-to-date, version-specific documentation and code examples** directly from library sources. Use it instead of relying on training data, which may be outdated or hallucinated.

## When to Use

- Looking up API surface, method signatures, or configuration options for a library
- Generating code that depends on a third-party package (FastAPI, SQLAlchemy, Pydantic, Alembic, pytest, ruff, ultralytics, etc.)
- Answering "how do I do X with library Y?" questions
- Verifying that an API or pattern still exists in the current version of a library

## Tools

Context7 exposes two MCP tools. **Always call them in order:**

### 1. `resolve-library-id`

Resolves a human-readable library name into a Context7-compatible library ID.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `libraryName` | yes | Library name to search for (e.g. `fastapi`, `sqlalchemy`, `pydantic`) |
| `query` | yes | The user's question or task — used to rank results by relevance |

Returns a list of matching libraries with their Context7 IDs (e.g. `/tiangolo/fastapi`).

### 2. `query-docs`

Retrieves documentation for a library using the resolved Context7 library ID.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `libraryId` | yes | Exact Context7 library ID from step 1 (e.g. `/tiangolo/fastapi`) |
| `query` | yes | The question or task to get relevant documentation for |

Returns relevant documentation pages and code examples.

## Workflow

```
1. Identify the library the task involves
2. Call resolve-library-id to get the Context7 library ID
3. Call query-docs with the resolved ID and your specific question
4. Use the returned docs to inform your code or answer
```

## Skip the Resolve Step

If you already know the Context7 library ID, go straight to `query-docs`:

| Library | Context7 ID |
|---------|-------------|
| FastAPI | `/tiangolo/fastapi` |
| SQLAlchemy | `/sqlalchemy/sqlalchemy` |
| Pydantic | `/pydantic/pydantic-docs` |
| Alembic | `/sqlalchemy/alembic` |
| pytest | `/pytest-dev/pytest` |
| Ultralytics (YOLO) | `/ultralytics/ultralytics` |
| Ruff | `/astral-sh/ruff` |
| uv | `/astral-sh/uv` |

## Rules

- **Prefer Context7 over training data** when writing code that uses third-party libraries — training data may reflect outdated APIs
- **Do not guess API signatures** — look them up via `query-docs` if unsure
- **Cite the library version** when the returned docs include version info
- If Context7 tools are unavailable (MCP not configured), fall back to `fetch` with the library's official documentation URL
