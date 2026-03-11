---
mode: agent
tools:
  - agent
  - readFile
  - listDirectory
  - search
  - runInTerminal
  - terminalLastCommand
  - codebase
description: Resume a paused or break-glassed orchestration loop from where it left off.
---

# Goal

Resume the orchestration loop after a user-initiated pause (5-cycle checkpoint) or a break-glass halt. Reconstruct loop state from beads and continue the implement → review → findings → sync cycle.

---

# Context

- The loop may have been paused at a 5-cycle checkpoint (user said "stop" or didn't respond)
- The loop may have been halted by break-glass (5+ bugs without a task close)
- Anna must reconstruct state from beads since there's no persistent loop state file
- After break-glass, the user should have specified which option they chose:
  1. Fix bugs first and resume — bugs should have been addressed before calling resume
  2. Adjust scope and continue — user may have closed or deprioritized some tasks
  3. Simply resume where we left off

---

# Instructions

1. **Reconstruct state from beads:**
   - Run `bd list --json` to inventory all tasks — count closed (= tasks_completed), open + in_progress (= remaining)
   - Run `bd ready --json` to see available work
   - Check for any in_progress tasks that may have been left mid-cycle
   - Estimate `cycle_count` from the number of closed tasks
   - Set `bug_counter = 0` (fresh start after explicit user decision to resume)

2. **Handle in-progress tasks:**
   - If a task is in_progress, check if it has been implemented (look for recent commits or test results)
   - If implemented but not reviewed → resume from Phase 3 (Review)
   - If not implemented → resume from Phase 2 (Implement)
   - If no task is in_progress → resume from Phase 1 (Pick Task)

3. **Present reconstruction summary:**
   - Show the reconstructed state to the user
   - Confirm: *"Resuming from cycle N. Continue?"*

4. **Re-enter the orchestration loop** as defined in `anna.run.prompt.md` from the appropriate phase

---

# Output Format

```
## Resuming Orchestration

| Metric | Reconstructed Value |
|--------|-------------------|
| Cycles completed so far | N |
| Tasks completed | X / Y |
| Tasks remaining | W |
| Bug counter | 0 (reset on resume) |
| Resume point | Phase N — <description> |

Resuming from cycle N+1. Continue? (yes / adjust / stop)
```

---

# Examples

**Input:** `@anna resume` (after break-glass)

**Output:**
```
## Resuming Orchestration

| Metric | Reconstructed Value |
|--------|-------------------|
| Cycles completed so far | 3 |
| Tasks completed | 2 / 12 |
| Tasks remaining | 10 |
| Bug counter | 0 (reset on resume) |
| Resume point | Phase 1 — Pick next ready task |

Previous break-glass bugs appear to have been addressed (3 closed since halt).
Resuming from cycle 4. Continue? (yes / adjust / stop)
```

---

# Anti-patterns

- **Never assume loop state** — always reconstruct from beads
- **Never skip the user confirmation** before re-entering the loop
- **Never carry over the old bug counter** — resume always resets to 0 (user made a deliberate decision)
- **Never resume without checking for stale in-progress tasks** — they may need cleanup
