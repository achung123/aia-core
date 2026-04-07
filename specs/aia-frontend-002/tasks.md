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

### Cycle 5 — aia-core-pf3 (Commit all outstanding implementation changes to git)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | Uncommitted agent and prompt files in working tree | 9 `.github/agents/` and `.github/prompts/` files remain uncommitted, including untracked `scott.loop-review.prompt.md` and `scott.agent.md` (+24 lines for loop-review command). Task AC partially unmet. | No |
| MEDIUM | `importlib.reload()` in CORS tests — fragile module state restoration | If an unexpected import error occurs during the first reload in test_cors_middleware.py, the finally block's second reload may also fail, leaving module state dirty. | No |
| LOW | Unused Vite boilerplate in frontend scaffold | `counter.js`, `hero.png`, `javascript.svg`, `vite.svg` are unreferenced template leftovers adding noise. | No |
| LOW | Generic `<title>frontend</title>` in index.html | Default Vite template title not updated to reflect product name. | No |

### Cycle 6 — aia-core-dbp (Implement API client module) — CRITICAL FAILURES

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| CRITICAL | `fetchPlayerStats` — wrong URL and parameter | Calls `GET /games/${sessionId}/stats/players`. Actual route: `GET /stats/players/{player_name}`. Wrong URL structure and wrong parameter type. Every call returns 404. | Yes — priority 0 |
| CRITICAL | `fetchGameStats` — reversed URL path segments | Calls `GET /games/${sessionId}/stats/game`. Actual route: `GET /stats/games/{game_id}`. Path segments in wrong order. Every call returns 404. | Yes — priority 0 |
| CRITICAL | `fetchLeaderboard` — missing `/stats` prefix | Calls `GET /leaderboard`. Actual route: `GET /stats/leaderboard`. Every call returns 404. | Yes — priority 0 |
| CRITICAL | `updateHolecards` — wrong method and URL | Calls `PUT /hands/${handId}/hole-cards`. Actual route: `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}`. Wrong HTTP method (405) and path. | Yes — priority 0 |
| CRITICAL | `updateCommunityCards` — wrong method and URL | Calls `PUT /hands/${handId}/community-cards`. Actual route: `PATCH /games/{game_id}/hands/{hand_number}`. Wrong HTTP method (405) and path. | Yes — priority 0 |
| MEDIUM | Raw server response body exposed in thrown errors | `throw new Error(\`HTTP ${response.status}: ${text}\`)` passes raw FastAPI response body into error message, visible in browser console. | No |
| LOW | Exported functions not `async` — implicit Promise return | All 10 exported functions omit `async`. Functionally correct but stylistically inconsistent. | No |

### Cycle 6b — aia-core-4av (Fix: API client wrong routes — re-review)

All 5 corrected routes verified. All mutating functions include Content-Type: application/json. All 10 exports present.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | Missing `encodeURIComponent` for playerName URL parameter | `fetchPlayerStats` and `updateHolecards` interpolate `playerName` directly. Names with spaces produce invalid URLs; names with `/` split path segments. Fix: `encodeURIComponent(playerName)`. | No |
| LOW | BASE_URL not normalized — trailing slash causes double-slash paths | If `VITE_API_BASE_URL` is set with trailing slash, all requests get double slashes (`//games`). Fix: `.replace(/\/$/, '')`. | No |
| LOW | `response.json()` called unconditionally on success path | If any 2xx returns no body or non-JSON, a SyntaxError surfaces with no meaningful message. | No |

### Cycle 7 — aia-core-puw (Build base Three.js scene)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | RAF loop not cancellable — double-loop on re-initialisation | `requestAnimationFrame` handle discarded; every `initScene` call starts a permanent additional loop. Fix: store `rafId` and return `dispose()` with `cancelAnimationFrame`. | Yes — priority 1 |
| HIGH | Resize event listener leaks on re-initialisation | `window.addEventListener('resize', onResize)` never removable by caller. Every `initScene` call adds a stale listener. Fix: include `window.removeEventListener` in `dispose()`. | Yes — priority 1 (combined with above) |
| MEDIUM | No cleanup/dispose mechanism returned from `initScene` | `initScene` returns `{renderer, scene, camera}` but no `dispose()`. Root cause of both HIGH findings. | No |

### Cycle 7b — aia-core-7sv (Fix: Table scene lifecycle — re-review)

All 5 ACs satisfied. RAF cancellable, resize listener removable.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | `renderer.dispose()` not called in `dispose()` | `dispose()` cancels RAF and removes resize listener but never calls `renderer.dispose()`. WebGLRenderer holds GPU resources that will leak on re-mount. Fix: add `renderer.dispose()` call. | No |
| LOW | Initial size computed before layout may be stable | `clientWidth/clientHeight` read at call time; if called before canvas is painted, size is 0. Fix: call `onResize()` once at end of `initScene`. | No |

### Cycle 8 — aia-core-cpw (Implement hash-based SPA router and nav bar)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | `style.css` not imported — page completely unstyled | `import './style.css'` dropped when main.js was rewritten. Vite never bundles the stylesheet. AC4 unmet. Fix: add import to main.js. | Yes — priority 1 |
| HIGH | No `nav a.active` CSS rule — active highlighting absent | router.js correctly toggles `.active` class but no CSS rule targets `nav a.active`. AC4 doubly unmet. Fix: add rule to style.css. | Yes — priority 1 (combined) |
| MEDIUM | `dispose()` return value discarded — Vite HMR double-render risk | `initRouter(...)` return value ignored. On HMR, old hashchange listener persists causing double-render. | No |
| LOW | `renderData` uses innerHTML string vs DOM API in renderPlayback | Inconsistent approach, no XSS risk. | No |

### Cycle 8b — aia-core-em7 (Fix: SPA router stylesheet and active state — re-review)

All 5 ACs satisfied. Active link styling confirmed.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| LOW | `opacity: 1` in `nav a.active` is a no-op | No base `nav a { opacity: ... }` rule to dim inactive links, so `opacity: 1` has zero visual effect. | No |

### Cycle 9 — aia-core-4nn (Build oval poker table geometry and seat positions)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Missing `projected.z` guard in seat label projection | When a seat is behind the camera (`projected.z > 1`), NDC values are garbage and the label renders at a mirrored position. Fix: `if (projected.z > 1) { label.style.display = 'none'; return; }` | Yes — priority 1 |
| MEDIUM | No DOM cleanup in `createSeatLabels` | Every call appends 10 new div.seat-label nodes with no teardown. Re-initialization accumulates stale labels. | No |
| LOW | `style.transform` set every frame | `translate(-50%, -50%)` never changes but is set in the per-frame forEach loop. Move to initial cssText in createSeatLabels. | No |
| LOW | `BufferGeometry.scale()` behavior clarified | `.scale()` calls `applyMatrix4()` internally, transforming vertex data in-place — no side effects. | No |

### Cycle 10 — aia-core-bpn (Build session list panel and session loading flow)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| CRITICAL | AC5 not implemented — `table.loadSession` never called | `table.loadSession(playerNames)` and scrubber initialization deferred to stub. AC5 unmet. | Yes — priority 0 |
| HIGH | AC2 broken: player count always 0 | Session rows use `(s.players || []).length` but API returns `player_count: int`. Every row shows "0 players". | Yes — priority 1 (combined) |
| HIGH | XSS: `err.message` injected via `innerHTML` in session list catch | `list.innerHTML = \`Error: ${err.message}\`` where err.message is from raw server response body. Arbitrary HTML/script injection possible. | Yes — priority 0 (combined) |
| HIGH | XSS: API string fields interpolated via `innerHTML` in session rows | `row.innerHTML` interpolates `s.game_date` without escaping. | Yes — priority 0 (combined) |
| MEDIUM | Race condition on rapid session clicks | No AbortController or monotonic fetch ID. Two in-flight fetchHands can resolve out of order. | No |
| LOW | Four unused imports from tableGeometry.js | loadSession, createSeatLabels, computeSeatPositions, updateSeatLabelPositions imported but never used. | No |
| LOW | fetchSessions error bypasses #error-banner | Error renders inline in panel instead of using shared error-banner overlay. | No |

### Cycle 10b — aia-core-gwl (Session panel fixes — re-review)

All 5 ACs verified. XSS fixes confirmed. No innerHTML with user-controlled content.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Canvas is 0×0 when `initScene` is called | `initScene(canvas)` called synchronously after `container.innerHTML=...`. Browser layout hasn't run — canvas.clientWidth/Height are 0. Renderer 0×0, camera aspect NaN. Fix: defer initScene by one RAF tick. | Yes — priority 1 |
| MEDIUM | `dispose` from `initScene` discarded | Only renderer/scene/camera destructured. Each renderPlaybackView call leaks RAF loop and resize listener. | No |
| MEDIUM | `window.__onSessionLoaded` is a mutable global | Any script can overwrite it. Stale closures on double-call. | No |
| MEDIUM | Seat labels not repositioned on window resize | table.js onResize updates renderer/camera but never calls updateSeatLabelPositions. Labels drift after resize. | No |
| LOW | `loadSession_` underscore suffix is non-idiomatic | Rename to loadHandsForSession. | No |
| LOW | `loadSessionList` uses global document.getElementById | Should use scoped container reference to prevent stale writes on unmount. | No |

### Cycle 11 — aia-core-30y (Create card mesh factory with canvas-rendered faces)

All 5 ACs satisfied. isFlipping guard correct. Face index +z correct.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | No `dispose()` — GPU memory leak | `renderCardFace` allocates CanvasTexture, `createCard` allocates BoxGeometry. Neither freed on scene removal. Expose `mesh.dispose()` calling dispose on geom/faceTex/faceMat/backMat. | No |
| LOW | `rotation.y` snaps from π→0 on final flip frame | At t=1, rotation.y=π then immediately set to 0. One-frame mirrored face visible. | No |
| LOW | `ctx.roundRect()` no fallback | Not available in Chromium < 99. Feature-detect and fall back to `ctx.fillRect`. | No |

### Cycle 12 — aia-core-3gu (Implement session-level scrubber component)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | `onChange` not fired on construction | `updateLabel()` not called during init. Scenes driven by onChange callback display nothing on load. Fix: call updateLabel() after container.appendChild(wrapper). | Yes — priority 1 |
| MEDIUM | Tick marks misalign with slider thumb at min/max | Browser range inputs have native thumb inset. Ticks at 0%/100% float outside thumb travel zone. | No |
| MEDIUM | No guard against `handCount=0` | range.min=1 > range.max=0 — invalid HTML. Browser behavior undefined. Fix: throw RangeError for handCount < 1. | No |
| LOW | Last tick at x1="100%" clips on right edge | 0.5px outside SVG viewport — half-width rightmost tick. | No |
| LOW | `dispose()` does not remove event listeners | wrapper.remove() called but removeEventListener not invoked. GC of detached nodes delayed. | No |
| LOW | `setIndex` fires onChange unconditionally | Triggers redundant downstream renders when value unchanged. | No |

### Cycle 13 — aia-core-3ra (Implement hand-level street scrubber component)

All 5 ACs satisfied. Edge case (both Turn+River null → Showdown reachable) confirmed correct.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | `updateHandData` — active+disabled contradiction, parent out of sync | When user is on Turn and updateHandData({turn:null}) is called, button is simultaneously disabled and highlighted. onStreetChange not fired. User stuck on invalid street. Fix: walk back to nearest enabled street and fire onStreetChange. | Yes — priority 1 |
| MEDIUM | `Object.assign(handData, newHandData)` mutates caller's object | Silently modifies the caller's reference. Use `handData = { ...handData, ...newHandData }` with let-scoped local. | No |
| LOW | `onStreetChange` fires before `updateUI` on initial mount | Constructor: fires callback then updates UI. Inconsistent with goToStreet order. | No |

### Cycle 14 — aia-core-ahl (Build chip stack visualization at each seat)

All 5 ACs verified at the module level. Module is not yet wired into playbackView.js.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | chipStacks module not wired into scene | createChipStacks never imported or called from playbackView.js or table.js. Chip stacks are not rendered. downstream b62 has nothing to connect to. | Yes — priority 1 |
| HIGH | No frontend unit test infrastructure | Zero frontend tests exist. lerp timing, P/L scaling, null-neutral, and negative-branch verified by inspection only. Systemic gap across all frontend modules — single chore task filed. | Yes (chore) |
| MEDIUM | Color change is instant, not lerped | setHeight calls m.color.set() synchronously before the height animation starts. Players crossing 0 P/L flash on scrubber drag. | No |
| MEDIUM | Post-dispose updateChipStacks leaks RAF callbacks | No disposed flag guard. After dispose(), updateChipStacks still schedules RAF loops. | No |
| MEDIUM | DISC_COUNT hardcoded to 5 | AC 1 says 3–8 discs implying configurable range. | No |
| LOW | Dispose order: dispose before scene.remove | Should be remove-then-dispose per idiomatic THREE.js. | No |
| LOW | dispose() not idempotent | No guard against double-dispose. | No |

### Cycle 15 — aia-core-5b9 (Implement community card deal animations)

All 5 ACs satisfied at module level.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Orphaned scene meshes after dispose() mid-animation | removeCard nulls cards[slot] immediately for state consistency, but dispose() iterates cards[] and skips nulls — in-flight removal meshes stay in the scene graph permanently. Fix: maintain inflightRemovals Set. | Yes — priority 1 |
| HIGH | Concurrent RAF loops on same mesh during rapid goToStreet | animateCard returns no cancel handle. Rapid street changes create competing RAF loops on the same mesh, producing jitter. Fix: return cancel closure, store per-slot, cancel before new animation. | Yes — priority 1 |
| MEDIUM | addCard RAF loop retains disposed mesh ~500ms post-dispose | Side-effect of HIGH-2 fix. | No |
| LOW | Shared backMat disposed multiple times per mesh | disposeMesh iterates all 6 slots; same backMat disposed 5×. Deduplicate with Set. | No |
| LOW | Linear interpolation — abrupt animation feel | No ease-in/out applied. ACs don't mandate easing. | No |

### Cycle 16 — aia-core-2pg (Implement hole card display and showdown reveal)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| CRITICAL | MeshBasicMaterial has no emissive — winner glow invisible | glowWinnerCards sets .emissive on MeshBasicMaterial which silently ignores it. Fix: switch faceMat to MeshStandardMaterial or MeshLambertMaterial. | Yes — priority 0 |
| HIGH | Stale setTimeout not cancellable — glow fires on wrong hand | 350ms timeout for glowWinnerCards has no handle. Rapid hand advance causes glow to apply to new hand's cards. Fix: store timer ID, clearTimeout on initHand/dispose. | Yes — priority 1 |
| HIGH | RAF flip animation untracked — runs on disposed materials | card.flip() starts RAF with no cancel mechanism. dispose() can free GPU resources while flip RAF continues writing to them. Fix: expose cancelFlip() method. | Yes — priority 1 |
| MEDIUM | Texture leak in disposeCards — CanvasTexture not disposed | m.dispose() doesn't auto-dispose m.map. 2 GPU textures leaked per seat per hand transition. Fix: dispose m.map before m. | No |
| MEDIUM | Texture leak in removeSprite — canvas texture not disposed | sprite.material.dispose() misses material.map. Fix: dispose map before material. | No |
| MEDIUM | Dim-then-flip race — folded players face renders at full opacity | dimCards runs before flip completes; faceMat never gets opacity:0.5. Delay dim by 350ms. | No |
| MEDIUM | No null guard on handData.player_hands | .find() crashes on null/malformed API data. Fix: player_hands ?? []. | No |
| LOW | seatPos.y undefined in addFoldSprite | y ?? 0 guard. | No |
| LOW | backMat disposed 5× per card | Deduplicate with Set. | No |

### Cycle 17 — aia-core-829 (Build hand result overlay panel)

All 5 ACs satisfied. No CRITICAL or HIGH findings.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | dispose() does not remove dismiss button event listener | overlay.remove() without explicit removeEventListener. No real leak in modern GC but violates release contract. | No |
| LOW | Winner result string 'win' is undocumented API contract | Silent breakage if backend changes vocabulary. | No |
| LOW | Winner gold background #b8860b is dark amber, not gold | May not match product intent. | No |
| LOW | All styles inlined | No CSS classes — makes theming harder. | No |

### Cycle 18 — aia-core-1w8 (Implement stats sidebar with cumulative P/L)

All 5 ACs satisfied. No CRITICAL or HIGH findings.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | dispose() throws NotFoundError on double-call | container.removeChild(sidebar) without checking parentNode. | No |
| LOW | Dead null guard in formatPL | Unreachable branch. | No |
| LOW | Misleading comment: "inclusive slice" with exclusive-end loop | Off-by-one comment, math is correct. | No |
| LOW | formatPL(0) returns +$0.00 | Should display $0.00 for breakeven. | No |

### Cycle 19 — aia-core-3fo (Build data interface: session list table)

All 5 ACs satisfied.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Race condition in handleRowClick — ghost-insert on fast click | After await fetchHands() resolves, no check that expandedSessionId still matches. Double-click or rapid row change inserts ghost detail rows. Fix: guard after await. | Yes — priority 1 |
| MEDIUM | Date sort is lexicographic not date-aware | Uses string comparison on date strings. Safe only for ISO 8601. Harden with new Date().getTime(). | No |
| LOW | tbody.id set but never queried | Dead code. | No |
| LOW | No CSS class on expanded row | Missing UX affordance. | No |
| LOW | #/data route uses redundant arrow wrapper | Minor style inconsistency. | No |

### Cycle 20 — aia-core-pys (Build data interface: player management UI)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| CRITICAL | AC1 not satisfied — wrong data source | fetchLeaderboard() inner-joins Player→PlayerHand, filtering players with zero hands. Must use GET /players instead. Need to add fetchPlayers() to client.js. | Yes — priority 0 |
| MEDIUM | Inline error below Submit button, not below input | AC4 requires duplicate-name error below input field. | No |
| MEDIUM | Fragile 409 detection via string prefix | err.message.startsWith('HTTP 409') couples to client.js string format. | No |
| LOW | Raw server error body rendered in UI | err.message includes HTTP status and raw response body. | No |

### Cycle 21 — aia-core-0v4 (Build data interface: session creation form)

All 5 ACs satisfied. No CRITICAL or HIGH findings.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| MEDIUM | Stale date on post-midnight reset | yyyy/mm/dd captured at construction, not reset time. Fix: compute YYYY-MM-DD at reset with new Date(). | No |
| LOW | 409 detection string-coupled to client.js error format | err.message.startsWith('HTTP 409'). | No |
| LOW | Submit not disabled during fetchPlayers() in-flight | User can submit empty player list while player select is loading. | No |

### Cycle 22 — aia-core-b62 (Wire chip stack animations to session scrubber)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Scrubber DOM nodes accumulate on repeated session loads | createSessionScrubber appended without clearing; dispose() discarded. Multiple scrubbers fire simultaneously causing visual corruption. Fix: let activeScrubber track and dispose before re-create. | Yes — priority 1 |
| MEDIUM | Zero-hand session throws TypeError in computeCumulativePL | hands[0].player_hands on empty array. Guard with if (!hands.length) return. | No |
| LOW | Double updateChipStacks call on load | neutral + scrubber onChange(1) queued in same frame. Minor waste. | No |
| LOW | null player_name creates plMap["undefined"] key | Guard with if (!ph.player_name) return. | No |

### Cycle 23 — aia-core-b0k (Build data interface: hand recording form)

All 5 ACs partial on PATCH path.

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | POST success + PATCH fail blocks onSuccess, re-submit makes duplicate hand | createHand already saves hand+players via player_entries. PATCH failures block onSuccess(). User re-submits → duplicate hands created. Fix: make PATCH non-fatal; call onSuccess() after POST. | Yes — priority 1 |
| MEDIUM | No min/max on profit_loss input | Extreme values reach API silently; 422 errors surface as opaque form errors. | No |
| MEDIUM | toFieldId slug collision for similar player names | Alice-Bob and Alice Bob both slug to Alice_Bob → duplicate element IDs. | No |
| LOW | Player name not URL-encoded in PATCH URL | Missing encodeURIComponent. | No |
| LOW | onSuccess() called inside try block — callback errors show as API errors | Move onSuccess after try/catch. | No |

### Cycle 24 — aia-core-vj6 (Build data interface: hand edit/correction form)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | Silent data loss — `result`/`profit_loss` edits not persisted | Form renders both fields as editable inputs and populates `updatedHandData`, but neither value is sent to any PATCH endpoint. Changes appear to save, then revert on the next backend fetch. Fix: add a backend PATCH for `result`/`profit_loss` and call it on change, or make the fields readonly. | Yes — priority 1 |
| HIGH | `playerName` not URL-encoded in `/players/${playerName}` path | `client.js` interpolates `playerName` raw in `/games/${gameId}/hands/${handNumber}/players/${playerName}`. Names containing spaces, `/`, `?`, or `#` produce malformed or mis-routed requests. Fix: `encodeURIComponent(playerName)`. | Yes — priority 1 |
| MEDIUM | Buttons permanently disabled if `onSave` throws | On an `onSave` exception the submit and cancel buttons remain disabled with no recovery path — the user cannot retry or cancel. Fix: re-enable buttons in a `finally` block. | No |
| MEDIUM | `dispose()` not called on successful save | The form's `dispose()` is never invoked after `onSave` resolves, leaving a DOM orphan if the caller does not clean up. Fix: call `dispose()` inside the success branch, or document that the caller is responsible. | No |
| LOW | `.card-field-error` spans lack `aria-live="polite"` | Validation error messages injected into `.card-field-error` spans are invisible to screen readers because no live-region attribute is present. Fix: add `aria-live="polite"` to each error span. | No |
| LOW | Slug collisions for names with special characters produce duplicate HTML IDs | The `toFieldId` helper strips non-alphanumeric characters; names that differ only in punctuation (e.g. `O'Brien` and `OBrien`) map to the same ID, violating HTML uniqueness. Fix: append a disambiguation suffix or use a counter. | No |
| LOW | `step="0.01"` on profit input does not prevent overly-precise floats | HTML `step` constrains the stepper UI only; user can type arbitrary precision. Fix: validate or round the value before submission. | No |

### Cycle 25 — aia-core-c6a (Frontend README)

| Severity | Title | Description | Filed to beads |
|---|---|---|---|
| HIGH | H-1: Deployment guide omits `@app.get('/')` conflict | `main.py` registers `@app.get('/')` which FastAPI resolves before `StaticFiles`. Since the app uses hash-based routing (browser always sends `GET /`), the welcome JSON is returned instead of `index.html`. README must note that `@app.get('/')` must be removed or moved to `/api/` before mounting `StaticFiles` at `"/"`. | Yes |
| MEDIUM | M-1: "Brief glow animation" description is inaccurate | `glowWinnerCards()` sets a static `emissiveIntensity = 0.4` after `setTimeout` — no time-based fade or pulse exists. The README description should reflect reality. | No |
| MEDIUM | M-2: Node.js prerequisites unanchored | `package.json` has no `engines` field, so the prerequisite version range `^20.19.0 \|\| >=22.12.0` stated in the README cannot be validated from the project. Fix: add an `engines` field to `package.json` or remove the version constraint from the README. | No |
| LOW | L-1: "npm 10 (bundled with Node.js 22)" is imprecise | npm 10 ships with Node.js 20+, not exclusively Node.js 22. Reword to "npm 10 (bundled with Node.js 20 and later)". | No |
