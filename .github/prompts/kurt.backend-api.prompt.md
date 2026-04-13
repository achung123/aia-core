---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - editFiles
  - usages
description: Document backend API routes focusing on core interactive poker game logic — session management, hand recording, player actions, betting rounds, and results.
---

## Goal

Produce clear, grounded documentation for the FastAPI backend routes that implement core poker game logic — session lifecycle, hand management, player actions, betting, and result recording. Output uses a mix of prose explaining the poker domain, tabular endpoint references, sequence diagrams for request flows, and code references.

---

## Context

The AIA backend API implements interactive Texas Hold'em logic:
- **Routers:** `src/app/routes/` — one file per endpoint group
- **Pydantic schemas:** `src/pydantic_models/` — request/response models
- **Database models:** `src/app/database/database_models.py`
- **Main app:** `src/app/main.py` — router registration, middleware, CORS
- **Tests:** `test/` — endpoint tests with example payloads

The API is not just CRUD — it encodes **poker game rules**: valid hand states, betting round sequences (preflop → flop → turn → river), player positions, blind structure, fold/call/raise actions, pot calculation, and winner determination. Documentation must explain both the REST interface AND the poker logic it enforces.

---

## Instructions

1. **Read the router files** — scan `src/app/routes/` to identify all endpoints, their HTTP methods, paths, request/response types
2. **Read the Pydantic schemas** — load request/response models from `src/pydantic_models/`
3. **Read the database models** — understand what each endpoint persists or queries
4. **Read related tests** — extract example payloads and edge case behaviors from `test/`
5. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
6. **Write the document** combining:
   - **Prose:** Explain the poker game logic each endpoint group enforces — what game rules are validated, what state transitions are legal
   - **Tables:** Endpoint reference tables (method, path, summary, request body, response, status codes)
   - **Tables:** Per-endpoint schema tables (field, type, required, description) for request and response bodies
   - **Mermaid sequence diagrams:** Show the full request lifecycle for key workflows (create game → add players → record hand → determine winner)
   - **Mermaid state diagrams:** Show game/hand state machines the API enforces
   - **Code references:** Cite router functions, Pydantic models, and validation logic
   - **Example payloads:** Actual curl + JSON from tests
7. **Place the file** at `docs/backend/api-poker-logic.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Overview of the poker game API (what domain rules it encodes)
- Endpoint group sections, each containing:
  - Prose explaining the poker logic
  - Endpoint reference table
  - Request/response schema tables
  - Example curl + JSON payloads
  - Sequence diagram for the key flow
- Game state machine diagram
- Source file references

---

## Example

**Input:**
```
@kurt backend-api hand recording
```

**Expected output:**
A file at `docs/backend/api-hand-recording.md` containing:
- Prose: how a hand flows through preflop → flop → turn → river, what the API validates at each stage
- Endpoint table: POST/GET/PATCH/DELETE for hands, hole cards, community cards
- Schema tables for `CreateHandRequest`, `HandResponse`, etc.
- Sequence diagram: dealer creates hand → adds hole cards → adds community cards → records result
- State diagram: hand states (empty → hole_cards_dealt → flop → turn → river → complete)
- Example JSON payloads from test files
- References to router files, Pydantic models, and database models

---

## Anti-patterns

- **Never** document an endpoint without reading its router source code
- **Never** describe poker rules without verifying the API actually enforces them
- **Never** fabricate request/response fields — read the Pydantic model
- **Never** skip the sequence diagram — API docs always need a request flow visual
- **Never** separate the poker logic explanation from the endpoint it belongs to — keep them together
- **Never** omit error responses and status codes
