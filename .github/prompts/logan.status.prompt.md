---
mode: agent
tools:
  - runInTerminal
  - readFile
description: Show detailed status of a specific task or an overview of all tracked tasks.
---

## Goal

Provide a clear status view — either a detailed report for a single task (by beads ID or Jean task ID) or a project-wide overview showing progress, blockers, and what's ready.

---

## Context

Beads stores task state (open, in_progress, closed), dependency links, assignees, and audit trails. Logan queries this data to build human-readable status reports. When given a specific ID, Logan shows full task details. When given no ID, Logan produces a project overview using the `logan.status-report.template.md` template.

---

## Instructions

### Single task status (ID provided):
1. **Resolve the ID.** If the user provides a Jean ID (e.g., `T-003`), search beads issues for one whose description contains that ID. Otherwise use the beads ID directly.
2. **Run `bd show <id> --json`.** Parse the full task record.
3. **Check dependencies.** For each dependency, run `bd show <dep-id> --json` to get its status.
4. **Check dependents.** Identify tasks that are blocked by this task.
5. **Present** the task details: ID, title, status, assignee, priority, description, acceptance criteria, blockers (with their status), and what this task unblocks.

### Project overview (no ID provided):
1. **Run `bd list --json`.** Get all tracked issues.
2. **Categorize** by status: open, in_progress, closed.
3. **Run `bd ready --json`.** Get the ready queue.
4. **Calculate stats:** total tasks, completed, in progress, blocked, ready.
5. **Present** using the `logan.status-report.template.md` structure.

---

## Output Format

Follow `logan.status-report.template.md` for project overviews. For single task status:

```markdown
## Task: bd-x7k2 — <Title>

**Status:** open | in_progress | closed
**Priority:** P0 | P1 | P2
**Assignee:** <name or unassigned>
**Category:** <category>
**Jean Task:** T-NNN

### Description
<task description>

### Acceptance Criteria
1. <criterion>
2. <criterion>

### Blocked By
| Beads ID | Title | Status |
|----------|-------|--------|
| bd-a1b2  | ...   | closed |

### Unblocks
| Beads ID | Title | Status |
|----------|-------|--------|
| bd-c3d4  | ...   | open (waiting) |
```

---

## Example

**Input:**
```
@logan status
```

**Expected output (abbreviated):**
```markdown
## Project Status

**Total:** 24 | **Closed:** 8 | **In Progress:** 2 | **Blocked:** 9 | **Ready:** 5

### In Progress
- bd-m3p9 — Define database models (P1, claimed by agent-1)

### Ready Now
- bd-q1w4 — Implement table creation endpoint (P1)
- bd-r8t3 — Add API rate limiting (P2)

### Recently Closed
- bd-x7k2 — Initialize project structure (closed 2026-03-08)
```

---

## Anti-patterns

- **Do NOT guess task status.** Always query beads for the current state.
- **Do NOT conflate "open" with "ready".** Open tasks may still be blocked.
- **Do NOT omit dependency context.** Always show what blocks a task and what it unblocks.
- **Do NOT show stale data.** Always query beads fresh — do not cache results across invocations.
