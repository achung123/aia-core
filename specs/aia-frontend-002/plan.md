# Plan — All In Analytics Interactive Frontend

**Project ID:** aia-frontend-002
**Date:** 2026-04-06
**Status:** Draft

---

## Overview

This project adds an interactive browser-based frontend to the All In Analytics Core backend. It delivers two interfaces: a 3D poker table visualization (built with Three.js) that lets users scrub through recorded sessions and hands at two levels of granularity, and a plain-HTML data management dashboard for browsing history and entering new game records. The frontend lives in a `frontend/` subfolder of the existing `aia-core` monorepo and communicates with the FastAPI backend via REST.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| **Vite** | Build tool and dev server — fast hot-module reload in dev, produces optimized static bundle for deployment |
| **Vanilla JavaScript (ES modules)** | Application logic — no framework overhead; straightforward for an ML/robotics background; easy to read and debug |
| **Three.js** | 3D WebGL scene — renders the poker table, card meshes, chip stacks, and seat labels |
| **HTML5 Canvas (CanvasTexture)** | Card face rendering — draws rank and suit glyphs directly onto a canvas used as a Three.js texture; zero image assets needed |
| **CSS + CSS Custom Properties** | UI styling — scoped to the data management interface and overlay panels; no CSS framework required |
| **Fetch API (built-in)** | Backend communication — browser-native, no external HTTP library needed |
| **Vite environment variables** | Configuration — `VITE_API_BASE_URL` controls the backend URL without code changes between local dev and deployed environments |
| **FastAPI CORSMiddleware** | Backend CORS — allows the frontend origin to call the API; configured via an env var |

---

## Architecture Components

### `frontend/` — Vite Project Root

The project root contains `package.json`, `vite.config.js`, `index.html`, and a `src/` directory. Running `npm run dev` starts the frontend against the local FastAPI server. Running `npm run build` produces `frontend/dist/` — a folder of static files that can be served by any static host (Nginx, GitHub Pages, Netlify, etc.) or by FastAPI itself via `StaticFiles`.

### `frontend/src/api/client.js` — API Client Module

A single module that owns all communication with the FastAPI backend. All components import from here — nothing else makes `fetch` calls. The `BASE_URL` defaults to `http://localhost:8000` and is overridden by `VITE_API_BASE_URL` at build time.

Exposed functions mirror the backend route surface:
- `fetchSessions()` → `GET /games`
- `fetchHands(gameId)` → `GET /games/{gameId}/hands`
- `fetchPlayerStats(name)` → `GET /stats/players/{name}`
- `fetchGameStats(gameId)` → `GET /stats/game/{gameId}`
- `fetchLeaderboard(gameId)` → `GET /stats/leaderboard?game_id={gameId}`
- `createSession(date)`, `createHand(gameId, payload)`, `createPlayer(name)`, etc.

### `frontend/src/router.js` — Hash-Based SPA Router

A minimal client-side router using `window.location.hash`. Two routes: `#/playback` and `#/data`. Renders the appropriate view by swapping DOM content. No external routing library needed.

### `frontend/src/scenes/table.js` — Three.js Scene Manager

Owns the `WebGLRenderer`, `Scene`, `Camera`, and top-level `AnimationMixer`. Exposes imperative methods called by the playback controller:
- `initScene()` — sets up renderer, lighting, camera
- `loadSession(sessionData)` — positions seats for the player list
- `goToStreet(handData, street)` — places and animates cards onto the table
- `updateChipStacks(playerPL)` — lerp-animates chip stack heights

### `frontend/src/playback/` — Playback Controllers

Two controller modules coordinate state:
- `session-controller.js` — tracks which hand index is selected; drives the session-level scrubber UI and the stats sidebar; calls `table.loadHandAtIndex()`
- `hand-controller.js` — tracks which street is selected within the current hand; drives the hand-level scrubber; calls `table.goToStreet()`

### `frontend/src/data/` — Data Management Interface

A set of vanilla-JS modules that render HTML tables and forms into a `<div id="data-view">` container. No Three.js. Calls the API client for CRUD operations and re-renders the affected section on success.

### `src/app/main.py` — CORS Middleware Addition (backend change)

A one-line middleware addition to the existing FastAPI app using `fastapi.middleware.cors.CORSMiddleware`. Allowed origins are read from an `ALLOWED_ORIGINS` environment variable (defaults to `http://localhost:5173` for development).

---

## Project Phases

### Phase 1: Foundation

Scaffold the frontend project, configure CORS on the backend, wire up the API client, and implement the two-page router so every subsequent phase has a runnable environment.

**Deliverables:**
- `frontend/` directory with Vite + Three.js installed and `npm run dev` working
- CORS middleware on FastAPI backend, all existing tests still passing
- `api/client.js` with all read + write functions stubbed and tested against the live dev server
- Hash router with "Playback" and "Data" navigation links visible

---

### Phase 2: 3D Poker Table Scene

Build the visual foundation — the table geometry, seat layout, and card mesh factory — so that Phases 3–5 can place objects into a real scene.

**Deliverables:**
- Oval green felt table rendered in 3D with correct proportions
- 10 seat positions computed and labeled; unused seats dimmed for a given session's player list
- `createCard(rank, suit)` factory producing face-up and face-down card meshes with canvas-rendered faces
- Chip stack cylinders at each seat (static, no data yet)
- Camera positioned for a comfortable overhead-angled view

---

### Phase 3: Session Browser & Session-Level Scrubbing

Load real session data from the API, populate the scene with players and chip stacks, and let the user scrub through hands.

**Deliverables:**
- Session list panel (overlay on left of scene) populated from `GET /games`
- Selecting a session fetches all hands and populates seats with player names
- Session-level scrubber bar with step buttons below the canvas
- Stats sidebar showing cumulative P/L per player, sorted by P/L
- Chip stacks animate to reflect P/L at the current hand index

---

### Phase 4: Hand-Level Street Scrubbing

Add the inner scrubber for stepping through streets within the selected hand, with card dealing animations and the showdown reveal.

**Deliverables:**
- Hand-level scrubber (Pre-Flop / Flop / Turn / River / Showdown segments)
- Community cards animate onto center of table as streets are revealed
- Face-down hole card placeholders appear at each player seat on Pre-Flop
- Showdown flips all hole cards face-up; fold indicator dims folded players
- Winner highlight effect (golden glow on winning cards)
- Hand result overlay panel

---

### Phase 5: Data Management Interface

Build the text-based "Data" page for browsing game history and entering new records.

**Deliverables:**
- Session list table (date, status, hand count, player count)
- Session detail expand showing all hands and results
- Player list + create player form
- Session creation form
- Hand recording form with inline card validation
- Hand edit/correction inline form

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Three.js learning curve for a non-frontend developer | Code is structured as imperative modules (init, update, render) — familiar to robotics/ML engineers who write ROS node-style code; each module is narrowly scoped |
| 7–10 seats on one table feels crowded | Use an elongated oval (casino-style) rather than a round table; seat label size adapts to seat count |
| CORS misconfiguration causing silent API failures | Add integration test that verifies the CORS header is present on API responses; configure in Phase 1 before any other work |
| Card face legibility at small sizes | Canvas texture is rendered at 256×384px regardless of display size; suit symbols use Unicode (`♠ ♥ ♦ ♣`) which are always crisp |
| Profit/loss data missing for some historical hands | Sidebar and chip stacks gracefully handle `null` P/L by treating it as `0` and showing a "—" placeholder |
| Deployment: frontend and backend on different origins | `VITE_API_BASE_URL` + `ALLOWED_ORIGINS` env vars solve this without any code changes; documented in README |
| Data entry form complexity (many card fields per hand) | Hand recording form uses a repeating player-row pattern (one row per player) with tab-key navigation; card fields are small and compact |

---

## External Dependencies

| Dependency | Notes |
|---|---|
| Existing `GET /games`, `GET /games/{id}/hands`, `GET /stats/*` endpoints | Already implemented and tested; frontend consumes as-is |
| Existing player management and hand CRUD endpoints | Already implemented; frontend's data interface is a thin UI on top |
| `fastapi.middleware.cors` | Ships with FastAPI; no new package needed |
| Three.js (`three` npm package) | Installed via npm; no CDN complexity |
| Browser WebGL support | Required for Three.js; any modern desktop browser (Chrome, Firefox, Safari, Edge) supports it |
