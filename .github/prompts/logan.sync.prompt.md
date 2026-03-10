---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - runInTerminal
description: Import Jean's tasks.md into beads — creates issues with priorities, descriptions, acceptance criteria, and dependency links.
---

## Goal

Read a Jean-generated `tasks.md` file from `specs/<project>/`, parse every task, and create corresponding beads issues with correct priorities, dependency chains, and acceptance criteria. Output a sync summary mapping Jean task IDs to beads hash IDs.

---

## Context

Jean produces structured `tasks.md` files in `specs/<project-name>-<project-id>/` containing atomic tasks with IDs (`T-NNN`), categories, dependency chains, story references, and acceptance criteria. Logan bridges these plans into beads (`bd` CLI), the project's local task tracker — a Dolt-powered SQL database that agents and engineers query for ready work.

Beads uses hash-based IDs (e.g., `bd-a1b2`) and supports hierarchical sub-tasks, dependency graphs, and atomic claiming. The sync must preserve Jean's dependency structure faithfully.

---

## Instructions

1. **Locate the tasks file.** Search `specs/` for the project matching the user's input. Read the `tasks.md` file.
2. **Check beads initialization.** Run `ls .beads/` or `bd list --json 2>/dev/null` to verify beads is initialized. If not, run `bd init`.
3. **Check for existing synced tasks.** Run `bd list --json` and check if tasks from this project are already tracked (look for Jean task IDs in descriptions). Avoid creating duplicates.
4. **Parse tasks.** Extract from each task block: ID, title, category, dependencies, story reference, description, and acceptance criteria.
5. **Map priority from category:**
   - `setup` → P1 (high — foundational work)
   - `feature` → P1 (high — core deliverables)
   - `infra` → P1 (high — infrastructure)
   - `test` → P2 (normal)
   - `docs` → P2 (normal)
   - `refactor` → P2 (normal)
6. **Create issues in dependency order.** For each task (starting with those that have no dependencies):
   ```bash
   echo '<description>\n\nJean Task: T-NNN\nCategory: <category>\nStory Ref: <ref>\n\nAcceptance Criteria:\n<criteria>' | bd create "<title>" -p <priority> --stdin --json
   ```
7. **Record the mapping.** After each `bd create`, capture the beads hash ID from JSON output and map it to the Jean task ID.
8. **Link dependencies.** After all tasks are created, for each task with dependencies:
   ```bash
   bd dep add <child-beads-id> <parent-beads-id>
   ```
9. **Verify the graph.** Run `bd ready --json` to confirm that only tasks with no dependencies appear as ready.
10. **Output the sync summary** as a table mapping Jean IDs → beads IDs → titles → priorities → dependencies.

---

## Output Format

```markdown
## Sync Summary — <project-name>

**Project:** <project-name>-<project-id>
**Date:** YYYY-MM-DD
**Tasks Synced:** N
**Dependencies Linked:** M

| Jean ID | Beads ID | Title | Priority | Blocked By |
|---------|----------|-------|----------|------------|
| T-001   | bd-a1b2  | ...   | P1       | none       |
| T-002   | bd-c3d4  | ...   | P1       | bd-a1b2    |

### Ready Now
- bd-a1b2 — <title> (P1)
```

---

## Example

**Input:**
```
@logan sync poker-lobby-001
```

**Expected output (abbreviated):**
```markdown
## Sync Summary — Poker Lobby API

**Project:** poker-lobby-001
**Date:** 2026-03-09
**Tasks Synced:** 24
**Dependencies Linked:** 31

| Jean ID | Beads ID | Title                              | Priority | Blocked By |
|---------|----------|------------------------------------|----------|------------|
| T-001   | bd-x7k2  | Initialize project structure       | P1       | none       |
| T-002   | bd-m3p9  | Define database models             | P1       | bd-x7k2    |
| T-003   | bd-q1w4  | Implement table creation endpoint  | P1       | bd-m3p9    |

### Ready Now
- bd-x7k2 — Initialize project structure (P1)
```

---

## Anti-patterns

- **Do NOT create duplicate issues.** Always check `bd list --json` for existing tasks from the same project before syncing.
- **Do NOT use `bd edit`** — it opens an interactive editor. Use `bd update` with flags.
- **Do NOT guess priorities.** Derive them from the task category as specified above.
- **Do NOT skip dependency linking.** The dependency graph is critical for `bd ready` to work correctly.
- **Do NOT create all tasks in a flat list.** Respect the dependency order — create parents before children.
- **Do NOT hardcode beads IDs.** Always capture them from `bd create --json` output dynamically.
