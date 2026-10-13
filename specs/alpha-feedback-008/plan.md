# Plan — Alpha Feedback Overhaul

**Project ID:** alpha-feedback-008
**Date:** 2026-04-12
**Status:** Draft

---

## Overview

This project incorporates all user feedback from the first live alpha game (44+ hands) into a comprehensive overhaul of the All In Analytics system. The primary changes are: (1) removing the dealer-centric mode entirely, (2) rebuilding the dealer interface as a streamlined mobile-first experience with one-button hand start and player roster management, (3) adding a live betting/action system with chip denominations for profit tracking, (4) auto-detecting hand winners via the existing equity calculator with a dealer review screen (equity-based auto-detection with manual review as the fallback for inconclusive cases), (5) giving players a 3D visualization with adjusted equity and showdown reveals, (6) upgrading the hand scrubber to a range slider across all views, (7) stabilizing infrastructure (polling, timestamps, session pinning), (8) adding seat assignment, buy-in tracking, and re-buy support for full profit/loss computation, (9) implementing a server-side hand state machine for turn-order enforcement, (10) improving the detection/correction UX with top-N OCR predictions and image local preview, and (11) adding a split-screen dealer layout for tablets. **This project (`alpha-feedback-008`) depends on `frontend-react-ts-006` (React/TS migration) being fully complete.** All frontend work targets the post-migration stack: React 18 + TypeScript (strict) + Zustand + React Router + Vite.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python 3.12 / FastAPI | Backend API — new endpoints for player management, actions, blinds, hand start |
| SQLAlchemy 2.x | ORM — new `PlayerHandAction` model, `GamePlayer.is_active`, blind fields, SB/BB on hands |
| Alembic | Schema migrations — 4 new migrations for all schema changes |
| Pydantic v2 | Request/response models — action recording, blind state, player status toggle |
| React 18 + TypeScript (strict) | Frontend UI — rebuilt dealer interface, player action buttons, chip picker (post-006 migration) |
| Three.js | Player 3D visualization — reuses `pokerScene.ts` with new seat-snap and live updates |
| Zustand | Dealer state management (typed store from 006 migration) — simplified for single-mode |
| `qrcode` (npm) | QR code generation — existing, simplified for single-game QR |
| React Router | Client-side routing (HashRouter from 006 migration) |
| Vite | Build tooling — `@vitejs/plugin-react`, TypeScript, no additional config changes expected |
| pytest + TestClient | Backend TDD — all new endpoints get tests |
| React Testing Library + Vitest | Frontend component tests |
| uv | Package management |

---

## Architecture Components

### Backend — Player Roster Management

New `is_active` flag on `game_players` allows soft-removing and re-adding players without data loss. New endpoints: `PATCH .../players/{name}/status` (toggle), `POST /games/{id}/players` (add mid-game). The `start-all` hand endpoint filters on `is_active = true`. Players are auto-assigned sequential `seat_number` values on game creation (used for SB/BB rotation, turn order, and 3D visualization).

### Backend — Buy-In & Re-buy Tracking

New `buy_in` float column on `game_players` records each player's initial buy-in at game creation. A new `rebuys` table (`rebuy_id`, `game_id`, `player_name`, `amount`, `created_at`) tracks mid-game re-buys. `POST .../players/{name}/rebuys` records a re-buy (and reactivates the player if inactive). Balance ledgers (total investment, profit/loss) are computed on the fly from buy-in + re-buy totals vs. chip outcomes — no separate ledger table needed.

### Backend — Betting & Actions System

New `player_hand_actions` table stores per-street actions (fold/check/call/bet/raise) with amounts. Fold actions auto-set `result = "folded"` on the player hand. New `POST .../actions` and `GET .../actions` endpoints. Chip denominations (White=$0.10 through Black=$0.50) are frontend constants; amounts are stored as floats.

### Backend — Blind System

Blind level fields (`small_blind`, `big_blind`, timer config) on `game_sessions`. `GET/PATCH /games/{id}/blinds` endpoints. Timer is computed client-side from `blind_timer_started_at` + duration; backend stores state for persistence. SB/BB player positions stored per-hand on the `hands` table (`sb_player_id`, `bb_player_id`) with auto-rotation.

### Backend — Infrastructure Middleware

Request-ID + response-time middleware for traceability. ETag support on the hand status endpoint for conditional 304 responses. Structured logging with request metadata.

### Backend — Hand State Machine

New `hand_states` table tracks the current phase (`preflop`/`flop`/`turn`/`river`/`showdown`) and `current_seat` for each hand. Auto-created when a hand starts. The action endpoint validates turn order before accepting an action and advances the seat pointer and phase automatically after each valid action. A `force` query parameter allows the dealer to override turn order for corrections. Phase advancement is gated on community card count (can’t enter `flop` phase until 3 community cards are recorded).

### Frontend — Rebuilt Dealer Interface

Full rebuild of `DealerApp` as React TSX with single-mode flow: Game Selection → Dashboard (player management, QR code, blind bar) → Active Hand (tiles, board capture, showdown) → Review (editable results). Community cards captured incrementally (flop/turn/river separately). Showdown triggers auto-detection via existing equity endpoint. Review screen allows dealer to edit all fields before confirming. On tablets/large phones, the Active Hand view uses a split-screen layout (board + tiles side-by-side) for simultaneous visibility. Camera capture flow includes a local image preview step before OCR submission.

### Frontend — Detection & Correction UX

Card correction screen shows top-N (3–5) OCR prediction alternatives ranked by confidence, letting the dealer tap the correct card instantly instead of browsing all 52. Falls back to the full `CardPicker` if predictions are unavailable or incorrect. Image local preview after camera capture lets the dealer verify photo quality and retake before sending to backend.

### Frontend — Player Decision Interface

Rebuilt `PlayerApp.tsx` replaces "Hand Back Cards" with action buttons (fold/check/call/bet/raise). Chip picker component with 5 denominations. Session pinning via `sessionStorage` prevents navigation kickback on refresh. Blind & SB/BB display shows current game state.

### Frontend — Player 3D Visualization

New "Table View" screen accessible from the player menu. Reuses `pokerScene.ts`. Shows player's own cards face-up, opponents face-down, community cards as available. Adjusted equity overlay (player's cards vs. unknown opponents). Showdown reveals. Range slider scrubber for game hand history.

### Frontend — Visualization Upgrades

Range slider added to `SessionScrubber` (replacing button-only navigation). Seat-snap camera with smooth animation. Live polling (10s) auto-updates the scene without page refresh. All improvements mobile-first.

---

## Project Phases

### Phase 1: Backend Foundation

All database schema changes, new models, and new API endpoints. Eight Alembic migrations, eight new endpoint groups, middleware additions. This phase unblocks all frontend work.

**Deliverables:**
- `game_players.is_active` + `seat_number` + `buy_in` columns + toggle endpoint + add-player endpoint
- `hands.sb_player_id / bb_player_id` columns + start-all hand endpoint with SB/BB rotation
- `player_hand_actions` table + record/retrieve action endpoints
- Blind fields on `game_sessions` + blind management endpoints
- `rebuys` table + re-buy recording/listing endpoints
- `hand_states` table + turn-order query/enforcement endpoints
- Request-ID + response-time middleware
- Full pytest coverage for all new endpoints

### Phase 2: Dealer Interface Rebuild

Strip old dealer-centric code, rebuild the dealer interface from scratch. Player management UI, one-button hand start, active hand dashboard with blind bar, incremental community card capture, showdown trigger, and full editable review screen.

**Deliverables:**
- Removal of `dealer_centric` mode and legacy hand submission
- New typed API client functions for all new endpoints
- Rebuilt `DealerApp` shell (React TSX, mobile-first, single-mode)
- Player management component
- Active Hand Dashboard (tiles + board + blind + timer)
- Community card capture (flop/turn/river separately)
- Showdown trigger + auto-detection + review screen (with equity fallback to manual pick-winner)
- End hand flow with terminal state validation
- Top-N OCR prediction alternatives in card correction screen
- Image local preview before OCR submission
- Split-screen dealer input layout (tablet/large phone)

### Phase 3: Player Interface

Enhance the player experience with session pinning, action buttons, chip picker, blind/position display, and the 3D table visualization.

**Deliverables:**
- Session pinning (`sessionStorage` persistence)
- Chip picker component
- Fold/check/call/bet/raise buttons + backend integration
- Blind & SB/BB display
- Player Table View (3D scene, adjusted equity, showdown reveals, game scrubber)

### Phase 4: Visualization & Infrastructure

Upgrade visualization across all views and stabilize infrastructure.

**Deliverables:**
- Range slider scrubber for all views
- Seat-snap camera view
- Live hand updates via polling (10s)
- Polling interval tuning + conditional 304 support
- Integration smoke tests for dealer and player flows

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Full dealer interface rebuild is high scope — regression risk | Rebuild incrementally; shared components (CameraCapture, DetectionReview, CardPicker) stay unchanged; existing backend tests anchor correctness |
| Blind timer synchronization across clients | Timer computed client-side from backend timestamp — no real-time sync needed; minor drift is acceptable for a 15-minute countdown |
| Auto-detection edge cases (ties, partial board, missing cards) | Review screen is always editable — dealer is the final authority; auto-detection is a convenience, not a hard requirement |
| Player action tracking adds DB write volume | SQLite handles the load for home games (< 10 players, < 100 hands); actions are small rows; optimize with batch writes if needed |
| State machine adds coupling between action recording and turn tracking | Dealer `force` override ensures the state machine never blocks gameplay; state machine is advisory for players, authoritative only on the API level |
| Top-N OCR predictions depend on model returning confidence scores | Graceful fallback: if confidence data is unavailable, the correction screen shows the full CardPicker directly |
| Polling 5+ endpoints from multiple clients | ETag/304 support reduces payload size; stagger intervals (3s dealer, 5s player, 10s viz); AbortController prevents request pileup |
| Player 3D viz on mobile may have performance issues | Reuse existing `pokerScene.ts` (already mobile-tested); keep polygon count low; gate Three.js loading behind the Table View tab |
| This project runs after the React/TS migration | **Hard dependency:** `frontend-react-ts-006` must be complete before this project starts. All new code uses React 18 + TypeScript (strict) — no Preact or vanilla JS |

---

## External Dependencies

- Existing equity calculator (`src/app/services/equity.py`) — must handle 0-unknown-card case deterministically for auto-detection
- Existing `CameraCapture`, `DetectionReview`, `CardPicker` React TSX components — shared with rebuilt dealer and player flows
- Existing `pokerScene.ts` Three.js module — extended with seat-snap camera and live update hooks
- YOLO/OCR card detection model — must expose confidence scores per prediction for the top-N correction UX; if unavailable, fallback to full CardPicker
- SQLite — all schema changes via Alembic; no new external DB dependency
