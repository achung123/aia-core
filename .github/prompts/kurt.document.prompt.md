---
mode: agent
tools: []
description: "DEPRECATED — replaced by layer-specific prompts. See kurt.backend-db, kurt.backend-api, kurt.backend-ocr, kurt.frontend-glue, kurt.frontend-pages, kurt.frontend-3d, kurt.frontend-mobile, kurt.deployment."
---

> **DEPRECATED** — This generic document prompt has been replaced by layer-specific prompts.
> Use one of: `@kurt backend-db`, `@kurt backend-api`, `@kurt backend-ocr`, `@kurt frontend-glue`, `@kurt frontend-pages`, `@kurt frontend-3d`, `@kurt frontend-mobile`, `@kurt deployment`

---

## Context

All In Analytics Core is a poker session tracking system with:
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic (in `src/app/`)
- **Frontend:** React, TypeScript, Vite (in `frontend/src/`)
- **ML:** YOLO-based card detection (models in `models/`, scripts in `scripts/`)
- **Schemas:** Pydantic models in `src/pydantic_models/`
- **Tests:** pytest in `test/`

Documentation must be grounded in the actual codebase — every claim backed by a file path and symbol name. All mermaid diagrams follow the style guide at `.github/prompts/templates/kurt.mermaid-style.template.md`.

---

## Instructions

1. **Identify the target** — determine whether the user is asking about a backend module, frontend component, database model, ML pipeline, or cross-cutting feature
2. **Read all relevant source files** — use `codebase`, `readFile`, `search`, and `usages` to understand the target's structure, dependencies, and behavior
3. **Read related tests** — scan `test/` for test files that cover the target to understand expected behavior and edge cases
4. **Read the mermaid style guide** — load `.github/prompts/templates/kurt.mermaid-style.template.md` and follow it exactly
5. **Read the document template** — load `.github/prompts/templates/kurt.document.template.md` for output structure
6. **Write the document** following the template:
   - Metadata header (title, date, author, scope, status)
   - Summary (2-3 sentences)
   - Table of Contents
   - Sections covering: purpose, key abstractions, data flow, API surface (if applicable), configuration, and usage examples
   - At least one mermaid diagram showing how the target fits into the larger system
   - Source file reference list with paths
   - Cross-references to related specs and docs
7. **Place the file** at `docs/<topic-slug>.md` unless the user specifies another location
8. **Flag unknowns** — mark anything not found in the codebase as `[TODO]` rather than guessing

---

## Output Format

A single markdown file following `kurt.document.template.md`. Must include:
- Metadata table at the top
- Minimum one mermaid diagram with full color legend
- All source file paths as workspace-relative links
- Prose in present tense, active voice

---

## Example

**Input:**
```
@kurt document game session lifecycle
```

**Expected output:**
A file at `docs/game-session-lifecycle.md` containing:
- Metadata header
- Summary of the game session lifecycle
- Sections: Session Creation, Player Management, Hand Recording, Session Completion
- Mermaid state diagram showing session states (created → active → completed)
- Mermaid sequence diagram showing the API call flow for creating and completing a session
- References to `src/app/routes/`, `src/app/database/`, `src/pydantic_models/`
- Cross-references to relevant specs

---

## Anti-patterns

- **Never** write documentation without reading the source code first
- **Never** fabricate file paths, function names, or API signatures
- **Never** produce a mermaid diagram without the standard color legend and classDef block
- **Never** skip the metadata header or Table of Contents
- **Never** document implementation details that don't exist in the codebase — flag as `[TODO]`
- **Never** combine backend and frontend concerns into a single section — keep them clearly separated
