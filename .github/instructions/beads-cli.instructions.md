---
description: "Use when any agent needs to interact with the beads task tracker (bd CLI): creating issues, claiming work, managing dependencies, checking ready tasks, closing issues, or syncing state. All task tracking in this project goes through beads — not markdown TODOs or any other system."
---

# Beads CLI (`bd`) — Task Tracking Reference

Beads (`bd`) is the **only** task tracking system in this project. Every piece of work — bugs, features, tasks, epics — lives in beads. Do NOT create markdown TODO lists, GitHub issues (unless explicitly asked), or any parallel tracking.

---

## Initialization

```bash
bd init          # Only if .beads/ does not exist in the repo root
bd onboard       # Introductory walkthrough — run once to understand the setup
```

Never run `bd init` if `.beads/` already exists.

---

## Issue Types

| Type | When to use |
|------|-------------|
| `bug` | Something broken or behaving incorrectly |
| `feature` | New functionality |
| `task` | Focused work item — tests, docs, refactoring |
| `epic` | Large feature broken into sub-tasks |
| `chore` | Maintenance — dependencies, tooling, CI |

---

## Priorities

| Value | Label | When to use |
|-------|-------|-------------|
| `0` | Critical | Security issues, data loss, broken builds |
| `1` | High | Major features, important bugs |
| `2` | Medium | Default — normal work items |
| `3` | Low | Polish, optimization |
| `4` | Backlog | Future ideas, no near-term commitment |

---

## Core Commands

### Create an issue

```bash
# Short title + inline description (safe for simple strings)
bd create "Title" --description="Details" -t task -p 2 --json

# Use --stdin for descriptions with backticks, quotes, or special characters
echo "Description with \`backticks\` and \"quotes\"" | bd create "Title" -t task -p 1 --deps discovered-from:bd-123 --stdin --json
```

Always pass `--json` when parsing output programmatically.

### View an issue

```bash
bd show <id>             # Human-readable
bd show <id> --json      # Structured output for programmatic use
```

### List all issues

```bash
bd list                  # Human-readable kanban view
bd list --json           # Full list as JSON
```

### Find ready work (no open blockers)

```bash
bd ready                 # Human-readable
bd ready --json          # JSON — use this for programmatic checks
```

---

## Claiming Work

Always claim atomically before starting work. This sets the assignee and moves the task to `in_progress` in one operation:

```bash
bd update <id> --claim --json
```

Never start implementing a task without claiming it first.

---

## Updating Issues

```bash
bd update <id> --priority 1 --json
bd update <id> --description "New description" --json
bd update <id> --acceptance "Acceptance criteria text" --json
bd update <id> --status blocked --json      # Task has open dependencies
bd update <id> --status open --json         # All dependencies resolved; unblock
```

> **CRITICAL: Never use `bd edit`** — it opens an interactive editor that agents cannot use. Always use `bd update` with explicit flags.

---

## Closing Issues

```bash
bd close <id> --reason "Completed — all tests pass" --json
```

After closing a task, check its dependents. Any dependent whose **all** blockers are now closed must be manually unblocked:

```bash
bd update <dependent-id> --status open --json
```

---

## Dependency Management

```bash
# child is blocked by parent
bd dep add <child-id> <parent-id>

# after linking deps, explicitly mark the child as blocked
bd update <child-id> --status blocked --json
```

### Link discovered work back to the parent issue

When you discover new work while implementing a task, create a linked issue:

```bash
bd create "Found: something needs fixing" \
  --description="Discovered while working on bd-xxx" \
  -p 1 --deps discovered-from:<parent-id> --json
```

---

## Lifecycle Workflow

```
1. bd ready --json                          → find unblocked work
2. bd update <id> --claim --json            → claim it atomically
3. ... implement ...
4. git commit -m "description (bd-<id>)"   → include beads ID in commit
5. bd close <id> --reason "Done" --json    → close when complete
6. bd update <dependent-id> --status open  → unblock any dependents
```

---

## Sync with Git

Beads auto-syncs with git:

- Exports to `.beads/issues.jsonl` after any change (5-second debounce)
- Imports from `.beads/issues.jsonl` when it is newer than the local DB (e.g. after `git pull`)

Manual sync when needed:

```bash
bd sync
```

---

## Commit Message Convention

Every commit that addresses a beads issue must include the beads ID:

```
feat: add equity calculation endpoint (bd-a1b2)
fix: handle null hand result in fold path (bd-c3d4)
```

---

## Jean → Beads Mapping (Logan's domain)

Jean produces `specs/<project>/tasks.md` with Jean task IDs (`T-NNN`). Logan maps these to beads hash IDs and records the mapping as a comment in each beads issue. When referencing a Jean task, look up the mapping via:

```bash
bd list --json | jq '.[] | select(.description | contains("T-NNN"))'
```

---

## Testing with Beads

Use the `BEADS_DB` environment variable to point at a throwaway database during tests so the production `.beads/` database is not polluted:

```bash
BEADS_DB=/tmp/test.beads bd create "Test issue" --json
```

---

## Quick Reference Card

| Goal | Command |
|------|---------|
| Find work to do | `bd ready --json` |
| View issue details | `bd show <id> --json` |
| Create issue | `bd create "Title" -t task -p 2 --json` |
| Create with special chars | `echo "desc" \| bd create "Title" --stdin --json` |
| Claim work | `bd update <id> --claim --json` |
| Block a task | `bd update <id> --status blocked --json` |
| Unblock a task | `bd update <id> --status open --json` |
| Add dependency | `bd dep add <child> <parent>` |
| Close work | `bd close <id> --reason "Done" --json` |
| Sync state | `bd sync` |

---

## Rules

- ✅ Use beads for **all** task tracking
- ✅ Always pass `--json` for programmatic output
- ✅ Claim before starting; close when done
- ✅ Link discovered work with `--deps discovered-from:<id>`
- ✅ Explicitly set `--status blocked` / `--status open` after dep changes
- ✅ Include beads ID in every commit message
- ❌ Never use `bd edit`
- ❌ Never run `bd init` if `.beads/` already exists
- ❌ Never create markdown TODO lists as a substitute
- ❌ Never delete or overwrite existing issues without user confirmation
