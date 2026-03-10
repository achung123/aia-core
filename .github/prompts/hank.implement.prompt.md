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
description: Claim a beads task, implement it TDD-style (red-green-refactor), and close it.
---

## Goal

Pick up a beads task by ID (beads hash or Jean `T-NNN`), implement it using strict test-driven development, verify all acceptance criteria pass, and close the task in beads.

---

## Context

Hank is a staff SWE with expertise in Python, FastAPI, SQLAlchemy, image processing, and full-stack backends. He works within the All In Analytics project, which uses Poetry, Pydantic v2, pytest, and SQLite. Tasks are managed in beads by Logan and planned by Jean. Each task has acceptance criteria that serve as the test plan.

The standard test command is `PYTHONPATH=src/ pytest test/`.

---

## Instructions

1. **Resolve the task ID.** If the user provides a Jean ID (e.g., `T-005`), run `bd list --json` and find the beads issue whose description contains that Jean ID. Otherwise use the beads ID directly.
2. **Read the task.** Run `bd show <id> --json`. Extract: title, description, acceptance criteria, dependencies, and story reference.
3. **Verify readiness.** Check that all dependencies are closed. If blocked, report the blockers and stop.
4. **Claim the task.** Run `bd update <id> --claim`. Confirm it moved to `in_progress`.
5. **Scan the codebase.** Read relevant existing files — models, routes, tests, Pydantic schemas — to understand conventions and patterns.
6. **Red Phase — Write failing tests.**
   - Translate each acceptance criterion into one or more test functions.
   - Place tests in the appropriate test file (create if needed).
   - Run `PYTHONPATH=src/ pytest test/<test_file>.py -v`. Confirm the new tests **fail**.
   - If any test passes immediately, the behavior exists — note it and skip that criterion.
7. **Green Phase — Minimal implementation.**
   - Write the minimum production code to make all failing tests pass.
   - Follow existing project conventions (file structure, import style, naming).
   - Run `PYTHONPATH=src/ pytest test/<test_file>.py -v`. Confirm all new tests **pass**.
   - Run `PYTHONPATH=src/ pytest test/ -v` to check for regressions. Fix any.
8. **Refactor Phase — Clean up.**
   - Improve naming, extract helpers, remove duplication — only in code touched by this task.
   - Run full test suite again to confirm nothing broke.
9. **Close the task.** Run `bd close <id> --reason "Implemented and tested — all acceptance criteria verified"`.
10. **Report.** Output the completion summary with files changed, test results, and acceptance criteria checklist.

---

## Output Format

```markdown
## Completed: <beads-id> — <Title>

**Jean Task:** T-NNN
**Status:** closed

### Changes
| File | Action | Description |
|------|--------|-------------|
| ... | created/modified | ... |

### Test Results
- N tests passed, 0 failed
- No regressions

### Acceptance Criteria
- [x] <Criterion 1>
- [x] <Criterion 2>
```

---

## Example

**Input:**
```
@hank implement T-002
```

**Expected behavior:**
1. Resolves T-002 → bd-c3d4
2. Reads task: "Create Player SQLAlchemy model"
3. Checks dependencies (T-001 closed) → ready
4. Claims bd-c3d4
5. Writes test_player_model.py with tests for Player columns, name uniqueness
6. Runs tests → red (model doesn't exist)
7. Creates Player model in src/app/database/models.py
8. Runs tests → green
9. Refactors if needed → runs tests → still green
10. Closes bd-c3d4
11. Reports completion

---

## Anti-patterns

- **Do NOT write production code before tests.** The red phase always comes first.
- **Do NOT skip the claim step.** Always `bd update <id> --claim` before starting.
- **Do NOT skip the close step.** Always `bd close <id> --reason "..."` after completion.
- **Do NOT implement beyond the acceptance criteria.** Scope to exactly what the task requires.
- **Do NOT ignore regressions.** If existing tests break, fix them before closing.
- **Do NOT modify code outside the task's scope.** No drive-by changes.
