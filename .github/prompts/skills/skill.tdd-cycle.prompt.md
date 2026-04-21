---
mode: agent
tools:
  - search/codebase
  - edit/editFiles
  - edit/createFile
  - read/readFile
  - execute/runInTerminal
  - read/terminalLastCommand
description: Shared skill — drive any behavioral change through a strict Red → Green → Refactor TDD cycle for the aia-core backend.
---

## Goal

Execute the canonical Red → Green → Refactor cycle for a single unit of behavior in the `aia-core` backend so the resulting code is test-covered, minimal, and regression-safe.

---

## When to Use

Invoke this skill whenever you are changing or adding Python behavior in `backend/src/`:

- New route, schema, or query
- Bug fix that changed observable behavior
- New business rule in `app/` modules

Do **not** use this skill for pure docs, diagrams, or Alembic migrations (see `skill.db-migration`).

---

## Context

- Tests live in `backend/test/` and mirror the layout of `backend/src/`
- Test files are named `test_<module>.py`
- Canonical test command (always from `backend/`): `uv run pytest test/`
- `backend/test/conftest.py` provides an in-memory SQLite DB fixture and a FastAPI `TestClient`
- Ruff + pre-commit gate every commit — code must pass `pre-commit run --all-files`

---

## Instructions

1. **Understand the target.** Read the acceptance criteria (beads task, Jean task, or inline spec) and the existing production/test files around the change site. Match existing patterns.
2. **Red — write the failing test.**
   - Add or extend a test file under `backend/test/` mirroring the source path
   - Express the behavior as concrete assertions (status codes, DB rows, response shapes)
   - Run `cd backend && uv run pytest test/<file>.py -v` and confirm it fails for the **right reason**
   - If it passes immediately, the behavior already exists — stop and report
3. **Green — minimal implementation.**
   - Write the smallest production change that makes the failing test pass
   - No speculative generalization, no unrelated edits
   - Re-run the targeted test until it passes
   - Run the full suite: `cd backend && uv run pytest test/` — zero regressions
4. **Refactor — clean up.**
   - Only refactor code touched in this cycle
   - Extract helpers, rename for clarity, remove duplication
   - Re-run the full suite after every refactor step
5. **Pre-commit gate.**
   - Run `pre-commit run --all-files`
   - Fix every reported issue and re-run until clean
6. **Report.** Summarize: files changed, tests added, suite result, any follow-ups discovered (file as `discovered-from` beads tasks if needed).

---

## Output Format

```
## TDD Cycle — <short title>

**Red:** test/<path>::<test_name> — failed as expected (<reason>)
**Green:** <N> files changed in src/app/<...>
**Refactor:** <summary or "none">
**Suite:** X passed, 0 failed
**Pre-commit:** clean
```

---

## Anti-patterns

- Writing production code before a failing test exists
- Skipping the full-suite run after Green — targeted tests alone hide regressions
- Refactoring code untouched by this cycle ("drive-by" refactors)
- Using `PYTHONPATH=src/` or bare `pytest` — always `cd backend && uv run pytest test/`
- Disabling pre-commit hooks with `--no-verify`
- Loosening an assertion to make a test pass instead of fixing the code
