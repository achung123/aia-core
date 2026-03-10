---
mode: agent
tools:
  - runInTerminal
description: Atomically claim a task — sets assignee and moves it to in_progress.
---

## Goal

Claim a specific beads task so that it is marked as in-progress and assigned, preventing other agents from picking it up. Confirm the claim and provide the task details needed to start work.

---

## Context

Beads supports atomic claiming via `bd update <id> --claim`, which sets the assignee and transitions the task to `in_progress` in a single operation. This prevents race conditions when multiple agents are picking up work. Logan verifies the task is ready (not blocked) before claiming it.

---

## Instructions

1. **Resolve the ID.** If the user provides a Jean ID (e.g., `T-003`), search beads for the matching issue. Otherwise use the beads ID directly.
2. **Verify readiness.** Run `bd show <id> --json` and check that all dependencies are closed. If the task is blocked, report the blockers and do NOT claim it.
3. **Check current status.** If the task is already claimed or in_progress, report who has it and do NOT re-claim.
4. **Claim the task.** Run `bd update <id> --claim`.
5. **Confirm.** Run `bd show <id> --json` to verify the status changed to `in_progress`.
6. **Output** the claimed task's details: ID, title, description, acceptance criteria, and any context needed to start work.

---

## Output Format

```markdown
## Claimed: bd-x7k2 — <Title>

**Status:** in_progress
**Priority:** P1
**Category:** setup

### What to do
<task description>

### Acceptance Criteria
1. <criterion>
2. <criterion>

### Context
- Jean Task: T-001
- Story Ref: S-1.1
- Unblocks: bd-m3p9, bd-q1w4
```

---

## Example

**Input:**
```
@logan claim bd-x7k2
```

**Expected output:**
```markdown
## Claimed: bd-x7k2 — Initialize project structure

**Status:** in_progress
**Priority:** P1
**Category:** setup

### What to do
Set up the Python project with Poetry, configure pyproject.toml, create src/ and test/ directory structure.

### Acceptance Criteria
1. `poetry install` succeeds without errors
2. src/ and test/ directories exist with __init__.py files

### Context
- Jean Task: T-001
- Story Ref: —
- Unblocks: bd-m3p9 (Define database models), bd-q1w4 (Implement table creation endpoint)
```

---

## Anti-patterns

- **Do NOT claim a blocked task.** Verify all dependencies are closed first.
- **Do NOT claim a task that is already in_progress.** Report the current assignee instead.
- **Do NOT use `bd edit`** — use `bd update --claim`.
- **Do NOT skip the readiness check.** Always verify before claiming.
- **Do NOT forget to show acceptance criteria.** The engineer needs to know what "done" looks like.
