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
description: Investigate and fix a bug — writes a failing regression test first, then fixes.
---

## Goal

Diagnose a reported bug, write a failing test that reproduces it, fix the underlying code, and confirm the test passes — preventing the bug from recurring.

---

## Context

Hank applies TDD even to bug fixes. The workflow is: reproduce → test → fix → verify. This is an ad-hoc command with no beads task — Hank operates independently outside the task board. The project uses FastAPI, SQLAlchemy, Pydantic v2, pytest, SQLite, and Poetry.

The standard test command is `PYTHONPATH=src/ pytest test/`.

---

## Instructions

1. **Understand the bug.** Parse the user's description. Ask one clarifying question if the issue is ambiguous.
2. **Scan the codebase.** Read the relevant modules, routes, models, and tests to understand the area where the bug lives.
3. **Reproduce.** If possible, run existing tests or write a minimal script to confirm the bug exists. Check logs or error messages.
4. **Red Phase — Write a regression test.**
   - Write a test that exercises the exact scenario described in the bug report.
   - Run the test — confirm it **fails**, reproducing the bug.
   - If the test passes, the bug may be elsewhere or already fixed — investigate further.
5. **Green Phase — Fix the bug.**
   - Make the minimal change needed to fix the root cause.
   - Run the regression test — confirm it **passes**.
   - Run the full test suite — confirm no regressions.
6. **Report.** Explain the root cause, the fix, and the regression test added.

---

## Output Format

```markdown
## Fixed: <brief title>

### Root Cause
<1-3 sentences explaining why the bug occurred>

### Changes
| File | Action | Description |
|------|--------|-------------|
| ... | modified | ... |
| test/... | created/modified | Regression test for ... |

### Test Results
- Regression test: test/<file>::<test_name> — PASS
- Full suite: N passed, 0 failed
```

---

## Example

**Input:**
```
@hank debug Community cards with rank "10" crash the card parser — it only handles single-char ranks
```

**Expected behavior:**
1. Reads Card model and validators
2. Writes test: `test_card_rank_ten_is_valid()` asserting Card(rank="10", suit="S") works
3. Runs test → fails (reproduces the bug)
4. Fixes Card/CardRank to handle "10"
5. Runs test → passes
6. Full suite → no regressions
7. Reports fix

---

## Anti-patterns

- **Do NOT fix without a regression test.** The test proves the bug existed and prevents recurrence.
- **Do NOT change unrelated code.** Scope the fix to the root cause only.
- **Do NOT guess at the cause.** Read the code, reproduce the issue, then diagnose.
- **Do NOT interact with beads.** Debug is ad-hoc — no task claiming or closing unless the user explicitly links a beads ID.
