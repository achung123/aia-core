# Plan — Player Analytics Dashboards

**Project ID:** player-analytics-007
**Date:** 2026-04-12
**Status:** Draft

---

## Overview

Add a suite of interactive analytics dashboards to the All In Analytics frontend (React + TypeScript, per spec 006). Players select their name and explore personal stats, game recaps, head-to-head rivalries, trends over time, and fun achievements — all mobile-friendly. New backend API endpoints handle the heavy aggregation (head-to-head, trends, achievements), while the frontend uses Recharts for visualization. No auth required — open access via player name picker.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python / FastAPI | New analytics API endpoints in `src/app/routes/stats.py` (or split into `analytics.py`) |
| SQLAlchemy 2.x | Query aggregation for head-to-head, trends, achievements |
| Recharts | React charting library for line charts, radar charts, sparklines, bar charts |
| React Router | New `/analytics/*` routes nested under the existing router |
| React (TypeScript) | Dashboard components — assumes spec 006 migration is complete |
| CSS Modules | Scoped dashboard styling, responsive breakpoints |
| Pydantic v2 | Response models for new API endpoints |
| pytest | Tests for all new endpoints |
| Vitest + React Testing Library | Frontend component and integration tests |

---

## Architecture Components

### Analytics API Layer (`src/app/routes/analytics.py`)

A new router (or extension of `stats.py`) housing the analytics-specific endpoints: head-to-head, session trends, hand-level trends, and achievements. Each endpoint performs server-side aggregation using SQLAlchemy queries against the existing `players`, `player_hands`, `hands`, and `game_sessions` tables. No schema changes required — all new data is derived from existing columns.

### Achievements Engine (`src/app/services/achievements.py`)

A config-driven module that defines achievement rules as data structures. Each achievement has an evaluator function that receives a player's hand/session data and returns whether the achievement is earned plus context metadata. The engine is invoked by the achievements API endpoint and computes results on-the-fly (no persistence). New achievements are added by appending to the config — no router changes needed.

### Analytics Dashboard Shell (`frontend/src/analytics/`)

A new top-level directory housing all analytics React components. The shell provides a responsive layout with a player name picker, tabbed navigation (Profile, Trends, Head-to-Head, Leaderboard), and shared context (selected player state). Uses React Router nested routes under `/analytics`.

### Chart Components (`frontend/src/analytics/charts/`)

Reusable Recharts wrapper components: `TrendLineChart`, `RadarProfileChart`, `Sparkline`, `CumulativeChart`, `RivalryBar`. Each component accepts typed props and handles loading/empty states consistently. Shared color palette and responsive sizing.

### API Client Extensions (`frontend/src/api/`)

New typed functions in the API client module for calling analytics endpoints. TypeScript interfaces match the backend Pydantic response models. Follows the same pattern as existing API client functions.

---

## Project Phases

### Phase 1: Backend Analytics APIs

Build the four new API endpoints and the achievements engine. This unblocks all frontend work.

**Deliverables:**
- `GET /stats/head-to-head` — matchup record between two players
- `GET /stats/players/{name}/trends` — session-over-session performance data
- `GET /stats/games/{game_id}/players/{name}/hand-trends` — hand-level cumulative data
- `GET /stats/players/{name}/achievements` — earned achievements list
- Enhanced `GET /stats/games/{game_id}` with `key_moments` field
- Achievements config module with 10+ achievement definitions
- Full pytest coverage for all new endpoints

### Phase 2: Dashboard Shell & Player Profile

Build the frontend foundation and the player profile page — the most-used view.

**Deliverables:**
- Analytics route structure (`/analytics`, `/analytics/player/{name}`)
- Player name picker component
- Stats summary cards
- Play style radar chart
- Recent games list
- Responsive layout (mobile-first)
- API client types for analytics endpoints

### Phase 3: Game Recap & Leaderboard

Build the single game recap page and the enhanced leaderboard.

**Deliverables:**
- Game recap page (`/analytics/game/{id}`)
- Player performance table (sortable)
- Hand timeline chart (multi-player line chart)
- Key moments highlight cards
- Game night awards section
- Filterable leaderboard page with sparklines

### Phase 4: Head-to-Head & Trends

Build the rivalry comparison page and the aggregate trends views.

**Deliverables:**
- Head-to-head picker and summary page
- Game-by-game breakdown table
- Shared hand detail expansion
- Session-over-session trend charts
- Hand-level drill-down from session points
- Play style evolution over time (radar slider)

### Phase 5: Achievements & Polish

Complete the achievement badge UI and do a final polish pass for mobile and edge cases.

**Deliverables:**
- Achievement badge grid on player profile
- Achievement detail modal
- Achievement definitions for all 10+ badges
- Mobile responsive QA across all views
- Empty state / zero-data handling for all components
- Loading skeletons throughout

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Spec 006 (React/TS migration) not yet complete — analytics frontend depends on it | Phase 1 (backend) has zero frontend dependency. Frontend phases can begin in parallel with the tail end of spec 006. Plan task dependencies explicitly. |
| P&L data is zero for existing games — charts look empty | All charts gracefully degrade: show outcome-based stats (wins/folds) as primary, P&L as secondary when available. Empty P&L shows "No P&L data" note. |
| Achievements engine performance — computing on-the-fly for players with many sessions | Initial dataset is small (< 100 sessions). Add caching (LRU or Redis) only if query time exceeds 500ms in production. Keep evaluators simple. |
| Head-to-head queries could be slow with many players/hands | Use efficient SQLAlchemy aggregation queries with proper indexes. The existing `uq_player_hand` unique constraint already indexes (hand_id, player_id). |
| Recharts bundle size bloat | Import only the specific chart types needed (tree-shakeable). Lazy-load analytics routes so the bundle doesn't affect dealer/playback views. |
| Radar chart "Consistency" axis requires computing standard deviation across sessions | Compute in the trends endpoint response or in a dedicated derived field. Not complex, but must be intentional. |

---

## External Dependencies

- **Spec 006 (frontend-react-ts-006):** The React + TypeScript migration must be substantially complete before frontend analytics components are built. Backend work (Phase 1) is independent.
- **Recharts:** Will be added as a new npm dependency. Currently not in `package.json`.
- **Existing API endpoints:** The analytics dashboard consumes existing endpoints (`/stats/players/{name}`, `/stats/leaderboard`, `/stats/games/{id}`, `/players`, `/games`) alongside the new ones. No changes to existing endpoints except the backward-compatible enhancement to game stats.
