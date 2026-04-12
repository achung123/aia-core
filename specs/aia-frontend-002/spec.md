# Spec — All In Analytics Interactive Frontend

**Project ID:** aia-frontend-002
**Date:** 2026-04-06
**Status:** Draft
**Scope:** Two-interface frontend — 3D Session Playback Visualizer + Text-Based Data Management Dashboard

---

## Table of Contents

1. [Epic 1: Project Foundation](#epic-1-project-foundation)
2. [Epic 2: 3D Poker Table Scene](#epic-2-3d-poker-table-scene)
3. [Epic 3: Session Browser & Navigation](#epic-3-session-browser--navigation)
4. [Epic 4: Session-Level Timeline Scrubbing](#epic-4-session-level-timeline-scrubbing)
5. [Epic 5: Hand-Level Timeline Scrubbing](#epic-5-hand-level-timeline-scrubbing)
6. [Epic 6: Data Management Interface](#epic-6-data-management-interface)

---

## Epic 1: Project Foundation

Establish the frontend project structure, build tooling, API client layer, and page routing so that all other epics have a working environment to build on. Also configure the FastAPI backend with CORS so the frontend can communicate with it.

### S-1.1 — Vite + Three.js Project Scaffold

**As a** developer, **I want** a working Vite project with Three.js installed inside `frontend/`, **so that** I can run `npm run dev` and see a live-reloading browser tab connected to the backend.

**Acceptance Criteria:**
1. A `frontend/` directory exists in the repo root containing `package.json`, `vite.config.js`, and `index.html`
2. `npm run dev` starts a dev server at `localhost:5173` without errors
3. `npm run build` produces a `frontend/dist/` output suitable for static hosting
4. Three.js is installed as a dependency and importable in source files

---

### S-1.2 — FastAPI CORS Configuration

**As a** frontend developer, **I want** the FastAPI backend to accept requests from the frontend dev server origin, **so that** API calls from `localhost:5173` are not blocked by the browser.

**Acceptance Criteria:**
1. `CORSMiddleware` is added to the FastAPI app in `src/app/main.py`
2. `localhost:5173` is listed as an allowed origin
3. All existing API tests continue to pass after the middleware addition
4. CORS origins are configurable via an environment variable for deployment flexibility

---

### S-1.3 — API Client Module

**As a** frontend component, **I want** a centralized API client module, **so that** all backend calls go through one place and the base URL can be changed in a single config.

**Acceptance Criteria:**
1. An `frontend/src/api/client.js` module exists with a configurable `BASE_URL`
2. The module exposes functions: `fetchSessions()`, `fetchHands(gameId)`, `fetchPlayerStats(playerName)`, `fetchLeaderboard(gameId)`, `fetchGameStats(gameId)`
3. All functions return parsed JSON or throw a descriptive error
4. The base URL defaults to `http://localhost:8000` and can be overridden via a `VITE_API_BASE_URL` environment variable

---

### S-1.4 — Two-Page App Routing

**As a** user, **I want** to navigate between a Playback view and a Data Management view, **so that** I can switch between watching replays and managing game records without a full page reload.

**Acceptance Criteria:**
1. A navigation bar is present on all pages with links to "Playback" and "Data" sections
2. The playback route renders a Three.js canvas
3. The data route renders the HTML-based data management dashboard
4. Direct URL navigation (e.g. `/#/playback`, `/#/data`) loads the correct view

---

## Epic 2: 3D Poker Table Scene

Build the Three.js scene that serves as the visual foundation for all hand playback. The scene includes an oval poker table with felt texture, 7–10 labeled seat positions, a camera rig, and reusable card mesh objects that can be placed and animated anywhere on the table.

### S-2.1 — Base Three.js Scene Setup

**As a** user, **I want** to see a 3D poker table when I open the playback view, **so that** I have the spatial context for card and player visualization.

**Acceptance Criteria:**
1. A Three.js `WebGLRenderer` renders a scene at full viewport size and resizes correctly on window resize
2. The scene contains a directional light, ambient light, and a perspective camera positioned above and slightly angled toward the table center
3. An orbital control (or locked top-angle camera) allows the user to understand the table layout
4. The table is modeled as an oval `CylinderGeometry` with a green felt `MeshLambertMaterial`

---

### S-2.2 — Seat Positions for 7–10 Players

**As a** user, **I want** player seats arranged around the table perimeter, **so that** I can see which cards and chip stacks belong to which player.

**Acceptance Criteria:**
1. Up to 10 seat positions are computed by evenly distributing angles around an ellipse matching the table geometry
2. Each seat position displays a player name label (rendered as a `Sprite` or HTML overlay)
3. Seats that have no player assigned for the current session are visually dimmed or hidden
4. Seat assignment is driven by the player list returned by the API for a given session

---

### S-2.3 — 3D Card Mesh with Rank/Suit Face

**As a** user, **I want** playing cards rendered as 3D objects showing the correct rank and suit, **so that** I can read the cards without needing external image assets.

**Acceptance Criteria:**
1. Each card is a `BoxGeometry` (thin rectangular prism — e.g. 0.7 × 1.0 × 0.02 units)
2. The front face uses a `CanvasTexture` that draws the rank (e.g. "A") and suit symbol (♠ ♥ ♦ ♣) in correct colors (red for hearts/diamonds, black for spades/clubs)
3. The back face is a solid card-back color/pattern
4. Cards not yet revealed render face-down (back only)
5. A `createCard(rank, suit)` factory function returns a positioned card mesh

---

### S-2.4 — Chip Stack Visualization

**As a** user, **I want** each player's chip stack to be visible at their seat, **so that** I can see visually who is winning and losing.

**Acceptance Criteria:**
1. Each player seat has a chip stack represented by a small stack of cylinders (`CylinderGeometry`)
2. Stack height is proportional to the player's cumulative `profit_loss` for the session up to the current hand
3. Players with negative P/L display a reduced or differently colored stack
4. Chip stacks animate smoothly when updated between hands (lerp transition ≥ 0.3s)

---

## Epic 3: Session Browser & Navigation

Allow the user to select a past poker session and load it into the playback view. This is the entry point for all playback features.

### S-3.1 — Session List Panel

**As a** user, **I want** to see a list of all recorded game sessions, **so that** I can choose which session to replay.

**Acceptance Criteria:**
1. A session list panel is rendered alongside (or overlaid on) the 3D scene
2. Each entry shows: session date, number of hands played, and player count
3. Sessions are sorted newest-first
4. Selecting a session triggers loading of that session's hand data and populating the 3D scene

---

### S-3.2 — Session Loading State

**As a** user, **I want** clear feedback while session data is loading, **so that** I don't see a blank or broken scene during the API fetch.

**Acceptance Criteria:**
1. While hands are fetching, a loading indicator is visible (spinner or text overlay on the scene)
2. Errors (e.g. network failure) display a human-readable error message
3. Once data is loaded, the scene resets to hand 1, pre-flop state

---

## Epic 4: Session-Level Timeline Scrubbing

Let the user scrub through an entire session hand-by-hand, watching chip stacks and the stats sidebar update in real time.

### S-4.1 — Session Timeline Scrubber Component

**As a** user, **I want** a scrubber bar that represents all hands in a session, **so that** I can drag to any hand or step forward/back one hand at a time.

**Acceptance Criteria:**
1. A horizontal scrubber bar is displayed below the 3D scene, with one tick mark per hand
2. Dragging the scrubber handle (or clicking a tick) jumps to that hand
3. Previous / Next arrow buttons advance or retreat by one hand
4. The current hand number and total hand count are displayed (e.g. "Hand 7 / 24")

---

### S-4.2 — Stats Sidebar — Player P/L Progression

**As a** user, **I want** a sidebar showing each player's cumulative P/L up to the current hand, **so that** I can see who was winning or losing at any point in the session.

**Acceptance Criteria:**
1. A sidebar lists all players in the session with their name and cumulative P/L from hand 1 to the current scrubber position
2. P/L values are formatted as dollar amounts (e.g. "+$45.00", "-$12.50")
3. Players are sorted by current P/L (highest first)
4. Sidebar updates immediately when the scrubber position changes
5. A summary row shows total pot circulated and number of hands completed

---

## Epic 5: Hand-Level Timeline Scrubbing

Within a selected hand, let the user scrub through each street (pre-flop → flop → turn → river → showdown), watching cards appear and animate onto the table.

### S-5.1 — Hand Timeline Scrubber Component

**As a** user, **I want** a second scrubber showing the streets of the current hand, **so that** I can step through what happened at each decision point.

**Acceptance Criteria:**
1. A hand-level scrubber bar with 4–5 labeled segments: Pre-Flop, Flop, Turn, River, Showdown
2. Clicking a segment jumps the scene to that street state
3. Previous / Next buttons advance or retreat by one street
4. The scrubber is only active when a hand is selected and loaded
5. "Showdown" state reveals all player hole cards simultaneously

---

### S-5.2 — Community Card Reveal Animations

**As a** user, **I want** to see community cards (flop, turn, river) slide onto the table as I advance the hand scrubber, **so that** the playback feels dynamic and spatial.

**Acceptance Criteria:**
1. At the Flop street, three face-up cards animate from a dealt position to their community card positions at the center of the table
2. At the Turn street, the fourth card animates in
3. At the River street, the fifth card animates in
4. Cards not yet revealed for the current street are absent (not face-down in center)
5. Navigating backward on the scrubber removes the appropriate cards

---

### S-5.3 — Player Hole Card Display

**As a** user, **I want** to see each player's hole cards displayed face-down at their seat throughout the hand, and revealed face-up at showdown, **so that** I can understand what everyone was holding.

**Acceptance Criteria:**
1. On Pre-Flop, two face-down card meshes appear at each active player's seat
2. At Showdown, all cards flip to face-up showing the correct rank and suit
3. Players who folded (`result == 'fold'`) display their cards slightly dimmed or with a "FOLD" indicator
4. The winner's hand is highlighted (e.g. golden glow or border effect on the winning cards)
5. Hole cards are only shown if the API returns them (they may be null for some historical records)

---

### S-5.4 — Hand Result Overlay

**As a** user, **I want** to see a brief result summary when a hand reaches Showdown, **so that** I know who won and what the profit/loss was.

**Acceptance Criteria:**
1. At Showdown, an overlay or panel displays: winner name, cards played, and P/L for each player in the hand
2. The overlay can be dismissed without changing the scrubber position
3. If multiple players have results recorded, all are listed
4. P/L values match the values returned by the API for that hand

---

## Epic 6: Data Management Interface

A separate text-based interface for browsing all recorded game data and entering new game records without using the 3D visualization.

### S-6.1 — Session List Table View

**As a** user, **I want** to see all sessions and their summary stats in a data table, **so that** I can quickly scan the full history.

**Acceptance Criteria:**
1. A sortable HTML table lists all sessions: date, status, player count, hand count
2. Clicking a row expands or navigates to a hands detail view for that session
3. Each hand's row shows: hand number, community cards (flop/turn/river), and a player result summary

---

### S-6.2 — Player Management

**As a** user, **I want** to create new players and see a list of all registered players, **so that** I can add participants before starting a session.

**Acceptance Criteria:**
1. A player list displays all players with name and total hands played
2. A form allows creating a new player by name
3. Name validation prevents duplicate entries (matches backend uniqueness constraint)
4. The list updates immediately after a successful player creation

---

### S-6.3 — Session Creation Form

**As a** user, **I want** to create a new game session from the data interface, **so that** I can start recording a new poker night.

**Acceptance Criteria:**
1. A form allows specifying a session date (defaults to today)
2. Submitting creates the session via `POST /games` and displays the new session ID
3. Validation prevents duplicate sessions on the same date

---

### S-6.4 — Hand Recording Form

**As a** user, **I want** to record a new hand into an active session from the data interface, **so that** I can log game data without needing to use the camera pipeline.

**Acceptance Criteria:**
1. A form lets the user select a session, enter community cards (flop 1/2/3, turn, river), and specify hole cards + results for each player in the session
2. Card entry fields validate against the standard rank/suit format (matches backend `card_validator`)
3. Submitting creates the hand via `POST /games/{game_id}/hands` followed by player-hand assignments
4. Errors from the API (e.g. duplicate cards) are displayed inline next to the relevant field

---

### S-6.5 — Data Edit & Correction

**As a** user, **I want** to edit community cards, hole cards, and results for an existing hand, **so that** I can fix mistakes in previously recorded data.

**Acceptance Criteria:**
1. Each hand row in the session detail view has an Edit button
2. Clicking Edit opens an inline form pre-populated with the current values
3. Saving calls the appropriate PATCH/PUT endpoint and refreshes the row
4. Cancel discards changes without touching the API
