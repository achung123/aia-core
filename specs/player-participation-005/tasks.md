# Tasks — Player Participation Mode

**Project ID:** player-participation-005
**Date:** 2026-04-09
**Total Tasks:** 16
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Add hand status polling endpoint | feature | none | S-3.1 |
| T-002 | Add "handed_back" to result validation | feature | none | S-3.2 |
| T-003 | Exclude "handed_back" from stats queries | feature | T-002 | S-3.2 |
| T-004 | Add `fetchHandStatus` to API client | feature | T-001 | S-3.1 |
| T-005 | Register `#/player` route and scaffold `PlayerApp` | feature | none | S-1.1 |
| T-006 | Build player game selector (with ?game= support) | feature | T-005 | S-1.1 |
| T-007 | Build player name picker | feature | T-006 | S-1.1 |
| T-008 | Add player polling loop and state derivation | feature | T-004, T-007 | S-1.1 |
| T-009 | Integrate camera capture for player self-capture | feature | T-008 | S-1.2 |
| T-010 | Build player fold action | feature | T-008, T-002 | S-1.4 |
| T-011 | Build player "Hand Back Cards" action | feature | T-009, T-002 | S-1.3 |
| T-012 | Extend dealer tile colors for participation states | feature | T-001 | S-2.1 |
| T-013 | Add dealer polling via hand status endpoint | feature | T-004, T-012 | S-2.1 |
| T-014 | Add QR code component to dealer UI | feature | T-005 | S-2.2 |
| T-015 | Integration tests for multi-client flow | test | T-011, T-013 | S-1.2, S-2.1 |
| T-016 | Polling cleanup and edge case hardening | refactor | T-008, T-013 | S-3.1 |

---

## Task Details

### T-001 — Add hand status polling endpoint

**Category:** feature
**Dependencies:** none
**Story Ref:** S-3.1

Add `GET /games/{game_id}/hands/{hand_number}/status` to the hands router. The endpoint returns all game players with a derived `participation_status` computed from PlayerHand row existence, `card_1`, and `result` fields. No schema changes — status is derived at query time.

**Acceptance Criteria:**
1. Endpoint returns JSON: `{ hand_number, community_recorded, players: [{ name, participation_status, card_1, card_2, result, outcome_street }] }`
2. Derivation: no PlayerHand row → `"idle"`, row with null card_1 & null result → `"pending"`, card_1 set & null result → `"joined"`, result=`"folded"` → `"folded"`, result=`"handed_back"` → `"handed_back"`, result=`"won"`/`"lost"` → as-is
3. Returns 404 for missing game or hand
4. Pydantic response model `HandStatusResponse` is defined in `pydantic_models/app_models.py`
5. At least 6 test cases covering each participation status + 404s in `test/test_hand_status_api.py`
6. `uv run pytest test/` passes

---

### T-002 — Add "handed_back" to result validation

**Category:** feature
**Dependencies:** none
**Story Ref:** S-3.2

Ensure the `patchPlayerResult` endpoint accepts `"handed_back"` as a valid `result` value. Check the `PlayerResultUpdate` Pydantic model — if it uses an enum or Literal constraint, add `"handed_back"`. If it's a freeform string, add a test proving it works.

**Acceptance Criteria:**
1. `PATCH /games/{id}/hands/{num}/players/{name}/result` with `{ "result": "handed_back" }` returns 200
2. The stored value is retrievable via `GET /games/{id}/hands/{num}` and shows `result: "handed_back"`
3. Test added in `test/test_player_result_patch_api.py` (or new file) for the `"handed_back"` case
4. Existing result tests (won, lost, folded) continue to pass
5. `uv run pytest test/` passes

---

### T-003 — Exclude "handed_back" from stats queries

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-3.2

Audit stats endpoints (`/stats/players/{name}`, `/stats/games/{id}`, `/stats/leaderboard`) and ensure `"handed_back"` results are not counted as wins, losses, or folds. They should be treated as if the hand is still in progress.

**Acceptance Criteria:**
1. Player stats do not count `"handed_back"` in win/loss/fold totals
2. Game stats do not count `"handed_back"` as a completed result
3. Leaderboard is unaffected by `"handed_back"` results
4. Tests added that create a player_hand with `result="handed_back"` and verify stats exclude it
5. `uv run pytest test/` passes

---

### T-004 — Add `fetchHandStatus` to API client

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-3.1

Add a `fetchHandStatus(gameId, handNumber)` function to `frontend/src/api/client.js` that calls `GET /games/{gameId}/hands/{handNumber}/status`.

**Acceptance Criteria:**
1. `fetchHandStatus` is exported from `client.js`
2. Function calls the correct endpoint path and returns parsed JSON
3. Error handling matches existing `request()` helper pattern
4. No other files are modified

---

### T-005 — Register `#/player` route and scaffold `PlayerApp`

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.1

Add `#/player` to the hash router in `frontend/src/router.js`. Create a new `frontend/src/player/PlayerApp.jsx` component that renders a placeholder "Player Mode" heading. Add a "Player" link to the navigation bar.

**Acceptance Criteria:**
1. Navigating to `#/player` renders the `PlayerApp` component
2. `PlayerApp.jsx` exists at `frontend/src/player/PlayerApp.jsx`
3. Nav bar includes a "Player" link alongside existing Playback/Data/Dealer links
4. Component renders without errors
5. Test file `frontend/src/player/PlayerApp.test.jsx` exists with a basic render test

---

### T-006 — Build player game selector (with ?game= support)

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-1.1

In `PlayerApp`, add a game selection step. Fetch active games via `fetchSessions` and display only those with `status === 'active'`. If the URL contains `?game=<id>` (parsed from `window.location`), skip the selector and use that game directly.

**Acceptance Criteria:**
1. Active games are listed with game date and player count
2. Selecting a game advances to the name picker step
3. `?game=123` in the URL pre-selects game 123 and skips the selector
4. If `?game=` references an invalid/inactive game, an error message is shown
5. Test covers both manual selection and query-param pre-selection paths

---

### T-007 — Build player name picker

**Category:** feature
**Dependencies:** T-006
**Story Ref:** S-1.1

After game selection, fetch the game's players via `fetchGame` and display a name picker. After selecting a name, show it prominently and transition to the "waiting for hand" state.

**Acceptance Criteria:**
1. All players in the game are listed as selectable buttons
2. Selecting a name stores it in component state and shows the player's name prominently
3. The view transitions to a "Waiting for hand…" state
4. A "Change Player" button allows re-selecting the name
5. Test covers name selection and display

---

### T-008 — Add player polling loop and state derivation

**Category:** feature
**Dependencies:** T-004, T-007
**Story Ref:** S-1.1

After name selection, start polling `fetchHandStatus` every 3 seconds. Determine the current hand number from the game's hands list or the status response. Extract the player's own `participation_status` and drive the UI state accordingly.

**Acceptance Criteria:**
1. Polling starts when the player has selected a game and name
2. Polling interval is 3 seconds, using `setInterval` inside a `useEffect` with proper cleanup
3. Player's participation status is extracted from the polling response and stored in state
4. UI shows appropriate view based on status: "Waiting for hand…" (idle), "Your turn!" (pending), card view (joined), "Folded" (folded), "Waiting for dealer…" (handed_back), final result (won/lost)
5. Polling stops on component unmount (no leaked intervals)
6. Test verifies polling starts and state transitions work

---

### T-009 — Integrate camera capture for player self-capture

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-1.2

When the player is in "pending" status and taps "Join Current Hand", open the existing `CameraCapture` component. After capture, show `DetectionReview`. On confirm, call `updateHolecards` to submit cards. On success, transition to "joined" state.

**Acceptance Criteria:**
1. "Join Current Hand" button is visible and enabled only in "pending" state
2. Tapping it renders `CameraCapture` with the correct `gameId` and `targetName`
3. After capture, `DetectionReview` is shown with the detection results
4. Confirming detection calls `updateHolecards(gameId, handNumber, playerName, { card_1, card_2 })`
5. On success, UI transitions to show submitted cards and "Hand Back Cards" button
6. On error, retry option is available
7. Test covers the capture → review → confirm flow (mocking API calls)

---

### T-010 — Build player fold action

**Category:** feature
**Dependencies:** T-008, T-002
**Story Ref:** S-1.4

When the player is in "pending" state, display a "Fold" button alongside "Join Current Hand". Tapping it calls `patchPlayerResult` with `{ result: "folded" }` and transitions the view to "Folded".

**Acceptance Criteria:**
1. "Fold" button is visible and enabled only in "pending" state
2. Tapping "Fold" calls `patchPlayerResult(gameId, handNumber, playerName, { result: "folded" })`
3. On success, UI shows "Folded" text and disables both action buttons
4. On error, an error message is displayed with retry
5. Test covers fold action and resulting UI state

---

### T-011 — Build player "Hand Back Cards" action

**Category:** feature
**Dependencies:** T-009, T-002
**Story Ref:** S-1.3

When the player is in "joined" state (cards submitted), display a "Hand Back Cards" button. Tapping it calls `patchPlayerResult` with `{ result: "handed_back" }` and transitions to "Waiting for dealer…".

**Acceptance Criteria:**
1. "Hand Back Cards" button is visible and enabled only in "joined" state
2. Tapping it calls `patchPlayerResult(gameId, handNumber, playerName, { result: "handed_back" })`
3. On success, UI shows "Waiting for dealer…" and disables the button
4. Polling continues so the player can see when the dealer assigns a final outcome
5. When polling detects a final result (won/lost/folded), the view updates to show the outcome
6. Test covers hand-back action and transition to waiting state

---

### T-012 — Extend dealer tile colors for participation states

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-2.1

Update `statusColors` in `PlayerGrid.jsx` to include participation-mode color states. Update the status label formatting to show participation state labels.

**Acceptance Criteria:**
1. New color entries: `pending: '#fef08a'` (yellow), `joined: '#bbf7d0'` (green), `handed_back: '#fef08a'` (yellow)
2. `formatStatus` function handles: "pending" → "pending", "joined" → "joined", "handed_back" → "handed back"
3. Existing colors for `won`, `folded`, `lost`, `not_playing` remain unchanged
4. `PlayerGrid.test.jsx` updated with tests for new color states
5. `uv run pytest test/` and frontend tests pass

---

### T-013 — Add dealer polling via hand status endpoint

**Category:** feature
**Dependencies:** T-004, T-012
**Story Ref:** S-2.1

Replace or augment the dealer's hand-state fetching with polling the new `fetchHandStatus` endpoint every 3 seconds while on the player grid step. Map the `participation_status` values from the response into the dealer state so tiles update in real time.

**Acceptance Criteria:**
1. When the dealer is on the `playerGrid` step, polling starts at 3-second intervals
2. Polling response `participation_status` values are mapped into the dealer's player state
3. Tiles update colors without requiring manual refresh
4. Polling stops when leaving the player grid step or unmounting
5. Existing dealer flow (manual tile tap → capture → review) continues to work
6. Test verifies polling integration updates tile states

---

### T-014 — Add QR code component to dealer UI

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-2.2

Add a QR code display to the dealer's game view. The QR encodes the player URL with the game ID pre-filled. A "Show QR" toggle button controls visibility.

**Acceptance Criteria:**
1. `qrcode` npm package (or equivalent) is added to `package.json`
2. A `QRCodeDisplay` component renders a QR code encoding `<origin>/#/player?game=<gameId>`
3. "Show QR" / "Hide QR" toggle button is present in the dealer dashboard
4. QR code updates when the game changes
5. QR is hidden by default to avoid clutter
6. Test covers rendering and toggle behavior

---

### T-015 — Integration tests for multi-client flow

**Category:** test
**Dependencies:** T-011, T-013
**Story Ref:** S-1.2, S-2.1

Write backend integration tests that simulate the full dealer-player interaction flow using the test client.

**Acceptance Criteria:**
1. Test: dealer creates hand → adds player (PlayerHand row) → status endpoint shows "pending"
2. Test: player submits hole cards → status endpoint shows "joined"
3. Test: player sends "handed_back" → status endpoint shows "handed_back"
4. Test: dealer assigns final result (won) → status endpoint shows "won"
5. Test: player folds → status endpoint shows "folded"
6. All tests in `test/test_player_participation_flow.py`
7. `uv run pytest test/` passes

---

### T-016 — Polling cleanup and edge case hardening

**Category:** refactor
**Dependencies:** T-008, T-013
**Story Ref:** S-3.1

Ensure polling loops in both player and dealer frontends are robust: cleanup on unmount, handle network errors gracefully, handle edge cases like no active hand or game completed mid-poll.

**Acceptance Criteria:**
1. Both player and dealer polling loops clear their interval on component unmount
2. Network errors during polling show a non-blocking warning (toast or inline message) without crashing the component
3. If the game status changes to "completed" during polling, both UIs show an appropriate message and stop polling
4. If there is no active hand, the polling response is handled gracefully (player sees "Waiting for hand…")
5. Tests verify cleanup behavior (no leaked intervals in test environments)
