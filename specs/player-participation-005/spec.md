# Spec — Player Participation Mode

**Project ID:** player-participation-005
**Date:** 2026-04-09
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Player Self-Service Interface](#epic-1-player-self-service-interface)
2. [Epic 2: Dealer Tile Real-Time Status](#epic-2-dealer-tile-real-time-status)
3. [Epic 3: Hand State Polling API](#epic-3-hand-state-polling-api)

---

## Epic 1: Player Self-Service Interface

Allow players to join the game from their own phones, select their identity, capture their own hole cards, and signal "hand back cards" when the hand ends.

### S-1.1 — Player Route & Name Selection

**As a** player, **I want** to open a `#/player` route on my phone, select the active game, and pick my name from the game's player list, **so that** I can participate from my own device.

**Acceptance Criteria:**
1. `#/player` route is registered in the frontend router and renders a `PlayerApp` component
2. Route displays a game selector showing only active games (reuses existing `fetchSessions` filtered to `status === 'active'`)
3. After selecting a game, player sees a name picker listing all players in that game (fetched via `fetchGame`)
4. After selecting a name, the player's name is shown prominently and persisted in component state
5. If a `?game=<id>` query param is present, the game selector is skipped and that game is pre-selected
6. The player sees the current hand status: waiting for hand, pending (their tile was tapped), or active (cards submitted)

### S-1.2 — Player Card Self-Capture

**As a** player, **I want** to capture my own hole cards when the dealer activates my tile, **so that** the card-recording workload is distributed across the table.

**Acceptance Criteria:**
1. When polling detects the player has a PlayerHand row with `card_1 = null` and `result = null` (i.e., "pending"), the "Join Current Hand" button becomes enabled
2. Tapping "Join Current Hand" opens the existing `CameraCapture` component on the player's phone, passing the current `gameId` and the player's name as `targetName`
3. After capture, the existing `DetectionReview` component is shown for confirmation/correction
4. On confirm, hole cards are POSTed to the backend via the existing `updateHolecards` API (`PATCH /games/{id}/hands/{num}/players/{name}`)
5. After a successful PATCH, the player's view updates to show their submitted cards and a "Hand Back Cards" button
6. If the camera/detection fails, the player sees an error with a retry option (existing `CameraCapture` error handling)

### S-1.3 — Player "Hand Back Cards" Action

**As a** player, **I want** to click "Hand Back Cards" when the hand ends, **so that** the dealer knows I'm ready for outcome assignment.

**Acceptance Criteria:**
1. After successfully submitting hole cards, the player's view shows only a "Hand Back Cards" button and their card values
2. Clicking "Hand Back Cards" sends `PATCH /games/{id}/hands/{num}/players/{name}/result` with `{ "result": "handed_back" }`
3. After submission, the player's view shows "Waiting for dealer…" and the button is disabled
4. The result value `"handed_back"` is accepted by the existing `patchPlayerResult` endpoint (validation must allow it)
5. Polling continues so the player can see when the dealer assigns a final outcome (won/lost/folded)

### S-1.4 — Player Fold Action

**As a** player, **I want** to tap "Fold" before capturing cards, **so that** I can signal to the dealer that I'm out of this hand without the capture workflow.

**Acceptance Criteria:**
1. When the player is in "pending" state, a "Fold" button is displayed alongside "Join Current Hand"
2. Tapping "Fold" sends `PATCH /games/{id}/hands/{num}/players/{name}/result` with `{ "result": "folded" }`
3. After folding, the player's view shows "Folded" and both buttons are disabled
4. The dealer's tile turns red for that player on the next poll cycle

---

## Epic 2: Dealer Tile Real-Time Status

Update the dealer's tile grid to reflect player participation state in real time via polling, and provide a QR code for players to join.

### S-2.1 — Expanded Tile Color States

**As a** dealer, **I want** player tiles to change color based on the player's participation state (idle → pending → joined → folded → handed_back), **so that** I have real-time visibility of the table.

**Acceptance Criteria:**
1. Tile color mapping extends the existing `statusColors` in `PlayerGrid.jsx`:
   - `not_playing` / idle: `#e5e7eb` (grey — existing)
   - `playing` (pending — PlayerHand exists, no cards, no result): `#fef08a` (yellow)
   - Cards submitted (card_1 ≠ null, result = null): `#bbf7d0` (green)
   - `folded`: `#fecaca` (red — existing)
   - `handed_back`: `#fef08a` (yellow, same as pending — signals dealer attention needed)
   - `won`: `#bbf7d0` (green — existing)
   - `lost`: `#fed7aa` (orange — existing)
2. A status label under each tile updates to reflect the participation state: "pending", "joined", "folded", "handed back", "won", "lost"
3. Color changes are driven by the dealer polling the hand state endpoint every 3 seconds
4. When a new hand is created and the dealer taps a player tile, the backend creates a PlayerHand row (existing flow) which moves the tile to "pending" on the next poll

### S-2.2 — QR Code for Player Access

**As a** dealer, **I want** to see a QR code in the dealer UI that players can scan to open the player route with the current game pre-selected, **so that** players can join quickly without typing a URL.

**Acceptance Criteria:**
1. A QR code is displayed in the dealer's game view (after selecting a game, before/during hands)
2. The QR code encodes the full URL: `<host>/#/player?game=<gameId>`
3. QR code is generated client-side using a lightweight library (e.g., `qrcode` npm package)
4. QR code updates if the selected game changes
5. A "Show QR" toggle button controls visibility so it doesn't clutter the UI during active play

---

## Epic 3: Hand State Polling API

Provide a backend endpoint that returns the current hand's player participation states, enabling both dealer and player clients to poll for updates.

### S-3.1 — Hand Status Polling Endpoint

**As a** client application, **I want** to poll a single endpoint to get the current hand's player participation states, **so that** both dealer and player views can update in near-real-time without WebSockets.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}/status` returns a JSON response with:
   - `hand_number`: int
   - `community_recorded`: bool (true if flop_1 is not null)
   - `players`: array of `{ name, participation_status, card_1, card_2, result, outcome_street }`
2. `participation_status` is derived server-side:
   - `"idle"` — player is in the game but has no PlayerHand row for this hand
   - `"pending"` — PlayerHand row exists, `card_1` is null and `result` is null
   - `"joined"` — PlayerHand row exists, `card_1` is not null and `result` is null
   - `"folded"` — `result = "folded"`
   - `"handed_back"` — `result = "handed_back"`
   - `"won"` / `"lost"` — final result assigned
3. Returns 404 if game or hand not found
4. Response includes `ETag` or `Last-Modified` header so clients can skip unchanged responses (optional optimization)
5. The endpoint is read-only and idempotent — safe for frequent polling

### S-3.2 — Validate "handed_back" as Result Value

**As a** backend system, **I want** the player result validation to accept `"handed_back"` as a valid result value, **so that** the "Hand Back Cards" flow works end-to-end.

**Acceptance Criteria:**
1. The `result` field on `PlayerResultUpdate` (Pydantic model) accepts `"handed_back"` as a valid value
2. The `patchPlayerResult` endpoint successfully stores `"handed_back"` in the database
3. The `"handed_back"` value is excluded from stats calculations (it's a transient lifecycle state, not a final outcome)
4. Existing tests continue to pass — `"handed_back"` does not break enum validation for won/lost/folded
