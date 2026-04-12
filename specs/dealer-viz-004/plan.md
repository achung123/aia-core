# Plan — Dealer & Visualization Evolution

**Project ID:** dealer-viz-004
**Date:** 2026-04-09
**Status:** Draft

---

## Overview

Evolve the dealer interface from a single-pass "record everything then submit" flow into an incremental, per-player card-collection workflow with live Three.js visualization. Introduce backend-computed equity, a responsive mobile playback experience, and a global game/hand navigator. Phase 1 delivers the Dealer Control Mode MVP; Phase 2 (deferred) adds Player Participation Mode.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python 3.12 / FastAPI | Backend API — new incremental hand endpoints, equity computation |
| SQLAlchemy 2.x / Alembic | ORM, migrations (no schema changes expected — validation-level only) |
| Pydantic v2 | Request/response models — `ResultEnum`, optional `HandCreate` fields |
| Preact + JSX | Frontend UI — dealer interface, mobile playback controls |
| Three.js | 3D poker table visualization — reusable scene module for desktop & mobile |
| Vite | Build tooling — existing config, no changes expected |
| pytest / pytest-mock | Backend TDD — all new endpoints get tests first |
| vitest | Frontend unit tests — reducer, payload assembly, component logic |
| uv | Package management — existing lockfile workflow |

---

## Architecture Components

### Backend — Incremental Hand Endpoints

Extend the existing hands router (`src/app/routes/hands.py`) to support creating empty hands and building them up step-by-step. This requires making `HandCreate` fields optional and adding a new single-player result endpoint.

**Key changes:**
- `HandCreate`: all fields optional (empty `{}` body creates an empty hand)
- New `PATCH .../players/{player_name}/result` endpoint for per-player outcome
- `ResultEnum`: `won | folded | lost` enforced at the Pydantic level
- Existing PATCH endpoints (`edit_community_cards`, `edit_player_hole_cards`, `add_player_to_hand`) remain unchanged

### Backend — Equity Service

Port the JavaScript equity calculator to `src/app/services/equity.py`. Expose via `GET /games/{game_id}/hands/{hand_number}/equity`. Exhaustive enumeration for ≤2 unknowns, Monte Carlo for more. No database schema changes — reads hand state from existing models.

### Frontend — Game & Hand Selector

New Preact components that replace the current "create-only" entry point:
- `GameSelector.jsx` — lists games, "New Game" button
- Refactored `HandDashboard` — lists hands within a game, "Add Hand" button, "Back" navigation
- Reducer gains `SET_GAME_LIST`, `SELECT_GAME`, `SET_HAND_LIST` actions

### Frontend — Dealer Control Mode

Enhanced `PlayerGrid` with per-player status tracking and a capture → review → assign-result flow for each player. Three outcome buttons (Won / Fold / Lost) replace the current "Submit Hand" all-at-once approach.

### Frontend — Reusable Three.js Scene

Extract the table rendering logic into `src/scenes/pokerScene.js` so both the desktop playback view and the dealer's embedded preview can share it. The module accepts a canvas, options, and exposes `update(handState)`.

### Frontend — Mobile Playback

A new `#/playback-mobile` route with a full-viewport Three.js canvas, touch-enabled OrbitControls, bottom-drawer session picker, and Preact-styled scrubbers. Equity comes from the backend API.

---

## Project Phases

### Phase 1: Backend Foundation (Epics 1–2)

Make the backend support incremental hand building and server-side equity.

**Deliverables:**
- Optional `HandCreate` fields (empty hand creation)
- `PATCH .../players/{player_name}/result` endpoint
- `ResultEnum` enforced across all result fields
- `src/app/services/equity.py` with full test coverage
- `GET .../equity` endpoint
- All existing 749+ tests still passing

### Phase 2: Dealer Interface Refactor (Epics 3–4)

Rebuild the dealer UI around the new incremental backend contract.

**Deliverables:**
- Game selector landing page
- Hand list with edit/create navigation
- Player tiles with status indicators (playing / won / folded / lost)
- Per-player capture → review → assign-result flow
- Community card capture (unchanged camera flow, new PATCH wiring)
- Hand completion with elimination logic
- Updated `dealerState.js` with new actions and status tracking

### Phase 3: Visualization (Epics 5–6)

Shared Three.js scene module, dealer embed, and mobile playback.

**Deliverables:**
- Reusable `pokerScene.js` module
- `DealerPreview.jsx` with live equity overlay
- `#/playback-mobile` route with touch controls
- Preact-styled scrubbers and session picker for mobile
- Backend equity integrated into both dealer preview and mobile view

### Phase 4: Player Participation (Epic 7 — deferred)

Add the player-side interface for self-service card capture and join/fold decisions.

**Deliverables:**
- `#/player` route with name selection and game picker
- Player card self-capture flow
- Real-time tile color states in dealer UI
- "Hand Back Cards" action

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Three.js scene extraction breaks existing playback | Phase 3 starts with a refactor task that must pass all existing visual smoke tests before the embed is built |
| Equity endpoint too slow for many players | Monte Carlo capped at 5,000 iterations; cache equity per hand-state hash; benchmark in tests |
| Mobile Three.js performance (older phones) | Use lightweight geometry, disable shadows/antialiasing in mobile mode, test on real devices |
| `HandCreate` backwards compatibility | Existing full-payload flow remains a valid input — empty fields are additive |
| Phase 2 (Player Participation) scope creep into Phase 1 | Phase 1 tasks explicitly exclude player-side features; Epic 7 is spec'd but not tasked |

---

## Dependencies

| Dependency | Notes |
|---|---|
| Three.js OrbitControls | Already available via `three/examples/jsm/controls/OrbitControls` — no new install |
| Backend equity service | Must be deployed before dealer preview or mobile view can use it |
| Incremental hand endpoints | Must be deployed before dealer control mode can function |
