---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
description: Review all docs in docs/ for gaps, staleness, artifact coverage, and missing poker-domain context.
---

## Goal

Produce a comprehensive documentation audit report identifying: undocumented codebase artifacts, stale docs that no longer match the code, docs missing poker-domain context, and Open Questions that have no linked beads issue.

---

## Context

Documentation lives in `docs/`. The codebase has:
- Routes: `src/app/routes/`
- ORM models: `src/app/database/`
- Pydantic schemas/enums: `src/pydantic_models/`

Full documentation coverage means every route file, ORM model class, and Pydantic schema class has a corresponding doc. Poker-domain context is required — a doc that explains fields only in technical terms without domain meaning is considered incomplete.

---

## Instructions

1. **Inventory the codebase** — list all:
   - Route files: `src/app/routes/*.py` (exclude `__init__.py`, `utils.py` is utility-level)
   - ORM model classes: search for `class .*(Base):` in `src/app/database/`
   - Pydantic schema classes: search for `class .*(BaseModel):` in `src/pydantic_models/`
   - Enum classes: search for `class .*(Enum):` in `src/pydantic_models/`

2. **Inventory `docs/`** — list all existing documentation files recursively; note their last modified date if available

3. **Build the coverage matrix** — for each codebase artifact: does a doc exist? What file? Is it current?

4. **Check for staleness** — read each existing doc and cross-reference against the current code:
   - Does the field table list columns that no longer exist in the ORM model?
   - Do endpoint paths match the current router prefix and decorators?
   - Does the response schema match what the handler actually returns?
   - Mark as **STALE** if any discrepancy is found

5. **Check for missing poker context** — read each existing doc; flag docs where:
   - Fields are described only technically ("stores a string value") with no poker meaning
   - Endpoints lack a "poker context" or "why this endpoint exists" explanation
   - Mark as **NO_CONTEXT**

6. **Check Open Questions** — for each existing doc, read the `## Open Questions` section; identify questions that are still open (not marked resolved) and have no corresponding beads issue linked; collect these for the unresolved questions section

7. **Generate the audit report** using `remy.doc-audit-report.template.md` and write to `docs/audit-report-YYYY-MM-DD.md`

---

## Output Format

`docs/audit-report-YYYY-MM-DD.md` following `remy.doc-audit-report.template.md`.

---

## Example

**Input:** `@remy audit docs`

**Output:** `docs/audit-report-2026-03-11.md`

Key findings:
- Coverage matrix: 8 route files, 2 ORM models, 6 Pydantic schemas found → 0% documented (no `docs/` directory exists yet)
- Missing: all 16 artifacts
- Recommendation table: 16 entries, prioritized by artifact importance

If `docs/` partially exists:
- Stale: `docs/models/Game.md` references a `session_id` field that was removed from the `Game` ORM model
- Missing poker context: `docs/api/upload.md` describes the file upload mechanism technically but never mentions the card detection pipeline context
- Unresolved Open Question: `docs/models/Community.md` Q1 ("players stored as string, no FK") — no linked beads issue

---

## Anti-patterns

- Do NOT audit test files (there should be none in `docs/`)
- Do NOT flag a doc as stale based on file dates alone — check actual field name and path alignment against the code
- Do NOT mark a doc as complete if it has no poker-domain context
- Do NOT skip the unresolved Open Questions check
