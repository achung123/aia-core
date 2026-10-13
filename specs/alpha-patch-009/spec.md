# Spec — Alpha Patch Epic

**Project ID:** alpha-patch-009
**Date:** 2026-04-12
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Dealer 3D Table Visualization](#epic-1-dealer-3d-table-visualization)
2. [Epic 2: Player Seat Selection](#epic-2-player-seat-selection)
3. [Epic 3: Betting State Machine](#epic-3-betting-state-machine)
4. [Epic 4: UI Stabilization & Polish](#epic-4-ui-stabilization--polish)

---

## Epic 1: Dealer 3D Table Visualization

The dealer's `HandDashboard` currently shows hands as a flat tile grid. The Three.js poker scene (`pokerScene.ts`) already renders a 3D table with seat positions, chip stacks, hole cards, and community cards — but it is only used in the playback/mobile views. This epic embeds the 3D scene into the dealer's hand dashboard as a toggle view so the dealer can switch between the familiar tile grid and a live 3D representation of the current hand.

### S-1.1 — Toggle Between Tile Grid and 3D Table View

**As a** dealer, **I want** a toggle button on the Hand Dashboard that switches between the existing tile grid and an embedded 3D table view, **so that** I can see the current hand state visualized spatially while running the game.

**Acceptance Criteria:**
1. A toggle control (button or tab) appears above the hand content area in `HandDashboard`
2. When "3D View" is selected, the Three.js scene from `pokerScene.ts` renders in place of the tile grid
3. When "Tile View" is selected, the existing tile grid renders (default on load)
4. Switching views preserves all hand state — no data is lost or refetched
5. The 3D scene receives the current hand's community cards, player hole cards, results, and seat assignments and renders them correctly

### S-1.2 — 3D Scene Lifecycle in Dashboard

**As a** dealer, **I want** the 3D scene to initialize and dispose properly when toggling views or navigating away, **so that** there are no memory leaks or WebGL context issues.

**Acceptance Criteria:**
1. The Three.js renderer is created when the 3D view mounts and disposed when it unmounts
2. Switching between tile view and 3D view multiple times does not leak WebGL contexts
3. The canvas resizes correctly when the dashboard container resizes
4. OrbitControls are active so the dealer can rotate/zoom the 3D view

---

## Epic 2: Player Seat Selection

Players currently join a game without choosing a seat. The `game_players.seat_number` column exists but is only set programmatically. This epic adds a visual seat picker so players can choose their seat relative to the dealer on join/rejoin, and gives the dealer the ability to assign or reassign seats from the management screen.

### S-2.1 — Seat Assignment API

**As a** backend consumer, **I want** an endpoint to assign or update a player's seat number in a game, **so that** both the player and dealer UIs can persist seat choices.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/players/{player_name}/seat` accepts `{ "seat_number": int }` and returns the updated player info
2. Returns 409 if the requested seat is already occupied by another active player in the same game
3. Returns 400 if `seat_number` is outside the range 1–10
4. Returns 404 if the player is not in the game
5. The `add_player_to_game` endpoint continues to accept an optional `seat_number` on creation, with conflict checking

### S-2.2 — Player Seat Picker UI

**As a** player joining a game on mobile, **I want** to see a visual seat map and pick my seat, **so that** I sit where I want relative to other players and the dealer.

**Acceptance Criteria:**
1. After selecting a game and name, a seat picker screen appears showing 10 seats arranged in an oval
2. Occupied seats show the player's name and are non-selectable
3. Open seats are selectable — tapping one assigns the seat via the API
4. If the player already has a seat, it is highlighted and they can tap a different open seat to move
5. The picker is skippable — players can proceed without choosing a seat

### S-2.3 — Dealer Seat Management

**As a** dealer, **I want** to see and reassign player seats from the `GamePlayerManagement` screen, **so that** I can resolve seating disputes or rebalance the table.

**Acceptance Criteria:**
1. The `GamePlayerManagement` component shows each player's current seat number
2. The dealer can tap a player to open a seat reassignment control
3. Reassignment calls the same `PATCH .../seat` endpoint and updates the UI
4. Conflict feedback is shown if a seat is already taken

---

## Epic 3: Betting State Machine

The current flow is participation-only: join → capture cards → record outcome. There is no enforcement of betting order, no automatic blind posting, no pot accumulation, and no dealer-side bet verification. This epic builds a proper betting state machine over the existing `HandState`, `PlayerHandAction`, and blind infrastructure.

### S-3.1 — Auto-Post Blinds on Hand Start

**As a** system, **I want** small blind and big blind actions to be automatically recorded when a hand starts, **so that** the pot begins with the correct forced bets and players don't need to manually post.

**Acceptance Criteria:**
1. When `POST /games/{game_id}/hands/start-all` creates a new hand, two `PlayerHandAction` records are created: SB player posts `small_blind` amount, BB player posts `big_blind` amount
2. The `HandState.phase` is set to `preflop` and `current_seat` points to the first player after BB (UTG)
3. A new `pot` column on the `hands` table holds the cumulative pot total, initialized to SB + BB
4. If there are fewer than 2 active players, hand start is rejected with 400

### S-3.2 — Turn-Based Action Queries

**As a** player or dealer, **I want** to know whose turn it is and what actions are legal, **so that** the game proceeds in correct order and only valid actions are accepted.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}/status` returns `current_seat`, `current_player_name`, `legal_actions` (list of `fold`/`check`/`call`/`bet`/`raise`), and `amount_to_call`
2. `POST /games/{game_id}/hands/{hand_number}/actions` rejects actions from any player other than the current-turn player (returns 403)
3. After a valid action is recorded, `current_seat` advances to the next active (non-folded) player
4. When all active players have acted and bets are equalized, the phase advances (preflop → flop → turn → river → showdown) and `current_seat` resets to first-to-act for the new street
5. If all but one player folds, the hand ends immediately — remaining player wins

### S-3.3 — Pot Tracking (with Side Pots)

**As a** dealer, **I want** the pot total to update automatically as players bet, call, and raise — and split into side pots when a player is all-in for less than the current bet — **so that** I can see the accurate pot size without manual math and all-in scenarios are handled correctly.

**Acceptance Criteria:**
1. Every `call`, `bet`, `raise`, or `blind` action with a non-null `amount` adds that amount to the pot
2. `GET /games/{game_id}/hands/{hand_number}` includes `pot` (total) and `side_pots` (list) in the response
3. `GET /games/{game_id}/hands/{hand_number}/status` includes `pot` and `side_pots` in the response
4. When a player goes all-in for less than the amount to call, a side pot is created: the main pot is capped at the all-in player's contribution level, and excess chips from other players go into a new side pot that the all-in player is not eligible to win
5. Side pots are stored as a JSON list on the `hands` table (e.g., `[{"amount": 120, "eligible_player_ids": [1,2,3]}, ...]`)
6. `fold` and `check` actions do not change the pot
7. When no all-in-for-less situation exists, `side_pots` is an empty list and `pot` holds the full amount (single-pot behavior)

### S-3.4 — Dealer-Side Bet Verification

**As a** dealer, **I want** to see each player's pending action and confirm or override it, **so that** I can catch mistakes and ensure the physical chips match the digital record.

**Acceptance Criteria:**
1. The dealer's Active Hand Dashboard shows whose turn it is and displays the action the player submitted (or "waiting" if no action yet)
2. The dealer can confirm the action (it gets recorded normally) or override it (submit a corrected action on behalf of the player)
3. Override actions are recorded with the same `POST .../actions` endpoint, and the `amount` can be adjusted
4. After confirmation or override, the turn advances normally
5. If the dealer initiates an action directly (player didn't submit), it is treated the same as a player action

---

## Epic 4: UI Stabilization & Polish

Alpha testers reported several visual and interaction issues: the 3D scene content overflows behind HUD elements (scrubbers, overlays, equity bars), the session/street scrubbers lag noticeably when dragging, and the default camera in player visualization mode is too zoomed in, making it hard to see the full table. This epic addresses these fit-and-finish issues across PlaybackView, MobilePlaybackView, and shared components.

### S-4.1 — Constrain 3D Canvas Within HUD Bounds

**As a** player or spectator, **I want** the 3D table visualization to be bounded by the surrounding HUD elements (scrubbers, equity overlay, stats sidebar), **so that** the scene content never renders behind or is occluded by UI controls.

**Acceptance Criteria:**
1. In `PlaybackView`, the Three.js canvas is sized to fit between the top scrubber bar and bottom street scrubber — it does not extend behind either
2. In `MobilePlaybackView`, the canvas respects the equity row, scrubber, and any bottom HUD elements — no overlap
3. When the window or container is resized, the canvas re-calculates its bounds and the Three.js renderer viewport updates accordingly
4. HUD elements use a higher `z-index` than the canvas as a fallback, but the canvas itself should not require clipping — it must be correctly sized
5. No content is cut off — the full table is still visible within the bounded area

### S-4.2 — Improve Scrubber Responsiveness

**As a** user scrubbing through hands, **I want** the session scrubber and street scrubber to respond instantly to drag input, **so that** playback feels smooth instead of laggy.

**Acceptance Criteria:**
1. Scrubber drag fires `onChange` on every `input` event (not just `change`), and the scene update is debounced or throttled so the UI doesn't freeze
2. The hand index label updates in real-time as the user drags the thumb
3. Scene updates (Three.js `update()` calls, equity recalculations) are deferred or batched so they don't block the slider interaction
4. Perceived scrubber latency is under 100ms on a mid-range mobile device
5. Street scrubber transitions are similarly non-blocking

### S-4.3 — Zoom Out Default Camera in Player Visualization

**As a** player viewing the 3D table on mobile, **I want** the default camera position to be zoomed out enough to show the full table and all seats, **so that** I can see the entire game state without manually zooming.

**Acceptance Criteria:**
1. The `DEFAULT_OVERHEAD_POSITION` in `seatCamera.ts` is moved further from the table center (higher Y and/or further Z) so all 10 seats and the full table surface are visible on a typical mobile viewport
2. The seat-snap camera (`computeSeatCameraPosition`) is also adjusted so the player's first-person view still shows most of the table
3. `OrbitControls` min/max distance are tuned so the user cannot zoom in so far that the table is clipped, nor zoom out so far that the scene is tiny
4. The camera defaults are applied in both `PlaybackView` and `MobilePlaybackView`

---
