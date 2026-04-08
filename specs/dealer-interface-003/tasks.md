# Tasks — Dealer Interface

**Project ID:** dealer-interface-003
**Date:** 2026-04-07
**Total Tasks:** 14
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Install Preact & configure Vite JSX | setup | none | S-1.1 |
| T-002 | Register `#/dealer` route | feature | T-001 | S-1.2 |
| T-003 | Add image upload & detection API functions | feature | none | S-4.2 |
| T-004 | Build Game Creation form component | feature | T-002 | S-2.1 |
| T-005 | Inline player creation in Game Creation form | feature | T-004 | S-2.2 |
| T-006 | Build Hand Dashboard view | feature | T-004 | S-3.1, S-3.2 |
| T-007 | Build Player Grid component | feature | T-006 | S-4.1 |
| T-008 | Implement dealer state reducer | feature | T-007 | S-4.3 |
| T-009 | Wire native camera capture for player cards | feature | T-007, T-003 | S-4.2 |
| T-010 | Wire native camera capture for community cards | feature | T-009 | S-5.1 |
| T-011 | Build Detection Review display | feature | T-009 | S-6.1 |
| T-012 | Build Card Correction picker | feature | T-011 | S-6.2 |
| T-013 | Assemble hand payload & submit | feature | T-012, T-010 | S-7.1, S-7.2 |
| T-014 | Mobile polish & end-to-end flow testing | test | T-013 | all |

---

## Task Details

### T-001 — Install Preact & configure Vite JSX

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Install `preact` as a dependency in `frontend/package.json`. Update `vite.config.js` to handle JSX via esbuild with `jsxFactory: 'h'` and `jsxFragment: 'Fragment'` for `.jsx` files. Create a `frontend/src/dealer/` directory for all dealer Preact components. Verify `npm run dev` and `npm run build` pass. Verify existing vanilla JS views still render.

**Acceptance Criteria:**
1. `preact` appears in `package.json` dependencies
2. `vite.config.js` includes esbuild JSX config targeting Preact
3. A test `.jsx` file in `src/dealer/` compiles without errors
4. `#/playback` and `#/data` views remain functional

---

### T-002 — Register `#/dealer` route

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.2

Add `#/dealer` to the hash router in `router.js`. When the route is active, mount the Preact dealer app into the `#app` container using `render()`. When navigating away, unmount with `render(null, container)`. Add a "Dealer" link to the navigation bar. Create `frontend/src/dealer/DealerApp.jsx` as the root component that renders a placeholder heading.

**Acceptance Criteria:**
1. Navigating to `#/dealer` renders the Preact `DealerApp` component
2. A "Dealer" nav link appears alongside "Playback" and "Data"
3. Navigating from `#/dealer` to `#/playback` unmounts Preact cleanly
4. No console errors on route transitions

---

### T-003 — Add image upload & detection API functions

**Category:** feature
**Dependencies:** none
**Story Ref:** S-4.2

Add two functions to `frontend/src/api/client.js`: `uploadImage(gameId, file)` (POST multipart to `/games/{gameId}/hands/image`) and `getDetectionResults(gameId, uploadId)` (GET `/games/{gameId}/hands/image/{uploadId}`). Both follow the existing `request()` pattern. `uploadImage` uses `FormData` instead of JSON.

**Acceptance Criteria:**
1. `uploadImage(gameId, file)` sends a multipart POST and returns the upload record JSON
2. `getDetectionResults(gameId, uploadId)` returns the detection results JSON
3. Both throw descriptive errors on non-2xx responses
4. Existing client functions are not modified

---

### T-004 — Build Game Creation form component

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-2.1

Create `frontend/src/dealer/GameCreateForm.jsx`. This component renders a date input (default today), fetches `GET /players` on mount, displays players as selectable chip/toggle buttons, and has a "Create Game" button that calls `POST /games`. On success, it emits the `game_id` to the parent so the dealer app can transition to the Hand Dashboard. Validate at least 2 players are selected before enabling submit.

**Acceptance Criteria:**
1. Date input defaults to today's date
2. Players are fetched and displayed as tappable chips
3. "Create Game" is disabled with <2 players selected
4. Successful creation navigates to the Hand Dashboard with the game context
5. API errors display an inline error message

---

### T-005 — Inline player creation in Game Creation form

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-2.2

Add a text input + "Add" button to `GameCreateForm.jsx` that calls `POST /players` to create a new player. On success, append the player to the selectable list and auto-select them. Show an inline error on duplicate names (409 from API).

**Acceptance Criteria:**
1. A text input and "Add" button appear below the player chips
2. Submitting creates the player via API and adds them to the list
3. The new player is automatically selected
4. Duplicate name attempts show an inline error without crashing

---

### T-006 — Build Hand Dashboard view

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-3.1, S-3.2

Create `frontend/src/dealer/HandDashboard.jsx`. Displays game date, player names, and a hand counter. Shows "Enter First Hand" when hand count is 0, or "Add New Hand" otherwise. Both buttons transition to the Player Grid view. The hand count updates after each successful hand submission.

**Acceptance Criteria:**
1. Game date and player names are displayed
2. Hand count shows the number of submitted hands
3. Button text reflects whether it's the first hand or a subsequent one
4. Tapping the button transitions to the Player Grid

---

### T-007 — Build Player Grid component

**Category:** feature
**Dependencies:** T-006
**Story Ref:** S-4.1

Create `frontend/src/dealer/PlayerGrid.jsx`. Renders all game players as large tappable tiles in a CSS grid layout (responsive, mobile-friendly). Each tile shows the player name. A "Table" tile is rendered first/at the top for community cards. Tiles accept a `recorded` prop to display a green checkmark overlay.

**Acceptance Criteria:**
1. One tile per player plus one "Table" tile
2. Tiles are large enough for easy tap on mobile (~80px min)
3. Checkmark overlays appear on tiles where `recorded` is true
4. Tapping a tile emits the player name (or "community") to the parent

---

### T-008 — Implement dealer state reducer

**Category:** feature
**Dependencies:** T-007
**Story Ref:** S-4.3

Create a `useReducer`-based state manager in `frontend/src/dealer/dealerState.js`. State shape: `{ gameId, players: [{name, card1, card2, recorded}], community: {flop1, flop2, flop3, turn, river, recorded}, currentStep }`. Actions: `SET_GAME`, `SET_PLAYER_CARDS`, `SET_COMMUNITY_CARDS`, `RESET_HAND`, `SET_STEP`. Wire it into `DealerApp.jsx` so all child components share state via props.

**Acceptance Criteria:**
1. Reducer manages game ID, per-player cards, community cards, and current step
2. `SET_PLAYER_CARDS` updates a specific player and marks them `recorded: true`
3. `SET_COMMUNITY_CARDS` stores community cards and marks `recorded: true`
4. `RESET_HAND` clears all card data but preserves game ID and player list
5. State is passed to child components; no prop-drilling deeper than one level

---

### T-009 — Wire native camera capture for player cards

**Category:** feature
**Dependencies:** T-007, T-003
**Story Ref:** S-4.2

Create `frontend/src/dealer/CameraCapture.jsx`. When the dealer taps a player tile, render a hidden `<input type="file" accept="image/*" capture="environment">` and programmatically trigger it. On file selection: show a loading spinner, call `uploadImage(gameId, file)`, then call `getDetectionResults(gameId, uploadId)`. Pass the detection results to the Detection Review screen.

**Acceptance Criteria:**
1. Tapping a player tile opens the native camera/file picker
2. The selected image is uploaded to the backend
3. Detection results are retrieved after upload
4. A loading indicator is shown during upload + detection
5. On failure, an error message is shown and the dealer can retry

---

### T-010 — Wire native camera capture for community cards

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-5.1

Reuse `CameraCapture.jsx` for the "Table" tile. The flow is identical (camera → upload → detect) but expects 3–5 cards instead of 2. The detection results are passed to the Detection Review with a `mode="community"` flag so the review screen knows how many cards to expect.

**Acceptance Criteria:**
1. Tapping the Table tile opens the native camera
2. Upload and detection work identically to player capture
3. Detection review is opened with community mode (3–5 cards expected)
4. The Table tile shows a checkmark after community cards are confirmed

---

### T-011 — Build Detection Review display

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-6.1

Create `frontend/src/dealer/DetectionReview.jsx`. Displays the uploaded photo alongside the detected cards. Each card is shown as a styled label (e.g., "A♥") with its confidence score. For player mode, expects exactly 2 cards. For community mode, expects 3–5 cards. A "Confirm" button saves the cards to state and returns to the Player Grid.

**Acceptance Criteria:**
1. The uploaded photo is displayed for reference
2. Detected cards are shown with rank, suit symbol, and confidence percentage
3. Card count matches the expected mode (2 for player, 3–5 for community)
4. "Confirm" dispatches cards to state and navigates back to the Player Grid

---

### T-012 — Build Card Correction picker

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-6.2

Add correction capability to `DetectionReview.jsx`. Tapping a detected card opens a `CardPicker.jsx` component — a grid of all 52 cards (4 suits × 13 ranks) rendered as tappable buttons. Selecting a card replaces the detected value. Corrected cards are visually marked (e.g., orange border). Create `frontend/src/dealer/CardPicker.jsx` as a reusable component.

**Acceptance Criteria:**
1. Tapping a card label opens the 52-card picker
2. Selecting a card replaces the detection in local state
3. Corrected cards have a distinct visual indicator
4. The picker dismisses after selection
5. All 52 standard cards are available (A–K × ♠♥♦♣)

---

### T-013 — Assemble hand payload & submit

**Category:** feature
**Dependencies:** T-012, T-010
**Story Ref:** S-7.1, S-7.2

In the Player Grid view, show a "Submit Hand" button that is enabled only when all players and community cards have `recorded: true`. On tap: assemble a `HandCreate` payload from state (map community cards to `flop_1`–`river`, map per-player cards to `PlayerHandEntry` items), run client-side duplicate-card validation, and call `POST /games/{gameId}/hands`. On success, dispatch `RESET_HAND` and navigate to the Hand Dashboard. On error, show an inline message.

**Acceptance Criteria:**
1. "Submit Hand" button is disabled until all tiles are checked
2. Payload assembles community cards into `flop_1`, `flop_2`, `flop_3`, `turn`, `river`
3. Payload assembles player cards into `player_entries` with `player_name`, `card_1`, `card_2`
4. Client-side validation rejects duplicate cards with an error message
5. Successful submission resets hand state and returns to dashboard
6. Failed submission shows error and allows retry

---

### T-014 — Mobile polish & end-to-end flow testing

**Category:** test
**Dependencies:** T-013
**Story Ref:** all

Run through the complete dealer flow on a mobile device over local network. Fix CSS issues (viewport meta tag, touch targets, scrolling). Ensure the Vite dev server is accessible on LAN (`--host 0.0.0.0`). Test on iOS Safari and Android Chrome. Fix any camera or upload issues encountered. Verify the full cycle: create game → record all player cards → record community cards → submit hand → add another hand.

**Acceptance Criteria:**
1. Vite dev server is accessible at `http://<local-ip>:5173` from a phone on the same network
2. All tap targets are at least 48×48px per mobile accessibility guidelines
3. The full flow (game → hand → all players → community → submit → next hand) works end-to-end
4. No horizontal scroll or layout overflow on a typical phone screen (375px+ width)
5. Camera capture works on iOS Safari and Android Chrome

---

## Bugs / Findings

### Cycle 1 — T-001 (aia-core-h58): Install Preact & configure Vite JSX

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-001 | MEDIUM | Global jsxInject applies Preact import to all JS files, not just .jsx. Consider scoping via @preact/preset-vite or documenting the .jsx convention. | vite.config.js L7 |
| F-002 | LOW | DealerApp uses named export only; many Preact patterns expect a default export for root components. May need adjustment in T-002. | DealerApp.jsx L1 |

Do NOT create any beads issues. These are MEDIUM/LOW only for documentation.

### Cycle 2 — T-002 (aia-core-6w0): Register #/dealer route

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-003 | MEDIUM | @preact/preset-vite in dependencies instead of devDependencies — build-only plugin should be a devDep | package.json |
| F-004 | MEDIUM | Dual cleanup pattern (Preact unmount + innerHTML clear) is correct but undocumented | router.js |
| F-005 | LOW | createNav() uses innerHTML with static content — safe today, but switch to DOM API if links become dynamic | router.js |
| F-006 | LOW | Chunk size warning (558 kB) predates T-002 — consider code-splitting as dealer interface grows | build output |

### Cycle 3 — T-003 (aia-core-6d2): Add image upload & detection API functions

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-007 | MEDIUM | Inconsistent error handling pattern — uploadImage parses body.detail for structured errors while getDetectionResults uses request() which throws raw text. Inherited convention. | client.js |
| F-008 | LOW | No client-side input validation on gameId/uploadId — consistent with every other function in the file | client.js |

### Cycle 4 — T-004 (aia-core-egy): Build Game Creation form component

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-009 | MEDIUM | No empty-state message when player list is empty — users on fresh system see blank chip area | GameCreateForm.jsx |
| F-010 | MEDIUM | Missing aria-pressed on player chip toggle buttons — accessibility gap | GameCreateForm.jsx |
| F-011 | LOW | Inconsistent h import across dealer components — unnecessary with @preact/preset-vite | GameCreateForm.jsx |
| F-012 | LOW | No AbortController cleanup in useEffect fetch — minor lifecycle gap | GameCreateForm.jsx |

### Cycle 5 — T-006 (aia-core-a3b): Build Hand Dashboard view

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-013 | LOW | Unnecessary h import in HandDashboard.jsx — @preact/preset-vite auto-injects it | HandDashboard.jsx |
| F-014 | LOW | One-way step transition to playerGrid — no return path yet, expected for T-007/T-013 | DealerApp.jsx |

### Cycle 6 — T-007 (aia-core-gsf): Build Player Grid component

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-015 | MEDIUM | Missing type="button" on tile buttons — defaults to submit, could trigger form submission | PlayerGrid.jsx |
| F-016 | MEDIUM | No ARIA attributes for recorded state — screen readers can't distinguish recorded from unrecorded tiles | PlayerGrid.jsx |
| F-017 | LOW | Inconsistent h import across dealer components — some import it, some don't | PlayerGrid.jsx |
| F-018 | LOW | handleTileSelect is a console.log stub — expected placeholder for T-009/T-008 | DealerApp.jsx |

### Cycle 7 — T-008 (aia-core-cu7): Implement dealer state reducer

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-019 | MEDIUM | SET_PLAYER_CARDS silently ignores unknown player names — could mask integration bugs | dealerState.js |
| F-020 | LOW | SET_COMMUNITY_CARDS destructuring can produce undefined instead of null for missing keys | dealerState.js |
| F-021 | LOW | Placeholder console.log in handleTileSelect — expected stub for T-009 | DealerApp.jsx |

### Cycle 8 — T-009 (aia-core-z6c): Wire native camera capture for player cards

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-022 | HIGH | Empty overlay with no dismiss mechanism when file picker change event doesn't fire on Android WebViews — traps dealer with no way out. Fix: add fallback Cancel button or "Waiting for camera..." state. | CameraCapture.jsx |
| F-023 | MEDIUM | No AbortController for in-flight requests on unmount — could call callbacks on stale context | CameraCapture.jsx |
| F-024 | MEDIUM | No client-side file size validation — phone cameras produce 5-15MB images, could cause long waits | CameraCapture.jsx |
| F-025 | LOW | console.log in production path — should remove or gate behind import.meta.env.DEV | DealerApp.jsx |
| F-026 | LOW | Detection results not persisted to state — acknowledged as deferred to T-011 | DealerApp.jsx |

### Cycle 9 — Bug (aia-core-pr5): CameraCapture overlay trap fix

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-027 | MEDIUM | Theoretical micro-race between file selection and setLoading(true) — unexploitable in practice due to Preact batching | CameraCapture.jsx |
| F-028 | LOW | Unicode ellipsis U+2026 vs ASCII convention — cosmetic consistency | CameraCapture.jsx |

### Cycle 10 — T-011 (aia-core-cd0): Build Detection Review display

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-029 | MEDIUM | Confirm button not disabled on card count mismatch — dealer can submit wrong number of cards | DetectionReview.jsx |
| F-030 | MEDIUM | Blob URL leak on component unmount if DealerApp navigates away during review | DealerApp.jsx |
| F-031 | LOW | formatCard doesn't handle malformed input — empty/undefined detected_value produces empty tiles | DetectionReview.jsx |
| F-032 | LOW | Array index as key — fine for display but needs stable key when T-012 adds correction | DetectionReview.jsx |

### Cycle 12 — T-012 (aia-core-zcd): Build Card Correction picker

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-033 | MEDIUM | Card labels use div instead of button — not keyboard-focusable or announced as interactive | DetectionReview.jsx |
| F-034 | MEDIUM | No duplicate card prevention across slots — picker allows selecting already-used cards | DetectionReview.jsx |
| F-035 | LOW | No Escape key to dismiss picker — standard UX expectation, minor for mobile | CardPicker.jsx |
| F-036 | LOW | "Corrected" indicator shown even when value matches original detection — cosmetic | DetectionReview.jsx |

### Cycle 13 — T-013 (aia-core-uqp): Assemble hand payload & submit

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-037 | MEDIUM | No component/integration tests for submit flow — unit tests cover handPayload.js but not DealerApp/PlayerGrid wiring | DealerApp.jsx, PlayerGrid.jsx |
| F-038 | LOW | || null vs ?? null for turn/river — coerces any falsy value but no practical impact | handPayload.js |
| F-039 | LOW | Player tiles remain clickable during submission — theoretical race condition | PlayerGrid.jsx |

### Cycle 14 — T-005 (aia-core-cpx): Inline player creation in Game Creation form

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-040 | MEDIUM | Error detection relies on string matching err.message.includes('409') — brittle coupling | GameCreateForm.jsx |
| F-041 | LOW | No maxlength on player name input — UX/layout concern | GameCreateForm.jsx |
| F-042 | LOW | Unnecessary e.preventDefault() on button type="button" click handler — harmless | GameCreateForm.jsx |

### Cycle 15 — T-014 (aia-core-4zr): Mobile polish & end-to-end flow testing

| # | Severity | Description | Source |
|---|----------|-------------|--------|
| F-043 | LOW | Player chip buttons missing explicit minWidth — single-char names could be <48px wide | GameCreateForm.jsx |
| F-044 | LOW | overflow-x: hidden masks overflow rather than fixing root cause — acceptable trade-off | style.css |
| F-045 | LOW | Vite dev server binds to all interfaces — required for LAN testing, dev-only | vite.config.js |
