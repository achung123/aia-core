---
mode: agent
tools:
  - runInTerminal
  - readFile
description: List tasks with no open blockers — the next actionable work items.
---

## Goal

Query beads for all tasks whose dependencies are fully resolved and present them as a prioritized, actionable list so agents or engineers know exactly what to work on next.

---

## Context

Beads tracks task dependencies as a directed graph. A task is "ready" when all its blockers (parent dependencies) are closed. The `bd ready --json` command returns exactly these tasks. Logan surfaces this list with enough context (title, priority, category, acceptance criteria) for someone to pick up work immediately.

---

## Instructions

1. **Run `bd ready --json`.** Parse the JSON output to get all ready tasks.
2. **Enrich with details.** For each ready task, run `bd show <id> --json` to get the full description, acceptance criteria, and any linked Jean task ID.
3. **Sort by type then priority.** Bugs (`type: bug`) always come before non-bugs at every priority level. Within each group, sort by priority: P0 first, then P1, then P2.
   - Sorting order: P0 bugs → P1 bugs → P2 bugs → P0 features/tasks → P1 features/tasks → P2 features/tasks
4. **Present the list.** Format each task with: beads ID, title, priority, type (bug/feature/task/chore), and a one-line summary of what needs to be done.
5. **Suggest next action.** Recommend claiming the first task in the sorted list — bugs take precedence over non-bugs.

---

## Output Format

```markdown
## Ready Tasks

| # | Beads ID | Title | Priority | Type |
|---|----------|-------|----------|------|
| 1 | bd-a3b1  | ...   | P0       | bug  |
| 2 | bd-x7k2  | ...   | P1       | bug  |
| 3 | bd-q1w4  | ...   | P1       | feature |

**Suggested next:** Claim `bd-a3b1` — highest-priority bug takes precedence
```

---

## Example

**Input:**
```
@logan ready
```

**Expected output:**
```markdown
## Ready Tasks

| # | Beads ID | Title                        | Priority | Type    |
|---|----------|------------------------------|----------|---------|
| 1 | bd-x7k2  | Fix null pointer in search   | P1       | bug     |
| 2 | bd-r8t3  | Initialize project structure | P1       | feature |
| 3 | bd-m4n7  | Add API rate limiting        | P2       | feature |

**Suggested next:** Claim `bd-x7k2` — it's the highest-priority bug and bugs take precedence over features.
```

---

## Anti-patterns

- **Do NOT show tasks that still have open blockers.** Only show what `bd ready` returns.
- **Do NOT show closed tasks.** Ready means open and unblocked.
- **Do NOT omit priority sorting.** Higher priority tasks must appear first.
- **Do NOT place features or tasks ahead of bugs.** Bugs always come before non-bugs at every priority level.
- **Do NOT run `bd list` instead of `bd ready`.** They return different results — `bd list` includes blocked tasks.
