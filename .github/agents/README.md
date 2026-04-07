# Agent Team — Quick Reference

This project uses a team of five VS Code custom agents that cover the full development lifecycle: planning, task management, implementation, testing/review, and agent creation.

---

## Agents

### Jean (Phoenix) — Master Project Planner

Transforms abstract ideas and design documents into structured specs, plans, and task breakdowns.

| Command | Description |
|---|---|
| `@jean plan <idea or doc>` | Full pipeline — intake questions, then generates `spec.md`, `plan.md`, and `tasks.md` |
| `@jean intake <idea or doc>` | Clarification interview to surface ambiguities before document generation |
| `@jean spec <idea or doc>` | Generates only `spec.md` (user stories) |
| `@jean tasks <idea or doc>` | Generates only `tasks.md` (atomic task tickets) |

**Output:** All files go to `specs/<project-name>-<project-id>/`.

---

### Logan (Wolverine) — Beads Task Manager

Bridges planning and execution by syncing Jean's task plans into [beads](https://github.com/steveyegge/beads) and tracking task lifecycle.

| Command | Description |
|---|---|
| `@logan sync <project>` | Imports Jean's `tasks.md` into beads with priorities, dependencies, and hierarchy |
| `@logan ready` | Lists all tasks whose blockers are resolved — the next actionable work |
| `@logan status [id]` | Shows status of a single task or an overview of all tracked tasks |
| `@logan claim <id>` | Claims a task — sets assignee and moves it to `in_progress` |
| `@logan close <id>` | Closes a task with a completion reason and updates dependents |

---

### Hank (Beast) — Staff Software Engineer

TDD-first implementer who picks up tasks from beads, implements them red-green-refactor style, and closes them when done.

| Command | Description |
|---|---|
| `@hank implement <id>` | Claims a beads task, implements it TDD-style, runs tests, and closes the task |
| `@hank debug <description>` | Investigates and fixes a bug — writes a failing test first, then fixes |
| `@hank refactor <target>` | Refactors a module or function — ensures tests pass before and after |
| `@hank test <target>` | Writes or fixes tests for a module/function without changing production code |

**TDD Cycle:** Red (failing test) → Green (minimal code to pass) → Refactor (clean up).

---

### Scott (Cyclops) — Test Architect & Code Reviewer

Ensures every line of production code is tested, every test maps to a requirement, and code quality meets staff-level standards.

| Command | Description |
|---|---|
| `@scott trace <spec or folder>` | Maps tests to spec stories and task acceptance criteria — generates a traceability report |
| `@scott review <file or folder>` | Code review for correctness, security, patterns, and conventions — generates a review report |
| `@scott coverage <target>` | Runs coverage analysis, identifies untested code paths — generates a coverage report |

**Output:** Reports go to `specs/<project-id>/reports/`.

---

### Xavier (Professor X) — Master Prompt Engineer

Designs and scaffolds new agents — agent files, task-specific prompts, and output templates — in one shot.

| Command | Description |
|---|---|
| `@xavier create agent <description>` | Scaffolds a complete agent: `.agent.md`, all `.prompt.md` files, and any `template.md` files |
| `@xavier design workflow <description>` | Plans a multi-agent pipeline with handoffs, then scaffolds every agent |
| `@xavier audit <agent name or path>` | Reviews an existing agent against the scaffold standard and suggests fixes |
| `@xavier list` | Lists all agents, prompts, and templates in the workspace |

---

## Common Development Workflow

The agents are designed to chain together through the full lifecycle of a feature. Here is the typical workflow:

```
  Jean          Logan          Hank           Scott
   │              │              │              │
   │ plan idea    │              │              │
   ├─────────────►│ sync tasks   │              │
   │              ├─────────────►│ implement    │
   │              │              ├─────────────►│ review & trace
   │              │              │◄─────────────┤ (findings)
   │              │              │ fix issues   │
   │              │◄─────────────┤ close task   │
   │              │              │              │
```

### 1. Plan the Feature

Start with Jean to turn an idea into actionable artifacts:

```
@jean plan <your idea or design doc>
```

Jean will ask clarification questions if needed, then produce `spec.md`, `plan.md`, and `tasks.md` in the `specs/` folder.

### 2. Sync Tasks into Beads

Hand off to Logan to import the task plan into beads for tracking:

```
@logan sync <project>
```

Logan creates beads issues with priorities, dependencies, and hierarchy matching Jean's task breakdown.

### 3. Find Ready Work

Ask Logan what's available to work on:

```
@logan ready
```

This surfaces tasks whose blockers have been resolved.

### 4. Implement a Task

Hand a ready task to Hank for TDD implementation:

```
@hank implement <task-id>
```

Hank claims the task, writes failing tests, implements the code, verifies all tests pass, and closes the task in beads.

### 5. Review & Validate

After implementation, bring in Scott to verify quality:

```
@scott review src/app/
@scott trace <spec-folder>
@scott coverage src/app/
```

Scott produces reports highlighting code issues, uncovered requirements, and coverage gaps.

### 6. Fix Any Issues

If Scott surfaces problems, send them back to Hank:

```
@hank debug <issue description>
```

### 7. Repeat

Continue the loop — `@logan ready` → `@hank implement` → `@scott review` — until all tasks are closed.

---

## Ad-Hoc Commands

Not every interaction needs the full workflow. Common standalone uses:

- **Quick bug fix:** `@hank debug <description>` — no beads task needed
- **Refactor:** `@hank refactor <target>` — works independently of task tracking
- **Code review:** `@scott review <file>` — review any code at any time
- **New agent:** `@xavier create agent <description>` — spin up a new agent on demand

---

## Agent Handoffs

Agents can hand off to each other directly. Key handoff paths:

| From | To | Trigger |
|---|---|---|
| Jean | Logan | After generating tasks — sync them into beads |
| Logan | Jean | Before sync — when a project needs planning first |
| Logan | Hank | Ready tasks available for implementation |
| Hank | Logan | After implementation — close the completed task |
| Scott | Hank | Issues found that need fixing or tests that need writing |
| Xavier | Any | After creating a new agent — test it with a representative task |
