---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - fetch
description: Generate spec.md — user stories capturing what the system does and why.
---

## Goal

Produce a `spec.md` file containing user stories grouped by epic, placed in `specs/<project-name>-<project-id>/`. Each story captures *what* the user can do and *why* it matters.

---

## Context

The spec is the **requirements source of truth** for the project. It is consumed by engineers, designers, and stakeholders. Every user story must be testable and unambiguous. The spec does not describe *how* to build — that belongs in `plan.md`.

---

## Instructions

1. **Read the input.** Parse the idea, design doc, or URL. If a `plan.md` or prior intake summary exists in the project folder, read that too.
2. **Scan the workspace.** Understand existing domain models, routes, and conventions to write stories that fit the project.
3. **Run intake (unless already completed).** If confirmed requirements from a prior `@jean intake` or `@jean plan` session exist in the project folder or conversation, reference those and proceed. Otherwise, run intake: present up to 7 focused questions grouped by theme and wait for answers before generating anything.
4. **Identify epics.** Group related functionality into 3–8 epics (fewer for small projects).
4. **Write user stories.** For each epic, write stories in the format:
   - **Title** — short, descriptive
   - **Narrative** — "As a [role], I want [capability], so that [benefit]."
   - **Acceptance criteria** — numbered list of testable conditions
5. **Assign story IDs.** Format: `S-<epic-number>.<story-number>` (e.g., `S-1.1`, `S-1.2`, `S-2.1`).
6. **Create the file** at `specs/<project-name>-<project-id>/spec.md` using the `jean.spec.template.md` structure.

---

## Output Format

Follow `jean.spec.template.md` exactly. The file must contain:
- Project header with name, ID, and date
- Table of contents listing each epic
- Epics with embedded user stories
- Each story with ID, narrative, and acceptance criteria

---

## Example

**Input:**
```
A REST API for managing a poker game lobby — players can create tables, join tables, and start games.
```

**Expected output (abbreviated):**
```markdown
# Spec — Poker Lobby API
**Project ID:** poker-lobby-001
**Date:** 2026-03-09

## Epic 1: Table Management

### S-1.1 — Create a Table
**As a** player, **I want** to create a new poker table with configurable settings, **so that** I can host a game on my terms.

**Acceptance Criteria:**
1. POST /tables creates a new table and returns the table ID
2. Table settings include: name, max players, blind levels, buy-in range
3. Creator is automatically seated at the table
```

---

## Anti-patterns

- **Do NOT skip intake** unless confirmed requirements already exist from a prior intake session. When in doubt, ask.
- **Do NOT generate spec.md without confirming requirements first.** If no prior intake exists, run one.
- **Do NOT include implementation details** in user stories. No API contracts, database schemas, or code snippets.
- **Do NOT write stories that aren't testable.** "The system should be fast" is not a story — "Page loads in under 2 seconds" is.
- **Do NOT skip acceptance criteria.** Every story must have at least 2 acceptance criteria.
- **Do NOT generate plan.md or tasks.md** — this prompt is for spec.md only.
