---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - editFiles
  - usages
description: Document the database layer — SQLAlchemy models, schema design, relationships, queries, and Alembic migrations.
---

## Goal

Produce clear, grounded documentation for the All In Analytics database layer — covering SQLAlchemy models, table schema, relationships, query patterns, and Alembic migration history. Output uses a mix of prose explanations, tabular schema representations, ER diagrams, and code references.

---

## Context

The AIA database layer:
- **ORM models:** `src/app/database/database_models.py` — SQLAlchemy 2.x declarative models
- **Engine/session:** `src/app/database/` — connection setup, session factories
- **Queries:** spread across route handlers and dedicated query modules
- **Migrations:** `alembic/versions/` — Alembic migration scripts
- **Config:** `alembic.ini`, SQLite in dev (`sqlite:///./poker.db`), in-memory for tests
- **Pydantic mirrors:** `src/pydantic_models/` — request/response schemas that map to DB models

The database tracks poker domain objects: game sessions, players, hands, community cards, hole cards, betting rounds, buy-ins, blinds, and results.

---

## Instructions

1. **Read the database models** — load `src/app/database/database_models.py` and any other files in `src/app/database/`
2. **Read Pydantic schemas** — load `src/pydantic_models/` to understand the API-facing shape of the data
3. **Read migration history** — scan `alembic/versions/` to understand schema evolution
4. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
5. **Write the document** combining:
   - **Prose:** Explain the domain model design, why tables are structured this way, key design decisions
   - **Tables:** Schema tables for each model (column, type, nullable, default, description)
   - **Mermaid ER diagram:** Show relationships between all models using `erDiagram`
   - **Mermaid state diagram:** If the target model has a lifecycle (e.g., game session states), show it
   - **Code references:** Cite exact model class names, column names, and relationship definitions
   - **Migration timeline:** Table showing migration versions, dates, and what changed
6. **Place the file** at `docs/backend/database.md` unless directed otherwise
7. **Flag unknowns** — mark anything not found in the codebase as `[TODO]`

---

## Output Format

A markdown file with:
- Metadata table (title, date, author, scope, status)
- Domain model overview (prose)
- Per-model schema tables (column | type | constraints | description)
- Mermaid ER diagram showing relationships
- Migration history table
- Query pattern examples (referencing actual code)
- Source file references

---

## Example

**Input:**
```
@kurt backend-db game session models
```

**Expected output:**
A file at `docs/backend/database-game-sessions.md` containing:
- Prose explaining the game session domain model
- Schema table for `GameSession` model (all columns, types, constraints)
- Schema table for related models (`GameHand`, `Player`, etc.)
- ER diagram: `GameSession ||--o{ GameHand`, `GameSession }o--o{ Player`, etc.
- State diagram: game session lifecycle (created → active → completed)
- Migration history: which migrations created/altered these tables
- References to `src/app/database/database_models.py`

---

## Anti-patterns

- **Never** document a column that doesn't exist in the actual model
- **Never** skip the ER diagram — database docs always need relationship visualization
- **Never** list migrations without reading the actual migration files
- **Never** omit column types or constraints from schema tables
- **Never** write a wall of prose when a table would be clearer for schema details
