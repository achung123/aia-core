---
mode: agent
tools:
  - codebase
  - editFiles
  - readFile
  - listDirectory
  - search
  - runInTerminal
  - usages
  - terminalLastCommand
description: Refactor a module or function — ensures tests pass before and after changes.
---

## Goal

Improve code quality of a specified target (module, function, pattern) while ensuring full behavioral preservation — existing tests must pass before, during, and after the refactor.

---

## Context

Hank refactors with a safety net: the existing test suite. No behavior changes, no new features — only structural improvements (extract helpers, rename, reduce duplication, improve typing, simplify logic). This is an ad-hoc command with no beads task. The project uses FastAPI, SQLAlchemy, Pydantic v2, pytest, SQLite, and Poetry.

The standard test command is `PYTHONPATH=src/ pytest test/`.

---

## Instructions

1. **Identify the target.** Parse the user's request — a file, function, module, or pattern to refactor.
2. **Read the target code.** Read the file(s) to understand the current structure.
3. **Baseline tests.** Run `PYTHONPATH=src/ pytest test/ -v`. Confirm all tests pass. If any fail, report them and stop — do not refactor broken code.
4. **Plan the refactor.** Briefly state what will change and why (e.g., "Extract card validation into a shared utility to remove duplication across 3 files"). Get user confirmation if the scope is large.
5. **Apply changes incrementally.** Make changes in small steps. After each step, run relevant tests.
6. **Final verification.** Run the full test suite. Confirm everything passes.
7. **Report.** Summarize what changed and why.

---

## Output Format

```markdown
## Refactored: <target>

### What Changed
<1-3 sentences summarizing the refactor>

### Changes
| File | Action | Description |
|------|--------|-------------|
| ... | modified | ... |

### Test Results
- Before: N passed, 0 failed
- After: N passed, 0 failed
- No behavioral changes
```

---

## Example

**Input:**
```
@hank refactor src/app/routes/game.py — extract database session management into a shared module
```

**Expected behavior:**
1. Reads game.py and other routers
2. Runs tests — all pass (baseline)
3. Extracts `_get_db` and `SessionLocal` into `src/app/database/session.py`
4. Updates imports in all routers
5. Runs tests — all pass
6. Reports changes

---

## Anti-patterns

- **Do NOT refactor if baseline tests fail.** Fix tests first (use `@hank debug` or `@hank test`).
- **Do NOT add new behavior during a refactor.** Structure changes only.
- **Do NOT change code outside the stated target** unless necessary to complete the refactor (e.g., updating imports).
- **Do NOT skip the baseline test run.** You need proof that tests pass before changes to confirm you didn't break anything.
- **Do NOT interact with beads.** Refactor is ad-hoc unless the user explicitly links a beads ID.
