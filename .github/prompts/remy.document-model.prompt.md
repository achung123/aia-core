---
mode: agent
tools:
  - codebase
  - readFile
  - search
  - usages
  - createFile
description: Generate a data model reference for a SQLAlchemy ORM class, including field definitions, relationships, and poker-domain context.
---

## Goal

Produce a complete ORM data model reference — field definitions, type and constraint details, relationships, business rules, poker-domain field meanings, cross-references to related schemas and endpoints, and a gap-analysis Open Questions section.

---

## Context

**Stack:** SQLAlchemy 2.x ORM, SQLite. Python 3.12.

**Domain:** Texas Hold'em poker analytics. ORM models represent real poker objects — cards, hands, game sessions, players — and are the authoritative source of truth for what is persisted.

**Card notation stored in the database:** rank + suit string, e.g. `"AH"` (Ace of Hearts), `"10S"` (Ten of Spades).

---

## Instructions

1. **Find the model class** — search `src/app/database/` for `class <Name>(Base):`; if the name is ambiguous, list all model classes found and ask for clarification

2. **Read the full class definition** — extract every `Column()`: name, SQLAlchemy type, nullable, default, index, unique, and primary_key constraints

3. **Find related Pydantic schemas** — use `search` and `usages` to find schemas in `src/pydantic_models/` that mirror or overlap with this ORM model; note which ORM fields map to which schema fields and flag any mismatches

4. **Find all database query functions** that read or write this model — search `src/app/database/` for functions that construct queries for this model's table; read their filters, joins, and return shapes

5. **Find all route handlers** that ultimately return this model's data — use `usages` and `search` to trace from the model through query functions to route handlers; list the resulting API endpoints

6. **Write poker-domain context for every field** — what does this field represent in a game of Texas Hold'em? Be specific about the poker concept, not just the technical type.

7. **Run gap analysis:**
   - Fields with no clear domain meaning (e.g., a generic `data` column)
   - Missing foreign key constraints for implied relationships (e.g., `players` stored as a String instead of FK to a players table)
   - Nullable fields that should be required by poker rules (e.g., a hand's `hand_number` shouldn't be nullable)
   - Missing `unique=True` or `index=True` on business keys used in common lookups
   - Columns storing multiple comma-delimited values as a single string (denormalization worth flagging)
   - Absence of `relationship()` declarations where cross-table access is common

8. **Write the doc** using `remy.data-model.template.md`, and write the output file to `docs/models/<ModelName>.md`

---

## Output Format

`docs/models/<ModelName>.md` following `remy.data-model.template.md`.

---

## Example

**Input:** `@remy document model Community`

**Output:** `docs/models/Community.md`

Key sections:
- **Table:** `community`
- **Fields:** `id` (PK), `game_date` (String), `time_stamp` (String), `hand_number` (Integer), `flop_card_0` / `flop_card_1` / `flop_card_2` (String, the three flop cards), `turn_card` (String), `river_card` (String), `players` (String)
- **Poker context:** This model stores the shared board cards for one hand of Texas Hold'em. The three flop cards, turn, and river collectively form the 5-card community board that all players use to build their best hand.
- **Open Questions:**
  > **Q1** `database_models.py:21` — `players` (String) appears to store comma-separated player names with no FK to a players table. This is denormalized. Is this intentional, or should this reference player IDs?
  > **Q2** `database_models.py:11` — No `UniqueConstraint` on `(game_date, hand_number)`. Can two hands have the same number on the same date?

---

## Anti-patterns

- Do NOT infer column types from field names — always read the `Column()` definition
- Do NOT skip the related schema and endpoint cross-reference steps
- Do NOT omit the Open Questions section
- Do NOT guess at relationship semantics — if implied, flag it as an open question
