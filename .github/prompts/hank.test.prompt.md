---
mode: agent
tools:
  - codebase
  - editFiles
  - createFile
  - readFile
  - listDirectory
  - search
  - runInTerminal
  - usages
  - terminalLastCommand
description: Write or fix tests for a specific module or function without changing production code.
---

## Goal

Add missing test coverage or fix broken tests for a specified target — without modifying any production code. Ensure the test suite accurately reflects the current behavior of the codebase.

---

## Context

Hank writes tests that document and verify existing behavior. This command is used when test coverage is missing, tests are broken, or the user wants tests for a specific module. No production code changes — if a test reveals a bug, Hank reports it and suggests using `@hank debug` to fix it. The project uses FastAPI, SQLAlchemy, Pydantic v2, pytest, SQLite, and Poetry.

The standard test command is `PYTHONPATH=src/ pytest test/`.

---

## Instructions

1. **Identify the target.** Parse the user's request — a file, class, function, or route to test.
2. **Read the target code.** Understand every code path, branch, and edge case.
3. **Read existing tests.** Check what's already covered to avoid duplication.
4. **Identify gaps.** List untested paths: happy paths, error cases, edge cases, boundary values.
5. **Write tests.** For each gap:
   - Name tests descriptively: `test_<function>_<scenario>_<expected>`
   - Follow existing test patterns (fixtures, client usage, assertions)
   - Use the in-memory SQLite fixture pattern from `conftest.py`
6. **Run the tests.** `PYTHONPATH=src/ pytest test/<test_file>.py -v`.
   - If all pass → coverage is documented, done.
   - If any fail due to actual bugs → report the bug, do NOT fix production code. Suggest `@hank debug`.
   - If any fail due to test errors → fix the test, re-run.
7. **Report.** Summary of tests added, coverage gaps closed, and any bugs discovered.

---

## Output Format

```markdown
## Tests: <target>

### Added
| Test File | Test Name | What It Covers |
|-----------|-----------|----------------|
| test/... | test_create_player_ok | Happy path for POST /players |
| test/... | test_create_player_duplicate | 409 on duplicate name |

### Test Results
- N new tests — all passing
- Full suite: M passed, 0 failed

### Bugs Found (if any)
- `<function>` returns X when it should return Y — use `@hank debug` to fix
```

---

## Example

**Input:**
```
@hank test src/app/routes/utils.py
```

**Expected behavior:**
1. Reads utils.py — finds `_convert_community_query_to_state`, `_convert_community_state_to_query`, `_validate_game_date`
2. Reads existing tests — checks what's covered
3. Identifies gaps (e.g., `_validate_game_date` with invalid input, conversion with "10" rank cards)
4. Writes new test functions
5. Runs tests — reports results

---

## Anti-patterns

- **Do NOT modify production code.** This command is tests-only.
- **Do NOT write tests that duplicate existing coverage.** Check first.
- **Do NOT write trivial tests** (e.g., testing that True is True). Every test should exercise meaningful behavior.
- **Do NOT suppress or skip failing tests.** If a test fails because of a real bug, report it.
