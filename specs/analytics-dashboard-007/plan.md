# Plan — Analytics Dashboard

**Project ID:** analytics-dashboard-007
**Date:** 2026-04-12
**Status:** Draft

---

## Overview

Build an interactive, mobile-first analytics dashboard within the All In Analytics React + TypeScript frontend (spec 006). The dashboard covers four major feature areas: single-game recaps with hand timelines, career/aggregate player stats with trend charts, deep head-to-head rivalry comparisons, and auto-generated fun awards. The backend is extended with 4 new API endpoints to power the analytics. All frontend work assumes the React + TS migration (spec 006) is complete.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| React 19 + TypeScript | Frontend framework (per spec 006) |
| Recharts | Charting library — line charts, donut/pie charts, bar charts |
| Zustand | Client-side state management for filter state, player selection, cached data |
| React Router | Page routing (`/games/:id/recap`, `/players/:name`, `/head-to-head`, `/awards`) |
| TanStack Query (React Query) | Data fetching, caching, and loading state management for all API calls |
| CSS Modules | Scoped component styling (per spec 006) |
| FastAPI | Backend analytics endpoints |
| SQLAlchemy 2.x | Database queries for analytics aggregation |
| Pydantic v2 | Response schema validation for new endpoints |

---

## Architecture Components

### Dashboard Pages (Frontend)

Four new top-level routes added to the React Router configuration:

- `/games/:gameId/recap` — Single-game recap with hand timeline and player summaries
- `/players/:playerName` — Player career profile with trend charts and outcome breakdowns
- `/head-to-head` — Two-player rivalry comparison with deep stats
- `/awards` — Auto-generated superlatives and fun awards grid

Each page is a standalone route component that fetches data via TanStack Query hooks, with Zustand managing cross-page state (e.g. recently viewed players, last selected filters).

### Shared UI Components (Frontend)

- **PlayerSelector** — Reusable autocomplete/dropdown for picking players (used in profile, H2H, and filtering)
- **CardIcon** — Mini playing card renderer (rank + suit) for hand timelines
- **StatCard** — Reusable stat block showing a metric label, value, and optional trend indicator
- **AwardCard** — Visually distinct card for awards with emoji, title, winner, and stat

### Analytics API Layer (Backend)

Four new endpoints added to `src/app/routes/stats.py` (or a new `analytics.py` router):

| Endpoint | Returns |
|---|---|
| `GET /stats/players/{name}/trends` | Per-session stats in chronological order |
| `GET /stats/head-to-head?player1=X&player2=Y` | Rivalry breakdown: showdowns, folds, street-level |
| `GET /stats/awards?game_id={optional}` | Auto-computed superlative awards |
| `GET /stats/games/{id}/highlights` | 3-5 key moments from a session |

### Query Helpers (Backend)

Reusable SQLAlchemy query functions in `app.database.queries`:

- `get_shared_hands(db, p1_id, p2_id)` — All hands where both players participated
- `get_player_session_stats(db, player_id)` — Per-session aggregated stats for trend data
- `compute_streak(results)` — Pure function to compute longest consecutive win streak from a list of results

---

## Project Phases

### Phase 1: Backend Analytics Endpoints

Build the 4 new API endpoints and their supporting query helpers. All endpoints are tested with pytest before moving to frontend work.

**Deliverables:**
- `GET /stats/players/{name}/trends` endpoint + Pydantic response model + tests
- `GET /stats/head-to-head` endpoint + Pydantic response model + tests
- `GET /stats/awards` endpoint + Pydantic response model + tests
- `GET /stats/games/{id}/highlights` endpoint + Pydantic response model + tests
- Shared query helper functions with unit tests

### Phase 2: Shared UI Components

Build the reusable components that every dashboard page needs — player selectors, card icons, stat cards — so subsequent pages can compose from them.

**Deliverables:**
- `PlayerSelector` component (autocomplete from `/players` list)
- `CardIcon` component (render a playing card by rank + suit string like "AH", "10C")
- `StatCard` and `AwardCard` display components
- TanStack Query hooks for all analytics endpoints
- Component tests for each

### Phase 3: Single-Game Recap Page

Build the `/games/:gameId/recap` route — the most data-rich page, combining hand timelines, player summaries, key moments, and session awards.

**Deliverables:**
- Game recap page with player summary cards
- Hand-by-hand vertical timeline with expandable details
- Key moments section (from `/highlights` endpoint)
- Session awards banner (from `/awards?game_id=X`)
- Mobile-first responsive layout

### Phase 4: Player Profile & Career Stats

Build the `/players/:playerName` route — trend charts, outcome distributions, and session history.

**Deliverables:**
- Player profile page with career stat summary
- Win rate trend line chart (Recharts)
- Outcome distribution donut charts (won/lost/folded + street reach)
- Session history sortable table with navigation to recap pages

### Phase 5: Head-to-Head Rivalries

Build the `/head-to-head` route — the fun two-player comparison view.

**Deliverables:**
- Head-to-head player picker with swap and quick-pick
- Showdown record summary with split gauge visualization
- Fold behavior comparison with baseline comparison bars
- Street-level rivalry breakdown chart

### Phase 6: Awards Page

Build the `/awards` route — the fun, visually engaging awards grid.

**Deliverables:**
- Awards grid page with card layout
- Global vs per-game filter toggle
- Navigation to winner's player profile from each card
- Playful visual design (emoji, bold colors, trophy feel)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| P&L data is missing for historical games (all zeros in game 1) | All P&L-dependent features gracefully degrade — show "—" or muted "$0.00" with a note; design charts to handle zero/null data without breaking |
| Head-to-head queries could be slow with large datasets | Add database indexes on `player_hands(player_id, hand_id)` and `hands(game_id)`; pre-aggregate in SQL rather than Python loops; target < 200ms response |
| Spec 006 (React migration) must be complete first | Phase 1 (backend) can proceed immediately; frontend phases are blocked on spec 006 core infrastructure (Epics 1-2) but not the full migration |
| Awards algorithm may produce unhelpful results with small datasets | Require minimum thresholds (e.g. "min 20 hands" for win rate award); skip awards that can't be meaningfully computed |
| Recharts bundle size (~200KB gzipped) could impact mobile load times | Code-split dashboard routes with React.lazy so chart library only loads when a chart page is visited |

---

## External Dependencies

- **Spec 006 (Frontend React + TS Migration)** — Phases 2-6 depend on the React + TS migration being at least through Epics 1-2 (scaffolding + core infrastructure)
- **Existing backend endpoints** — `/stats/players/{name}`, `/stats/leaderboard`, `/stats/games/{id}`, `/games/{id}/hands` — must remain stable; new endpoints extend, not replace
- **Recharts** — npm package, no external service dependency
- **TanStack Query** — npm package for data fetching layer
