# Spec — Dealer & Visualization Evolution

**Project ID:** dealer-viz-004
**Date:** 2026-04-09
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Backend — Incremental Hand Building](#epic-1-backend--incremental-hand-building)
2. [Epic 2: Backend — Equity Computation API](#epic-2-backend--equity-computation-api)
3. [Epic 3: Dealer Interface — Game & Hand Selector](#epic-3-dealer-interface--game--hand-selector)
4. [Epic 4: Dealer Interface — Dealer Control Mode](#epic-4-dealer-interface--dealer-control-mode)
5. [Epic 5: Dealer Interface — Embedded Three.js Preview](#epic-5-dealer-interface--embedded-threejs-preview)
6. [Epic 6: Visualization — Mobile-Responsive Three.js View](#epic-6-visualization--mobile-responsive-threejs-view)
7. [Epic 7: Dealer Interface — Player Participation Mode (Phase 2)](#epic-7-dealer-interface--player-participation-mode-phase-2)

---

## Epic 1: Backend — Incremental Hand Building

The current `POST /games/{game_id}/hands` requires all community cards and all player cards upfront. The Dealer Control Mode captures cards incrementally (per-player snapshots throughout a hand, then community cards at the end). This epic adds backend support for creating an empty hand and populating it step-by-step via PATCH endpoints.

### S-1.1 — Create Empty Hand

**As a** dealer, **I want** to create an empty hand (no community cards, no player entries), **so that** I can build up the hand incrementally as I collect cards from each player.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands` accepts an empty payload (no `flop_1`, no `player_entries`) and returns 201
2. The returned `HandResponse` has `hand_number` auto-incremented, all community card fields `null`, and `player_hands` empty
3. Existing behavior (full payload with all cards) still works identically
4. A hand with no community cards and no players is valid in the database

### S-1.2 — Add Player to Hand with Cards

**As a** dealer, **I want** to add a player's hole cards to an existing hand, **so that** I record each player's cards as I collect them one at a time.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/{hand_number}/players` accepts `player_name`, `card_1`, `card_2` (cards optional — `null` means player participated but cards unknown)
2. Returns 201 with the `PlayerHandResponse`
3. Duplicate card validation runs against all cards already in the hand
4. If player_name already exists in this hand, returns 400

### S-1.3 — Set Player Result

**As a** dealer, **I want** to assign a result (won, folded, lost) to a single player in a hand, **so that** I can record each player's outcome as it happens.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}/result` accepts `{ "result": "won"|"folded"|"lost", "profit_loss": float|null }`
2. Returns 200 with the updated `PlayerHandResponse`
3. Returns 404 if player is not in this hand
4. A player with `null` cards but a valid result is allowed (they participated but cards weren't captured)

### S-1.4 — Standardize Result Enum

**As a** developer, **I want** the `result` field on `PlayerHandEntry` and `PlayerResultEntry` to accept only `won`, `folded`, or `lost`, **so that** the API enforces consistent result values.

**Acceptance Criteria:**
1. A Pydantic `ResultEnum` with values `won`, `folded`, `lost` is defined
2. `PlayerHandEntry.result`, `PlayerResultEntry.result`, and the new single-player result endpoint all use this enum
3. Existing tests that use free-text result values are updated
4. `null` result remains valid (player participated but was eliminated / no explicit outcome)

### S-1.5 — Make HandCreate Fields Optional

**As a** developer, **I want** `HandCreate.flop_1/flop_2/flop_3` and `player_entries` to be optional, **so that** empty hands can be created through the existing endpoint.

**Acceptance Criteria:**
1. `HandCreate` schema has all community card fields as `Card | None = None` and `player_entries` as `list[PlayerHandEntry] = []` (empty default)
2. `POST /games/{game_id}/hands` with empty body `{}` returns 201
3. `POST /games/{game_id}/hands` with full cards payload still works identically
4. Alembic migration is not needed (this is a schema validation change only)

---

## Epic 2: Backend — Equity Computation API

The equity calculator currently runs client-side in JavaScript. Moving it to the backend makes it available to both the dealer's embedded preview and the mobile visualization view without duplicating logic, and opens the door to more sophisticated calculations.

### S-2.1 — Equity Computation Endpoint

**As a** dealer viewing the embedded preview, **I want** to call a backend endpoint that returns per-player win equity for a given hand state, **so that** I don't need heavy computation on a mobile device.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}/equity` returns `{ "equities": [{ "player_name": str, "equity": float }] }` for all players with hole cards in the hand
2. Equity calculation uses the current community card state (if flop only, equity reflects that street)
3. Players with `null` hole cards are excluded from equity calculation
4. If fewer than 2 players have hole cards, returns an empty equities list
5. Response time < 500ms for typical hold'em scenarios (2-9 players)

### S-2.2 — Port Evaluator to Python

**As a** developer, **I want** the poker hand evaluator ported from `frontend/src/poker/evaluator.js` to a Python module, **so that** the backend can compute equity without a JS dependency.

**Acceptance Criteria:**
1. `src/app/services/equity.py` contains `calculate_equity(player_hole_cards, community_cards)` returning per-player equity floats
2. Uses exhaustive enumeration for ≤2 unknown cards, Monte Carlo (5,000 iterations) otherwise
3. Unit tests validate against known equity scenarios (AA vs KK, AKs vs QQ, etc.)
4. Results match the existing JS evaluator within ±1% equity

---

## Epic 3: Dealer Interface — Game & Hand Selector

Replace the current "create-only" flow with a landing page that lets the dealer select an existing game or create a new one, then drill into hand management.

### S-3.1 — Game Selector Landing Page

**As a** dealer, **I want** to see a list of existing games when I open the dealer interface, **so that** I can resume recording for an in-progress game.

**Acceptance Criteria:**
1. The dealer landing page lists all game sessions (date, status, player count, hand count)
2. A "New Game" button is prominently displayed to create a new session
3. Tapping a game row navigates to the hand dashboard for that game
4. The list is sorted by date descending (most recent first)
5. Active games are visually distinct from completed games

### S-3.2 — Hand List & Navigation

**As a** dealer, **I want** to see all hands recorded in the current game and navigate to edit any of them, **so that** I can correct mistakes in previous hands.

**Acceptance Criteria:**
1. The hand dashboard shows a scrollable list of past hands with hand number, player count, and result summary
2. Tapping a hand row opens it for editing (shows player grid in edit mode)
3. An "Add New Hand" button creates a new empty hand (via the new incremental endpoint)
4. "Back to Games" button returns to the game selector
5. Current hand count is displayed prominently

### S-3.3 — Integrate Existing GameCreateForm

**As a** dealer, **I want** the "New Game" flow to use the existing game creation form, **so that** I can set the date and select players before starting.

**Acceptance Criteria:**
1. Tapping "New Game" on the landing page shows the existing `GameCreateForm`
2. After creation, the dealer is navigated to the hand dashboard for the new game
3. No changes to the `GameCreateForm` component itself (only wiring changes)

---

## Epic 4: Dealer Interface — Dealer Control Mode

The core gameplay recording flow for the MVP. The dealer collects cards from each player as they fold/win/lose, snaps photos, and assigns outcomes.

### S-4.1 — Player Tiles with Status Indicators

**As a** dealer, **I want** each player tile to show their current status (playing, won, folded, lost), **so that** I can see at a glance where every player stands.

**Acceptance Criteria:**
1. Player tiles display status text below the player name: "playing", "won", "folded", or "lost"
2. Tile background color reflects status: white = playing, green = won, red = folded, orange = lost (showdown loss)
3. The "Table" (community cards) tile remains separate and shows ✅ when recorded
4. Tiles are large, touch-friendly (min 80px height) on mobile

### S-4.2 — Per-Player Card Collection Flow

**As a** dealer, **I want** to tap a player's tile, take a photo of their hole cards, review/correct the detection, and assign an outcome, **so that** I can record each player's cards and result individually.

**Acceptance Criteria:**
1. Tapping a player tile opens the camera capture flow (existing `CameraCapture` component)
2. After detection review, three action buttons appear: "Won", "Folded", "Lost (Showdown)"
3. Selecting an outcome PATCHes the player's result on the backend and updates the tile status
4. The player's hole cards are PATCHed to the backend after review confirmation
5. The dealer returns to the player grid after assigning an outcome

### S-4.3 — Community Card Capture

**As a** dealer, **I want** to capture community cards (flop, turn, river) via the Table tile, **so that** the board is recorded after the hand concludes.

**Acceptance Criteria:**
1. Tapping the "Table" tile opens camera capture for community cards
2. Detection review shows 3-5 detected cards (flop, optional turn, optional river)
3. After confirmation, community cards are PATCHed to the backend
4. The Table tile shows ✅ when community cards are recorded

### S-4.4 — Hand Completion & Elimination Logic

**As a** dealer, **I want** the hand to auto-finalize once community cards are recorded, treating any un-captured player tiles as eliminated, **so that** I can move on without explicitly marking every player.

**Acceptance Criteria:**
1. When the dealer has captured community cards and at least one player outcome, a "Finish Hand" button appears
2. Players whose tiles were never tapped are recorded with `result = null`, `card_1 = null`, `card_2 = null` (they played but were eliminated)
3. After finishing, the dealer returns to the hand list / dashboard
4. A confirmation dialog warns if some players have no cards recorded

### S-4.5 — Dealer State Refactor

**As a** developer, **I want** `dealerState.js` to support per-player result tracking and the new incremental flow, **so that** the UI state matches the new backend contract.

**Acceptance Criteria:**
1. Player state includes `status: 'playing' | 'won' | 'folded' | 'lost'` alongside cards
2. New reducer actions: `SET_PLAYER_RESULT`, `SET_HAND_ID` (for incremental hand), `FINISH_HAND`
3. `RESET_HAND` clears all player statuses back to `playing` and increments hand count
4. Existing tests updated to cover new actions

---

## Epic 5: Dealer Interface — Embedded Three.js Preview

Embed a live Three.js visualization inside the dealer interface so the dealer can see the table, cards, and equity without navigating away.

### S-5.1 — Extract Reusable Three.js Scene Module

**As a** developer, **I want** the Three.js table scene logic extracted into a reusable module, **so that** both the full playback view and the dealer embed can share it.

**Acceptance Criteria:**
1. A new `src/scenes/pokerScene.js` exports `createPokerScene(canvas, options)` that returns `{ scene, camera, renderer, dispose, update }`
2. The existing `playbackView.js` is refactored to use this module
3. The module accepts options for size, seat count, and feature toggles
4. Playback view behavior is unchanged after refactoring

### S-5.2 — Dealer Preview Component

**As a** dealer, **I want** a mini Three.js visualization embedded in the dealer interface showing the current hand, **so that** I can see the table state while recording.

**Acceptance Criteria:**
1. A `DealerPreview.jsx` Preact component renders a `<canvas>` with the poker table scene
2. The preview updates in real-time as community and player cards are recorded
3. The preview is collapsible (tap to expand/collapse) to save screen real estate on mobile
4. The preview canvas adapts to the container width (responsive)

### S-5.3 — Wire Equity Overlay in Dealer Preview

**As a** dealer, **I want** to see live win-equity percentages on the embedded table preview, **so that** I can gauge the hand dynamics while dealing.

**Acceptance Criteria:**
1. After ≥2 players have hole cards recorded, equity badges appear over each seat
2. Equity is fetched from the new `GET .../equity` backend endpoint
3. Equity recalculates when community cards are added (flop → turn → river)
4. If equity fetch fails, the preview gracefully hides equity badges (no error shown)

---

## Epic 6: Visualization — Mobile-Responsive Three.js View

Create a separate lightweight mobile visualization experience with a Three.js scene optimized for touch interaction.

### S-6.1 — Mobile Playback Route

**As a** mobile user, **I want** a dedicated `#/playback-mobile` route with a touch-optimized layout, **so that** I can view hand history on my phone.

**Acceptance Criteria:**
1. `#/playback-mobile` route is registered in the router
2. The layout is full-width with no sidebar — session picker is a bottom drawer / dropdown
3. The Three.js canvas fills the viewport above the controls
4. Auto-redirect to mobile route when viewport width ≤ 768px (optional, configurable)

### S-6.2 — Touch Controls for Three.js Scene

**As a** mobile user, **I want** to pinch-zoom and swipe to orbit the 3D table, **so that** I can explore the visualization with standard mobile gestures.

**Acceptance Criteria:**
1. OrbitControls (or similar) is enabled with touch support
2. Pinch-to-zoom works on iOS Safari and Android Chrome
3. Single-finger drag orbits the camera
4. Camera resets to default position with a double-tap

### S-6.3 — Preact-Styled UI Controls

**As a** mobile user, **I want** the scrubbers and session picker to match the Preact/dealer interface design language, **so that** the app looks cohesive.

**Acceptance Criteria:**
1. Session scrubber and street scrubber are reimplemented as Preact components
2. Styling matches the dealer interface (indigo palette, rounded buttons, tap-friendly sizes)
3. Equity overlay displays below the canvas in a card-style layout
4. Navigation back to `#/dealer` is available

### S-6.4 — Mobile Equity via Backend

**As a** mobile user, **I want** equity percentages fetched from the backend rather than computed locally, **so that** my phone isn't overloaded with Monte Carlo calculations.

**Acceptance Criteria:**
1. The mobile view calls the backend equity endpoint instead of running the JS evaluator
2. Equity updates when the user scrubs to a new hand or street
3. Loading state is shown while equity is being fetched

---

## Epic 7: Dealer Interface — Player Participation Mode (Phase 2)

**⚠️ Deferred — not in scope for Phase 1 tasks.**

Allow players to join from their own phones, capture their own hole cards, and report fold/join decisions. The dealer sees tile color changes in real time.

### S-7.1 — Player Interface Route & Name Selection

**As a** player, **I want** to open a `#/player` route, select my name from the current game, and see my status, **so that** I can participate from my own phone.

**Acceptance Criteria:**
1. `#/player` route displays game selector (active games only) and player name picker
2. Player's name is shown prominently after selection
3. "Join Current Hand" and "Fold" buttons are visible but disabled until the dealer activates the tile

### S-7.2 — Player Card Self-Capture

**As a** player, **I want** to capture my own hole cards when the dealer activates my tile, **so that** the workload is distributed.

**Acceptance Criteria:**
1. When dealer taps the player's tile, the player's "Join Current Hand" button enables
2. Tapping "Join Current Hand" opens camera capture on the player's phone
3. After review/confirm, cards are POSTed to the backend and the dealer's tile turns green

### S-7.3 — Dealer Tile Color States

**As a** dealer, **I want** player tiles to change color based on the player's decision (white → yellow → green/red), **so that** I have real-time visibility.

**Acceptance Criteria:**
1. White = idle, Yellow = pending player decision, Green = joined (cards submitted), Red = folded
2. Color changes are driven by polling the backend hand state (or WebSocket in future)
3. Status label under tile updates: "playing", "pending", "joined", "folded"

### S-7.4 — Player "Hand Back Cards" Action

**As a** player, **I want** to click "Hand Back Cards" when the hand ends, **so that** the dealer can assign my final outcome.

**Acceptance Criteria:**
1. After joining, the player sees only the "Hand Back Cards" button
2. Clicking it notifies the dealer (their tile turns yellow again)
3. The dealer can then assign won/folded/lost for that player
