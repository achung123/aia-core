---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
  - createFile
  - runInTerminal
  - terminalLastCommand
description: Map existing tests to spec stories (S-x.x) and task acceptance criteria (T-xxx), producing a traceability report.
---

# Goal

Build a complete traceability matrix that maps every test in the project to the spec stories and task acceptance criteria it verifies, and identifies all uncovered requirements.

# Context

The project uses:
- **Spec stories** in `specs/*/spec.md` — formatted as `S-x.x` with acceptance criteria
- **Task acceptance criteria** in `specs/*/tasks.md` — formatted as `T-xxx` with numbered ACs
- **Tests** in `test/` — pytest-based, using FastAPI TestClient and SQLAlchemy in-memory SQLite
- **Stack**: Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, pytest

Both spec stories and task ACs must be traced. A requirement is considered COVERED only if at least one test directly asserts the behavior described in that AC.

# Instructions

1. Read `specs/*/spec.md` — extract every story ID (S-x.x) and each of its numbered acceptance criteria
2. Read `specs/*/tasks.md` — extract every task ID (T-xxx) and each of its numbered acceptance criteria
3. Read every file in `test/` — for each test function, determine:
   - What behavior is being tested (read assertions, fixtures, setup)
   - Which story ACs and/or task ACs it satisfies
4. Build the traceability matrix:
   - For each AC (story and task), classify as COVERED, PARTIAL, or UNCOVERED
   - For each test, record which ACs it maps to
5. Identify orphaned tests — tests that don't map to any known requirement
6. Compute summary stats: total ACs, covered count, partial count, uncovered count, coverage percentage
7. Write the report to `specs/<project-id>/reports/traceability-report-YYYY-MM-DD.md` using the companion template

# Output Format

A markdown report following `scott.traceability-report.template.md` placed in `specs/<project-id>/reports/`.

# Examples

**Input:** `@scott trace specs/aia-core-001`

**Output:** A traceability report containing:
- Summary: 84 total ACs, 42 covered, 12 partial, 30 uncovered (50% coverage)
- Story matrix: S-1.1 AC1 → COVERED (test_create_player), S-1.1 AC2 → UNCOVERED, ...
- Task matrix: T-001 AC1 → COVERED (test_alembic_init), T-001 AC2 → PARTIAL, ...
- Orphaned tests: test_legacy_helper — no matching requirement

# Anti-patterns

- Do NOT count a test as covering an AC just because it touches the same module — the test must assert the specific behavior
- Do NOT skip reading test implementations — function names alone are not sufficient to determine coverage
- Do NOT generate the report without reading the actual spec and tasks files first
- Do NOT mark something COVERED based on naming conventions alone — read the assertions
