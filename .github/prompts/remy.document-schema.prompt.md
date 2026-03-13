---
mode: agent
tools:
  - codebase
  - readFile
  - search
  - usages
  - createFile
description: Generate a schema reference for a Pydantic model or enum, including validation rules, example JSON, endpoint usage, and domain context.
---

## Goal

Produce a complete Pydantic schema reference — all fields, types, validators, defaults, example JSON payloads, endpoint usage cross-references, related ORM model mapping, and a gap-analysis Open Questions section.

---

## Context

**Stack:** Pydantic v2, Python 3.12.

**Domain:** Texas Hold'em poker analytics. Schemas serve double duty: input validation for API requests and output serialization for API responses.

**Pydantic v2 notes:**
- Use `model_config = ConfigDict(...)` instead of `class Config`
- `field_validator` replaces `validator`; `model_validator` replaces `root_validator`
- `computed_field` is used for derived properties

---

## Instructions

1. **Find the schema class** — search `src/pydantic_models/` for `class <Name>(BaseModel):` or for the enum `class <Name>(str, Enum):`

2. **Read the full class definition** — extract every field: name, type annotation (including `Optional`, `List`, `Literal`), `Field(...)` constraints (min_length, max_length, gt, ge, pattern, etc.), default value, alias, and `computed_field` declarations

3. **Identify all validators** — read every `@field_validator` and `@model_validator`; document their logic in plain English and what invariant they enforce

4. **Find all API endpoints** that use this schema — use `usages` to find the schema name in route handlers; determine whether it's used as request body, response model, or query parameter

5. **Find the related ORM model** — use `search` to find the corresponding SQLAlchemy model; document the field mapping (ORM column → Pydantic field); flag any fields present in one but absent in the other

6. **Construct realistic example JSON** — valid request example (if used as request body) and valid response example (if used as response model), using real card notation and poker-appropriate values

7. **Run gap analysis:**
   - Pydantic fields present but with no matching ORM column (may be computed or silently dropped)
   - ORM columns with no corresponding Pydantic field (data silently excluded from API responses)
   - Missing validation for poker-specific values (card rank/suit strings, hand player counts, game state transitions)
   - Inconsistent naming between ORM and schema for the same concept (e.g., ORM has `game_date`, schema has `date`)
   - `Optional` fields that should be required by poker rules

8. **Write the doc** using `remy.schema-reference.template.md`, and write to `docs/schemas/<SchemaName>.md`

---

## Output Format

`docs/schemas/<SchemaName>.md` following `remy.schema-reference.template.md`.

---

## Example

**Input:** `@remy document schema CardRank`

**Output:** `docs/schemas/CardRank.md`

Key sections:
- **Base:** `str, Enum`
- **Role:** Enumeration — valid card rank values accepted and stored by the system
- **Members table:** `ACE = "A"`, `TWO = "2"`, ... `KING = "K"` — each with poker meaning
- **Used in:** `Hand` request schema `hole_cards` field; `Community` response schema
- **Open Questions:** "The system stores `TEN = "10"` (two characters) while all other ranks are single characters. Does this affect card-string parsing or sorting logic anywhere? See `src/pydantic_models/card_validator.py`."

**Input:** `@remy document schema GameState`

**Output:** `docs/schemas/GameState.md`
- Members: `FLOP`, `TURN`, `RIVER`, `BAD_GAME_STATE`
- Poker context: Represents the current betting street. `BAD_GAME_STATE` is a sentinel for invalid state transitions — not a real poker concept.

---

## Anti-patterns

- Do NOT document validator logic without tracing what exact constraint it enforces
- Do NOT provide example JSON with incorrect types — derive all types from actual field annotations
- Do NOT skip the ORM mapping cross-reference step
- Do NOT omit the Open Questions section
