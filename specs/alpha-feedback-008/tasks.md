# Tasks — Alpha Feedback Overhaul

**Project ID:** alpha-feedback-008
**Date:** 2026-04-12
**Total Tasks:** 53
**Status:** Draft
**Depends on:** `frontend-react-ts-006` — the React/TypeScript migration must be fully complete before any task in this project begins.

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Alembic migration — `is_active` on `game_players` | infra | none | S-2.1 |
| T-002 | Alembic migration — `sb_player_id`, `bb_player_id` on `hands` | infra | none | S-2.5 |
| T-003 | Alembic migration — `player_hand_actions` table | infra | none | S-3.1 |
| T-004 | Alembic migration — blind fields on `game_sessions` | infra | none | S-3.3 |
| T-005 | Toggle player active status endpoint | feature | T-001 | S-2.2 |
| T-006 | Add player to existing game endpoint | feature | T-001 | S-2.3 |
| T-007 | Update GameSessionResponse for active status | feature | T-001 | S-2.1 |
| T-008 | Start-all hand endpoint with SB/BB rotation | feature | T-001, T-002 | S-2.4, S-2.5 |
| T-009 | Record player action endpoint | feature | T-003 | S-3.2 |
| T-010 | Retrieve hand actions endpoint | feature | T-003 | S-3.5 |
| T-011 | Fold action auto-sets player result | feature | T-009 | S-3.2 |
| T-012 | Blind management endpoints (GET + PATCH) | feature | T-004 | S-3.4 |
| T-013 | Server timestamp & request-ID middleware | infra | none | S-9.2 |
| T-014 | ETag support on hand status endpoint | feature | T-013 | S-9.1 |
| T-015 | Remove dealer-centric mode toggle and code paths | refactor | none | S-1.1 |
| T-016 | Remove legacy handPayload submission flow | refactor | T-015 | S-1.2 |
| T-017 | API client — add new endpoint functions | feature | T-005, T-006, T-008, T-009, T-012 | S-2.2, S-2.3, S-2.4, S-3.2, S-3.4 |
| T-018 | Rebuild DealerApp shell (single-mode, mobile-first) | feature | T-015, T-016 | S-5.1 |
| T-019 | Player management UI component | feature | T-017, T-018 | S-5.2 |
| T-020 | One-button Start Hand UI | feature | T-017, T-018 | S-5.3 |
| T-021 | Active Hand Dashboard (tiles + board + blind bar) | feature | T-020, T-012 | S-5.3 |
| T-022 | Dealer community card capture (rebuilt, incremental) | feature | T-021 | S-5.4 |
| T-023 | Blind display & timer UI component | feature | T-012, T-017, T-021 | S-5.5 |
| T-024 | Showdown trigger + auto-detection frontend logic | feature | T-022 | S-4.1, S-4.3 |
| T-025 | Full editable dealer review screen | feature | T-024 | S-4.2 |
| T-026 | End hand flow with terminal state check | feature | T-025 | S-4.4 |
| T-027 | QR code simplification | feature | T-018 | S-6.1 |
| T-028 | Player session pinning (sessionStorage) | feature | none | S-6.2 |
| T-029 | Chip picker component | feature | none | S-6.3 |
| T-030 | Player action buttons (fold/check/call/bet/raise) | feature | T-009, T-017, T-029 | S-6.4 |
| T-031 | Player blind & position display | feature | T-012, T-017 | S-6.5 |
| T-032 | Player Table View screen (3D scene, mobile-first) | feature | none | S-7.1 |
| T-033 | Adjusted equity display (player perspective) | feature | T-032 | S-7.2 |
| T-034 | Showdown card reveals in player viz | feature | T-032 | S-7.3 |
| T-035 | Player game scrubber (range slider) | feature | T-032 | S-7.4 |
| T-036 | Range slider scrubber for all SessionScrubber views | feature | none | S-8.1 |
| T-037 | Seat-snap camera view | feature | none | S-8.2 |
| T-038 | Live hand updates without refresh | feature | T-036 | S-8.3 |
| T-039 | Polling optimization (conditional requests, intervals) | feature | T-014 | S-9.1 |
| T-040 | Structured request logging middleware | infra | T-013 | S-9.2 |
| T-041 | Dealer flow integration test | test | T-026 | S-4.4, S-5.3 |
| T-042 | Player flow integration test | test | T-030, T-034 | S-6.4, S-7.3 |
| T-043 | Alembic migration — `seat_number` on `game_players` | infra | none | S-2.6 |
| T-044 | Auto-seat assignment on game creation | feature | T-043 | S-2.6 |
| T-045 | Alembic migration — `buy_in` on `game_players` | infra | none | S-2.7 |
| T-046 | Buy-in capture on game/player creation endpoints | feature | T-045 | S-2.7 |
| T-047 | Alembic migration — `rebuys` table | infra | none | S-2.8 |
| T-048 | Re-buy/buyback recording & listing endpoints | feature | T-047 | S-2.8 |
| T-049 | Alembic migration — `hand_states` table | infra | none | S-10.1 |
| T-050 | Turn-order state machine logic & endpoints | feature | T-049, T-008 | S-10.2 |
| T-051 | Top-N OCR predictions in detection correction UI | feature | none | S-4.5 |
| T-052 | Image local preview in camera capture flow | feature | none | S-4.6 |
| T-053 | Split-screen dealer input layout | feature | T-021 | S-5.6 |

---

## Task Details

### T-001 — Alembic migration — `is_active` on `game_players`

**Category:** infra
**Dependencies:** none
**Story Ref:** S-2.1

Add an `is_active` boolean column (default `true`) to the `game_players` table. Update the `GamePlayer` SQLAlchemy model to include the field. Generate and apply the Alembic migration.

**Acceptance Criteria:**
1. `alembic revision --autogenerate -m "add is_active to game_players"` produces a valid migration
2. `alembic upgrade head` succeeds; existing rows get `is_active = true`
3. `GamePlayer` model in `src/app/database/models.py` has `is_active = Column(Boolean, default=True, nullable=False)`
4. `uv run pytest test/` passes (no existing tests break)

---

### T-002 — Alembic migration — `sb_player_id`, `bb_player_id` on `hands`

**Category:** infra
**Dependencies:** none
**Story Ref:** S-2.5

Add `sb_player_id` and `bb_player_id` nullable FK columns to the `hands` table. Update the `Hand` model.

**Acceptance Criteria:**
1. Migration adds both columns as `Integer, ForeignKey('players.player_id'), nullable=True`
2. `Hand` model includes `sb_player_id` and `bb_player_id` fields
3. Existing hands retain null values for both columns
4. `uv run pytest test/` passes

---

### T-003 — Alembic migration — `player_hand_actions` table

**Category:** infra
**Dependencies:** none
**Story Ref:** S-3.1

Create the `player_hand_actions` table and `PlayerHandAction` SQLAlchemy model.

**Acceptance Criteria:**
1. Table schema: `action_id` (PK auto), `player_hand_id` (FK → player_hands.player_hand_id, not null), `street` (String, not null), `action` (String, not null), `amount` (Float, nullable), `created_at` (DateTime, default utcnow)
2. `PlayerHandAction` model defined in `src/app/database/models.py`
3. Relationship: `PlayerHand.actions` ↔ `PlayerHandAction.player_hand`
4. Migration applies cleanly; `uv run pytest test/` passes

---

### T-004 — Alembic migration — blind fields on `game_sessions`

**Category:** infra
**Dependencies:** none
**Story Ref:** S-3.3

Add blind-related columns to `game_sessions`: `small_blind`, `big_blind`, `blind_timer_minutes`, `blind_timer_paused`, `blind_timer_started_at`. Update the `GameSession` model.

**Acceptance Criteria:**
1. `small_blind` Float default 0.10, `big_blind` Float default 0.20
2. `blind_timer_minutes` Integer default 15, `blind_timer_paused` Boolean default false
3. `blind_timer_started_at` DateTime nullable
4. Existing games get default values; migration applies cleanly
5. `uv run pytest test/` passes

---

### T-005 — Toggle player active status endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-2.2

Add `PATCH /games/{game_id}/players/{player_name}/status` to toggle a player's `is_active` flag.

**Acceptance Criteria:**
1. Accepts `{ "is_active": bool }` body
2. Returns 200 with `{ "player_name": str, "is_active": bool }`
3. Returns 404 if the player is not in the game
4. Does NOT delete PlayerHand rows — only flips the flag
5. Tests in `test/test_toggle_player_status_api.py` cover activate, deactivate, not-found, idempotent toggle
6. `uv run pytest test/` passes

---

### T-006 — Add player to existing game endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-2.3

Add `POST /games/{game_id}/players` to add a player to an existing game (for buy-back-ins).

**Acceptance Criteria:**
1. Accepts `{ "player_name": str }`
2. Creates `Player` if needed, adds `GamePlayer` row with `is_active = true`
3. Returns 201 with player info
4. Returns 409 if player already in game; returns 404 if game not found
5. Tests cover: new player, existing player in system but not game, duplicate, inactive player (should return 409 with hint to use toggle)
6. `uv run pytest test/` passes

---

### T-007 — Update GameSessionResponse for active status

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-2.1

Update `GameSessionResponse` Pydantic model and the `GET /games/{id}` endpoint to include each player's `is_active` status.

**Acceptance Criteria:**
1. `GameSessionResponse.player_names` is replaced or augmented with `players: list[{ name: str, is_active: bool }]`
2. Backward compatibility: if `player_names` is still used elsewhere, maintain it as a computed property or update all references
3. Tests verify the new response shape
4. `uv run pytest test/` passes

---

### T-008 — Start-all hand endpoint with SB/BB rotation

**Category:** feature
**Dependencies:** T-001, T-002
**Story Ref:** S-2.4, S-2.5

Add `POST /games/{game_id}/hands/start` that creates an empty hand, adds `PlayerHand` rows for all active players, and auto-assigns SB/BB.

**Acceptance Criteria:**
1. Creates hand with next `hand_number`, creates `PlayerHand` for each active `GamePlayer`
2. SB/BB assigned by rotating through active players based on previous hand's positions (or first two for hand 1)
3. Response is `HandResponse` with `sb_player_name`, `bb_player_name`, and all player entries
4. Returns 400 if < 2 active players; 404 if game not found
5. Tests: first hand rotation, subsequent rotation, inactive players excluded, edge cases
6. `uv run pytest test/` passes

---

### T-009 — Record player action endpoint

**Category:** feature
**Dependencies:** T-003
**Story Ref:** S-3.2

Add `POST /games/{game_id}/hands/{hand_number}/players/{player_name}/actions` to record a betting action.

**Acceptance Criteria:**
1. Accepts `{ "street": str, "action": str, "amount": float | null }`
2. Validates `street` ∈ {preflop, flop, turn, river}; `action` ∈ {fold, check, call, bet, raise}
3. Returns 201 with created action record
4. Returns 404 for missing game/hand/player
5. Test file `test/test_player_actions_api.py` covers all action types, validation errors, and 404 cases
6. `uv run pytest test/` passes

---

### T-010 — Retrieve hand actions endpoint

**Category:** feature
**Dependencies:** T-003
**Story Ref:** S-3.5

Add `GET /games/{game_id}/hands/{hand_number}/actions` returning all actions for a hand.

**Acceptance Criteria:**
1. Returns array of `{ player_name, street, action, amount, created_at }` ordered by `created_at`
2. Includes player name resolved from `PlayerHand` → `Player`
3. Returns empty list for hand with no actions; 404 for missing game/hand
4. Tests verify ordering, empty case, and 404s
5. `uv run pytest test/` passes

---

### T-011 — Fold action auto-sets player result

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-3.2

When a `fold` action is recorded via the action endpoint, automatically set `result = "folded"` on the corresponding `PlayerHand` row.

**Acceptance Criteria:**
1. Recording `{ "action": "fold" }` also sets `PlayerHand.result = "folded"`
2. Subsequent GET of the hand shows the player as folded
3. Recording fold on an already-folded player returns 400 ("already folded")
4. Non-fold actions do not modify the result field
5. Tests verify the side-effect and the duplicate guard
6. `uv run pytest test/` passes

---

### T-012 — Blind management endpoints (GET + PATCH)

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-3.4

Add `GET /games/{game_id}/blinds` and `PATCH /games/{game_id}/blinds` endpoints.

**Acceptance Criteria:**
1. GET returns `{ small_blind, big_blind, blind_timer_minutes, blind_timer_paused, blind_timer_started_at }`
2. PATCH accepts partial updates for any blind field
3. Updating `small_blind` or `big_blind` resets `blind_timer_started_at` to now (new level timer starts)
4. Pausing stores the implicit remaining time; resuming adjusts `blind_timer_started_at` so the countdown continues
5. Tests cover: read, advance blinds, pause, resume, partial update
6. `uv run pytest test/` passes

---

### T-013 — Server timestamp & request-ID middleware

**Category:** infra
**Dependencies:** none
**Story Ref:** S-9.2

Add FastAPI middleware that attaches `X-Request-Id` (UUID) and `X-Response-Time-Ms` headers to every response.

**Acceptance Criteria:**
1. Middleware is registered in `main.py` after CORS middleware
2. `X-Request-Id` is a UUID4 string, unique per request
3. `X-Response-Time-Ms` is the wall-clock time in milliseconds (float, 2 decimal places)
4. Headers appear on all endpoints including error responses
5. Tests verify both headers are present and `X-Response-Time-Ms` is a valid number
6. `uv run pytest test/` passes

---

### T-014 — ETag support on hand status endpoint

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-9.1

Add ETag support to `GET /games/{id}/hands/{num}/status` so clients can send `If-None-Match` and receive 304 when data hasn't changed.

**Acceptance Criteria:**
1. Response includes an `ETag` header (hash of the response body)
2. If request includes `If-None-Match` matching the current ETag, return 304 with empty body
3. If data has changed, return 200 with new ETag
4. Tests verify 304 on unchanged data and 200 on changed data
5. `uv run pytest test/` passes

---

### T-015 — Remove dealer-centric mode toggle and code paths

**Category:** refactor
**Dependencies:** none
**Story Ref:** S-1.1

Remove `GameMode` type's `'dealer_centric'` value, the `SET_GAME_MODE` action, and all conditional branches in `DealerApp`, `PlayerGrid`, `HandDashboard`, and `OutcomeButtons` that check for dealer-centric mode. All components are now React TSX (post-006 migration).

**Acceptance Criteria:**
1. `GameMode` type only has `'participation'` (or is removed entirely)
2. No `gameMode === 'dealer_centric'` conditionals exist anywhere in the codebase
3. `dealerState.ts` and `dealerStore.ts` no longer reference dealer-centric mode
4. `npm run build` succeeds with zero TypeScript errors
5. All frontend tests pass after updates (React Testing Library)

---

### T-016 — Remove legacy handPayload submission flow

**Category:** refactor
**Dependencies:** T-015
**Story Ref:** S-1.2

Remove the old full-hand submission flow from `handPayload.ts` and the "Submit Hand" button from `DealerApp`.

**Acceptance Criteria:**
1. `handPayload.ts` is deleted or reduced to only incremental-flow helpers (if any remain)
2. "Submit Hand" button (old all-at-once flow) is removed from dealer UI
3. `handPayload.test.ts` is updated or removed accordingly
4. `npm run build` succeeds with zero TypeScript errors; all tests pass

---

### T-017 — API client — add new endpoint functions

**Category:** feature
**Dependencies:** T-005, T-006, T-008, T-009, T-012
**Story Ref:** S-2.2, S-2.3, S-2.4, S-3.2, S-3.4

Add typed functions to `frontend/src/api/client.ts` for all new backend endpoints.

**Acceptance Criteria:**
1. `togglePlayerStatus(gameId, playerName, isActive)` — PATCH player status
2. `addPlayerToGame(gameId, playerName, buyIn?)` — POST add player (with optional buy-in)
3. `startHand(gameId)` — POST start-all hand
4. `recordPlayerAction(gameId, handNumber, playerName, data)` — POST action
5. `fetchHandActions(gameId, handNumber)` — GET actions
6. `fetchBlinds(gameId)` / `updateBlinds(gameId, data)` — GET/PATCH blinds
7. `recordRebuy(gameId, playerName, amount)` — POST re-buy
8. `fetchRebuys(gameId, playerName)` — GET re-buys
9. `fetchHandState(gameId, handNumber)` — GET hand state machine state
10. All functions follow existing `request()` helper pattern with proper error handling

---

### T-018 — Rebuild DealerApp shell (single-mode, mobile-first)

**Category:** feature
**Dependencies:** T-015, T-016
**Story Ref:** S-5.1

Create a new `DealerApp` React TSX component (or refactor the existing one) with the rebuilt flow: Game Selection → Game Dashboard → Active Hand → Review. No mode toggle.

**Acceptance Criteria:**
1. Steps are: `gameSelector` → `dashboard` → `activeHand` → `review`
2. Each step renders a corresponding child component (placeholder OK for later tasks)
3. Navigation between steps is clear and one-thumb accessible
4. State management uses the Zustand store (stripped of dealer-centric actions)
5. Basic React Testing Library render test exists; `npm run build` succeeds

---

### T-019 — Player management UI component

**Category:** feature
**Dependencies:** T-017, T-018
**Story Ref:** S-5.2

Build a `PlayerManagement` React TSX component accessible from the Game Dashboard that lists players with active/inactive toggles and allows adding new players.

**Acceptance Criteria:**
1. Lists all game players with their active/inactive status
2. Toggle switches call `togglePlayerStatus()` and update the list immediately
3. "Add Player" input + button calls `addPlayerToGame()` and appends to the list
4. Error states shown inline (player already exists, network error)
5. React Testing Library test verifies render, toggle, and add flows (mocked API)

---

### T-020 — One-button Start Hand UI

**Category:** feature
**Dependencies:** T-017, T-018
**Story Ref:** S-5.3

Add a "Start Hand" button on the Game Dashboard that calls the `startHand()` API and transitions to the Active Hand view.

**Acceptance Criteria:**
1. "Start Hand" button visible on the dashboard; calls `startHand(gameId)`
2. On success, transitions to the Active Hand step with the new hand loaded
3. Button shows a loading state during the API call
4. Error message displayed if start fails (e.g., no active players)
5. Component test verifies the flow (mocked API)

---

### T-021 — Active Hand Dashboard (tiles + board + blind bar)

**Category:** feature
**Dependencies:** T-020, T-012
**Story Ref:** S-5.3

Build the Active Hand view with player tiles (status-colored), board area (community card slots), and blind info bar.

**Acceptance Criteria:**
1. Player tiles show name, participation status, and last action (if any)
2. Tile colors use the existing `statusColors` mapping
3. Board area shows 5 slots: empty → flop1/2/3 → turn → river (filled as captured)
4. Blind info bar shows current level and SB/BB player names
5. "Take Flop" / "Take Turn" / "Take River" buttons shown (wired in T-022)
6. "Showdown" button shown (wired in T-024)
7. Polling via `fetchHandStatus()` every 3 seconds updates tiles
8. Component test verifies tile rendering and status display

---

### T-022 — Dealer community card capture (rebuilt, incremental)

**Category:** feature
**Dependencies:** T-021
**Story Ref:** S-5.4

Wire the "Take Flop" / "Take Turn" / "Take River" buttons to open `CameraCapture` → `DetectionReview` → PATCH to the corresponding backend endpoint.

**Acceptance Criteria:**
1. "Take Flop" opens capture expecting 3 cards; on confirm, calls `updateFlop()`
2. "Take Turn" (enabled after flop recorded) opens capture expecting 1 card; calls `updateTurn()`
3. "Take River" (enabled after turn recorded) opens capture expecting 1 card; calls `updateRiver()`
4. Board area updates after each successful capture (✅ indicator on button)
5. Component test verifies the capture → confirm → PATCH flow (mocked API)

---

### T-023 — Blind display & timer UI component

**Category:** feature
**Dependencies:** T-012, T-017, T-021
**Story Ref:** S-5.5

Build a `BlindTimer` component that displays current blind level, a countdown timer, and pause/resume controls.

**Acceptance Criteria:**
1. Displays "Blinds: $X.XX / $Y.YY" from `fetchBlinds()` data
2. Countdown timer computes remaining time from `blind_timer_started_at` + `blind_timer_minutes`
3. Pause/resume button calls `updateBlinds()` to toggle `blind_timer_paused`
4. When timer hits 0, prompts dealer to advance blinds (suggests doubled amounts)
5. Advancing calls `updateBlinds()` with new levels and resets timer
6. Component test verifies timer display, pause, and advance flows

---

### T-024 — Showdown trigger + auto-detection frontend logic

**Category:** feature
**Dependencies:** T-022
**Story Ref:** S-4.1, S-4.3

Add a "Showdown" button on the Active Hand Dashboard. When tapped, call the equity endpoint, map results to proposed outcomes, and navigate to the review screen.

**Acceptance Criteria:**
1. "Showdown" button enabled when community cards are recorded and ≥ 2 non-folded players have cards
2. Calls `GET /games/{id}/hands/{num}/equity`; maps: equity ≈ 1.0 → "won", ≈ 0.0 → "lost", split → "won" (tied)
3. If only one non-folded player remains, auto-propose "won" (no equity call)
4. Outcome street inferred: 3 community cards → "flop", 4 → "turn", 5 → "river"
5. Navigates to review screen with proposed results pre-filled
6. When equity is inconclusive (partial board, missing hole cards, ambiguous ties), the review screen opens with blank/unresolved results — dealer manually picks winners through the editable review (S-4.2); no separate "pick winner" flow needed
7. Test verifies auto-detection logic for win, loss, tie, single-player-remaining, and inconclusive-fallback cases

---

### T-025 — Full editable dealer review screen

**Category:** feature
**Dependencies:** T-024
**Story Ref:** S-4.2

Build the `HandReview` component where the dealer sees all proposed results and can edit any field before confirming.

**Acceptance Criteria:**
1. Displays: community cards (editable via `CardPicker`), each player's hole cards, proposed result, outcome street
2. Dealer can tap any card to edit it; can change any result via buttons (won/lost/folded)
3. Dealer can change outcome street per player via dropdown (preflop/flop/turn/river)
4. "Confirm & Save" button batches changes: `patchPlayerResult()` per player + `updateCommunityCards()` if board was edited
5. "Cancel" returns to the active hand without saving
6. Component test covers rendering, editing, and save flow

---

### T-026 — End hand flow with terminal state check

**Category:** feature
**Dependencies:** T-025
**Story Ref:** S-4.4

Add end-hand validation: "Finish Hand" is enabled only when every player has a non-null result. Players without cards or actions are auto-assigned "folded."

**Acceptance Criteria:**
1. "Finish Hand" button on review screen is disabled until all players have a result
2. Players with null cards and null result are auto-assigned `result = "folded"` before save
3. Confirmation dialog summarizes outcomes before committing
4. After finish, dealer returns to the Game Dashboard; hand count increments
5. Test verifies the auto-fold logic and terminal-state gating

---

### T-027 — QR code simplification

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-6.1

Update the QR code display on the Game Dashboard to show a single, prominent QR for the current active game.

**Acceptance Criteria:**
1. QR encodes `<host>/player?game=<gameId>` (React Router paths)
2. Displayed prominently on the Game Dashboard (before/during hands)
3. "Show/Hide QR" toggle prevents clutter during active play
4. QR updates if the active game changes
5. Existing `QRCodeDisplay` component is reused or simplified (no multi-QR)

---

### T-028 — Player session pinning (sessionStorage)

**Category:** feature
**Dependencies:** none
**Story Ref:** S-6.2

Persist the player's game + name selection in `sessionStorage` so page refreshes don't kick them back to selection screens.

**Acceptance Criteria:**
1. After selecting game + name, store `{ gameId, playerName }` in `sessionStorage`
2. On `PlayerApp` mount, check storage; if game is still active, skip to playing screen
3. If stored game is not found or inactive, clear storage and show the game selector
4. "Leave Game" button clears storage and returns to the selector
5. Test verifies persistence across simulated mounts

---

### T-029 — Chip picker component

**Category:** feature
**Dependencies:** none
**Story Ref:** S-6.3

Build a reusable `ChipPicker` React TSX component with 5 colored chip buttons and a running total display.

**Acceptance Criteria:**
1. Five circular buttons: White ($0.10), Red ($0.20), Green ($0.30), Blue ($0.40), Black ($0.50)
2. Each button is color-coded and labeled with its denomination
3. Tapping a chip adds its denomination to a running total displayed prominently
4. "Clear" resets total to $0.00; "Confirm" triggers an `onConfirm(amount)` callback
5. Mobile-first: min 56px diameter buttons, high-contrast labels
6. React Testing Library test verifies tapping, clearing, and confirm callback

---

### T-030 — Player action buttons (fold/check/call/bet/raise)

**Category:** feature
**Dependencies:** T-009, T-017, T-029
**Story Ref:** S-6.4

Add action buttons to the player hand screen. Fold/Check/Call are one-tap; Bet/Raise open the chip picker.

**Acceptance Criteria:**
1. After submitting hole cards, player sees 5 buttons: Fold, Check, Call, Bet, Raise
2. Fold calls `recordPlayerAction()` with `{ action: "fold" }` and shows "Folded" state
3. Check calls with `{ action: "check" }`; Call calls with `{ action: "call" }`
4. Bet/Raise opens `ChipPicker`; on confirm, calls with `{ action: "bet"/"raise", amount }` and closes picker
5. After acting, buttons are disabled until new community cards appear (detected via polling — current vs. previous community card state)
6. Street auto-determined: 0 community cards → "preflop", 3 → "flop", 4 → "turn", 5 → "river"
7. Test covers all action flows (mocked API)

---

### T-031 — Player blind & position display

**Category:** feature
**Dependencies:** T-012, T-017
**Story Ref:** S-6.5

Add a blind/position display to the player hand screen showing SB/BB names and current blind level.

**Acceptance Criteria:**
1. Shows "Blinds: $X.XX / $Y.YY" from game blind state
2. Shows SB and BB player names from the current hand response
3. If the current player is SB or BB, their label is highlighted
4. Updates when blind level changes (via game state polling)
5. Component test verifies rendering and highlight logic

---

### T-032 — Player Table View screen (3D scene, mobile-first)

**Category:** feature
**Dependencies:** none
**Story Ref:** S-7.1

Create a new "Table View" screen accessible from the player menu that renders a mobile-first Three.js poker table.

**Acceptance Criteria:**
1. "Table View" button/tab accessible from the player playing screen
2. Renders `pokerScene.ts` in a full-viewport `<canvas>` with touch-enabled orbit controls
3. Player's own hole cards are face-up; all other players' cards are face-down
4. Community cards displayed as available from the current hand data
5. "Back to Hand" button returns to the action/decision screen
6. Default camera position centers on the player's own seat

---

### T-033 — Adjusted equity display (player perspective)

**Category:** feature
**Dependencies:** T-032
**Story Ref:** S-7.2

Add an equity percentage overlay on the player's Table View showing their odds from their own perspective (opponents' cards unknown).

**Acceptance Criteria:**
1. Calls the equity endpoint with only the player's hole cards (treat all opponents as unknown/random)
2. Displays equity as a percentage near the player's cards (e.g., "62%")
3. Recalculates when community cards change
4. Toggle to show/hide equity
5. Falls back to preflop equity when no community cards exist

---

### T-034 — Showdown card reveals in player viz

**Category:** feature
**Dependencies:** T-032
**Story Ref:** S-7.3

When a hand reaches showdown (results include won/lost), reveal all non-folded players' cards in the 3D scene.

**Acceptance Criteria:**
1. Detect showdown from hand data: any player with `result = "won"` or `result = "lost"` triggers reveal
2. All non-folded players' cards flip face-up with the existing 300ms rotation animation
3. Winner's cards get a glow highlight
4. Folded players show "FOLD" sprite (existing behavior)
5. Reveal triggers when the player scrubs to a finalized hand or polls a newly-finalized hand

---

### T-035 — Player game scrubber (range slider)

**Category:** feature
**Dependencies:** T-032
**Story Ref:** S-7.4

Add a range slider at the bottom of the player Table View for scrubbing through all hands of the current game.

**Acceptance Criteria:**
1. `<input type="range">` slider with min=1, max=total hands
2. Dragging the slider loads the selected hand and updates the 3D scene
3. Label shows "Hand X / Y"
4. Defaults to the latest hand
5. Touch-friendly: min 48px slider thumb
6. Fetches hand data from `GET /games/{id}/hands/{num}`

---

### T-036 — Range slider scrubber for all SessionScrubber views

**Category:** feature
**Dependencies:** none
**Story Ref:** S-8.1

Add an `<input type="range">` slider to the `SessionScrubber` component used by `MobilePlaybackView` and desktop playback.

**Acceptance Criteria:**
1. `SessionScrubber` gains a range slider input between the prev/next buttons
2. Dragging the slider triggers `onchange` with the new hand index
3. Prev/next buttons remain as supplementary controls
4. Slider thumb is min 48px for mobile touch targets
5. Current hand number / total label updates in real-time during drag
6. Test verifies slider input triggers callback

---

### T-037 — Seat-snap camera view

**Category:** feature
**Dependencies:** none
**Story Ref:** S-8.2

Add seat-snap functionality to the 3D visualization: tapping a seat label smoothly animates the camera to that seat's perspective.

**Acceptance Criteria:**
1. Tapping a seat label in the 3D scene triggers a 300–500ms camera animation to that seat's eye-level position
2. Camera positions computed from `tableGeometry.ts` seat positions (slightly behind and above, looking toward table center)
3. "Reset View" button returns to the default overhead position
4. In player mode, camera defaults to the player's own seat on initial load
5. Works on mobile (tap) and desktop (click)

---

### T-038 — Live hand updates without refresh

**Category:** feature
**Dependencies:** T-036
**Story Ref:** S-8.3

Add background polling (10s) to the visualization views so new hand data and community card changes update the 3D scene without page refresh.

**Acceptance Criteria:**
1. Every 10 seconds, fetch the hand list for the current game
2. If a new hand is detected and the user is on the latest hand, auto-advance and update the scene
3. If the user is scrubbing older hands, show a "New hand available" indicator without disrupting
4. Community card changes on the current hand update the scene seamlessly
5. `AbortController` ensures clean unmount; transient errors silently retry
6. No scroll reset, page refresh, or navigation away on update

---

### T-039 — Polling optimization (conditional requests, intervals)

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-9.1

Tune polling intervals across all views and implement conditional 304 handling in the existing polling loops.

**Acceptance Criteria:**
1. Dealer polling: 3s (unchanged)
2. Player status polling: increase from 3s to 5s
3. Visualization polling: 10s (from T-038)
4. Player `PlayerApp` polling passes `If-None-Match` header from previous ETag; skips state update on 304
5. All polling loops use `AbortController` with proper cleanup on unmount
6. Transient errors show a subtle reconnection indicator instead of blocking error messages

---

### T-040 — Structured request logging middleware

**Category:** infra
**Dependencies:** T-013
**Story Ref:** S-9.2

Build on the request-ID middleware (T-013) to add structured log output for every request.

**Acceptance Criteria:**
1. Each request logs: `request_id`, `method`, `path`, `status_code`, `duration_ms`
2. Logging uses Python's `logging` module at INFO level
3. Log format is structured (JSON or key=value) for easy parsing
4. Error responses (4xx, 5xx) log at WARNING/ERROR level respectively
5. `uv run pytest test/` passes; log output verified in test via `caplog`

---

### T-041 — Dealer flow integration test

**Category:** test
**Dependencies:** T-026
**Story Ref:** S-4.4, S-5.3

Write an end-to-end integration test covering the full dealer flow: create game → manage players → start hand → capture community cards → showdown → review → finish hand.

**Acceptance Criteria:**
1. Test creates a game with 3 players, starts a hand via `POST /hands/start`
2. Records community cards (flop + turn + river) via PATCH endpoints
3. Records fold actions for one player, gets equity for remaining two
4. Calls `PATCH .../result` for each player with proposed outcomes
5. Verifies final hand state: all players have results, community cards recorded, SB/BB assigned
6. `uv run pytest test/` passes

---

### T-042 — Player flow integration test

**Category:** test
**Dependencies:** T-030, T-034
**Story Ref:** S-6.4, S-7.3

Write an end-to-end integration test covering the player flow: join game → capture cards → record actions → view showdown.

**Acceptance Criteria:**
1. Test creates a game, starts a hand, and simulates a player joining via existing hand status polling
2. Records hole cards via PATCH, then records bet/check/fold actions via POST
3. After hand finalization, verifies the player can see showdown results via the hand endpoint
4. Verifies the actions are retrievable via `GET /hands/{num}/actions`
5. `uv run pytest test/` passes

---

### T-043 — Alembic migration — `seat_number` on `game_players`

**Category:** infra
**Dependencies:** none
**Story Ref:** S-2.6

Add a `seat_number` integer column (nullable) to the `game_players` table. Update the `GamePlayer` SQLAlchemy model.

**Acceptance Criteria:**
1. `seat_number` is an Integer column, nullable, no default
2. Alembic migration applies cleanly; existing rows get `seat_number = null`
3. `GamePlayer` model in `src/app/database/models.py` includes the `seat_number` field
4. `uv run pytest test/` passes

---

### T-044 — Auto-seat assignment on game creation

**Category:** feature
**Dependencies:** T-043
**Story Ref:** S-2.6

Update `POST /games` and `POST /games/{id}/players` to auto-assign sequential seat numbers.

**Acceptance Criteria:**
1. When `POST /games` creates a game with players, each player gets a sequential `seat_number` (1, 2, 3, …) in the order listed
2. When `POST /games/{id}/players` adds a player mid-game, the player gets `max(existing seat_numbers) + 1`
3. Toggling a player inactive/active does NOT change their seat number
4. `GameSessionResponse` includes `seat_number` for each player
5. Tests cover: creation ordering, mid-game addition, stability after toggle, and gap handling
6. `uv run pytest test/` passes

---

### T-045 — Alembic migration — `buy_in` on `game_players`

**Category:** infra
**Dependencies:** none
**Story Ref:** S-2.7

Add a `buy_in` float column (nullable, default null) to the `game_players` table. Update the `GamePlayer` model.

**Acceptance Criteria:**
1. `buy_in` is a Float column, nullable, default null
2. Alembic migration applies cleanly; existing rows get `buy_in = null`
3. `GamePlayer` model includes the `buy_in` field
4. `uv run pytest test/` passes

---

### T-046 — Buy-in capture on game/player creation endpoints

**Category:** feature
**Dependencies:** T-045
**Story Ref:** S-2.7

Update `POST /games` and `POST /games/{id}/players` to accept an optional `buy_in` amount per player.

**Acceptance Criteria:**
1. `POST /games` creation payload accepts an optional `buy_in` float per player
2. `POST /games/{id}/players` accepts an optional `buy_in` float in the body
3. `GameSessionResponse` includes `buy_in` for each player
4. If buy-in is not specified, the field is null (dealer can update later)
5. Tests cover: buy-in on creation, buy-in on mid-game add, null default, and response shape
6. `uv run pytest test/` passes

---

### T-047 — Alembic migration — `rebuys` table

**Category:** infra
**Dependencies:** none
**Story Ref:** S-2.8

Create the `rebuys` table and `Rebuy` SQLAlchemy model.

**Acceptance Criteria:**
1. Table schema: `rebuy_id` (PK auto), `game_id` (FK → game_sessions.game_id, not null), `player_name` (String, not null), `amount` (Float, not null), `created_at` (DateTime, default utcnow)
2. `Rebuy` model defined in `src/app/database/models.py`
3. Migration applies cleanly; `uv run pytest test/` passes

---

### T-048 — Re-buy/buyback recording & listing endpoints

**Category:** feature
**Dependencies:** T-047
**Story Ref:** S-2.8

Add `POST /games/{game_id}/players/{player_name}/rebuys` and `GET /games/{game_id}/players/{player_name}/rebuys` endpoints.

**Acceptance Criteria:**
1. `POST .../rebuys` accepts `{ "amount": float }` and returns 201 with the created rebuy record
2. Recording a re-buy also reactivates the player if `is_active = false` (flips to `true`)
3. `GET .../rebuys` returns a list of rebuy records for that player in the game, ordered by `created_at`
4. Returns 404 for missing game or player not in game
5. `GameSessionResponse` includes `rebuy_count` and `total_rebuys` per player (computed from rebuy records)
6. Tests cover: record rebuy, list rebuys, rebuy reactivates inactive player, 404 cases, and response aggregates
7. `uv run pytest test/` passes

---

### T-049 — Alembic migration — `hand_states` table

**Category:** infra
**Dependencies:** none
**Story Ref:** S-10.1

Create the `hand_states` table and `HandState` SQLAlchemy model.

**Acceptance Criteria:**
1. Table schema: `hand_state_id` (PK auto), `hand_id` (FK → hands.hand_id, unique, not null), `phase` (String, not null, default "preflop"), `current_seat` (Integer, nullable), `action_index` (Integer, default 0), `updated_at` (DateTime, default utcnow)
2. `HandState` model defined in `src/app/database/models.py` with relationship to `Hand`
3. Migration applies cleanly; `uv run pytest test/` passes

---

### T-050 — Turn-order state machine logic & endpoints

**Category:** feature
**Dependencies:** T-049, T-008
**Story Ref:** S-10.2

Implement the hand state machine logic: auto-create `HandState` on hand start, expose turn query endpoint, enforce turn order on action recording, auto-advance phase.

**Acceptance Criteria:**
1. `POST /games/{id}/hands/start` (from T-008) also creates a `HandState` row with `phase = "preflop"` and `current_seat` = first-to-act (seat after BB for 3+ players, SB for heads-up)
2. `GET /games/{game_id}/hands/{hand_number}/state` returns `{ phase, current_seat, current_player_name, action_index }`
3. `POST .../players/{name}/actions` validates that it is the named player's turn; returns 409 if out of order
4. After a valid action, `current_seat` advances to the next non-folded active player (clockwise by seat_number)
5. When all non-folded players have acted in a phase, the phase auto-advances and `current_seat` resets
6. Phase cannot advance past community card count (e.g., can't go to `flop` without 3 community cards)
7. Dealer can pass `?force=true` on the action endpoint to bypass turn-order validation
8. Tests cover: normal rotation, fold skipping, phase advancement, heads-up, dealer force, out-of-order rejection
9. `uv run pytest test/` passes

---

### T-051 — Top-N OCR predictions in detection correction UI

**Category:** feature
**Dependencies:** none
**Story Ref:** S-4.5

Update the `DetectionReview` component's card correction flow to show top-N OCR prediction alternatives ranked by confidence.

**Acceptance Criteria:**
1. When the dealer taps a detected card to correct it, the UI shows 3–5 alternative predictions with confidence percentages
2. Each alternative is a tappable card face (min 48px touch target) that selects it immediately
3. A "More…" / "All Cards" button expands to the full `CardPicker` for manual selection
4. If the backend detection response does not include confidence scores, fall back to showing `CardPicker` directly
5. Alternatives are horizontally scrollable on mobile if they exceed viewport width
6. React Testing Library test verifies rendering of alternatives and fallback behavior

---

### T-052 — Image local preview in camera capture flow

**Category:** feature
**Dependencies:** none
**Story Ref:** S-4.6

Add a local image preview step to the `CameraCapture` component — show the captured photo before sending to backend for OCR.

**Acceptance Criteria:**
1. After capturing an image, a preview screen shows the photo with "Use Photo" and "Retake" buttons
2. Preview renders from the local blob/data-URL — no backend call
3. "Use Photo" sends the image to backend for OCR; "Retake" discards and re-opens camera
4. Preview shows basic quality info (resolution, file size)
5. Mobile-first: buttons are large and thumb-accessible at the bottom of the screen
6. React Testing Library test verifies preview rendering and button flows

---

### T-053 — Split-screen dealer input layout

**Category:** feature
**Dependencies:** T-021
**Story Ref:** S-5.6

Add a responsive split-screen layout to the Active Hand Dashboard for tablet/large phone viewports.

**Acceptance Criteria:**
1. When viewport width ≥ 600px, the Active Hand view splits: top = board area (community cards + capture buttons), bottom = player tiles grid
2. On narrow viewports (< 600px), the layout remains stacked/scrollable single-column
3. Both sections scroll independently if content overflows
4. Blind info bar remains fixed/sticky at the top
5. Implemented with CSS grid or flexbox — no JS layout calculations
6. React Testing Library test verifies both layout modes render correctly

---

## Bugs / Findings

### Cycle 1 — aia-core-25a3 (T-001)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-001 | MEDIUM | Model/migration server_default drift: models.py has `default=True` but no `server_default`, while the migration uses `server_default=sa.text('1')`. A future autogenerate will create an unwanted migration. Fix: add `server_default=sa.text('1')` to the model column. | aia-core-25a3 |
| F-002 | LOW | Unused `client` fixture parameter in test_game_player_is_active.py tests. Remove unused parameter. | aia-core-25a3 |
| F-003 | LOW | Direct `SessionLocal` import inside test functions instead of using a `db_session` fixture — non-idiomatic test pattern. | aia-core-25a3 |

### Cycle 2 — aia-core-7jw1 (T-003)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-004 | MEDIUM | server_default on created_at diverges from project convention. PlayerHandAction.created_at has both default and server_default while all other models use only Python default. Either remove server_default or adopt project-wide. | aia-core-7jw1 |
| F-005 | MEDIUM | Test file defines its own db_session fixture instead of using conftest. Justified since conftest doesn't enable PRAGMA foreign_keys=ON, but duplicates session setup. Consider shared db_session_with_fk fixture. | aia-core-7jw1 |
| F-006 | LOW | created_at column is nullable=True in migration despite server_default always providing a value. Matches existing convention across all tables. | aia-core-7jw1 |

### Cycle 4 — aia-core-m70e (T-004)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-007 | MEDIUM | Pydantic schemas (GameSessionCreate, GameSessionListItem, GameSessionResponse) do not expose the new blind fields. API cannot set or retrieve blind values. Track as follow-up. | aia-core-m70e |
| F-008 | LOW | Tautological assertion in test_blind_fields.py: `isinstance(col.type, type(col.type))` is always True. No functional impact. | aia-core-m70e |

### Cycle 9 — aia-core-glk0 (T-012)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-009 | HIGH | Resume logic resets full timer instead of preserving remaining time. When resuming, blind_timer_started_at = now gives full blind_timer_minutes remaining regardless of time elapsed before pause. No pause timestamp stored. Needs blind_timer_paused_at or blind_timer_remaining_seconds column. | aia-core-glk0 |
| F-010 | MEDIUM | No validation for negative/zero blind amounts in BlindsUpdate. small_blind and big_blind accept any float including negatives. Add Field(gt=0). | aia-core-glk0 |
| F-011 | MEDIUM | No validation for negative/zero timer minutes in BlindsUpdate. blind_timer_minutes accepts 0 or negative. Add Field(gt=0). | aia-core-glk0 |
| F-012 | LOW | Simultaneous blind change + pause silently overrides pause. If both small_blind and blind_timer_paused:true are sent, the changed block resets paused to False. | aia-core-glk0 |

### Cycle 10 — aia-core-2sr1 (T-009)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-013 | MEDIUM | No validation for negative bet amounts. amount: float accepts negatives. Add Field(ge=0) to PlayerActionCreate. | aia-core-2sr1 |
| F-014 | MEDIUM | No semantic validation of amount vs action type. fold with amount and bet without amount both accepted. Consider model_validator for poker-rule consistency. | aia-core-2sr1 |
| F-015 | LOW | Test file duplicates conftest DB boilerplate. Matches existing codebase convention (18+ files). No action needed. | aia-core-2sr1 |

### Cycle 12 — aia-core-w9fl (T-006)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-016 | HIGH | No validation on empty/whitespace-only player names. AddPlayerToGameRequest.player_name is a bare str. Empty "" or whitespace "   " create garbage Player rows. Add Field(min_length=1, strip_whitespace=True). | aia-core-w9fl |
| F-017 | MEDIUM | Race condition on seat number assignment. MAX(seat_number) read + insert with no unique constraint on (game_id, seat_number). Low risk under SQLite serialization. | aia-core-w9fl |
| F-018 | MEDIUM | IntegrityError fallback skips duplicate-game-player re-check. After catching IntegrityError on Player creation, re-query doesn't check if player was concurrently added to game. | aia-core-w9fl |
| F-019 | LOW | Test seat assertion imprecise — asserts not None but not expected value 1. | aia-core-w9fl |

### Cycle 13 — aia-core-5wiv (T-008)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-020 | HIGH | Existing GET hand endpoints (list_hands, get_hand, etc.) build HandResponse inline without sb_player_name/bb_player_name. Fields default to None even when DB has SB/BB set. Fix: use _build_hand_response() everywhere. | aia-core-5wiv |
| F-021 | MEDIUM | No concurrency guard on hand_number assignment. Two concurrent start_hand calls could get same max and cause unhandled IntegrityError (500). Should catch and return 409. | aia-core-5wiv |
| F-022 | MEDIUM | N+1 query pattern in _build_hand_response. One Player query per PlayerHand plus two for SB/BB. Should batch-fetch with Player.player_id.in_(ids). | aia-core-5wiv |
| F-023 | MEDIUM | Prev-SB fallback rotation relies on implicit default. Logic correct but intent is unclear. Add clarifying comment. | aia-core-5wiv |
| F-024 | LOW | Test file duplicates DB fixture setup from conftest.py. Works but diverges from convention. | aia-core-5wiv |

### Cycle 1 (Anna) — aia-core-gilq (Bug Fix: HandResponse sb/bb)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-025 | MEDIUM | Test file duplicates conftest fixtures (engine, SessionLocal, override_get_db, setup_db, client) instead of reusing them — pre-existing codebase pattern. | aia-core-gilq |
| F-026 | MEDIUM | _build_hand_response queries Player table redundantly — SB/BB lookup re-queries players already fetched in the PlayerHand loop (N+1 pattern, pre-existing). | aia-core-gilq |
| F-027 | LOW | test_record_hand_returns_sb_bb_fields asserts field presence (in data) but not value (is None) — weaker than explicit None assertion. | aia-core-gilq |

### Cycle 2 (Anna) — aia-core-p3y2 (Bug Fix: Player name validation)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-028 | MEDIUM | PlayerResultEntry validation has zero test coverage — 4 of 5 target models tested but PlayerResultEntry (PUT .../results) missing a test class. | aia-core-p3y2 |
| F-029 | LOW | PlayerCreate.name: str has the same bare-string vulnerability — same class of bug, different field name, should be a separate issue. | aia-core-p3y2 |
| F-030 | LOW | No whitespace-stripping positive tests for PlayerHandEntry or ConfirmPlayerEntry — only rejection tested, not that strip_whitespace actually strips valid input. | aia-core-p3y2 |

### Cycle 3 (Anna) — aia-core-ov0s (Bug Fix: Blind timer remaining time)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-031 | MEDIUM | Reducing blind_timer_minutes while paused can produce negative elapsed_before_pause, setting started_at in the future. Clamp remaining_seconds to min(remaining, total) on resume. | aia-core-ov0s |
| F-032 | LOW | Missing edge-case tests: double-pause, double-resume, pause with no started timer, timer-minutes change while paused. | aia-core-ov0s |
| F-033 | LOW | Test helper _set_started_at uses __import__ and doesn't properly close the DB generator. Import get_db directly or use SessionLocal from conftest. | aia-core-ov0s |

### Cycle 4 (Anna) — aia-core-cdv2 (API client functions)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-034 | MEDIUM | HandResponse TS type missing sb_player_name / bb_player_name fields — backend populates these but TS consumers have no type-safe access. | aia-core-cdv2 |
| F-035 | LOW | AC2 specifies buyIn? parameter for addPlayerToGame but omitted — valid because backend AddPlayerToGameRequest has no buy_in field yet. | aia-core-cdv2 |
| F-036 | LOW | No error-path tests for the 6 new functions — error handling is generic via request() helper so risk is minimal. | aia-core-cdv2 |

### Cycle 5 (Anna) — aia-core-d22b (GameSessionResponse active status)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-037 | MEDIUM | GameSessionListItem (GET /games list) does not include per-player active/inactive info. May need follow-up. | aia-core-d22b |
| F-038 | LOW | _build_players() query lacks .order_by() — player list ordering is non-deterministic across requests. | aia-core-d22b |

### Cycle 6 (Anna) — aia-core-s3df (Fold action auto-sets result)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-039 | MEDIUM | Fold does not set outcome_street — player_hand.outcome_street is left None even though payload.street is available. | aia-core-s3df |
| F-040 | MEDIUM | Fold after other terminal states silently overwrites result — guard only checks == 'folded', so fold on 'won' or 'lost' player silently changes it. | aia-core-s3df |

### Cycle 7 (Anna) — aia-core-qd2p (Retrieve hand actions endpoint)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-041 | MEDIUM | N+1 lazy-load on player_hand and player relationships — each iteration triggers 2 lazy SQL queries. Should use joinedload. | aia-core-qd2p |

### Cycle 8 (Anna) — aia-core-9gaj (Auto-seat assignment)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-042 | MEDIUM | No unique constraint on (game_id, seat_number) — concurrent add-player requests can produce duplicate seats. Known gap (F-017). Low risk with SQLite serialization. | aia-core-9gaj |
| F-043 | LOW | No edge-case test for add-player to a game with 0 existing players. Code handles it correctly. | aia-core-9gaj |

### Cycle 9 (Anna) — aia-core-07y6 (Turn-order state machine)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-044 | MEDIUM | GET /state endpoint modifies DB state via _try_advance_phase() + db.commit() — violates REST idempotency. | aia-core-07y6 |
| F-045 | MEDIUM | Phase advancement counts total actions >= player count — doesn't handle raise/re-raise rounds correctly. | aia-core-07y6 |
| F-046 | MEDIUM | Heads-up post-flop first-to-act gives SB/dealer first action, but standard rules say BB acts first post-flop. | aia-core-07y6 |
| F-047 | LOW | HandState.updated_at has no onupdate — stays at creation time after changes. | aia-core-07y6 |
| F-048 | LOW | No test for all-but-one-fold scenario — hand completion signal missing. | aia-core-07y6 |
| F-049 | LOW | action_index += 1 is Python-side read-modify-write — not atomic under concurrency. | aia-core-07y6 |
| F-050 | LOW | _next_seat returns player's own seat when one remains — no hand-complete signal. | aia-core-07y6 |

### Cycle 10 (Anna) — aia-core-vm6d (Buy-in capture)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-051 | MEDIUM | No validation on negative buy-in values — both GameSessionCreate.player_buy_ins and AddPlayerToGameRequest.buy_in accept negative floats. Add ge=0. | aia-core-vm6d |
| F-052 | LOW | Case-sensitive dict key matching for player_buy_ins vs case-insensitive player creation. | aia-core-vm6d |
| F-053 | LOW | Extra keys in player_buy_ins silently ignored — typos discarded without warning. | aia-core-vm6d |

### Cycle 11 (Anna) — aia-core-bjmw (Re-buy endpoints)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-054 | HIGH | RebuyCreate.amount accepts zero and negative values — no gt=0 constraint. RebuyCreate(amount=-50) succeeds. | aia-core-bjmw |
| F-055 | MEDIUM | Rebuy table uses player_name (String) instead of player_id FK — denormalized; fragile if player rename is ever added. | aia-core-bjmw |
| F-056 | MEDIUM | _get_game_player helper duplicates logic already inline in toggle_player_status — could refactor to reuse. | aia-core-bjmw |
| F-057 | LOW | No test for rebuy on a completed game session — behavior undefined and untested. | aia-core-bjmw |

### Cycle 12 (Anna) — aia-core-2tkw (Bug Fix: Negative rebuy amount)

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-058 | MEDIUM | GameSessionCreate.player_buy_ins and AddPlayerToGameRequest.buy_in accept negative values — same class of bug. | aia-core-2tkw |
| F-059 | MEDIUM | PlayerActionCreate.amount accepts negative values for bet/raise actions. | aia-core-2tkw |
