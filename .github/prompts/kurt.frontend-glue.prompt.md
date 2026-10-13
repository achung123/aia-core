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
description: Document the frontend-to-backend integration layer — API client, hooks, stores, data fetching patterns, and type contracts between React frontend and FastAPI backend.
---

## Goal

Produce clear, grounded documentation for the frontend glue layer — how the React/TypeScript frontend communicates with the FastAPI backend. Covers API client setup, custom hooks, state stores, type contracts, error handling, and data flow patterns.

---

## Context

The AIA frontend (`frontend/src/`) connects to the FastAPI backend via:
- **API client:** `frontend/src/api/` — HTTP client, endpoint functions
- **Hooks:** `frontend/src/hooks/` — custom React hooks for data fetching
- **Stores:** `frontend/src/stores/` — state management (game state, player state, etc.)
- **Types:** `frontend/src/types/` — TypeScript types that mirror Pydantic schemas
- **Components:** consume hooks and stores to render UI

The glue layer is the critical contract between frontend and backend — TypeScript types must match Pydantic schemas, API calls must match FastAPI route signatures, and error handling must account for all backend response codes.

---

## Instructions

1. **Read the API client** — load `frontend/src/api/` to understand HTTP client setup, base URL config, and endpoint functions
2. **Read custom hooks** — load `frontend/src/hooks/` to see data fetching patterns
3. **Read stores** — load `frontend/src/stores/` to understand state management
4. **Read TypeScript types** — load `frontend/src/types/` and compare to `src/pydantic_models/`
5. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
6. **Write the document** combining:
   - **Prose:** Explain the data flow architecture — how a user action triggers a hook → API call → backend → response → store update → re-render
   - **Tables:** API function inventory (function, endpoint, method, request type, response type), type contract mapping (TypeScript type ↔ Pydantic model)
   - **Mermaid flowchart:** Data flow from component → hook → API client → backend → response → store → component
   - **Mermaid sequence diagram:** Specific interaction (e.g., creating a game session from the UI)
   - **Code references:** Exact function names, hook names, store actions, and type definitions
7. **Place the file** at `docs/frontend/api-integration.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Data flow overview (prose + flowchart)
- API client section (functions table + configuration)
- Hooks section (hook inventory table + usage patterns)
- Stores section (store inventory + state shape)
- Type contract section (TypeScript ↔ Pydantic mapping table)
- Sequence diagram for a key user workflow
- Source file references

---

## Example

**Input:**
```
@kurt frontend-glue api hooks
```

**Expected output:**
A file at `docs/frontend/api-integration.md` containing:
- Flowchart: Component → useGameSession hook → api/gameSessions.ts → POST /game-sessions → store update → re-render
- API functions table: createGameSession(), getGameSessions(), etc.
- Hooks table: useGameSession, usePlayerStats, etc. with their return types
- Type mapping: GameSession (TS) ↔ GameSessionResponse (Pydantic)
- Sequence diagram: user clicks "New Game" → hook fires → API call → response → store → UI update
- Error handling patterns documented

---

## Anti-patterns

- **Never** document API functions without reading the actual source files
- **Never** assume TypeScript types match Pydantic models — verify by reading both
- **Never** skip the data flow diagram — it's the core visual for the glue layer
- **Never** document hooks without showing what components consume them
- **Never** omit error handling and loading state patterns
