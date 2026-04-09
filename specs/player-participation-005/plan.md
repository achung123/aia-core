# Plan — Player Participation Mode

**Project ID:** player-participation-005
**Date:** 2026-04-09
**Status:** Draft

---

## Overview

Player Participation Mode allows poker players to join the game from their own phones, capture their own hole cards via camera, and signal fold/hand-back decisions — while the dealer sees tile color changes in real time via polling. This project builds on the existing dealer interface (dealer-viz-004) by adding a player-facing route, a hand-status polling endpoint, and expanded tile color states. No schema changes are needed; participation state is derived from existing `PlayerHand` columns. The `result` field is overloaded with a transient `"handed_back"` value.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| FastAPI | New polling endpoint (`GET /games/{id}/hands/{num}/status`) |
| SQLAlchemy 2.x | Query hand + player_hand state for derived participation status |
| Pydantic v2 | Response model for hand status; extend result validation to accept `"handed_back"` |
| Preact | Player-facing SPA components, dealer tile updates |
| preact/hooks | State management in `PlayerApp` via `useState` / `useEffect` polling |
| qrcode (npm) | Client-side QR code generation for player URL |
| Vite | Dev server and build tooling (existing) |
| pytest + TestClient | Backend endpoint tests |
| vitest / preact-testing-library | Frontend component tests (existing test setup) |

---

## Architecture Components

### Hand Status Polling Endpoint (Backend)

A new read-only `GET /games/{game_id}/hands/{hand_number}/status` endpoint in the hands router. Returns all game players with a derived `participation_status` field computed from `PlayerHand` row existence + `card_1` + `result` values. Both dealer and player clients poll this endpoint every 3 seconds.

**Derivation logic:**
- No `PlayerHand` row → `"idle"`
- Row exists, `card_1 = null`, `result = null` → `"pending"`
- Row exists, `card_1 ≠ null`, `result = null` → `"joined"`
- `result = "folded"` → `"folded"`
- `result = "handed_back"` → `"handed_back"`
- `result = "won"` / `"lost"` → `"won"` / `"lost"`

### Player App (Frontend)

A new `PlayerApp` component mounted at `#/player`. Manages its own state via `useState`/`useEffect` (no shared reducer with dealer). Flow:

1. **Game selection** — either from `?game=<id>` query param or interactive picker (filtered to active games)
2. **Name selection** — pick from game's player list
3. **Polling loop** — polls hand status every 3s; derives own participation status
4. **Pending state** — shows "Join Current Hand" + "Fold" buttons
5. **Capture flow** — reuses `CameraCapture` → `DetectionReview` → `updateHolecards` PATCH
6. **Joined state** — shows submitted cards + "Hand Back Cards" button
7. **Handed-back / final** — shows outcome assigned by dealer

### Dealer Tile Enhancements (Frontend)

Extend `PlayerGrid.jsx` with new color states for participation-mode statuses. The dealer's existing `fetchHand` polling is replaced/augmented by polling the new status endpoint, which provides `participation_status` directly. A "Show QR" toggle renders a QR code encoding `<host>/#/player?game=<id>`.

### API Client Extensions (Frontend)

New functions in `frontend/src/api/client.js`:
- `fetchHandStatus(gameId, handNumber)` — calls the new polling endpoint
- `setPlayerResult(gameId, handNumber, playerName, result)` — wraps existing `patchPlayerResult` for the "Fold" and "Hand Back Cards" actions (this already exists but may be used directly)

### Result Validation Extension (Backend)

The `PlayerResultUpdate` Pydantic model and the `patchPlayerResult` endpoint already accept freeform strings for `result`. If there's an enum constraint, `"handed_back"` must be added. Stats calculations must skip `"handed_back"` rows to avoid corrupting metrics.

---

## Project Phases

### Phase 1: Backend Foundation

Build the polling endpoint, extend result validation, and write comprehensive tests. This unblocks all frontend work.

**Deliverables:**
- `GET /games/{id}/hands/{num}/status` endpoint with derived participation status
- `"handed_back"` accepted in result validation
- Stats queries exclude `"handed_back"` results
- Full pytest coverage for the new endpoint and edge cases

### Phase 2: Player Frontend

Build the `PlayerApp` component with game/name selection, polling loop, capture flow, fold, and hand-back actions.

**Deliverables:**
- `#/player` route in router
- `PlayerApp.jsx` with full participation flow
- Reuse of `CameraCapture` and `DetectionReview` components
- Frontend tests for player state transitions

### Phase 3: Dealer Enhancements

Extend dealer tile colors for participation states, add polling integration, and add QR code display.

**Deliverables:**
- Extended `statusColors` and status labels in `PlayerGrid.jsx`
- Dealer polling via the new status endpoint
- QR code component with "Show QR" toggle
- Updated dealer component tests

### Phase 4: Integration & Polish

End-to-end testing of multi-client flows, polling reliability, and edge cases.

**Deliverables:**
- Integration tests for dealer-tap → player-capture → dealer-sees-green flow
- Edge case handling (player joins after hand creation, game with no active hand)
- Polling cleanup on unmount (no leaked intervals)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Polling at 3s creates noticeable lag for "real-time" feel | Acceptable for Phase 1; WebSocket upgrade path is documented in S-3.1 AC4 |
| `"handed_back"` as a result value could leak into stats | Explicitly filter it in stats queries; add test coverage |
| Multiple players polling simultaneously increases server load | Endpoint is read-only, no joins beyond what `fetchHand` already does; add index if needed |
| Player selects wrong name — no auth to prevent impersonation | Acceptable for home poker; name-only identity is a known limitation |
| Camera capture may not work on all mobile browsers | Existing `CameraCapture` uses `<input type="file" accept="image/*">` which has broad support |
| QR code library adds bundle size | Use lightweight `qrcode` package (~15KB gzipped); lazy-load if needed |

---

## External Dependencies

- `qrcode` npm package for client-side QR code generation (new dependency)
- Existing backend endpoints: `addPlayerToHand`, `updateHolecards`, `patchPlayerResult`, `fetchGame`, `fetchHands`
- Existing frontend components: `CameraCapture`, `DetectionReview`, `GameSelector`
