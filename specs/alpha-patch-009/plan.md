# Plan — Alpha Patch Epic

**Project ID:** alpha-patch-009
**Date:** 2026-04-12
**Status:** Draft

---

## Overview

The Alpha Patch Epic addresses three high-priority gaps surfaced during alpha testing: (1) the dealer lacks a spatial visualization of the table during live play, (2) players have no way to choose their seat, and (3) the game flow is participation-only with no betting enforcement. This plan delivers a 3D toggle view in the dealer dashboard, a seat picker for both players and dealers, and a full betting state machine with auto-blinds, turn-order enforcement, pot/side-pot tracking, and dealer bet verification.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python 3.12 / FastAPI | Backend API for seat assignment, betting state machine, pot tracking |
| SQLAlchemy 2.x + Alembic | ORM models and migrations for `pot`, `side_pots` columns on `hands` |
| Pydantic v2 | Request/response validation for new endpoints and action schemas |
| React + TypeScript | Frontend components (seat picker, 3D toggle, bet verification UI) |
| Three.js (`pokerScene.ts`) | Existing 3D scene — embedded into `HandDashboard` via toggle |
| Zustand (`dealerStore.ts`) | Dealer state management — extended for betting/pot state |
| Vitest | Frontend unit tests for new components |
| pytest + pytest-mock | Backend tests for seat API, betting logic, pot calculations |

---

## Architecture Components

### Seat Assignment API

New `PATCH /games/{game_id}/players/{player_name}/seat` endpoint in `routes/games.py`. Validates seat range (1–10), checks for conflicts against other active players in the same game, and updates `game_players.seat_number`. The existing `add_player_to_game` endpoint gains conflict checking on the optional `seat_number` field.

### Betting State Machine (Backend)

Extends the existing `HandState` model (`phase`, `current_seat`, `action_index`) with turn-order enforcement logic. On hand start, auto-posts SB/BB as `PlayerHandAction` records and initializes the pot. The `POST .../actions` endpoint validates that only the current-turn player may act, advances `current_seat` after each action, detects street completion (bets equalized), and advances phase. Fold-to-one detection ends the hand immediately.

### Pot & Side-Pot Tracker

New `pot` (Float) and `side_pots` (JSON string) columns on the `hands` table. Every action with an `amount` updates `pot`. When an all-in-for-less is detected, the tracker splits contributions into the main pot (capped at the all-in amount × eligible players) and one or more side pots. Side pots are serialized as `[{"amount": N, "eligible_player_ids": [...]}]`.

### Legal Action Calculator

A pure function in `services/betting.py` that, given the current `HandState`, player action history for the street, and blind amounts, returns the list of legal actions (`fold`, `check`, `call`, `bet`, `raise`) and the `amount_to_call` for the current player. Exposed via `GET .../status` and used for validation in `POST .../actions`.

### 3D Toggle View (Frontend)

A new `TableView3D` React component wrapping the existing `createPokerScene()` in a `useEffect` lifecycle hook (create on mount, dispose on unmount). `HandDashboard` gains a toggle state (`tile` | `3d`) and conditionally renders either the existing tile grid or `TableView3D`. Hand state is mapped from the dealer store into the `HandState` interface expected by `pokerScene.update()`.

### Seat Picker Components (Frontend)

A shared `SeatPicker` component rendering 10 seats in an oval layout. Used in two contexts: (1) `PlayerApp` inserts it as a step between name selection and playing, (2) `GamePlayerManagement` shows it inline for dealer-side reassignment. Both call the same `PATCH .../seat` API endpoint.

### Dealer Bet Verification UI (Frontend)

An extension to `ActiveHandDashboard` that displays the current player's pending action (or "waiting"), with confirm/override controls. Override opens an inline editor for action type and amount, then submits via the existing `POST .../actions` endpoint.

---

## Project Phases

### Phase 1: Backend Foundations (Tasks T-001, T-002)

Deliver all backend changes: seat assignment endpoint with conflict checking, Alembic migration for `pot`/`side_pots`, auto-blind posting, turn-order state machine, legal action calculator, pot tracking with side-pot logic, and comprehensive pytest coverage.

**Deliverables:**
- `PATCH /games/{game_id}/players/{player_name}/seat` endpoint with tests
- Alembic migration adding `pot` and `side_pots` to `hands`
- Updated `start-all` endpoint with auto-blind posting and pot initialization
- Turn-order enforcement in `POST .../actions`
- Legal action calculator in `services/betting.py`
- Pot/side-pot update logic
- `GET .../status` extended with `pot`, `side_pots`, `legal_actions`, `amount_to_call`

### Phase 2: Frontend Integration (Tasks T-003, T-004)

Deliver all frontend components: 3D toggle in HandDashboard, seat picker for both player and dealer flows, and dealer bet verification UI.

**Deliverables:**
- `TableView3D` component with lifecycle management
- Toggle control in `HandDashboard`
- `SeatPicker` component (shared)
- Player seat selection step in `PlayerApp`
- Dealer seat management in `GamePlayerManagement`
- Bet verification panel in `ActiveHandDashboard`
- Vitest coverage for all new components

### Phase 3: UI Stabilization & Polish (Task T-005)

Fix visual and interaction regressions reported during alpha: 3D canvas overflowing behind HUD elements, scrubber lag, and default camera too zoomed in.

**Deliverables:**
- Canvas sizing constrained within HUD bounds (PlaybackView + MobilePlaybackView)
- Scrubber input debounced/throttled; scene updates deferred so dragging is smooth
- Default overhead camera position pulled back in `seatCamera.ts`
- OrbitControls min/max distance tuned
- Vitest tests for layout constraints and scrubber callbacks

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WebGL context limits — toggling 3D view repeatedly could exhaust GPU contexts | Strict dispose-on-unmount lifecycle; test with rapid toggle cycles |
| Side-pot logic complexity — edge cases with multiple all-ins | Implement as a pure function with exhaustive unit tests covering 2-way, 3-way, and cascading all-in scenarios |
| Turn-order bugs — incorrect seat advancement when players fold or are skipped | State machine logic is a pure function tested independently of the API layer; integration tests cover full hand flows |
| Seat conflicts under concurrency — two players pick the same seat simultaneously | Database-level unique constraint on `(game_id, seat_number)` for active players, plus check-then-set in a transaction |
| Scope creep from betting feature — stack tracking, antes, straddles | Explicitly out of scope for this epic; pot tracking is action-amount-based only, no player chip stack management |
| Scrubber debounce hides issues — deferred updates may feel inconsistent | Use `requestAnimationFrame` batching so the scene still updates every frame; only defer expensive equity recalculations |

---

## External Dependencies

- Three.js (already vendored in frontend dependencies)
- No new backend dependencies — all betting logic is pure Python
