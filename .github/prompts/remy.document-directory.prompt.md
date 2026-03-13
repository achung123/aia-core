---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - createFile
  - editFiles
  - search
  - usages
description: Explore a directory, classify every artifact by type, and generate a single consolidated README.md placed directly inside the target directory.
---

## Goal

Produce a single, consolidated `README.md` documenting every artifact in a target directory. Run a discovery routine to classify each file, then write one Markdown file placed directly inside the target directory — each artifact gets its own named section with poker-domain context and gap analysis.

---

## Context

**Project:** AIA Core — a FastAPI + SQLAlchemy poker analytics backend tracking Texas Hold'em games.

**Domain:** The system records game sessions (multi-hand play between a fixed set of players), hands (one full round of betting streets), community cards (flop/turn/river), player hole cards, card detections from uploaded images, and player statistics.

**Card notation:** rank + suit string, e.g. `"AH"` (Ace of Hearts), `"10S"` (Ten of Spades). Ranks: `A, 2–10, J, Q, K`. Suits: `S, H, D, C`.

**Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x (ORM), Pydantic v2, SQLite, pytest.

**Key source directories:**
- `src/app/routes/` — FastAPI routers (one file per domain: game, games, hands, players, images, upload, stats, search)
- `src/app/database/` — SQLAlchemy ORM models and query functions
- `src/pydantic_models/` — Pydantic request/response schemas, enumerations, validators
- `src/app/services/` — Business logic services

**Audience:** Internal Python developers AND external consumers (front-end engineers building a UI against this API). Every doc must serve both audiences.

**Companion templates:** Use the section structures from these templates as a guide for each artifact's section within the single `README.md`:
- API router section → `remy.api-reference.template.md`
- SQLAlchemy ORM model section → `remy.data-model.template.md`
- Pydantic schema / enum section → `remy.schema-reference.template.md`
- Utility section → `remy.concept-explainer.template.md`
- Top-level overview → `remy.directory-index.template.md`

---

## Instructions

1. **List the target directory** — use `listDirectory` on the supplied path; recurse into subdirectories if the target contains nested folders.

2. **Read and classify each Python file** using this decision tree (check signals in order):
   - File imports `APIRouter` AND contains `@router.GET/POST/PUT/DELETE/PATCH` decorators → **API Router** → `remy.api-reference.template.md` (one doc per router file)
   - File contains `class <Name>(Base):` (SQLAlchemy `declarative_base` subclass) → **ORM Model** → `remy.data-model.template.md` (one doc per class found in the file)
   - File contains `class <Name>(BaseModel):` → **Pydantic Schema** → `remy.schema-reference.template.md` (one doc per class; group same-file enums into the nearest parent schema doc)
   - File contains `class <Name>(str, Enum):` or `class <Name>(Enum):` with no BaseModel classes → **Enumeration** → `remy.schema-reference.template.md` (enum section)
   - `__init__.py` with only import re-exports → **skip**
   - All other `.py` files with public functions → **Utility Reference** → `remy.concept-explainer.template.md`

3. **Output the classification manifest to chat before generating any file:**
   ```
   ## Discovery Manifest: <directory>
   | File | Classification | Template | Artifacts Found |
   |------|---------------|----------|-----------------|
   | ...  | ...           | ...      | ...             |
   ```

4. **Build the consolidated `README.md`** — all artifacts in one file, each as a named H2 section:
   - Begin with a **Module Overview** (what this directory does, where it fits in the system, how it connects to other modules)
   - Follow with the **Discovery Manifest** table
   - For each classified artifact, write an H2 section using the artifact name (e.g., `## Player` for the `Player` ORM class).
     - Read the full source; trace call chains where relevant
     - Use the corresponding template as a structural guide for that section's content
     - Never write "TODO" or "description here" — unknown values go to Open Questions instead
   - Close with a single **Open Questions** section aggregating all gaps across the entire directory

5. **Run gap analysis spanning the whole directory:**
   - Evaluate each artifact for: semantic clarity, completeness, naming consistency (ORM vs Pydantic vs API key), poker alignment, missing validation, implied-but-unenforced relationships
   - Collect all gaps into the single `## Open Questions` section at the bottom of the `README.md`
   - If no gaps were found: `## Open Questions\n\nNone identified.`
   - Each entry must include: artifact reference (file:line), observation, why it matters, suggested resolution

6. **Write the single file to `<target-directory>/README.md`** — for example, documenting `src/app/database/` produces `src/app/database/README.md`.

7. **Output a completion summary to chat** after the file is written:
   ```
   ## Documentation Complete: <directory>
   | Artifact | Type | Section | Open Questions |
   |----------|------|---------|----------------|
   ```

---

## Output Format

A single `README.md` written to `<target-directory>/README.md`. Completion summary table output to the chat window after the file is written.

---

## Example

**Input:** `@remy document src/app/routes/`

**Classification manifest (chat):**
```
| File | Classification | Template | Artifacts Found |
|---|---|---|---|
| game.py | API Router | remy.api-reference.template.md | 3 endpoints |
| players.py | API Router | remy.api-reference.template.md | 4 endpoints |
| hands.py | API Router | remy.api-reference.template.md | 5 endpoints |
| images.py | API Router | remy.api-reference.template.md | 2 endpoints |
| upload.py | API Router | remy.api-reference.template.md | 2 endpoints |
| utils.py | Utility Reference | remy.concept-explainer.template.md | 4 functions |
```

**Generated file:**
- `src/app/routes/README.md` — single consolidated doc with sections for each router and the utility module

**Open Questions example (in `src/app/routes/README.md`):**
> **Q1** `src/app/routes/game.py:45` — The `winner` field is stored as a raw string. No FK to the `players` table exists. Is this intentional (denormalized for speed) or a data integrity gap that should reference player IDs?

---

## Anti-patterns

- Do NOT skip the classification manifest — always show the plan before generating files
- Do NOT scatter output across multiple files in `docs/` — produce exactly one `README.md` inside the target directory
- Do NOT document test files or files in `test/`
- Do NOT use placeholder text in any generated doc — unknown values go to Open Questions
- Do NOT omit the Open Questions section — every doc must have one, even if it says "None identified."
- Do NOT assume poker semantics — derive all meanings from actual field names, enum values, and handler logic
- Do NOT start generating any documentation before reading the actual file contents
