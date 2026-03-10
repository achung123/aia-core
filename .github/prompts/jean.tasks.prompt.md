---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
description: Generate tasks.md — atomic, ordered task tickets scoped to one agent interaction each.
---

## Goal

Produce a `tasks.md` file containing an ordered list of atomic engineering tasks with unique IDs, descriptions, dependency chains, and acceptance criteria. Each task is scoped so that a single premium-request agent interaction can complete it. Output to `specs/<project-name>-<project-id>/`.

---

## Context

The tasks file is the **engineering execution plan**. It converts the *what* (spec.md) and *how* (plan.md) into an ordered queue of work. Tasks are consumed by engineers or AI coding agents one at a time, top-to-bottom. Dependencies must be explicit so nothing is started before its prerequisites are done.

---

## Instructions

1. **Read the input.** Parse the idea or design doc. Also read any existing `spec.md` and `plan.md` in the project folder — they are the primary input for task decomposition.
2. **Scan the workspace.** Understand existing code structure, modules, and conventions.
3. **Decompose into tasks.** For each user story in `spec.md` and component in `plan.md`:
   - Break work into the smallest meaningful unit
   - Each task must be completable in **one focused agent interaction** (roughly one premium request)
   - If a task requires multiple files or concepts, it's too big — split it
4. **Assign task IDs.** Format: `T-<sequence>` (e.g., `T-001`, `T-002`). Sequential, zero-padded to 3 digits.
5. **Define dependencies.** For each task, list which task IDs must be completed first. Use `none` for tasks with no dependencies.
6. **Order by dependency chain.** Tasks with no dependencies come first. Tasks whose dependencies are all earlier in the list come next. No task should appear before its dependencies.
7. **Write acceptance criteria.** Each task gets 1–3 specific, testable conditions that define "done."
8. **Tag each task** with a category: `setup`, `feature`, `test`, `docs`, `refactor`, `infra`.
9. **Create the file** at `specs/<project-name>-<project-id>/tasks.md` using the `jean.tasks.template.md` structure.

---

## Output Format

Follow `jean.tasks.template.md` exactly. The file must contain:
- Project header with name, ID, and date
- Summary stats (total tasks, estimated phases)
- Ordered task list, each with: ID, title, category, description, dependencies, acceptance criteria, and story reference

---

## Example

**Input:**
```
Existing spec.md and plan.md for a poker lobby API project.
```

**Expected output (abbreviated):**
```markdown
# Tasks — Poker Lobby API
**Project ID:** poker-lobby-001
**Date:** 2026-03-09
**Total Tasks:** 24

---

### T-001 — Initialize project structure
**Category:** setup
**Dependencies:** none
**Story Ref:** —

Set up the Python project with Poetry, configure pyproject.toml, create src/ and test/ directory structure.

**Acceptance Criteria:**
1. `poetry install` succeeds without errors
2. src/ and test/ directories exist with __init__.py files

---

### T-002 — Define database models for tables and players
**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.1, S-1.2

Create SQLAlchemy models for PokerTable and Player entities with all fields from the spec.

**Acceptance Criteria:**
1. Models define all columns from spec acceptance criteria
2. Relationship between PokerTable and Player is defined
```

---

## Anti-patterns

- **Do NOT create tasks that require multiple agent sessions.** If it takes more than one premium request, split it.
- **Do NOT leave dependencies implicit.** Every task must explicitly declare its dependencies or `none`.
- **Do NOT group unrelated work** into a single task for convenience.
- **Do NOT generate spec.md or plan.md** — this prompt is for tasks.md only.
- **Do NOT skip the story reference.** Link tasks back to `spec.md` story IDs where applicable.
