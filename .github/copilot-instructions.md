# All In Analytics Core — Copilot Baseline Instructions

These instructions apply to every agent and every Copilot interaction in this workspace.

---

## What This Project Is

**All In Analytics Core** is a Python/FastAPI backend that records and analyzes poker sessions. It ingests poker hand data (CSV or live via camera), persists it to a SQLite database via SQLAlchemy + Alembic, and exposes REST endpoints for game session management, hand recording, player stats, and search.

---

## Agent Roster

| Agent | Role | Invoke with |
|---|---|---|
| **Jean** | Project planner — turns ideas into spec, plan, and tasks | `@jean` |
| **Logan** | Beads task manager — syncs Jean's tasks into `bd` and tracks lifecycle | `@logan` |
| **Hank** | Staff SWE — TDD-first implementer, debugger, and refactorer | `@hank` |
| **Scott** | Test architect & code reviewer — traces tests to requirements, reviews quality | `@scott` |
| **Xavier** | Prompt engineer — scaffolds new agents and workflows | `@xavier` |

**Typical workflow:** `@jean plan` → `@logan sync` → `@hank implement` → `@scott review`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| Web framework | FastAPI |
| Database ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Package manager | uv (with hatchling build backend) |
| Test runner | pytest + pytest-mock |
| Linter/formatter | ruff |
| Task tracker | beads (`bd` CLI) |
| CI | GitHub Actions |

---

## Project Layout

```
src/
  app/                  # FastAPI application (importable as `app`)
    main.py             # App entry point, router registration
    database/           # SQLAlchemy models, engine, queries
    routes/             # One file per endpoint group
  pydantic_models/      # Pydantic request/response schemas
test/                   # All pytest tests (mirrors src/ structure)
specs/                  # Jean's planning artifacts (spec, plan, tasks)
alembic/                # Alembic migration environment
  versions/             # Migration scripts
.github/
  agents/               # Agent .agent.md files
  prompts/              # Task-specific .prompt.md files
  prompts/templates/    # Output templates for structured agent output
```

Both `src/app` and `src/pydantic_models` are installed as editable packages by uv — imports like `from app.database.database_models import Base` work without any PYTHONPATH manipulation.

---

## Universal Conventions

### Running Tests
```bash
uv run pytest test/          # full suite
uv run pytest test/foo.py    # single file
uv run pytest test/ -v       # verbose
```
Never use bare `python -m pytest` or `PYTHONPATH=src/`. Always use `uv run`.

### Code Style
- Ruff is enforced via pre-commit hooks — all code must pass `uv run ruff check` before committing
- Imports must be at the top of the file (E402)
- Prefer direct attribute access over `getattr(obj, 'attr')` with constant strings (B009)
- Match the formatting and type hint style of existing files

### Database
- SQLite in development: `sqlite:///./poker.db`
- In-memory SQLite in tests: `sqlite:///:memory:` with `StaticPool`
- All schema changes go through Alembic migrations — never call `Base.metadata.create_all()` in production paths
- Autogenerate migrations: `alembic revision --autogenerate -m "<description>"`

### Task Management (beads)
- All work tracks to a beads task (`bd` CLI)
- **Claim before starting:** `bd update <id> --claim`
- **Close when done:** `bd close <id> --reason "..."`
- **Never use `bd edit`** — it opens an interactive editor; use `bd update` with flags
- Use `--stdin` for descriptions that contain special characters, backticks, or quotes
- Jean task IDs (`T-NNN`) map to beads hash IDs — Logan maintains the mapping

### Git
- Commit messages include the beads ID: `git commit -m "description (bd-xxx)"`
- Never push to remote or force-push without explicit user confirmation
- Pre-commit hooks run ruff check, ruff format, and yaml/whitespace fixers — all must pass

### TDD (Hank's domain, but universal awareness)
- Tests live in `test/` and mirror the structure of `src/`
- Every new behavior gets a test — no production code without coverage
- Test files are named `test_<module>.py`
- The `conftest.py` provides an in-memory DB fixture and a FastAPI `TestClient`

---

## What Agents Should Always Do

- **Read before writing** — scan relevant files before making any edit
- **Scope changes tightly** — one task = one focused unit of work; no drive-by refactors
- **Match existing patterns** — naming, imports, error handling, and structure should be consistent with the existing codebase
- **Run tests after changes** — `uv run pytest test/` must pass before any task is closed or PR is created
- **Ask rather than assume** — if requirements or acceptance criteria are ambiguous, surface the gap

## What Agents Should Never Do

- Modify code unrelated to the current task
- Skip tests or disable pre-commit hooks (`--no-verify`)
- Drop database tables, delete branches, or push to shared remotes without user confirmation
- Use `bd edit`
- Commit broken tests
