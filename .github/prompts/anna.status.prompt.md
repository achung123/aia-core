---
mode: agent
tools:
  - runInTerminal
  - terminalLastCommand
  - readFile
  - listDirectory
  - search
description: Report current orchestration loop state — cycle count, task progress, bug counter, and break-glass proximity.
---

# Goal

Provide a clear snapshot of the current orchestration loop state so the user can decide whether to continue, adjust, or stop.

---

# Context

- Anna tracks loop state across cycles: cycle count, tasks completed, total tasks, bug counter, and break-glass status
- The source of truth for task state is beads (`bd list`, `bd ready`)
- Recent reports from Scott are in `specs/<project>/reports/`
- The bug counter tracks findings created since the last successful task close

---

# Instructions

1. Run `bd list --json` to get current task inventory (open, in_progress, closed)
2. Run `bd ready --json` to see what's available next
3. Count tasks by status: closed = completed, in_progress = active, open = remaining
4. Check `specs/<project>/reports/` for the most recent code review reports to estimate recent findings
5. Present the status report

---

# Output Format

```
## Orchestration Status

| Metric | Value |
|--------|-------|
| Current cycle | N |
| Tasks completed | X / Y |
| Tasks in progress | Z |
| Tasks remaining | W |
| Bug counter (since last close) | N / 5 |
| Break-glass status | OK / ⚠️ APPROACHING / 🛑 TRIGGERED |
| Next checkpoint | In N cycles |

### Ready Tasks (next up)
| Beads ID | Title | Priority |
|----------|-------|----------|
| bd-xxx | ... | P1 |

### Recent Findings (current window)
| # | Severity | Description | Source |
|---|----------|-------------|--------|
| 1 | ... | ... | bd-xxx |
```

---

# Examples

**Input:** `@anna status`

**Output:**
```
## Orchestration Status

| Metric | Value |
|--------|-------|
| Current cycle | 7 |
| Tasks completed | 5 / 12 |
| Tasks in progress | 1 |
| Tasks remaining | 6 |
| Bug counter (since last close) | 2 / 5 |
| Break-glass status | OK |
| Next checkpoint | In 3 cycles |

### Ready Tasks (next up)
| Beads ID | Title | Priority |
|----------|-------|----------|
| bd-a1b2 | Add search endpoint | P1 |
| bd-c3d4 | Input validation | P0 |
```

---

# Anti-patterns

- **Never modify task state** — this is a read-only status check
- **Never invoke sub-agents** — status only reads from beads and the filesystem
- **Never guess loop state** — derive everything from beads and reports on disk
