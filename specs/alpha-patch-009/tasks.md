# Tasks — Alpha Patch Epic

**Project ID:** alpha-patch-009
**Date:** 2026-04-12
**Total Tasks:** 5
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Seat assignment API + conflict checking | feature | none | S-2.1 |
| T-002 | Betting state machine backend (blinds, turn order, pot, side pots) | feature | none | S-3.1, S-3.2, S-3.3 |
| T-003 | 3D table toggle in dealer HandDashboard | feature | none | S-1.1, S-1.2 |
| T-004 | Seat picker UI + dealer bet verification frontend | feature | T-001, T-002 | S-2.2, S-2.3, S-3.4 |
| T-005 | UI stabilization — canvas bounds, scrubber perf, camera defaults | refactor | none | S-4.1, S-4.2, S-4.3 |

---

## Task Details

### T-001 — Seat assignment API + conflict checking

**Category:** feature
**Dependencies:** none
**Story Ref:** S-2.1

Add a `PATCH /games/{game_id}/players/{player_name}/seat` endpoint to `routes/games.py`. The endpoint accepts `{ "seat_number": int }`, validates the range is 1–10, checks that no other active player in the game holds that seat, and updates `game_players.seat_number`. Returns the updated `PlayerInfo` response. Also add conflict checking to the existing `add_player_to_game` endpoint when an optional `seat_number` is provided on creation. Add Pydantic request model `SeatAssignmentRequest` with validation. No new migration needed — `seat_number` column already exists on `game_players`.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/players/{player_name}/seat` with `{ "seat_number": 3 }` returns 200 and the player's seat is updated
2. Returns 409 when the seat is occupied by another active player
3. Returns 400 when `seat_number` is outside 1–10
4. Returns 404 when the player is not in the game
5. `add_player_to_game` with `seat_number` returns 409 if the seat is already taken
6. A player can reassign themselves to a different open seat (old seat is freed)
7. Pytest tests cover all success and error paths, including concurrent-seat edge case

---

### T-002 — Betting state machine backend (blinds, turn order, pot, side pots)

**Category:** feature
**Dependencies:** none
**Story Ref:** S-3.1, S-3.2, S-3.3

This is the largest task. It delivers the full betting flow on the backend:

**Migration:** Add `pot` (Float, default 0) and `side_pots` (String/JSON, default `"[]"`) columns to the `hands` table via Alembic.

**Auto-post blinds:** Modify the `start-all` endpoint so that when a hand is created, two `PlayerHandAction` records (SB post, BB post) are automatically inserted, `HandState.phase` is set to `preflop`, `current_seat` is set to UTG (first player after BB), and `pot` is initialized to SB + BB. Reject with 400 if fewer than 2 active players.

**Legal action calculator:** Create `services/betting.py` with a pure function `get_legal_actions(hand_state, actions_this_street, blind_amounts) -> LegalActions` that returns the list of valid actions and `amount_to_call` for the current player. Integrate into `GET .../status` response.

**Turn-order enforcement:** Update `POST .../actions` to reject actions from non-current players (403). After recording a valid action, advance `current_seat` to the next non-folded player. Detect street completion (all active players acted, bets equalized) and advance `phase`. Detect fold-to-one and end the hand immediately (remaining player wins).

**Pot tracking:** On every action with a non-null `amount` (`call`, `bet`, `raise`, `blind`), add the amount to `hands.pot`. When an all-in-for-less is detected, compute side pots: cap the main pot at the all-in player's contribution per-player, move excess to a side pot with eligible player IDs. Serialize to `hands.side_pots` JSON.

**Response updates:** Extend `HandResponse` and `HandStatusResponse` Pydantic models with `pot`, `side_pots`, `legal_actions`, `amount_to_call`, and `current_player_name` fields.

**Acceptance Criteria:**
1. `start-all` creates blind actions and initializes pot = SB + BB; `HandState` points to UTG
2. `start-all` returns 400 if fewer than 2 active players
3. `GET .../status` returns `current_player_name`, `legal_actions`, `amount_to_call`, `pot`, `side_pots`
4. `POST .../actions` returns 403 when a non-current player submits an action
5. After a valid action, `current_seat` advances correctly; after street completion, `phase` advances
6. Fold-to-one ends the hand and sets the remaining player's result to `won`
7. `pot` accumulates correctly across call/bet/raise/blind actions
8. All-in-for-less triggers side-pot creation with correct eligible player lists
9. When no all-in, `side_pots` is `[]` and `pot` holds the full amount
10. Alembic migration passes `alembic upgrade head` and `alembic downgrade -1` cleanly
11. Pytest tests cover: blind posting, full preflop round, street transitions, fold-to-one, side-pot creation (2-way and 3-way all-in), and legal action calculation

---

### T-003 — 3D table toggle in dealer HandDashboard

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.1, S-1.2

Create a `TableView3D` React component that wraps `createPokerScene()` in a `useRef`/`useEffect` lifecycle: initialize the scene and renderer on mount, call `dispose()` on unmount. The component accepts the current hand state (community cards, player hole cards, results, seat-player map) as props and calls `scene.update()` when props change. Add a toggle control (button or segmented tab) to `HandDashboard` that switches between `tile` (default) and `3d` states. When `3d` is selected, render `TableView3D` instead of the tile grid. Preserve all hand state across toggles — no refetch. Handle canvas resizing on container resize via `ResizeObserver`. Enable `OrbitControls` for rotate/zoom.

**Acceptance Criteria:**
1. A toggle button or tab appears in `HandDashboard` above the hand content area
2. Clicking "3D View" renders the Three.js scene showing community cards, player cards, seat positions, and results
3. Clicking "Tile View" (default) restores the existing tile grid
4. Toggling multiple times does not leak WebGL contexts (verified by test or manual inspection)
5. The canvas resizes when the dashboard container size changes
6. OrbitControls allow the dealer to rotate and zoom the 3D view
7. Hand state (cards, results) is passed from the dealer store and renders correctly in the scene
8. Vitest tests cover: toggle state switching, component mount/unmount lifecycle, prop mapping

---

### T-004 — Seat picker UI + dealer bet verification frontend

**Category:** feature
**Dependencies:** T-001, T-002
**Story Ref:** S-2.2, S-2.3, S-3.4

This task delivers three frontend components that depend on the backend work in T-001 and T-002:

**Shared SeatPicker component:** Create `components/SeatPicker.tsx` rendering 10 seats in an oval (CSS or SVG). Each seat shows either a player name (occupied, non-selectable) or an open indicator (selectable). Props: `seats` (array of `{seatNumber, playerName | null}`), `currentPlayerSeat` (highlighted), `onSelect(seatNumber)`, `onSkip`. The component is purely presentational and reused in both contexts below.

**Player seat selection step:** In `PlayerApp`, insert a `SeatPicker` screen between name selection and the playing state. On load, fetch the game's player list to populate seat occupancy. When the player taps an open seat, call `PATCH .../seat` and advance to playing. A "Skip" button lets the player proceed without choosing. If the player already has a seat (rejoin), highlight it; tapping a different seat reassigns.

**Dealer seat management:** In `GamePlayerManagement`, display each player's seat number in the player list. Add a "Reassign Seat" action per player that opens the `SeatPicker` in a modal/inline panel. Reassignment calls `PATCH .../seat`; on 409 conflict, show a toast/inline error.

**Dealer bet verification UI:** Extend `ActiveHandDashboard` (or the equivalent active hand view) with a panel showing: whose turn it is (`current_player_name`), the action the player submitted (poll `GET .../status` or use existing polling), and confirm/override buttons. "Confirm" records the action as-is. "Override" opens an inline form to change action type and amount, then submits via `POST .../actions`. After confirmation or override, the turn advances.

**Acceptance Criteria:**
1. `SeatPicker` renders 10 seats in an oval; occupied seats show names and are disabled; open seats are tappable
2. Player flow: after name pick, seat picker appears; selecting a seat calls the API; "Skip" proceeds without seat
3. Player flow: on rejoin, current seat is highlighted; tapping another seat reassigns
4. Dealer flow: player list shows seat numbers; "Reassign" opens seat picker; conflict error is displayed on 409
5. Dealer bet verification: shows current player's action or "waiting"; confirm and override buttons work
6. Override opens an inline editor for action type and amount; submission advances the turn
7. Vitest tests cover: SeatPicker rendering/interaction, PlayerApp seat step, GamePlayerManagement seat reassignment, bet verification confirm/override flows

---

### T-005 — UI stabilization — canvas bounds, scrubber perf, camera defaults

**Category:** refactor
**Dependencies:** none
**Story Ref:** S-4.1, S-4.2, S-4.3

This task fixes three alpha-reported UX issues across the visualization views. It touches existing files only — no new endpoints or models.

**Canvas bounds:** In `PlaybackView.tsx` and `MobilePlaybackView.tsx`, change the layout so the Three.js canvas is sized by the space *between* HUD elements (scrubbers, equity row, stats sidebar) rather than using a full-viewport canvas with overlays on top. Use a flex column layout where the canvas container has `flex: 1; overflow: hidden` and a `ResizeObserver` calls `renderer.setSize()` on the bounded area. Ensure HUD elements have `z-index` above the canvas as a safety net. Verify the table and all 10 seats remain fully visible within the bounded canvas.

**Scrubber responsiveness:** In `SessionScrubber.tsx` and `StreetScrubber.tsx`, ensure the range input fires `onChange` on the `input` event (live drag), not just `change` (release). In the parent views, split the scrubber callback into two parts: (1) update the hand/street index state immediately (so the label and slider position update instantly), and (2) defer the expensive work (Three.js `scene.update()`, equity recalculation) into a `requestAnimationFrame` or a short debounce (~50ms). This keeps the slider responsive while the scene catches up.

**Camera defaults:** In `seatCamera.ts`, increase `DEFAULT_OVERHEAD_POSITION` Y from 14 to ~18 and Z from 3 to ~6 so the default view shows the full table and all seats on a mobile viewport without manual zoom. Adjust `SEAT_CAMERA_HEIGHT` from 6 to ~8 and `SEAT_CAMERA_BEHIND` from 1.4 to ~1.6 so the seat-snap view is slightly wider. In `pokerScene.ts`, set `controls.minDistance = 8` and `controls.maxDistance = 30` to prevent extreme zoom levels.

**Acceptance Criteria:**
1. In both PlaybackView and MobilePlaybackView, the 3D canvas does not extend behind scrubbers, equity overlays, or any other HUD element
2. Resizing the browser window re-bounds the canvas correctly
3. Dragging the session scrubber updates the hand label in real-time without visible lag
4. The Three.js scene update follows within one animation frame of the scrubber release
5. Default camera in both views shows all 10 seats and the full table without manual zoom
6. Seat-snap camera still shows a reasonable first-person perspective (table center + nearest neighbors visible)
7. OrbitControls enforce min/max zoom — user cannot clip through the table or zoom out to a dot
8. Vitest tests cover: canvas container sizing via mock ResizeObserver, scrubber `input` event firing, camera position assertions against new defaults

---

## Bugs / Findings

Findings recorded from code review cycles. MEDIUM and LOW severity items are tracked here only — they do NOT warrant standalone beads issues.

---

### M-1: `assign_player_seat` duplicates `_get_game_player()` helper

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-001 (aia-core-q3jl), Cycle 1 review |
| **File** | `src/app/routes/games.py` lines 540–565 |

**Description:** The inline game→player→game_player lookup chain in `assign_player_seat` is identical to the existing `_get_game_player()` helper defined earlier in the same file. Should call the helper instead of duplicating the logic.

**Recommended fix:** Replace the inline lookup with a call to `_get_game_player(game_id, player_name, db)` and let its `HTTPException` raises handle the 404 cases.

---

### M-2: Auto-assigned seats in `add_player_to_game` can exceed 1–10

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-001 (aia-core-q3jl), Cycle 1 review |
| **File** | `src/app/routes/games.py` lines 482–489 |

**Description:** `next_seat = (max_seat or 0) + 1` has no upper-bound check. Adding an 11th player produces seat 11, bypassing the 1–10 validation that the explicit seat-assignment path enforces.

**Recommended fix:** After computing `next_seat`, raise `HTTPException(400)` if `next_seat > 10` with a message like "table is full (max 10 seats)".

---

### L-1: Error message inconsistency

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-001 (aia-core-q3jl), Cycle 1 review |
| **File** | `src/app/routes/games.py` |

**Description:** `assign_player_seat` says "not found in this game" while existing helpers say "not in this game". Inconsistent error wording.

**Recommended fix:** Adopt the helper's message phrasing ("not in this game") for consistency, or — better — use the helper directly (see M-1).

---

### L-2: AC-3 spec says 400, implementation returns 422

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-001 (aia-core-q3jl), Cycle 1 review |
| **File** | `specs/alpha-patch-009/tasks.md` (this file) |

**Description:** AC-3 for T-001 states "Returns 400 when `seat_number` is outside 1–10". FastAPI + Pydantic's `Field(ge=1, le=10)` correctly returns 422 for validation failures, not 400. The spec text is inaccurate.

**Recommended fix:** Update AC-3 wording to say "Returns 422 when `seat_number` is outside 1–10" to match FastAPI/Pydantic behavior.

---

### L-3: No concurrency test for AC-7

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-001 (aia-core-q3jl), Cycle 1 review |
| **File** | `test/` (missing test) |

**Description:** AC-7 mentions "concurrent-seat edge case" but the implemented tests only exercise conflict logic serially. No threading or async-concurrent test validates that two simultaneous seat assignments don't both succeed.

**Recommended fix:** Add a threading-based test (or `asyncio.gather` with the async client) that races two players assigning the same seat and asserts exactly one gets 409.

---

### H-1: No validation on negative action amounts

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/pydantic_models/app_models.py` (PlayerActionCreate.amount) |

**Description:** `amount` field accepts negative floats. A negative call/bet/raise subtracts from pot.

**Recommended fix:** Add `Field(default=None, ge=0)` to the amount field.

---

### H-2: All-in detection only fires on calls, missing bet/raise all-ins

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/routes/hands.py` (action handling) |

**Description:** `is_all_in` only gets set for call actions. Players who go all-in via bet/raise are never flagged, breaking side-pot calculation.

**Recommended fix:** Accept `is_all_in` flag from client or add stack tracking.

---

### H-3: Side pot eligible_player_ids exposes internal DB IDs

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/services/betting.py`, `src/app/routes/hands.py` |

**Description:** API responses contain raw integer player_id values the frontend cannot resolve.

**Recommended fix:** Map IDs to player names before serializing responses.

---

### M-3: MD5 used for ETag generation

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/routes/hands.py` |

**Description:** MD5 is used for ETag generation. While not a cryptographic use, it is flagged by security scanners and can be replaced with a faster non-crypto hash.

**Recommended fix:** Replace `hashlib.md5` with `hashlib.sha256` or a non-crypto alternative like `xxhash`.

---

### M-4: Untyped side_pots: list in Pydantic models

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/pydantic_models/app_models.py` |

**Description:** `side_pots` is typed as bare `list` without element type annotation, losing schema validation and OpenAPI documentation.

**Recommended fix:** Define a `SidePot` Pydantic model and type the field as `list[SidePot]`.

---

### M-5: No validation that submitted action is legal

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/routes/hands.py` |

**Description:** The action endpoint checks turn order but does not verify the submitted action type is in the set returned by `get_legal_actions()`. A player could submit "raise" when only "check/fold" is valid.

**Recommended fix:** Call `get_legal_actions()` before recording and reject actions not in the legal set.

---

### M-6: Pot calculation trusts client-supplied amount

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/routes/hands.py` |

**Description:** The pot is incremented by whatever `amount` the client sends. No server-side verification that the amount matches what the action requires (e.g., call amount = current bet − player contribution).

**Recommended fix:** Compute the correct amount server-side for calls; validate bet/raise amounts against min-raise rules.

---

### M-7: GET /state endpoint mutates via _try_advance_phase

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/routes/hands.py` |

**Description:** The GET status/state endpoint calls `_try_advance_phase()` which may write to the database. GET requests should be idempotent and side-effect-free.

**Recommended fix:** Move phase advancement into the action POST handler so it fires after recording an action, not on read.

---

### L-4: blind_amounts parameter unused in get_legal_actions()

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/services/betting.py` |

**Description:** `blind_amounts` is accepted as a parameter but never referenced in the function body. Dead parameter adds confusion.

**Recommended fix:** Remove the parameter or wire it into min-raise calculation.

---

### L-5: Multiple null-seat players map to seat 0 causing ordering ambiguity

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `src/app/services/betting.py` |

**Description:** Players without an assigned seat get `seat_number or 0`, meaning multiple seatless players share position 0. Turn order among them is arbitrary and non-deterministic.

**Recommended fix:** Require seat assignment before hand start, or use a secondary sort key (e.g., player ID) for tiebreaking.

---

### L-6: test_fold_action_sets_result uses legacy endpoint

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `test/test_fold_action_sets_result.py` |

**Description:** The test POSTs to the old `/actions` endpoint shape rather than the current turn-order-enforced endpoint, masking potential regressions.

**Recommended fix:** Update the test to use the current endpoint and supply the correct current-player context.

---

### L-7: No test for rejecting actions on completed hand

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | T-002 (aia-core-ndtd), Cycle 2 review |
| **File** | `test/` (missing test) |

**Description:** There is no test asserting that submitting an action to a hand with `result != null` (already completed) is rejected. The endpoint may silently accept stale actions.

**Recommended fix:** Add a test that completes a hand (fold-to-one or showdown), then submits another action and asserts 400/409.

---

### M-8: BlindsUpdate accepts negative blind values

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-n01m, Cycle 3 review |
| **File** | `src/pydantic_models/app_models.py` (BlindsUpdate.small_blind, BlindsUpdate.big_blind) |

**Description:** Bare `float | None` with no `ge=0` constraint. Negative blinds would produce negative initial pot.

**Recommended fix:** Add `Field(ge=0)` to both `small_blind` and `big_blind` on `BlindsUpdate`.

---

### L-8: Negative amount test does not assert on error detail

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | aia-core-n01m, Cycle 3 review |
| **File** | `test/test_betting_state_machine.py` |

**Description:** Test checks `status_code == 422` but doesn't verify the error body references the amount field.

**Recommended fix:** Add an assertion on the response JSON detail to confirm the validation error targets the `amount` field.

---

### H-4: Fallback returns raw side pots (with IDs) when all_ids is empty

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Source** | aia-core-7l16, Cycle 4 review |
| **File** | `src/app/routes/hands.py` (`_resolve_side_pot_names`) |

**Description:** Short-circuits with `return side_pots_raw` when no player IDs found, potentially leaking `eligible_player_ids` keys in API response. Should transform to `eligible_players: []` instead.

**Recommended fix:** Replace the early return with a transform that copies each pot but replaces `eligible_player_ids` with `eligible_players: []`.

---

### M-9: compute_side_pots still returns eligible_player_ids — undocumented internal contract

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-7l16, Cycle 4 review |
| **File** | `src/app/services/betting.py` |

**Description:** `compute_side_pots` returns dicts keyed with `eligible_player_ids` (internal DB IDs). The route layer transforms these to `eligible_players` (names), but this internal contract is not documented or type-enforced, making it fragile.

**Recommended fix:** Document the internal return shape or define a typed dict / dataclass for the return value of `compute_side_pots`.

---

### M-10: Unit test still asserts eligible_player_ids (confusing asymmetry)

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-7l16, Cycle 4 review |
| **File** | `test/test_betting_state_machine.py` |

**Description:** Unit tests for `compute_side_pots` assert on `eligible_player_ids` keys, while integration/API tests expect `eligible_players` (names). This asymmetry is confusing and makes it easy to miss regressions in the ID→name mapping layer.

**Recommended fix:** Add a comment clarifying the intentional asymmetry, or refactor so the service returns name-based keys and both test layers agree.

---

### L-9: Pydantic side_pots field is untyped list (pre-existing)

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | aia-core-7l16, Cycle 4 review |
| **File** | `src/pydantic_models/app_models.py` |

**Description:** `side_pots` is typed as bare `list` without element type annotation, losing schema validation and OpenAPI documentation. (Pre-existing; see also M-4.)

**Recommended fix:** Define a `SidePot` Pydantic model and type the field as `list[SidePot]`.

---

### H-5: PlaybackView camera default inconsistent with DEFAULT_OVERHEAD_POSITION

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Source** | aia-core-kf0l (T-005), Cycle 7 review |
| **File** | `frontend/src/scenes/pokerScene.ts` and `frontend/src/views/PlaybackView.tsx` |

**Description:** pokerScene.ts hardcodes `camera.position.set(0, 8, 5)` while `DEFAULT_OVERHEAD_POSITION` is `(0, 18, 6)`. MobilePlaybackView overrides correctly, PlaybackView does not. Desktop view doesn't show full table without zoom.

**Recommended fix:** Import `DEFAULT_OVERHEAD_POSITION` into pokerScene.ts or have PlaybackView override camera after creation.

---

### M-11: SessionScrubber double-fires onChange per drag step

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `frontend/src/components/SessionScrubber.tsx` |

**Description:** Both `onInput` and `onChange` attached; React `onChange` already fires on native input events, so callback runs twice per drag step.

**Recommended fix:** Remove the redundant handler so only one fires per drag step.

---

### M-12: MobilePlaybackView uses hardcoded (0,18,6) instead of importing constants

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `frontend/src/views/MobilePlaybackView.tsx` |

**Description:** MobilePlaybackView hardcodes the camera position `(0, 18, 6)` instead of importing `DEFAULT_OVERHEAD_POSITION` from the constants module, creating a maintenance risk if the default changes.

**Recommended fix:** Import and use `DEFAULT_OVERHEAD_POSITION` instead of hardcoded values.

---

### M-13: MobilePlaybackView init loop has no retry limit

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `frontend/src/views/MobilePlaybackView.tsx` |

**Description:** The initialization loop in MobilePlaybackView retries indefinitely without a cap, risking an infinite loop if the scene never becomes ready.

**Recommended fix:** Add a maximum retry count or timeout to the init loop and surface an error state if exceeded.

---

### L-10: ResizeObserver behavior not tested via mock

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `test/` (missing test) |

**Description:** No test mocks `ResizeObserver` to verify that canvas resize logic fires correctly when the container dimensions change.

**Recommended fix:** Add a Vitest test that mocks `ResizeObserver`, triggers a resize entry, and asserts `renderer.setSize()` is called with the new dimensions.

---

### L-11: Rapid scrubbing queues multiple rAF without cancellation

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `frontend/src/components/SessionScrubber.tsx` |

**Description:** Each scrubber drag step schedules a `requestAnimationFrame` for scene update, but previous pending rAFs are not cancelled. Rapid scrubbing can queue redundant frames.

**Recommended fix:** Store the rAF ID and call `cancelAnimationFrame()` before scheduling a new one.

---

### L-12: Redundant window resize handler in pokerScene alongside ResizeObserver

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Source** | aia-core-kf0l, Cycle 7 review |
| **File** | `frontend/src/scenes/pokerScene.ts` |

**Description:** pokerScene.ts attaches a `window` resize event listener in addition to the `ResizeObserver` used by the view components. The window listener is redundant when `ResizeObserver` is active and may cause double resize handling.

**Recommended fix:** Remove the window resize listener from pokerScene.ts and rely solely on `ResizeObserver` in the view layer.
