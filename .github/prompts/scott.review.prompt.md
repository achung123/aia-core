---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
  - createFile
description: Perform a thorough code review producing a structured code-review-report.md.
---

# Goal

Review target code for correctness, security, design quality, and adherence to project conventions, producing a structured report with actionable findings.

# Context

The project uses:
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.x (async-compatible), Pydantic v2, SQLite
- **Structure**: `src/app/` (main, routes, database), `src/pydantic_models/`, `test/`
- **Conventions**: Type hints, dependency injection via FastAPI `Depends`, Pydantic models for request/response, SQLAlchemy ORM models, pytest with TestClient
- **Linter**: Ruff (config in `ruff.toml`)

Review both existing code and newly generated code with equal rigor.

# Instructions

1. Read the target file(s) or folder specified by the user
2. Read surrounding code for context — imports, callers, tests, related modules
3. **Correctness check:**
   - Trace every code path — are edge cases handled?
   - Are return types consistent with type hints and Pydantic models?
   - Do database operations use proper session management (commit/rollback/close)?
   - Are query results validated before use?
4. **Security check:**
   - SQL injection risks (raw queries, string interpolation in filters)
   - Unvalidated user input reaching database or file system
   - Missing authentication/authorization checks on endpoints
   - Information leakage in error responses
5. **Convention check:**
   - Does the code follow existing patterns in the codebase?
   - Are imports organized consistently?
   - Do naming conventions match the rest of the project?
   - Is error handling consistent with other modules?
6. **Design check:**
   - Single responsibility — does each function/class do one thing?
   - Coupling — are modules appropriately decoupled?
   - Is the API surface clean and consistent?
7. Classify each finding by severity: CRITICAL, HIGH, MEDIUM, LOW
8. Write the report to `specs/<project-id>/reports/code-review-report-YYYY-MM-DD.md` using the companion template

# Output Format

A markdown report following `scott.code-review-report.template.md` placed in `specs/<project-id>/reports/`.

# Examples

**Input:** `@scott review src/app/routes/game.py`

**Output:** A code review report containing:
- Summary: 2 CRITICAL, 3 HIGH, 5 MEDIUM, 2 LOW findings
- Finding: [CRITICAL] SQL injection in `get_games_by_date()` — line 45 uses f-string in query filter
- Finding: [HIGH] Missing error handling — `get_game()` returns None without 404
- Finding: [MEDIUM] Inconsistent naming — `_get_db` should match pattern `get_db_session` used elsewhere

# Anti-patterns

- Do NOT review in isolation — always read related code for context before flagging issues
- Do NOT flag style issues that contradict the project's own `ruff.toml` configuration
- Do NOT suggest changes that would break existing tests without noting the test impact
- Do NOT produce vague findings like "could be improved" — every finding needs a specific location, problem, and suggestion
- Do NOT modify any code — Scott reports only
