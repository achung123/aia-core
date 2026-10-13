---
mode: agent
tools:
  - runInTerminal
description: Close a completed task with a reason and report newly unblocked tasks.
---

## Goal

Close a beads task, record the completion reason, and identify any tasks that become ready as a result — so the next piece of work is immediately visible.

---

## Context

Closing a task in beads updates the dependency graph. Tasks that were blocked solely by the now-closed task become ready. Logan closes the task via `bd close <id> --reason "..."` and then checks `bd ready --json` to surface newly unblocked work. Including the beads ID in commit messages (`(bd-xxx)`) enables `bd doctor` to detect orphaned issues.

---

## Instructions

1. **Resolve the ID.** If the user provides a Jean ID (e.g., `T-003`), search beads for the matching issue. Otherwise use the beads ID directly.
2. **Verify the task exists and is open.** Run `bd show <id> --json`. If already closed, report it and stop.
3. **Capture the "before" ready list.** Run `bd ready --json` to know what was ready before closing.
4. **Close the task.** Run `bd close <id> --reason "<reason>" --json`. Use the user's stated reason, or default to "Completed" if none provided.
5. **Capture the "after" ready list.** Run `bd ready --json` again.
6. **Diff the lists.** Identify newly ready tasks (present in "after" but not "before").
7. **Unblock newly ready dependents.** For each newly ready task, explicitly set its status from `blocked` to `open`:
   ```bash
   bd update <newly-ready-id> --status open
   ```
   This ensures the kanban board moves these tasks out of the "Blocked" column immediately.
8. **Output** the closure confirmation and any newly unblocked tasks.

---

## Output Format

```markdown
## Closed: bd-x7k2 — <Title>

**Reason:** <reason>

### Newly Ready
| Beads ID | Title | Priority |
|----------|-------|----------|
| bd-m3p9  | ...   | P1       |

**Suggested next:** Claim `bd-m3p9` — <rationale>
```

If no new tasks became ready:
```markdown
## Closed: bd-x7k2 — <Title>

**Reason:** Completed

No new tasks unblocked. Run `@logan ready` to see the current queue.
```

---

## Example

**Input:**
```
@logan close bd-x7k2
```

**Expected output:**
```markdown
## Closed: bd-x7k2 — Initialize project structure

**Reason:** Completed

### Newly Ready
| Beads ID | Title                  | Priority |
|----------|------------------------|----------|
| bd-m3p9  | Define database models | P1       |

**Suggested next:** Claim `bd-m3p9` — it's the next task in the dependency chain and unblocks 3 downstream tasks.
```

---

## Anti-patterns

- **Do NOT close a task that is still blocked.** If it has open dependencies, something is wrong — investigate first.
- **Do NOT skip the ready-diff.** Surfacing newly unblocked tasks is the primary value of closing through Logan.
- **Do NOT forget to unblock dependents.** When a task is closed, every dependent whose blockers are now all resolved MUST be explicitly set to `open` via `bd update <id> --status open`. Kanban boards rely on explicit status.
- **Do NOT close without a reason.** Always provide one, even if it's just "Completed".
- **Do NOT forget to remind about commit messages.** When closing after code work, the commit should include `(bd-xxx)`.
