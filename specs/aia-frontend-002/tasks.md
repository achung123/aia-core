# Tasks — All In Analytics Interactive Frontend

**Project ID:** aia-frontend-002
**Date:** 2026-04-06
**Total Tasks:** 22
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Scaffold Vite + Three.js frontend project | setup | none | S-1.1 |
| T-002 | Add CORS middleware to FastAPI backend | infra | none | S-1.2 |
| T-003 | Implement API client module | feature | T-001 | S-1.3 |
| T-004 | Implement hash-based SPA router and nav bar | feature | T-001 | S-1.4 |
| T-005 | Build base Three.js scene (renderer, camera, lighting) | feature | T-001 | S-2.1 |
| T-006 | Build oval poker table geometry and seat positions | feature | T-005 | S-2.2 |
| T-007 | Create card mesh factory with canvas-rendered faces | feature | T-005 | S-2.3 |
| T-008 | Build chip stack visualization at each seat | feature | T-006 | S-2.4 |
| T-009 | Build session list panel and session loading flow | feature | T-003, T-006 | S-3.1, S-3.2 |
| T-010 | Implement session-level scrubber component | feature | T-009 | S-4.1 |
| T-011 | Implement stats sidebar with cumulative P/L | feature | T-009, T-010 | S-4.2 |
| T-012 | Wire chip stack animations to session scrubber | feature | T-008, T-010 | S-4.2 |
| T-013 | Implement hand-level street scrubber component | feature | T-010 | S-5.1 |
| T-014 | Implement community card deal animations | feature | T-007, T-013 | S-5.2 |
| T-015 | Implement hole card display and showdown reveal | feature | T-007, T-013 | S-5.3 |
| T-016 | Build hand result overlay panel | feature | T-013, T-015 | S-5.4 |
| T-017 | Build data interface: session list table | feature | T-003, T-004 | S-6.1 |
| T-018 | Build data interface: player management UI | feature | T-003, T-004 | S-6.2 |
| T-019 | Build data interface: session creation form | feature | T-003, T-004 | S-6.3 |
| T-020 | Build data interface: hand recording form | feature | T-003, T-004, T-017 | S-6.4 |
| T-021 | Build data interface: hand edit/correction form | feature | T-003, T-017 | S-6.5 |
| T-022 | Write frontend README with dev setup and deployment guide | docs | T-001, T-002 | — |

---

## Task Details

### T-001 — Scaffold Vite + Three.js frontend project

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Create the `frontend/` directory inside the repo root with a minimal Vite project configured for vanilla JavaScript. Install Three.js as an npm dependency. Verify the dev server starts and Three.js is importable.

**Acceptance Criteria:**
1. `frontend/package.json` exists with `"three"` in dependencies and `"vite"` in devDependencies
2. `frontend/index.html` contains a `<canvas id="three-canvas">` and a `<div id="app">`
3. `npm run dev` (from `frontend/`) opens a working page at `localhost:5173`
4. `npm run build` produces `frontend/dist/` without errors
5. A smoke-test `main.js` imports `Three` and logs the Three.js version to the console

---

### T-002 — Add CORS middleware to FastAPI backend

**Category:** infra
**Dependencies:** none
**Story Ref:** S-1.2

Add `CORSMiddleware` to the FastAPI app in `src/app/main.py`. Read allowed origins from an `ALLOWED_ORIGINS` environment variable; default to `http://localhost:5173` so no configuration is needed in development.

**Acceptance Criteria:**
1. `CORSMiddleware` is imported from `fastapi.middleware.cors` and added to `app` in `main.py`
2. `ALLOWED_ORIGINS` env var is parsed as a comma-separated list; defaults to `http://localhost:5173`
3. `uv run pytest test/` passes with no regressions
4. A manual `curl -H "Origin: http://localhost:5173" http://localhost:8000/` returns an `Access-Control-Allow-Origin` response header

---

### T-003 — Implement API client module

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.3

Create `frontend/src/api/client.js` with all functions needed by the playback and data interfaces. The base URL is configurable via `VITE_API_BASE_URL`.

**Acceptance Criteria:**
1. `client.js` exports: `fetchSessions`, `fetchHands`, `fetchPlayerStats`, `fetchGameStats`, `fetchLeaderboard`, `createSession`, `createPlayer`, `createHand`, `updateHolecards`, `updateCommunityCards`
2. Each function calls the correct backend endpoint and returns parsed JSON
3. HTTP error responses (4xx, 5xx) throw an `Error` with the response status and message
4. The base URL defaults to `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'`
5. A README comment documents the expected response shape for each function

---

### T-004 — Implement hash-based SPA router and nav bar

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.4

Implement client-side routing using `window.location.hash`. Register two routes: `#/playback` and `#/data`. Render a shared navigation bar that persists across both views.

**Acceptance Criteria:**
1. A `router.js` module exports `initRouter(routes)` where `routes` is a map of hash → render function
2. Navigating to `/#/playback` renders the Three.js canvas container; navigating to `/#/data` renders the data dashboard container
3. A `<nav>` bar at the top contains "Playback" and "Data" links that update `window.location.hash`
4. The active link is visually highlighted
5. Navigating directly via the browser address bar to `/#/data` loads the correct view

---

### T-005 — Build base Three.js scene (renderer, camera, lighting)

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-2.1

Create `frontend/src/scenes/table.js` and initialize a `WebGLRenderer` that fills the viewport, a `PerspectiveCamera` positioned in a top-angled view, and basic lighting. Wire the animation loop.

**Acceptance Criteria:**
1. `initScene(canvasElement)` sets up the renderer, scene, camera, and RAF loop
2. The viewport fills the canvas entirely; `window.resize` triggers `renderer.setSize` and camera aspect update
3. Ambient light (`0x404040`) and a directional key light are added to the scene
4. Camera is positioned at approximately `(0, 8, 5)` looking at origin — giving a comfortable angled-overhead perspective
5. The scene renders at a stable 60fps on a standard desktop machine (visible via browser dev tools)

---

### T-006 — Build oval poker table geometry and seat positions

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-2.2

Add the poker table mesh to the scene and compute up to 10 seat positions evenly distributed around the table ellipse. Each seat renders a text label using an HTML overlay (`position: absolute` over the canvas).

**Acceptance Criteria:**
1. The table is an oval (`CylinderGeometry` scaled on X) with a green `MeshLambertMaterial`
2. 10 seat positions are computed as evenly-spaced angles around the ellipse perimeter
3. Each seat position has a corresponding `<div class="seat-label">` that is projected from 3D world space to 2D screen space each frame
4. `loadSession(playerNames)` takes an array of up to 10 player names, assigns them to seats, and shows/dims labels accordingly
5. Unoccupied seats are visually dimmed (e.g. 30% opacity label, no chip stack)

---

### T-007 — Create card mesh factory with canvas-rendered faces

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-2.3

Implement `createCard(rank, suit, faceUp)` in `frontend/src/scenes/cards.js`. Returns a Three.js `Mesh` with a canvas-rendered front face and a solid card-back color.

**Acceptance Criteria:**
1. Card mesh uses `BoxGeometry(0.7, 1.0, 0.02)`
2. Front face `CanvasTexture` (256×384px) renders: rank text in top-left + bottom-right, large suit symbol (♠ ♥ ♦ ♣) centered; red for hearts/diamonds, black for spades/clubs; white background with rounded corners
3. Back face uses a solid dark-blue `MeshBasicMaterial`
4. `faceUp = false` renders the back-face material on the front face slot (card hidden)
5. `card.flip()` method swaps to the face-up material with a 0.3s Y-axis rotation tween

---

### T-008 — Build chip stack visualization at each seat

**Category:** feature
**Dependencies:** T-006
**Story Ref:** S-2.4

Add chip stacks to each seat as stacked `CylinderGeometry` discs. Implement `updateChipStacks(playerPLMap)` that animates stack heights to reflect the given P/L values.

**Acceptance Criteria:**
1. Each active seat has a chip stack group of 3–8 disc geometries positioned at the seat location
2. Stack height scales linearly with P/L relative to the session maximum
3. Players with negative P/L display a smaller stack in a different color (e.g. red tint)
4. `updateChipStacks(map)` lerp-animates each stack to its target height over 400ms
5. Players with `null` P/L display a neutral half-height stack

---

### T-009 — Build session list panel and session loading flow

**Category:** feature
**Dependencies:** T-003, T-006
**Story Ref:** S-3.1, S-3.2

Build the session list sidebar panel that calls `fetchSessions()` on mount and renders a clickable list. Selecting a session fetches its hands and populates the scene with players.

**Acceptance Criteria:**
1. On playback view mount, `fetchSessions()` is called and results render in a left-side panel
2. Each row shows: date, hand count, player count
3. A loading spinner overlays the scene while hands are fetching
4. On error, a red banner with the error message is shown; loading spinner is removed
5. On success, `table.loadSession(playerNames)` is called and the session scrubber is initialized with the hand count

---

### T-010 — Implement session-level scrubber component

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-4.1

Build the session timeline scrubber as an HTML range input with tick marks, styled to sit below the Three.js canvas. Implement Previous / Next buttons. Emit a `handChange` event when the position changes.

**Acceptance Criteria:**
1. A `<div class="session-scrubber">` renders below the canvas with `<input type="range">` and Prev/Next buttons
2. Range input min=1, max=handCount, step=1; thumb snaps to integer positions
3. Tick marks are rendered as SVG above the range track, one per hand
4. "Hand X / Y" label updates in real time on drag
5. `onChange(handIndex)` callback is wired so that advancing the scrubber updates the scene and stats sidebar

---

### T-011 — Implement stats sidebar with cumulative P/L

**Category:** feature
**Dependencies:** T-009, T-010
**Story Ref:** S-4.2

Build the stats sidebar that shows per-player cumulative P/L computed from `hand 1` through the current scrubber position. The sidebar reads from the already-fetched hand array.

**Acceptance Criteria:**
1. Sidebar lists all session players with formatted P/L (e.g. `+$45.00`, `-$12.50`)
2. Players are sorted by P/L descending
3. A summary row shows total hands completed and cumulative pot
4. Sidebar re-renders whenever the session scrubber position changes (no additional API call)
5. `null` P/L values display as `—` and are sorted last

---

### T-012 — Wire chip stack animations to session scrubber

**Category:** feature
**Dependencies:** T-008, T-010
**Story Ref:** S-4.2

Connect the session scrubber's `handChange` event to `updateChipStacks()` so chip stack heights reflect the cumulative P/L up to the current hand.

**Acceptance Criteria:**
1. When the session scrubber moves to hand N, P/L is summed from hand 1..N for each player
2. `table.updateChipStacks(cumulativePLMap)` is called with the computed map
3. Chip stacks animate smoothly (lerp, 400ms) to the new heights
4. Scrubbing quickly (dragging fast) does not cause visual stutter — animations are cancelled and restarted correctly

---

### T-013 — Implement hand-level street scrubber component

**Category:** feature
**Dependencies:** T-010
**Story Ref:** S-5.1

Build the hand street scrubber below the session scrubber. It has 5 labeled segments (Pre-Flop, Flop, Turn, River, Showdown) that act as clickable buttons.

**Acceptance Criteria:**
1. A `<div class="hand-scrubber">` renders below the session scrubber with 5 segment buttons
2. Clicking a segment sets the active street and calls `table.goToStreet(handData, street)`
3. Prev / Next buttons cycle through streets in order
4. The active segment is highlighted
5. If Turn or River data is null for the current hand, those segments are disabled/greyed out

---

### T-014 — Implement community card deal animations

**Category:** feature
**Dependencies:** T-007, T-013
**Story Ref:** S-5.2

When the street scrubber advances to Flop, Turn, or River, animate the appropriate community cards sliding from an "off-table" position to their center positions.

**Acceptance Criteria:**
1. At Flop: three cards animate from below the table edge to three evenly-spaced center positions over 0.5s
2. At Turn: one card slides in to the right of the flop cards
3. At River: one card slides in to the right of the turn card
4. Going backwards on the scrubber removes the appropriate cards (they reverse-animate off the table)
5. Cards are face-up immediately on arrival (no separate flip needed for community cards)

---

### T-015 — Implement hole card display and showdown reveal

**Category:** feature
**Dependencies:** T-007, T-013
**Story Ref:** S-5.3

Place face-down hole card placeholders at each player seat on Pre-Flop, and flip them face-up at Showdown with the correct rank/suit.

**Acceptance Criteria:**
1. On Pre-Flop, two face-down card meshes appear at each active player's seat
2. At Showdown, all cards flip face-up; `card.flip()` is called for each
3. Players with `result == 'fold'` have their cards dimmed (50% opacity) and a "FOLD" text sprite appears above them
4. The winner's cards have a golden emissive glow applied to their material
5. If hole card data is `null` for a player, their placeholder cards remain face-down at Showdown

---

### T-016 — Build hand result overlay panel

**Category:** feature
**Dependencies:** T-013, T-015
**Story Ref:** S-5.4

On reaching Showdown, display an overlay panel summarizing hand results: winner, each player's P/L, and hole cards.

**Acceptance Criteria:**
1. An overlay `<div class="result-overlay">` appears centered on the canvas at Showdown
2. The overlay lists each active player: name, hole cards (or "—"), result (win/loss/fold), P/L
3. Winner row is visually highlighted (bold, gold background)
4. A dismiss button closes the overlay without changing the street state
5. Overlay does not appear automatically when navigating backwards through streets

---

### T-017 — Build data interface: session list table

**Category:** feature
**Dependencies:** T-003, T-004
**Story Ref:** S-6.1

Build the main page of the Data interface: a sortable HTML table of all sessions. Clicking a row expands it to show a hand list with community cards and player results.

**Acceptance Criteria:**
1. Clicking "Data" in the nav renders a table with columns: Date, Status, Hands, Players
2. Column headers are clickable to sort ascending/descending
3. Clicking a row expands it to show a nested table of hands for that session
4. Each hand row shows: hand number, flop (3 cards), turn, river, and a per-player result summary
5. Loading state and error state are handled with appropriate UI feedback

---

### T-018 — Build data interface: player management UI

**Category:** feature
**Dependencies:** T-003, T-004
**Story Ref:** S-6.2

Add a "Players" section in the Data interface showing a list of all players and a form to create a new one.

**Acceptance Criteria:**
1. A player list renders all players with name and a "total hands" count (fetched from the stats endpoint)
2. A "New Player" form has a single name input and a Submit button
3. Submitting calls `POST /players` and adds the new player to the list without a full page reload
4. Duplicate name errors from the API are shown inline below the input field
5. Empty name submission is prevented client-side with a validation message

---

### T-019 — Build data interface: session creation form

**Category:** feature
**Dependencies:** T-003, T-004
**Story Ref:** S-6.3

Add a "New Session" form in the Data interface.

**Acceptance Criteria:**
1. A date picker input defaults to today's date in the correct backend format (`MM-DD-YYYY`)
2. A multi-select of registered players lets the user add players to the session
3. Submitting calls `POST /games` and redirects to the new session's expanded row in the session list
4. Duplicate session date errors from the API are displayed inline
5. The form resets after successful submission

---

### T-020 — Build data interface: hand recording form

**Category:** feature
**Dependencies:** T-003, T-004, T-017
**Story Ref:** S-6.4

Add a "Record Hand" form accessible from the expanded session row that allows recording community cards and per-player hole cards + results.

**Acceptance Criteria:**
1. The form shows fields for flop 1/2/3, turn (optional), river (optional), and one row per player with: card_1, card_2, result (win/loss/fold), profit_loss
2. Card fields validate format on blur: `[rank][suit]` — e.g. `AS`, `10H`, `KD`
3. Duplicate card detection runs client-side: if the same card appears twice across any field, an inline error highlights the duplicate fields
4. Successful submission calls `POST /games/{id}/hands` then per-player `POST /games/{id}/hands/{hand_id}/players`, then refreshes the hand list
5. API errors are shown inline next to the relevant fields

---

### T-021 — Build data interface: hand edit/correction form

**Category:** feature
**Dependencies:** T-003, T-017
**Story Ref:** S-6.5

Add an Edit button on each hand row in the expanded session view that opens an inline pre-populated form for correcting hand data.

**Acceptance Criteria:**
1. Each hand row has an "Edit" button that renders an inline edit form populated with current community card and player hole card values
2. Card and result fields are editable; validation rules match T-020
3. Saving calls `PATCH /games/{id}/hands/{hand_id}/community` and `PATCH /games/{id}/hands/{hand_id}/players/{ph_id}/holecards` as needed
4. A "Cancel" button exits the edit form without any API call
5. Successful save refreshes only that hand row, not the whole session list

---

### T-022 — Write frontend README with dev setup and deployment guide

**Category:** docs
**Dependencies:** T-001, T-002
**Story Ref:** —

Write `frontend/README.md` documenting how to install dependencies, run the dev server, configure environment variables, and build for deployment. Include a note on deploying the frontend as static files served by FastAPI.

**Acceptance Criteria:**
1. `frontend/README.md` covers: prerequisites (Node.js version), `npm install`, `npm run dev`, `npm run build`
2. Documents `VITE_API_BASE_URL` and the backend's `ALLOWED_ORIGINS` variable
3. Includes a deployment section showing how to mount `frontend/dist/` as `StaticFiles` in FastAPI
4. Includes a "how the 3D scene works" section written for a non-frontend developer (analogies to ROS nodes / coordinate frames are welcome)

---

## Bugs / Findings

### Cycle 1 — aia-core-3zn (Scaffold Vite + Three.js frontend project)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | main.js missing Three.js import and revision log | `frontend/src/main.js` is the unmodified Vite vanilla boilerplate. It never imports `three` and never calls `console.log(THREE.REVISION)`. AC#5 is directly unmet — `three` is installed as a dependency but is completely unused by the entry point. | Yes — priority 1 |
| LOW | Unquoted asset references in template literal HTML | Two `src=${viteLogo}` expressions in the `main.js` template literal are missing quotes around the interpolation. Unlikely to cause a runtime failure but is an HTML correctness inconsistency. | No |

### Cycle 2 — aia-core-cjn (Fix: main.js missing Three.js import and revision log)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | counter.js is an unreferenced scaffold artifact | `frontend/src/counter.js` is the default Vite boilerplate helper. main.js no longer imports it — dead code that will confuse future contributors. | No |
| LOW | Renderer and scene constructed but never rendered | main.js creates WebGLRenderer, Scene, and PerspectiveCamera but never calls renderer.render(). Canvas stays blank at runtime. Not an AC failure but inert placeholder code. | No |

### Cycle 3 — aia-core-4eo (Add CORS middleware to FastAPI backend)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | No guard against `ALLOWED_ORIGINS=*` with `allow_credentials=True` | If `ALLOWED_ORIGINS=*` is set, `allow_credentials=True` + wildcard origin reflects every Origin header verbatim, exposing credentials to the entire internet. OWASP A05:2021. Fix: raise `ValueError` at startup if `'*' in _allowed_origins`. | Yes — priority 1 |
| MEDIUM | Multi-origin env var path is untested | `ALLOWED_ORIGINS` comma-separated parsing exists but no test exercises multiple origins. AC#2 is partial. | No |
| MEDIUM | `allow_credentials` response header not asserted | No test asserts `Access-Control-Allow-Credentials: true` in preflight response. A regression dropping it would be invisible. | No |
| LOW | Imprecise assertion in disallowed origin test | Asserts `!= 'http://evil.example.com'` rather than `is None`. Should be `assert response.headers.get('access-control-allow-origin') is None`. | No |
| LOW | Module-level env var evaluation limits test isolation | `os.getenv('ALLOWED_ORIGINS')` evaluated at import time makes it impossible to safely override the env var in tests after first import. | No |

### Cycle 4 — aia-core-g5t (Fix: CORS wildcard origin guard)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | All implementation changes uncommitted to git | src/app/main.py, test/test_cors_middleware.py, frontend/, and specs/aia-frontend-002/ are all untracked/modified — never committed. Work is at risk of being lost. Must git add+commit all outstanding changes. | Yes — priority 1 |
| MEDIUM | test_cors_multi_origin_parsing validates parsing only | The reload test asserts `_allowed_origins` list but never makes a preflight HTTP request against the reloaded app. Regression to broken middleware initialization would go undetected. | No |
| LOW | Two pre-existing B905 ruff errors in unrelated files | `src/app/services/card_detector.py:48` and `src/pydantic_models/csv_schema.py:175` have `zip()` without `strict=`. Pre-existing but violate ruff baseline. | No |
| LOW | No test for mixed wildcard `ALLOWED_ORIGINS=http://foo.com,*` | Only bare `ALLOWED_ORIGINS=*` tested. Mixed wildcard regression would go undetected. | No |
