---
mode: agent
tools:
  - search/codebase
  - read/readFile
  - edit/editFiles
  - execute/runInTerminal
  - read/terminalLastCommand
  - search/usages
description: Shared skill — reproduce, fix, and close a bug with a regression test and a beads-linked record.
---

## Goal

Turn a bug report into a reproducing test, a minimal fix, and a closed beads task so the defect is both resolved today and prevented tomorrow.

---

## When to Use

- A beads issue of type `bug` is claimed
- A user reports broken behavior that needs immediate triage
- A review (Scott) surfaced a defect rather than a design concern

---

## Context

- Every bug fix lands with a regression test — no exceptions
- Bugs discovered during other work are filed as `bd create ... --deps discovered-from:<parent>` rather than fixed inline
- Test command: `cd backend && uv run pytest test/`

---

## Instructions

1. **Read the bug report** from `bd show <id> --json` (or the user message). Extract: symptom, reproduction steps, expected vs actual.
2. **Reproduce first.**
   - Write a regression test in `backend/test/` that fails **because of the bug**
   - Run it and confirm Red with the exact symptom from the report
   - If you cannot reproduce, stop and ask for more information — do not fix what you cannot prove is broken
3. **Root-cause.** Use `search/usages` and `read/readFile` to trace the defect to the minimum code responsible. Note the root cause in your working memory for the report.
4. **Fix minimally.** Change only what is necessary to turn the regression test green. Defer refactors to a separate task.
5. **Run full suite.** `cd backend && uv run pytest test/` — zero regressions. If something else broke, your fix is incomplete or the other test was wrong; investigate before continuing.
6. **Pre-commit gate.** `pre-commit run --all-files` must be clean.
7. **Close the beads task.**
   ```bash
   bd close <id> --reason "Fixed: <root cause summary>. Regression test: test/<file>::<test>"
   ```
8. **File follow-ups** if you discovered related issues:
   ```bash
   bd create "<title>" --description "..." -t bug -p <N> --deps discovered-from:<id>
   ```

---

## Output Format

```
## Bug Fixed — <beads-id>

**Symptom:** <one line>
**Root cause:** <one to three lines>
**Regression test:** test/<file>::<test_name>
**Fix:** <files changed, one line each>
**Suite:** X passed, 0 failed
**Pre-commit:** clean
**Follow-ups filed:** <bd-ids> or "none"
```

---

## Anti-patterns

- Fixing the bug before a failing test proves it exists
- "Fixing" by catching and swallowing the exception
- Broadening a test's tolerance to make it pass
- Rolling unrelated refactors into the fix — file them as separate tasks
- Closing the beads task without including the regression test path in the reason
- Skipping the full-suite run — a local fix can break distant tests
