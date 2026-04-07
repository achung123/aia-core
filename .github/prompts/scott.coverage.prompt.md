---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - runInTerminal
  - terminalLastCommand
description: Run coverage analysis, identify untested code paths and logic gaps, and produce a coverage report.
---

# Goal

Execute test coverage analysis, identify untested code paths, classify gaps by risk, and produce a report with prioritized recommendations for closing coverage holes.

# Context

The project uses:
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, SQLite, pytest
- **Test command**: `PYTHONPATH=src/ pytest test/ --cov=app --cov-report=term-missing --cov-report=json`
- **Test location**: `test/` directory
- **Source location**: `src/app/`

Coverage percentage is a starting point, not the goal. The real value is identifying *which* untested paths carry the most risk.

# Instructions

1. Run `PYTHONPATH=src/ pytest test/ --cov=app --cov-report=term-missing --cov-report=json` to collect coverage data
2. Parse the terminal output and/or `coverage.json` for:
   - Per-file line coverage percentage
   - Specific uncovered line ranges per file
3. For each file with < 80% coverage or significant uncovered ranges:
   - Read the source code at the uncovered lines
   - Classify each uncovered block:
     - **Untested error path** — exception handlers, validation failures, edge cases
     - **Untested branch** — conditional logic where only one path is covered
     - **Untested business logic** — critical operations (DB writes, calculations, API responses)
     - **Dead code** — unreachable or unused code that should be removed
4. Prioritize gaps by risk:
   - **P0** — Untested business logic (data corruption, wrong calculations)
   - **P1** — Untested error paths (unhandled exceptions, missing 404s)
   - **P2** — Untested branches (edge cases, boundary conditions)
   - **P3** — Dead code / utility functions with low risk
5. For each gap, write a specific recommendation: what test to write and what it should assert
6. Write the report to `specs/<project-id>/reports/coverage-report-YYYY-MM-DD.md` using the companion template

# Output Format

A markdown report following `scott.coverage-report.template.md` placed in `specs/<project-id>/reports/`.

# Examples

**Input:** `@scott coverage src/app/`

**Output:** A coverage report containing:
- Summary: 67% overall line coverage, 4 files below 80%, 12 logic gaps identified
- File breakdown: `routes/game.py` — 54% (lines 45-62, 78-91 uncovered)
- Gap: [P0] `routes/game.py:45-62` — Hand result calculation logic untested, could produce wrong P/L values
- Gap: [P1] `routes/game.py:78-91` — Missing test for duplicate hand_number error path
- Recommendation: Write test `test_duplicate_hand_number_returns_409` asserting 409 response

# Anti-patterns

- Do NOT report only percentages — the uncovered *lines* and their *risk* are what matter
- Do NOT skip reading the uncovered source code — line numbers alone don't tell you the risk
- Do NOT treat all uncovered lines equally — business logic gaps are more important than utility helpers
- Do NOT recommend writing tests for dead code — recommend removing it instead
- Do NOT run coverage without `PYTHONPATH=src/` — imports will fail
