---
mode: agent
tools:
  - search/codebase
  - edit/editFiles
  - edit/createFile
  - read/readFile
  - search/listDirectory
  - execute/runInTerminal
  - read/terminalLastCommand
description: Shared skill — generate, review, and validate an Alembic migration for any SQLAlchemy model change in aia-core.
---

## Goal

Produce a correct, reviewed, and test-verified Alembic migration for a SQLAlchemy model change so dev and prod databases stay in sync without using `Base.metadata.create_all()` in production paths.

---

## When to Use

- Adding, removing, or renaming a table
- Adding, removing, renaming, or retyping a column
- Adding/removing an index, unique constraint, or foreign key
- Any change to a class under `backend/src/app/database/` that alters the schema

---

## Context

- Alembic env lives at `backend/alembic/` with versions under `backend/alembic/versions/`
- Dev DB: `sqlite:///./poker.db` in `backend/`
- Tests use in-memory SQLite with `StaticPool` via `backend/test/conftest.py` — they do **not** run migrations, so models must stay in sync with the latest migration
- `backend/test/test_alembic_setup.py` verifies migrations apply cleanly

---

## Instructions

1. **Edit the SQLAlchemy model** in `backend/src/app/database/` to the new desired shape.
2. **Generate the migration** from the `backend/` directory:
   ```bash
   uv run alembic revision --autogenerate -m "<imperative description>"
   ```
3. **Review the generated file** under `backend/alembic/versions/` — autogenerate is not infallible:
   - Confirm `upgrade()` operations match the model change exactly
   - Confirm `downgrade()` reverses them correctly
   - For SQLite: column renames/type changes require `batch_alter_table` — ensure Alembic emitted it; if not, wrap operations manually
   - Remove any stray operations from unrelated models
4. **Apply the migration locally:**
   ```bash
   uv run alembic upgrade head
   ```
   Then inspect the dev DB (`poker.db`) to confirm the schema is correct.
5. **Test the full suite:** `cd backend && uv run pytest test/` — must be green. Pay attention to `test_alembic_setup.py`.
6. **If tests reference the new column/table**, follow `skill.tdd-cycle` to add coverage for the new behavior.
7. **Pre-commit gate** — `pre-commit run --all-files` must be clean.
8. **Do not commit `poker.db`** — it is a local dev artifact.

---

## Output Format

```
## Migration — <revision id> <description>

**Model changes:** src/app/database/<file>.py (<summary>)
**Migration file:** alembic/versions/<revision>_<slug>.py
**Upgrade verified:** alembic upgrade head ✅
**Suite:** X passed, 0 failed (incl. test_alembic_setup.py)
**Pre-commit:** clean
```

---

## Anti-patterns

- Hand-editing the DB schema without creating a migration
- Calling `Base.metadata.create_all()` outside the in-memory test fixture
- Committing a migration without running `alembic upgrade head` locally first
- Leaving unrelated autogenerate noise (drops of existing tables, re-ordered columns) in the migration file
- Using straight `op.alter_column` on SQLite for type changes — use `batch_alter_table`
- Editing an already-applied migration that exists on a shared branch — write a new one instead
