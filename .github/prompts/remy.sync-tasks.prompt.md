---
mode: agent
tools:
  - runInTerminal
  - terminalLastCommand
  - readFile
  - listDirectory
  - search
  - codebase
description: Read open beads issues and Jean's tasks.md to produce a prioritized documentation work queue.
---

## Goal

Identify all artifacts (APIs, models, schemas, concepts) that exist in the codebase but have no corresponding documentation, then produce a prioritized work queue for documentation tasks — referencing both beads and Jean's tasks.md.

---

## Context

Documentation is tracked two ways:
1. **beads** — run `bd list --json` for all issues; filter for `feature` or `task` type issues that are closed and likely produced new surfaces
2. **Jean's tasks.md** — `specs/*/tasks.md` contains all task definitions with acceptance criteria; completed tasks that produced new features/endpoints/models may not yet have docs

Existing docs live in `docs/`. The work queue surfaces what is missing, stale, or undocumented.

---

## Instructions

1. **Read Jean's tasks file** — find `specs/*/tasks.md` (glob for any project); extract all tasks that are:
   - Marked complete (look for `[x]`, `done`, `closed`, or similar markers)
   - Type `feature`, `task`, or describe adding/creating an endpoint, model, or schema
   - Cross-reference against `docs/` — does a corresponding doc exist?

2. **Query beads** — run `bd list --json`; filter for issues where:
   - Type is `feature`
   - Status is `closed`
   - Cross-reference against `docs/` to find undocumented ones

3. **Inventory the codebase** — list all:
   - Route files: `src/app/routes/*.py`
   - ORM model classes: search `src/app/database/` for `class .*(Base):`
   - Pydantic schema classes: search `src/pydantic_models/` for `class .*(BaseModel):`
   - Enum classes: search `src/pydantic_models/` for `class .*(Enum):`

4. **Cross-reference against `docs/`** — for each artifact found, check whether a corresponding `.md` doc file exists anywhere under `docs/`

5. **Build the work queue** — categorize findings:
   - **MISSING** — artifact exists in code, no doc exists anywhere
   - **STALE** — doc exists but references field names or endpoint paths that no longer match the code
   - **UNDOCUMENTED TASK** — closed beads/tasks.md task produced a feature with no doc

6. **Assign priority:**
   - **HIGH** — primary resource routes (game, hand, player, session), core ORM models
   - **MEDIUM** — supporting routes (stats, search, upload), derived schemas
   - **LOW** — enum-only schemas, utility modules, concept explainers

7. **Output to chat** in the format below. Do NOT write a file.

---

## Output Format

Chat window only — no file written.

```
## Documentation Work Queue — <YYYY-MM-DD>

### Missing Documentation
| Priority | Artifact | Type | Source | Recommended Command |
|---|---|---|---|---|
| HIGH | src/app/routes/images.py | API Router | codebase scan | `@remy document api src/app/routes/images.py` |

### Stale Documentation
| Doc File | Issue | Recommended Fix |
|---|---|---|
| docs/models/Game.md | Field `session_id` in doc but not in ORM | `@remy document model Game` |

### Undocumented Completed Tasks
| Task | Beads ID | Artifact | Recommended Command |
|---|---|---|---|
| T-012 Add card detection endpoint | aia-core-4xy | images.py | `@remy document api src/app/routes/images.py` |

### Summary
- Total artifacts found: N
- Documented: N (N%)
- Missing: N
- Stale: N
```

---

## Example

**Input:** `@remy sync tasks`

**Output (chat):**

```
## Documentation Work Queue — 2026-03-11

### Missing Documentation
| Priority | Artifact | Type | Recommended Command |
|---|---|---|---|
| HIGH | src/app/routes/images.py | API Router | @remy document api src/app/routes/images.py |
| HIGH | Community (ORM model) | Data Model | @remy document model Community |
| HIGH | Game (ORM model) | Data Model | @remy document model Game |
| MEDIUM | GameState (enum) | Schema | @remy document schema GameState |
| MEDIUM | CardRank (enum) | Schema | @remy document schema CardRank |

### Summary
- Total artifacts found: 15
- Documented: 0 (0%)
- Missing: 15
```

---

## Anti-patterns

- Do NOT write a file — output only to the chat window
- Do NOT flag test files or files in `test/` as needing documentation
- Do NOT include bug fix or refactor tasks in the work queue
- Do NOT guess at artifact existence — discover it by scanning the codebase
