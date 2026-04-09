# Tasks — Dealer & Visualization Evolution

**Project ID:** dealer-viz-004
**Date:** 2026-04-09
**Total Tasks:** 24
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Standardize ResultEnum in Pydantic models | refactor | none | S-1.4 |
| T-002 | Make HandCreate fields optional | refactor | none | S-1.5 |
| T-003 | TDD: Empty hand creation via POST | test | T-001, T-002 | S-1.1 |
| T-004 | Add single-player result PATCH endpoint | feature | T-001 | S-1.3 |
| T-005 | TDD: Add player to hand with optional cards | test | T-002 | S-1.2 |
| T-006 | Port equity evaluator to Python | feature | none | S-2.2 |
| T-007 | Add equity computation endpoint | feature | T-006 | S-2.1 |
| T-008 | Game selector landing page component | feature | none | S-3.1 |
| T-009 | Hand list & navigation in HandDashboard | feature | T-008 | S-3.2 |
| T-010 | Integrate GameCreateForm into selector flow | feature | T-008 | S-3.3 |
| T-011 | Dealer state refactor: status & incremental actions | refactor | T-004 | S-4.5 |
| T-012 | Player tiles with status indicators | feature | T-011 | S-4.1 |
| T-013 | Per-player card collection flow | feature | T-012, T-005 | S-4.2 |
| T-014 | Outcome buttons (Won / Folded / Lost) | feature | T-013, T-004 | S-4.2 |
| T-015 | Community card capture (PATCH wiring) | feature | T-011, T-003 | S-4.3 |
| T-016 | Hand completion & elimination logic | feature | T-014, T-015 | S-4.4 |
| T-017 | Extract reusable Three.js scene module | refactor | none | S-5.1 |
| T-018 | DealerPreview.jsx embedded component | feature | T-017, T-011 | S-5.2 |
| T-019 | Wire equity overlay in dealer preview | feature | T-018, T-007 | S-5.3 |
| T-020 | Mobile playback route & layout | feature | T-017 | S-6.1 |
| T-021 | Touch controls for Three.js scene | feature | T-020 | S-6.2 |
| T-022 | Preact-styled UI controls for mobile | feature | T-020 | S-6.3 |
| T-023 | Mobile equity via backend | feature | T-022, T-007 | S-6.4 |
| T-024 | End-to-end smoke test: full dealer flow | test | T-016, T-019 | S-4.2, S-4.4, S-5.3 |

---

## Task Details

### T-001 — Standardize ResultEnum in Pydantic models

**Category:** refactor
**Dependencies:** none
**Story Ref:** S-1.4

Define a `ResultEnum` with values `won`, `folded`, `lost` in `src/pydantic_models/app_models.py`. Update `PlayerHandEntry.result`, `PlayerResultEntry.result`, and `HandResultUpdate.result` to use `ResultEnum | None`. Update all existing tests that pass free-text result strings to use the new enum values.

**Acceptance Criteria:**
1. `ResultEnum` class exists with exactly three values: `won`, `folded`, `lost`
2. All Pydantic models referencing `result` use `ResultEnum | None`
3. `uv run pytest test/` passes with all existing tests updated
4. API still accepts `null` for result (player participated, no explicit outcome)

---

### T-002 — Make HandCreate fields optional

**Category:** refactor
**Dependencies:** none
**Story Ref:** S-1.5

Change `HandCreate` in `src/pydantic_models/app_models.py` so that `flop_1`, `flop_2`, `flop_3` are `Card | None = None`, `turn` and `river` remain `Card | None = None`, and `player_entries` defaults to `[]`. Update `record_hand()` in `src/app/routes/hands.py` to handle the case where community cards are all `None` (skip card validation for missing cards). Write tests for empty-body hand creation.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands` with `{}` body returns 201
2. `POST /games/{game_id}/hands` with full payload still returns 201 (backwards-compatible)
3. Hand is persisted with all `null` community cards and empty `player_hands`
4. `uv run pytest test/` passes — no regressions

---

### T-003 — TDD: Empty hand creation via POST

**Category:** test
**Dependencies:** T-001, T-002
**Story Ref:** S-1.1

Write tests in `test/test_record_hand_api.py` (or a new file) that cover the empty hand creation flow: empty body returns 201, auto-incremented hand_number, null community cards, empty player_hands. Verify that the existing full-payload tests still pass alongside.

**Acceptance Criteria:**
1. Test: `POST {} → 201`, response has `hand_number >= 1`, all community fields `null`, `player_hands == []`
2. Test: Two consecutive empty POSTs yield incrementing `hand_number` (1, 2)
3. Test: Empty hand followed by full-payload hand — both succeed
4. All new tests pass

---

### T-004 — Add single-player result PATCH endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.3

Add `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}/result` to `src/app/routes/hands.py`. Accepts `{ "result": "won"|"folded"|"lost", "profit_loss": float|null }`. Returns updated `PlayerHandResponse`. Write TDD tests covering: happy path, 404 for missing player, 404 for missing hand, invalid result value returns 422.

**Acceptance Criteria:**
1. Endpoint exists and returns 200 with the updated player hand
2. `result` and `profit_loss` are persisted in the database
3. Returns 404 if player is not in the hand
4. Returns 422 if result is not a valid `ResultEnum` value
5. Tests cover all error paths

---

### T-005 — TDD: Add player to hand with optional cards

**Category:** test
**Dependencies:** T-002
**Story Ref:** S-1.2

Write tests for the existing `POST /games/{game_id}/hands/{hand_number}/players` endpoint to verify it works with `null` cards (cards optional). If the endpoint currently requires cards, update it to allow `card_1: Card | None = None`, `card_2: Card | None = None`. Add tests: player with null cards succeeds, player with cards succeeds, duplicate player returns 400.

**Acceptance Criteria:**
1. Test: Add player with `card_1=null, card_2=null` returns 201
2. Test: Add player with valid cards returns 201
3. Test: Add duplicate player to same hand returns 400
4. `HoleCardsUpdate` or the add-player schema allows null cards
5. All tests pass

---

### T-006 — Port equity evaluator to Python

**Category:** feature
**Dependencies:** none
**Story Ref:** S-2.2

Create `src/app/services/equity.py` with `calculate_equity(player_hole_cards, community_cards)`. Port the exhaustive + Monte Carlo logic from `frontend/src/poker/evaluator.js`. Write unit tests with known equity scenarios. Use standard library only (no numpy required).

**Acceptance Criteria:**
1. `calculate_equity([[('A','s'),('A','h')], [('K','s'),('K','h')]], [])` returns equity within ±1% of known AA vs KK equity (~81% vs 19%)
2. Exhaustive enumeration used when ≤2 community cards remain to be dealt
3. Monte Carlo (5,000 iterations) used otherwise
4. Unit tests in `test/test_equity.py` with ≥5 known-equity scenarios
5. Function returns `list[float]` — one equity per player

---

### T-007 — Add equity computation endpoint

**Category:** feature
**Dependencies:** T-006
**Story Ref:** S-2.1

Add `GET /games/{game_id}/hands/{hand_number}/equity` to a new or existing router. Reads hand state from the database (community cards + player hole cards), calls `calculate_equity()`, returns JSON `{ "equities": [{ "player_name": str, "equity": float }] }`. Write TDD tests.

**Acceptance Criteria:**
1. Returns equity for each player with non-null hole cards
2. Returns empty equities list if <2 players have cards
3. Returns 404 if game or hand doesn't exist
4. Response matches expected equity values for a test fixture
5. API client function added to `frontend/src/api/client.js`

---

### T-008 — Game selector landing page component

**Category:** feature
**Dependencies:** none
**Story Ref:** S-3.1

Create `GameSelector.jsx` in `frontend/src/dealer/`. Fetches game list via `fetchSessions()`. Renders a card-style list (date, status, players, hand count). Includes a "New Game" button. Emits `onSelectGame(gameId)` and `onNewGame()` callbacks.

**Acceptance Criteria:**
1. Component renders a list of games sorted by date descending
2. Active games have an indigo accent; completed games are muted
3. Tapping a game card calls `onSelectGame(gameId)`
4. "New Game" button is visible and calls `onNewGame()`
5. Loading and error states are handled

---

### T-009 — Hand list & navigation in HandDashboard

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-3.2

Refactor `HandDashboard.jsx` to accept a list of hands (fetched from `fetchHands(gameId)`) and display them in a scrollable list. Each row shows hand number, participating players, and result summary. Add "Add New Hand" button (calls incremental POST) and "Back to Games" button.

**Acceptance Criteria:**
1. HandDashboard shows past hands in a scrollable list
2. Tapping a hand row emits `onSelectHand(handNumber)` for editing
3. "Add New Hand" button creates an empty hand via the API and navigates to player grid
4. "Back to Games" button returns to the game selector
5. Hand count is displayed at the top

---

### T-010 — Integrate GameCreateForm into selector flow

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-3.3

Wire the existing `GameCreateForm` to appear when "New Game" is tapped in `GameSelector`. After creation, dispatch `SET_GAME` and navigate to the hand dashboard. Update `DealerApp.jsx` step flow to include the game selector as the new entry point.

**Acceptance Criteria:**
1. `DealerApp` initial step is `gameSelector` (not `create`)
2. "New Game" transitions to `GameCreateForm`
3. After game creation, transitions to `HandDashboard` with the new game loaded
4. Selecting an existing game transitions directly to `HandDashboard`
5. Existing create flow works unchanged

---

### T-011 — Dealer state refactor: status & incremental actions

**Category:** refactor
**Dependencies:** T-004
**Story Ref:** S-4.5

Extend `dealerState.js` with per-player `status` field (`playing | won | folded | lost`), and new actions: `SET_PLAYER_RESULT` (sets status + result), `SET_HAND_ID` (stores the backend hand ID for PATCH calls), `FINISH_HAND` (marks hand as complete). Add `currentHandId` to the state. Update `dealerState.test.js` with tests for all new actions.

**Acceptance Criteria:**
1. `initialState` includes `currentHandId: null`
2. Each player object has `status: 'playing'` by default
3. `SET_PLAYER_RESULT` updates a player's status to `won`, `folded`, or `lost`
4. `SET_HAND_ID` stores the hand ID returned from the empty-hand POST
5. `FINISH_HAND` resets to hand dashboard
6. Tests cover all new actions and edge cases

---

### T-012 — Player tiles with status indicators

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-4.1

Update `PlayerGrid.jsx` to display each player's status text and background color. White = playing, green = won, red = folded, orange = lost. Status text renders below the player name. Remove the old `✅ recorded` indicator in favor of status + card icons.

**Acceptance Criteria:**
1. Each tile shows the player name and status text
2. Background color matches status: white/playing, green/won, red/folded, orange/lost
3. Tiles are at least 80px tall and touch-friendly
4. The Table tile retains ✅ for community cards recorded

---

### T-013 — Per-player card collection flow

**Category:** feature
**Dependencies:** T-012, T-005
**Story Ref:** S-4.2

When a dealer taps a player tile (status = `playing`), open `CameraCapture` → `DetectionReview`. After review confirmation, PATCH the player's hole cards to the backend via `add_player_to_hand` or `edit_player_hole_cards`. Store the cards in local state. Return to player grid.

**Acceptance Criteria:**
1. Tapping a "playing" tile opens camera capture
2. After detection review + confirm, hole cards are PATCHed to the backend
3. Player state updates with `card1`, `card2`, and `recorded: true`
4. Tapping a tile that already has cards opens review for re-capture (retake flow)
5. Error handling shows toast on PATCH failure

---

### T-014 — Outcome buttons (Won / Folded / Lost)

**Category:** feature
**Dependencies:** T-013, T-004
**Story Ref:** S-4.2

After detection review confirmation, show three outcome buttons: "Won", "Folded", "Lost (Showdown)". Selecting an outcome calls `PATCH .../players/{player_name}/result` with the chosen value. Dispatches `SET_PLAYER_RESULT` to update the tile. Returns to player grid.

**Acceptance Criteria:**
1. Three buttons appear after card review: "Won" (green), "Folded" (red), "Lost" (orange)
2. Tapping a button PATCHes the result to the backend
3. Player tile updates to the corresponding color/status
4. If PATCH fails, error is shown and buttons remain available for retry
5. Dealer can also assign outcome without capturing cards (for fold-without-showing scenarios)

---

### T-015 — Community card capture (PATCH wiring)

**Category:** feature
**Dependencies:** T-011, T-003
**Story Ref:** S-4.3

Wire the existing Table tile → camera capture → detection review flow to PATCH community cards via `edit_community_cards` (existing endpoint). After confirm, dispatch `SET_COMMUNITY_CARDS`. Show ✅ on the Table tile.

**Acceptance Criteria:**
1. Tapping Table tile opens camera capture for 3–5 cards
2. After confirm, community cards PATCHed to backend
3. Table tile shows ✅
4. Community PATCH validates against existing player cards (no duplicates)

---

### T-016 — Hand completion & elimination logic

**Category:** feature
**Dependencies:** T-014, T-015
**Story Ref:** S-4.4

When community cards are recorded and at least one player has an outcome, show a "Finish Hand" button. On finish: any player with `status: playing` (never tapped) is auto-assigned `result: null` (eliminated). Navigate to hand dashboard. Show confirmation dialog listing un-captured players.

**Acceptance Criteria:**
1. "Finish Hand" button appears when community cards + ≥1 outcome recorded
2. Confirmation dialog lists players that will be marked as eliminated
3. After confirm, eliminated players are POSTed to backend with null cards and null result
4. Dealer returns to hand dashboard with incremented hand count
5. Community cards are required before finishing (alert if missing)

---

### T-017 — Extract reusable Three.js scene module

**Category:** refactor
**Dependencies:** none
**Story Ref:** S-5.1

Create `frontend/src/scenes/pokerScene.js` that exports `createPokerScene(canvas, options)`. Move table geometry, seat positions, labels, and rendering loop from `playbackView.js` into this module. Refactor `playbackView.js` to call `createPokerScene()`. Verify playback view works identically after refactor.

**Acceptance Criteria:**
1. `pokerScene.js` exports `createPokerScene(canvas, options)` returning `{ scene, camera, renderer, seatPositions, dispose, update }`
2. `playbackView.js` uses `createPokerScene()` instead of inline scene setup
3. Playback view renders identically before and after
4. Options include `{ width, height, seatCount, antialias }` with sensible defaults

---

### T-018 — DealerPreview.jsx embedded component

**Category:** feature
**Dependencies:** T-017, T-011
**Story Ref:** S-5.2

Create `DealerPreview.jsx` — a Preact component that renders a `<canvas>` using `createPokerScene()`. Reads current hand state from the dealer reducer (community cards, player hole cards). Updates the 3D scene when cards change. Collapsible via a "Show/Hide Table" toggle.

**Acceptance Criteria:**
1. `DealerPreview` renders a Three.js canvas inside the dealer interface
2. Community cards and hole cards update in real time as the dealer records them
3. A toggle button collapses/expands the preview (saves mobile screen space)
4. The canvas is responsive to container width
5. Cleanup on unmount (dispose Three.js resources)

---

### T-019 — Wire equity overlay in dealer preview

**Category:** feature
**Dependencies:** T-018, T-007
**Story Ref:** S-5.3

Add equity badges to `DealerPreview`. After ≥2 players have hole cards, call `GET .../equity` and render per-seat equity percentages. Re-fetch when community cards change. Handle errors gracefully (hide equity instead of showing error).

**Acceptance Criteria:**
1. Equity badges appear when ≥2 players have hole cards
2. Equity re-fetches when community cards are added
3. If equity endpoint fails, badges are hidden (no error toast)
4. Badges show percentage to nearest integer (e.g., "81%")
5. API client `fetchEquity(gameId, handNumber)` added to `client.js`

---

### T-020 — Mobile playback route & layout

**Category:** feature
**Dependencies:** T-017
**Story Ref:** S-6.1

Register `#/playback-mobile` route. Create `MobilePlaybackView.jsx` — a Preact component with full-viewport Three.js canvas (using `createPokerScene` with mobile options), a bottom-drawer session picker (slide-up list), and mount point for scrubber controls. No sidebar.

**Acceptance Criteria:**
1. `#/playback-mobile` route is registered and renders the mobile view
2. Three.js canvas fills the viewport (no sidebar)
3. Session picker is a bottom-drawer (hidden by default, slide-up on tap)
4. Game list fetched from API and sorted by date descending
5. Selecting a game loads its hands and renders the first hand

---

### T-021 — Touch controls for Three.js scene

**Category:** feature
**Dependencies:** T-020
**Story Ref:** S-6.2

Enable `OrbitControls` from Three.js on the mobile playback canvas. Configure for touch: pinch-zoom, single-finger orbit, double-tap reset. Disable right-click context menu. Test on iOS Safari and Chrome Android (manual verification).

**Acceptance Criteria:**
1. Pinch-to-zoom works on mobile
2. Single-finger drag orbits the camera around the table
3. Double-tap resets camera to default position
4. OrbitControls does not interfere with scrubber touch events
5. Context menu is suppressed on long-press

---

### T-022 — Preact-styled UI controls for mobile

**Category:** feature
**Dependencies:** T-020
**Story Ref:** S-6.3

Reimplement session scrubber and street scrubber as Preact components for the mobile view. Style with the dealer-interface design language (indigo palette, rounded buttons, 48px min touch targets). Add equity display as a card-style row below the canvas.

**Acceptance Criteria:**
1. Session scrubber and street scrubber are Preact components with mobile-friendly sizing
2. Styling matches dealer interface (indigo accent, rounded corners)
3. Equity overlay renders as a horizontal card row below the canvas
4. "Back to Dealer" or "Back to Games" navigation link is available
5. All controls are usable on a 375px-wide screen

---

### T-023 — Mobile equity via backend

**Category:** feature
**Dependencies:** T-022, T-007
**Story Ref:** S-6.4

Wire the mobile playback equity display to call `GET .../equity` instead of the JS evaluator. Show a loading spinner while fetching. Re-fetch when the user scrubs to a new hand or street.

**Acceptance Criteria:**
1. Equity is fetched from the backend, not computed client-side
2. Loading indicator shows during fetch
3. Equity updates when hand or street changes
4. Error state gracefully hides equity (no crash)

---

### T-024 — End-to-end smoke test: full dealer flow

**Category:** test
**Dependencies:** T-016, T-019
**Story Ref:** S-4.2, S-4.4, S-5.3

Write an integration-style test (backend) and a manual test checklist (frontend) covering the full dealer control mode flow: select game → create hand → capture player cards → assign results → capture community → finish hand → verify equity. Backend tests use TestClient; frontend checklist is a markdown file.

**Acceptance Criteria:**
1. Backend test: POST empty hand → POST player cards → PATCH results → PATCH community → GET equity — all 200s
2. Backend test: Eliminated player (never POSTed) has null cards and null result
3. Frontend checklist covers: game selector, hand dashboard, camera capture, outcome buttons, Table capture, finish hand, dealer preview equity
4. All backend tests pass with `uv run pytest test/`

---

## Bugs / Findings

Discovered during Scott's review of **T-001** (aia-core-dh3, Cycle 1).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-001 | HIGH | CSV upload writes unvalidated result strings to database | `src/app/routes/upload.py:161` | T-001 review (Cycle 1) |
| B-002 | MEDIUM | `PlayerHandResponse.result` not typed as `ResultEnum \| None` | `src/pydantic_models/app_models.py:289` | T-001 review (Cycle 1) |
| B-003 | MEDIUM | `stats.py` uses string literals instead of `ResultEnum` constants | `src/app/routes/stats.py` | T-001 review (Cycle 1) |
| B-004 | MEDIUM | Frontend still uses old enum values (`win`/`loss`/`fold`) | `frontend/src/components/` (multiple) | T-001 review (Cycle 1) |
| B-005 | LOW | CSV schema `validate_csv_rows()` doesn't check result values | `src/pydantic_models/csv_schema.py` | T-001 review (Cycle 1) |

### B-001 — [HIGH] CSV upload writes unvalidated result strings to database

- **File:** `src/app/routes/upload.py` line 161
- **Description:** The CSV commit path writes `row['result'].strip() or None` directly to `PlayerHand.result` without validating against `ResultEnum`. This bypasses the enum constraint and allows arbitrary strings into the database.
- **Recommendation:** Validate result values against `ResultEnum` before database write. Reject or coerce invalid values during the commit step.

### B-002 — [MEDIUM] PlayerHandResponse.result not typed as ResultEnum | None

- **File:** `src/pydantic_models/app_models.py` line 289
- **Description:** The response model `PlayerHandResponse` still declares `result` as `str | None` instead of `ResultEnum | None`. This means the API contract does not reflect the enum constraint, and clients cannot rely on the documented enum values.
- **Recommendation:** Change `result: str | None` to `result: ResultEnum | None` in `PlayerHandResponse`.

### B-003 — [MEDIUM] stats.py uses string literals instead of ResultEnum constants

- **File:** `src/app/routes/stats.py`
- **Description:** Hardcoded `'won'`/`'lost'`/`'folded'` strings are used in filter queries instead of `ResultEnum.WON`, `ResultEnum.LOST`, `ResultEnum.FOLDED`. If enum values ever change, these queries silently break.
- **Recommendation:** Replace string literals with `ResultEnum` member values throughout `stats.py`.

### B-004 — [MEDIUM] Frontend still uses old enum values (win/loss/fold)

- **Files:** `frontend/src/components/handRecordForm.js`, `holeCards.js`, `dataView.js`, `handEditForm.js`, `resultOverlay.js`
- **Description:** Frontend components send `'win'`/`'loss'`/`'fold'` as result values. After T-001 standardizes on `'won'`/`'lost'`/`'folded'`, Pydantic validation will reject these values with a 422 error.
- **Recommendation:** Update all frontend components to send `'won'`/`'lost'`/`'folded'` to match `ResultEnum`.

### B-005 — [LOW] CSV schema validate_csv_rows() doesn't check result values

- **File:** `src/pydantic_models/csv_schema.py`
- **Description:** `validate_csv_rows()` validates column presence and basic types but never checks whether the `result` column contains valid enum values. Invalid results pass validation and are only caught (or not caught — see B-001) at database write time.
- **Recommendation:** Add result value validation in `validate_csv_rows()` against the documented enum values. Return row-level errors for invalid results.

---

Discovered during Scott's review of **T-002** (Cycle 2).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-006 | CRITICAL | add_player_to_hand() passes None flop values to duplicate card validator | `src/app/routes/hands.py:328-329` | T-002 review (Cycle 2) |
| B-007 | HIGH | edit_player_hole_cards() — same None-in-card-list bug | `src/app/routes/hands.py:240-241` | T-002 review (Cycle 2) |
| B-008 | MEDIUM | No validation that flop is all-3-or-none | `src/pydantic_models/app_models.py` | T-002 review (Cycle 2) |
| B-009 | MEDIUM | Test file duplicates DB fixture infrastructure | `test/test_empty_hand_creation_api.py` | T-002 review (Cycle 2) |

### B-006 — [CRITICAL] add_player_to_hand() passes None flop values to duplicate card validator

- **File:** `src/app/routes/hands.py` lines 328–329
- **Description:** `all_cards.extend([hand.flop_1, hand.flop_2, hand.flop_3])` injects `None` when community cards are null. Three `None` values are seen as duplicates by `validate_no_duplicate_cards()`, causing a spurious 400 error when adding a player to an empty-body hand. This blocks the "create empty → add players" workflow.
- **Recommendation:** Filter `None` before extending, matching what `record_hand()` already does.

### B-007 — [HIGH] edit_player_hole_cards() — same None-in-card-list bug

- **File:** `src/app/routes/hands.py` lines 240–241
- **Description:** Same pattern: `all_cards.extend()` without filtering `None`. Editing hole cards on a hand with null community cards will fail.
- **Recommendation:** Filter `None` values before extending `all_cards`.

### B-008 — [MEDIUM] No validation that flop is all-3-or-none

- **File:** `src/pydantic_models/app_models.py`
- **Description:** `HandCreate` allows partial flop (e.g., `flop_1` set, `flop_2`/`flop_3` null). In poker, a flop is always 3 cards.
- **Recommendation:** Add a model validator ensuring either all three flop fields are set or none are.

### B-009 — [MEDIUM] Test file duplicates DB fixture infrastructure

- **File:** `test/test_empty_hand_creation_api.py`
- **Description:** Creates its own engine/session/override instead of using shared `conftest.py` fixtures. Diverges from project convention.
- **Recommendation:** Refactor to use the shared `conftest.py` fixtures (`client`, `db_session`, etc.).

---

Discovered during Scott's review of **aia-core-xnwk + aia-core-y7jn** (Cycle 3).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-010 | MEDIUM | Regression test file creates its own DB fixtures instead of conftest.py | `test/test_none_community_cards_bug.py` | xnwk/y7jn review (Cycle 3) |
| B-011 | MEDIUM | No test covers partial community cards (flop set, turn/river null) | — | xnwk/y7jn review (Cycle 3) |
| B-012 | LOW | Fix unifies turn/river handling (positive) | — | xnwk/y7jn review (Cycle 3) |

### B-010 — [MEDIUM] Regression test file creates its own DB fixtures instead of conftest.py

- **File:** `test/test_none_community_cards_bug.py`
- **Description:** Creates own engine/session/override setup. Non-blocking — conftest only creates LegacyBase tables.
- **Recommendation:** Refactor to use shared `conftest.py` fixtures once conftest supports all required table bases.

### B-011 — [MEDIUM] No test covers partial community cards (flop set, turn/river null)

- **Source:** xnwk/y7jn review (Cycle 3)
- **Description:** The fix handles partial null correctly but no test exercises intermediate state (e.g., flop set, turn/river null).
- **Recommendation:** Add a test that creates a hand with flop cards set and turn/river null, then verifies community card list returns only flop values.

### B-012 — [LOW] Fix unifies turn/river handling (positive)

- **Source:** xnwk/y7jn review (Cycle 3)
- **Description:** Old code had separate conditional appends for turn and river. New comprehension pattern is more robust and consistent.
- **Recommendation:** No action required — positive finding. Pattern should be adopted in any future similar code.

---

Discovered during Scott's review of **aia-core-h7fm** (T-006 review, Cycle 6).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-013 | HIGH | Empty player list causes unhandled ValueError in calculate_equity() | `src/app/services/equity.py` | T-006 review (Cycle 6) |
| B-014 | MEDIUM | No input validation on card data in equity module | `src/app/services/equity.py` | T-006 review (Cycle 6) |
| B-015 | MEDIUM | AC #1 tolerance mismatch — test uses ±4% vs spec's ±1% | `test/test_equity.py` | T-006 review (Cycle 6) |
| B-016 | LOW | No Monte Carlo seeding for reproducibility | `src/app/services/equity.py` | T-006 review (Cycle 6) |
| B-017 | LOW | Unused constant B5 | `src/app/services/equity.py` | T-006 review (Cycle 6) |

### B-013 — [HIGH] Empty player list causes unhandled ValueError in calculate_equity()

- **Source:** T-006 review (Cycle 6)
- **File:** `src/app/services/equity.py` — `_eval_board()` calls `max(scores)` which crashes on empty list
- **Description:** If `calculate_equity([])` is called with 0 players, `max()` gets an empty sequence.
- **Recommendation:** Guard at T-007 endpoint (validate `len(players) >= 2`) or raise explicit `ValueError`.

### B-014 — [MEDIUM] No input validation on card data in equity module

- **Source:** T-006 review (Cycle 6)
- **File:** `src/app/services/equity.py`
- **Description:** No checks for: player count, 2 cards per player, 0–5 community cards, valid rank/suit, duplicates.
- **Recommendation:** Add validation at the service boundary or the calling endpoint.

### B-015 — [MEDIUM] AC #1 tolerance mismatch — test uses ±4% vs spec's ±1%

- **Source:** T-006 review (Cycle 6)
- **File:** `test/test_equity.py`
- **Description:** Standard error at 5,000 iterations is ~0.55%, so ±1% would fail ~7% of runs.
- **Recommendation:** Either increase iteration count to tighten variance, or update the spec AC to match the realistic tolerance.

### B-016 — [LOW] No Monte Carlo seeding for reproducibility

- **Source:** T-006 review (Cycle 6)
- **File:** `src/app/services/equity.py`
- **Description:** Monte Carlo simulation uses unseeded random, making test results non-deterministic.
- **Recommendation:** Accept an optional `seed` parameter for test reproducibility.

### B-017 — [LOW] Unused constant B5

- **Source:** T-006 review (Cycle 6)
- **File:** `src/app/services/equity.py`
- **Description:** Constant `B5` is defined but never referenced.
- **Recommendation:** Remove or use it.

---

Discovered during Scott's review of **T-005** (aia-core-u63x, Cycle 10).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-018 | CRITICAL | record_hand() stores literal string "None" in DB for null cards | `src/app/routes/hands.py:495-496,551-552` | T-005 review (Cycle 10) |
| B-019 | CRITICAL | edit_community_cards() passes None hole cards to duplicate validator | `src/app/routes/hands.py:206-207` | T-005 review (Cycle 10) |
| B-020 | HIGH | edit_player_hole_cards() passes None hole cards of other players to validator | `src/app/routes/hands.py:306-307` | T-005 review (Cycle 10) |
| B-021 | HIGH | HoleCardsUpdate not updated — card_1/card_2 still required (AC-4 not satisfied) | `src/pydantic_models/app_models.py` | T-005 review (Cycle 10) |

### B-018 — [CRITICAL] record_hand() stores literal string "None" in DB for null cards

- **Source:** T-005 review (Cycle 10)
- **File:** `src/app/routes/hands.py` lines 495–496, 551–552
- **Description:** `str(entry.card_1)` converts `None` → `"None"` string. DB stores `"None"` instead of SQL NULL. Also causes spurious duplicate card 400 when two players both have null cards.
- **Recommendation:** Filter `None` in validation; use conditional `str()` conversion in persistence.

### B-019 — [CRITICAL] edit_community_cards() passes None hole cards to duplicate validator

- **Source:** T-005 review (Cycle 10)
- **File:** `src/app/routes/hands.py` lines 206–207
- **Description:** Appends `ph.card_1`/`ph.card_2` without `None` check. Players with null cards → validator sees duplicate `None` → spurious 400.
- **Recommendation:** Guard with `None` check before appending.

### B-020 — [HIGH] edit_player_hole_cards() passes None hole cards of other players to validator

- **Source:** T-005 review (Cycle 10)
- **File:** `src/app/routes/hands.py` lines 306–307
- **Description:** Same pattern: appends `other_ph.card_1`/`card_2` without `None` filter.
- **Recommendation:** Filter `None` values before appending to `all_cards`.

### B-021 — [HIGH] HoleCardsUpdate not updated — card_1/card_2 still required (AC-4 not satisfied)

- **Source:** T-005 review (Cycle 10)
- **File:** `src/pydantic_models/app_models.py`
- **Description:** `HoleCardsUpdate.card_1` and `card_2` remain required (`Card` type). Should be `Card | None = None` per AC-4.
- **Recommendation:** Change fields to `Card | None = None` in `HoleCardsUpdate`. Blocks T-013 per-player card collection flow.

---

Discovered during Scott's review of **aia-core-hnfr** (Cycle 11).

| # | Severity | Title | File(s) | Source |
|---|---|---|---|---|
| B-022 | HIGH | `confirm_detection()` — unguarded `str(entry.card_1)` fragility | `src/app/routes/images.py:258-259,315-316,357-358` | Cycle 11 review |
| B-023 | MEDIUM | `to_community_query()` stores literal string "None" for missing turn/river | `src/app/routes/utils.py:70-72` | Cycle 11 review |
| B-024 | LOW | Test file duplicates DB fixtures | `test/test_none_handling_bugs.py` | Cycle 11 review |

### B-022 — [HIGH] images.py confirm_detection() — unguarded str(entry.card_1) fragility

- **Source:** Cycle 11 review
- **File:** `src/app/routes/images.py` lines 258–259, 315–316, 357–358
- **Description:** `ConfirmPlayerEntry.card_1` is currently required (`Card` type), so Pydantic rejects `None`. But if made optional in future, same `"None"` string bug would reappear. Recommend proactive `None` guards.
- **Recommendation:** Add explicit `None` guards around `str()` calls on card fields to prevent future regression if fields become optional.

### B-023 — [MEDIUM] utils.py to_community_query() stores literal string "None" for missing turn/river

- **Source:** Cycle 11 review
- **File:** `src/app/routes/utils.py` lines 70–72
- **Description:** Pre-existing anti-pattern. Legacy `"None"` string fallback — `str()` on `None` turn/river produces `"None"` stored in DB instead of SQL NULL.
- **Recommendation:** Replace `str()` calls with conditional conversion; store SQL NULL for missing turn/river.

### B-024 — [LOW] Test file duplicates DB fixtures

- **Source:** Cycle 11 review
- **File:** `test/test_none_handling_bugs.py`
- **Description:** Creates its own engine/session/override setup instead of using shared `conftest.py` fixtures. Consistent with existing patterns (see B-009, B-010) but adds boilerplate.
- **Recommendation:** Refactor to use shared `conftest.py` fixtures when conftest supports all required table bases.
