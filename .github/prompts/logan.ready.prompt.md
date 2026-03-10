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
3. **Sort by priority.** P0 first, then P1, then P2.
4. **Present the list.** Format each task with: beads ID, title, priority, category (from description), and a one-line summary of what needs to be done.
5. **Suggest next action.** Recommend claiming the highest-priority ready task.

---

## Output Format

```markdown
## Ready Tasks

| # | Beads ID | Title | Priority | Category |
|---|----------|-------|----------|----------|
| 1 | bd-x7k2  | ...   | P1       | setup    |
| 2 | bd-q1w4  | ...   | P2       | test     |

**Suggested next:** Claim `bd-x7k2` — <brief rationale>
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

| # | Beads ID | Title                        | Priority | Category |
|---|----------|------------------------------|----------|----------|
| 1 | bd-x7k2  | Initialize project structure | P1       | setup    |
| 2 | bd-r8t3  | Add API rate limiting        | P2       | feature  |

**Suggested next:** Claim `bd-x7k2` — it's the foundational setup task that unblocks 5 downstream tasks.
```

---

## Anti-patterns

- **Do NOT show tasks that still have open blockers.** Only show what `bd ready` returns.
- **Do NOT show closed tasks.** Ready means open and unblocked.
- **Do NOT omit priority sorting.** Higher priority tasks must appear first.
- **Do NOT run `bd list` instead of `bd ready`.** They return different results — `bd list` includes blocked tasks.
