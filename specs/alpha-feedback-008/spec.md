# Spec — Alpha Feedback Overhaul

**Project ID:** alpha-feedback-008
**Date:** 2026-04-12
**Status:** Draft
**Depends on:** `frontend-react-ts-006` — the React/TypeScript migration **MUST** be complete before this project begins. All frontend work here targets the post-migration stack: React 18 + TypeScript (strict) + Zustand + React Router + Vite.
**Ordering:** `frontend-react-ts-006` → `alpha-feedback-008`

---

## Table of Contents

1. [Epic 1: Dealer Mode Teardown](#epic-1-dealer-mode-teardown)
2. [Epic 2: Game & Hand Management](#epic-2-game--hand-management)
3. [Epic 3: Betting & Blind System](#epic-3-betting--blind-system)
4. [Epic 4: Auto-Detection & Dealer Review](#epic-4-auto-detection--dealer-review)
5. [Epic 5: New Dealer Interface (Rebuilt, Mobile-First)](#epic-5-new-dealer-interface-rebuilt-mobile-first)
6. [Epic 6: Player Onboarding & Decision Interface](#epic-6-player-onboarding--decision-interface)
7. [Epic 7: Player 3D Visualization](#epic-7-player-3d-visualization)
8. [Epic 8: Visualization Improvements (Mobile-First)](#epic-8-visualization-improvements-mobile-first)
9. [Epic 9: Infrastructure Stabilization](#epic-9-infrastructure-stabilization)
10. [Epic 10: Hand Turn-Order State Machine](#epic-10-hand-turn-order-state-machine)
11. [Appendix: Nice-to-Haves (Deferred — No Beads)](#appendix-nice-to-haves-deferred--no-beads)

---

## Epic 1: Dealer Mode Teardown

Full removal of dealer-centric mode. The system exclusively supports player participation mode going forward. All conditional logic, mode toggles, and dealer-centric-only code paths are stripped. Shared React components (`CameraCapture`, `DetectionReview`, `CardPicker`) are preserved.

### S-1.1 — Remove Dealer-Centric Mode Toggle & Code Paths

**As a** developer, **I want** the dealer-centric mode toggle and all mode-conditional code removed, **so that** the codebase has a single clean game mode and no dead branches.

**Acceptance Criteria:**
1. `GameMode` type no longer includes `'dealer_centric'`; `SET_GAME_MODE` reducer action is removed from `dealerState.ts` and `dealerStore.ts`
2. All `gameMode === 'dealer_centric'` conditionals in `DealerApp`, `PlayerGrid`, `HandDashboard`, and `OutcomeButtons` are removed
3. The old per-player card-collection flow (dealer taps tile → camera → outcome assignment in dealer-centric mode) is removed
4. `npm run build` succeeds with zero TypeScript errors
5. Tests referencing `dealer_centric` mode are updated or removed; `npm test` passes

### S-1.2 — Remove Legacy Hand Submission Flow

**As a** developer, **I want** the old all-at-once hand submission (full `HandCreate` payload assembled from dealer state) removed, **so that** only the incremental per-player backend contract is used.

**Acceptance Criteria:**
1. `handPayload.ts` is removed or stripped to only support incremental flow helpers
2. The "Submit Hand" button that assembled a full hand payload is removed from the dealer UI
3. All dead references to the old submission pattern in `DealerApp` are removed
4. `handPayload.test.ts` is updated or removed; all tests pass

---

## Epic 2: Game & Hand Management

Enable the dealer to manage the player roster mid-game (soft-remove/re-add players, add buy-ins/re-buys) and start a new hand for all active players with a single tap. Track small blind / big blind positions per hand. Auto-assign seats on game creation for SB/BB rotation and visualization. Capture initial buy-in amounts and track re-buys for profit tracking.

### S-2.1 — Soft Active/Inactive Flag for Game Players

**As a** dealer, **I want** to mark a player as inactive in a game without losing their hand history, **so that** eliminated or sat-out players don't appear in new hands but their data is preserved.

**Acceptance Criteria:**
1. `game_players` table gains an `is_active` boolean column (default `true`) via Alembic migration
2. `GamePlayer` model includes the `is_active` field
3. All existing rows default to `is_active = true` (non-destructive migration)
4. `GameSessionResponse` returns each player with their active/inactive status
5. Tests verify the migration and model changes

### S-2.2 — Toggle Player Active Status Endpoint

**As a** dealer, **I want** an API endpoint to deactivate or reactivate a player in a game, **so that** the frontend can manage the player roster.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/players/{player_name}/status` accepts `{ "is_active": bool }`
2. Returns 200 with the updated player status
3. Returns 404 if the player is not in the game
4. Deactivating does NOT delete existing `PlayerHand` rows for that player
5. Tests cover activate, deactivate, not-found, and idempotent toggle

### S-2.3 — Add Player to Existing Game Endpoint

**As a** dealer, **I want** to add a new player to an in-progress game (for buy-back-ins), **so that** late arrivals can join without creating a new game.

**Acceptance Criteria:**
1. `POST /games/{game_id}/players` accepts `{ "player_name": str }`
2. Creates the `Player` row if the name doesn't exist, then adds a `GamePlayer` row with `is_active = true`
3. Returns 201 with the player info
4. Returns 409 if the player is already in the game (active or inactive — use toggle endpoint to reactivate)
5. Tests cover new player, existing player, duplicate, and game-not-found

### S-2.4 — One-Button Hand Start

**As a** dealer, **I want** a single API call that creates a new hand and adds `PlayerHand` rows for all active players, **so that** I don't waste time tapping each player individually.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/start` creates a hand with the next `hand_number`
2. `PlayerHand` rows are created for all `is_active = true` `GamePlayer` entries (card_1=null, card_2=null, result=null)
3. Inactive players are excluded
4. Returns 201 with the full `HandResponse` including all player entries
5. Returns 400 if no active players exist; returns 404 if game not found

### S-2.5 — SB/BB Position Tracking on Hands

**As a** system, **I want** each hand to record which player is small blind and which is big blind, **so that** position information is available for display and analytics.

**Acceptance Criteria:**
1. `hands` table gains `sb_player_id` and `bb_player_id` columns (nullable FK to `players`) via Alembic migration
2. The start-all endpoint auto-assigns SB/BB by rotating through active players based on player order and previous hand positions
3. `HandResponse` includes `sb_player_name` and `bb_player_name` fields
4. If a game has < 2 active players, SB/BB are null
5. Tests verify rotation logic across consecutive hands

### S-2.6 — Seat Assignment on Game Creation

**As a** dealer, **I want** each player to be auto-assigned a seat number when the game is created, **so that** SB/BB rotation, turn order, and 3D visualization seat placement are consistent.

**Acceptance Criteria:**
1. `game_players` table gains a `seat_number` integer column (nullable) via Alembic migration
2. When `POST /games` creates a game with players, each player is assigned a sequential seat number (1-based) in the order they were listed
3. When `POST /games/{id}/players` adds a player mid-game, the player receives the next available seat number
4. `GameSessionResponse` includes `seat_number` for each player
5. Seat numbers are stable — removing/reactivating a player does not reassign seats of other players
6. Tests verify seat assignment on creation, mid-game addition, and stability after toggle

### S-2.7 — Buy-In Tracking on Game Player

**As a** dealer, **I want** to record each player's initial buy-in amount when creating the game, **so that** profit/loss can be computed at the end of the session.

**Acceptance Criteria:**
1. `game_players` table gains a `buy_in` float column (nullable, default null) via Alembic migration
2. `POST /games` accepts an optional `buy_in` amount per player in the creation payload
3. `POST /games/{id}/players` (add player mid-game) also accepts an optional `buy_in` amount
4. `GameSessionResponse` includes `buy_in` for each player
5. If no buy-in is specified, the field remains null (dealer can update later)
6. Tests verify buy-in stored on creation, mid-game addition, and null default

### S-2.8 — Re-buy / Buyback Tracking

**As a** dealer, **I want** to record when a player re-buys into the game (with an amount), **so that** total investment per player is tracked for accurate profit/loss calculations.

**Acceptance Criteria:**
1. New `rebuys` table: `rebuy_id` (PK), `game_id` (FK), `player_name` (string), `amount` (float, not null), `created_at` (datetime)
2. Alembic migration creates the table; `Rebuy` SQLAlchemy model defined
3. `POST /games/{game_id}/players/{player_name}/rebuys` accepts `{ "amount": float }` and returns 201
4. `GET /games/{game_id}/players/{player_name}/rebuys` returns the list of re-buys for that player in the game
5. `GameSessionResponse` includes a `rebuy_count` and `total_rebuys` per player (or a separate endpoint)
6. Re-buying also reactivates the player if they were inactive (`is_active` flipped to `true`)
7. Tests cover: record re-buy, list re-buys, re-buy reactivates inactive player, 404 for missing game/player

---

## Epic 3: Betting & Blind System

Track per-street player actions (fold/check/call/bet/raise with amounts) in a new database table. Manage blind levels with a timer that doubles every 15 minutes. Chip denominations: White=$0.10, Red=$0.20, Green=$0.30, Blue=$0.40, Black=$0.50.

### S-3.1 — Player Hand Actions Table

**As a** developer, **I want** a `player_hand_actions` table to persist per-street player actions with amounts, **so that** betting data is available for analytics and profit tracking.

**Acceptance Criteria:**
1. Table schema: `action_id` (PK), `player_hand_id` (FK → player_hands), `street` (string), `action` (string), `amount` (float, nullable), `created_at` (datetime)
2. Alembic migration creates the table
3. `PlayerHandAction` SQLAlchemy model is defined with a relationship to `PlayerHand`
4. `street` is constrained to: `preflop`, `flop`, `turn`, `river`
5. `action` is constrained to: `fold`, `check`, `call`, `bet`, `raise`

### S-3.2 — Record Player Action Endpoint

**As a** player/system, **I want** an API endpoint to record a betting action, **so that** player decisions are persisted as they happen.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/{hand_number}/players/{player_name}/actions` accepts `{ "street": str, "action": str, "amount": float | null }`
2. Validates street and action values against allowed enums
3. A `fold` action automatically sets `result = "folded"` on the corresponding `PlayerHand` row
4. Returns 201 with the created action record
5. Returns 404 for missing game, hand, or player; tests cover all action types and error cases

### S-3.3 — Blind Level Fields on Game Session

**As a** dealer, **I want** the game session to track current blind levels, timer duration, and timer state, **so that** blind information persists across refreshes and is visible to all clients.

**Acceptance Criteria:**
1. `game_sessions` gains: `small_blind` (float, default 0.10), `big_blind` (float, default 0.20), `blind_timer_minutes` (int, default 15), `blind_timer_paused` (bool, default false), `blind_timer_started_at` (datetime, nullable)
2. Alembic migration adds the columns with defaults
3. `GameSessionResponse` includes the new blind fields
4. Existing data is unaffected (new columns use defaults)

### S-3.4 — Blind Management Endpoints

**As a** dealer, **I want** endpoints to read and update blind levels and timer state, **so that** I can advance blinds and pause/resume the timer.

**Acceptance Criteria:**
1. `GET /games/{game_id}/blinds` returns current blind level, timer state, and time remaining
2. `PATCH /games/{game_id}/blinds` accepts partial updates: `small_blind`, `big_blind`, `blind_timer_paused`, `blind_timer_started_at`
3. Updating blind amounts resets `blind_timer_started_at` to now (new level countdown starts)
4. Pausing stores the remaining seconds; resuming restarts the countdown from remaining
5. Tests cover advance, pause, resume, and read scenarios

### S-3.5 — Retrieve Hand Actions Endpoint

**As a** client, **I want** to fetch all actions for a hand, **so that** the betting history can be displayed and used for analytics.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}/actions` returns an array of action records ordered by `created_at`
2. Each record includes: `player_name`, `street`, `action`, `amount`, `created_at`
3. Returns an empty list for a hand with no actions
4. Returns 404 for missing game or hand

---

## Epic 4: Auto-Detection & Dealer Review

Automatically determine hand winners from the existing equity calculator, infer the outcome street from community card count, and provide the dealer with a full editable review screen before any results are finalized. The dealer always has edit access over all game state.

### S-4.1 — Auto-Detect Winners from Equity

**As a** dealer, **I want** the system to auto-determine hand winners when showdown data is available, **so that** I don't have to manually figure out who won.

**Acceptance Criteria:**
1. When all 5 community cards are recorded and ≥ 2 non-folded players have hole cards, the frontend calls `GET /equity` and maps: equity ≈ 1.0 → `won`, equity ≈ 0.0 → `lost`, split equity → `won` (tied)
2. If all players except one have folded, the remaining player is auto-assigned `won` (no equity calc needed)
3. Outcome street is inferred: 3 community cards → `flop`, 4 → `turn`, 5 → `river`
4. Auto-detected results are proposed, not saved — dealer must confirm via the review screen
5. When equity is inconclusive — fewer than 5 community cards, missing hole cards, or ambiguous ties — the system falls back to the editable review screen (S-4.2) with blank/unresolved results for the dealer to manually assign winners; the equity-based auto-detection and the manual review are two halves of the same flow, not separate paths

### S-4.2 — Dealer Review & Edit Screen

**As a** dealer, **I want** a full editable review screen showing all player states, cards, board, and auto-detected outcomes before final save, **so that** I can correct any errors before committing.

**Acceptance Criteria:**
1. Review screen displays: community cards, each player's hole cards, proposed result (won/lost/folded), and outcome street
2. Dealer can tap any card to edit it (reuses `CardPicker` component)
3. Dealer can override any result via dropdown or button (won/lost/folded)
4. Dealer can edit the outcome street for any player
5. "Confirm & Save" button batches all changes to existing PATCH endpoints (`patchPlayerResult`, `edit_community_cards`, `updateHolecards`)
6. "Cancel" returns to the active hand dashboard without saving

### S-4.3 — Showdown Trigger

**As a** dealer, **I want** a "Showdown" button to trigger the auto-detection process, **so that** I control when the system evaluates the hand.

**Acceptance Criteria:**
1. "Showdown" button appears when community cards are recorded and ≥ 2 non-folded players have hole cards
2. Tapping it runs auto-detection logic and navigates to the review screen with proposed results
3. Button is disabled with a tooltip when insufficient data is available
4. If only one non-folded player remains, auto-award win and go directly to review

### S-4.4 — End Hand with Terminal State Check

**As a** dealer, **I want** the hand to be finishable only when all players are in a terminal state, **so that** no unresolved players are left behind.

**Acceptance Criteria:**
1. "Finish Hand" button on the review screen is enabled only when every `PlayerHand` has a non-null `result`
2. Finishing saves all results, returns to the hand dashboard, and increments hand count
3. A confirmation dialog summarizes the hand outcomes before committing
4. Players who never acted and have no cards are auto-assigned `result = "folded"` (assumption: they silently folded preflop)

### S-4.5 — Top-N OCR Predictions in Card Correction

**As a** dealer, **I want** the card correction screen to show the top 3–5 OCR prediction alternatives ranked by confidence, **so that** I can quickly tap the correct card instead of browsing all 52 cards.

**Acceptance Criteria:**
1. When the dealer taps a detected card to correct it, the correction UI shows the top-N (3–5) alternative predictions from the OCR model, ranked by confidence score
2. Each alternative is displayed as a card face with its confidence percentage (e.g., "K♠ 82%", "K♥ 71%", "Q♠ 45%")
3. Tapping an alternative selects it immediately (same as tapping in the full `CardPicker`)
4. A "More…" / "All Cards" button expands to the full 52-card `CardPicker` if none of the predictions are correct
5. If the backend detection endpoint does not return confidence scores, fall back to showing the full `CardPicker` directly
6. Mobile-first: alternatives are large touch targets (min 48px), horizontally scrollable if needed

### S-4.6 — Image Local Preview Before OCR

**As a** dealer, **I want** to see a local preview of the captured image immediately after taking a photo (before sending to the backend for OCR), **so that** I can verify image quality and retake if the photo is blurry or misframed.

**Acceptance Criteria:**
1. After the camera captures an image, a full-screen preview is displayed with "Use Photo" and "Retake" buttons
2. The preview renders from the local blob/data-URL — no backend round-trip required
3. "Use Photo" sends the image to the backend for OCR detection and continues the normal flow
4. "Retake" discards the image and re-opens the camera
5. Preview includes a brief quality indicator (image resolution, file size) so the dealer can judge sharpness
6. Mobile-first: buttons are large and thumb-accessible at the bottom of the screen

---

## Epic 5: New Dealer Interface (Rebuilt, Mobile-First)

Full rebuild of the dealer interface from scratch — mobile-first, player-participation-only, no dealer-centric references. All components are React TSX with TypeScript. Retains shared components (`CameraCapture`, `DetectionReview`, `CardPicker`).

### S-5.1 — Dealer App Shell (Rebuilt)

**As a** dealer, **I want** a clean mobile-first dealer interface that only supports player participation mode, **so that** the experience is streamlined and fast.

**Acceptance Criteria:**
1. `DealerApp` is rebuilt with steps: Game Selection → Game Dashboard (player management + hand list) → Active Hand → Review
2. No mode toggle, no dealer-centric code paths
3. Large touch targets (min 48px), one-thumb accessible navigation
4. State management uses the Zustand store (simplified for single-mode)
5. Component renders without errors; React Testing Library render test exists

### S-5.2 — Player Management UI

**As a** dealer, **I want** a player management screen to add/remove/reactivate players mid-game, **so that** I control the roster before each hand.

**Acceptance Criteria:**
1. Accessible from the Game Dashboard via a "Manage Players" button
2. Lists all game players with active/inactive status (toggle switches)
3. An "Add Player" text input + button allows adding new players (calls `POST /games/{id}/players`)
4. Toggling inactive → active calls `PATCH .../players/{name}/status` with `{ "is_active": true }` and vice versa
5. Changes are reflected immediately via React state; the hand start flow uses the updated roster

### S-5.3 — Active Hand Dashboard

**As a** dealer during a hand, **I want** to see all player tiles with participation status, the board state, and blind info, **so that** I have full table awareness.

**Acceptance Criteria:**
1. Player tiles show: name, participation status (pending/joined/folded/acted), last action and amount if any
2. Board area shows community cards as captured (empty slots → flop → turn → river)
3. Blind info bar: current level, countdown timer, SB/BB player names
4. "Take Flop" / "Take Turn" / "Take River" buttons for community card capture
5. "Showdown" button when conditions are met
6. Polling updates tile states every 3 seconds via `GET .../hands/{num}/status`

### S-5.4 — Dealer Community Card Capture (Rebuilt)

**As a** dealer, **I want** to photograph community cards one street at a time (flop=3, turn=1, river=1), **so that** the board is recorded incrementally.

**Acceptance Criteria:**
1. "Take Flop" opens `CameraCapture` → `DetectionReview` expecting 3 cards; PATCHes to `/flop`
2. "Take Turn" (enabled after flop) opens capture expecting 1 card; PATCHes to `/turn`
3. "Take River" (enabled after turn) opens capture expecting 1 card; PATCHes to `/river`
4. Board area updates in real-time after each capture
5. Each button shows ✅ once its street is recorded

### S-5.5 — Blind Display & Timer UI

**As a** dealer, **I want** to see the current blind level with a countdown timer and controls, **so that** I know when to announce blind increases.

**Acceptance Criteria:**
1. Blind level displayed: "Blinds: $0.10 / $0.20"
2. Countdown timer shows minutes:seconds remaining in current level (15 min default)
3. Pause/resume button controls the timer; state persisted to backend via `PATCH /games/{id}/blinds`
4. When timer expires, prompt dealer to advance blinds (double previous); advancing resets timer
5. SB/BB indicators show which players are in blind positions for the current hand

### S-5.6 — Split-Screen Dealer Input Layout

**As a** dealer on a larger mobile screen or tablet, **I want** a split-screen layout showing the board/community cards and the player tiles simultaneously, **so that** I can see both without scrolling during active play.

**Acceptance Criteria:**
1. When viewport width ≥ 600px (tablet/large phone landscape), the Active Hand view uses a split layout: top half = board area (community cards + capture buttons), bottom half = player tiles grid
2. On narrow viewports (< 600px), the layout falls back to the existing stacked/scrollable single-column view
3. Both halves scroll independently if content overflows
4. Blind info bar remains fixed/sticky at the top above both halves
5. Layout is implemented with CSS grid or flexbox — no JavaScript layout calculations
6. React Testing Library test verifies both layouts render at different viewport widths (mocked via container width)

---

## Epic 6: Player Onboarding & Decision Interface

Simplify player onboarding (single QR, session pinning), and add a live interactive menu with fold/check/call/bet/raise actions and a visual chip picker. Mobile-first.

### S-6.1 — Single QR Code for Current Game

**As a** player, **I want** to scan one QR code that lands me directly in the player menu for the active game, **so that** I don't have to navigate menus or type URLs.

**Acceptance Criteria:**
1. QR code on the dealer screen encodes `<host>/player?game=<gameId>` (using React Router paths)
2. Only ONE QR code is generated for the currently active game
3. When `?game=<id>` is in the URL, game selection is auto-skipped (React Router query param)
4. QR code is prominently displayed on the Game Dashboard (before hands start)
5. "Show/Hide QR" toggle prevents clutter during active play

### S-6.2 — Player Session Pinning

**As a** player, **I want** my game and name selection persisted so that page refreshes don't kick me back to the selection screens, **so that** my experience is uninterrupted during play.

**Acceptance Criteria:**
1. After selecting game + name, the selection is stored in `sessionStorage` (or `localStorage`)
2. On page load, if stored game is still active, the player returns directly to the playing screen
3. If the stored game is no longer active or not found, clear storage and show the game selector
4. A "Leave Game" button explicitly clears the stored session and returns to the selector
5. Test verifies persistence across simulated refreshes

### S-6.3 — Chip Picker Component

**As a** player, **I want** a visual chip picker with colored chip buttons (White=$0.10, Red=$0.20, Green=$0.30, Blue=$0.40, Black=$0.50), **so that** I can quickly build a bet amount by tapping chips.

**Acceptance Criteria:**
1. Five colored circular buttons, each labeled with denomination: White $0.10, Red $0.20, Green $0.30, Blue $0.40, Black $0.50
2. Each tap adds the denomination to a running total displayed prominently (e.g., "$0.70")
3. A "Clear" button resets the total to $0.00
4. A "Confirm" button submits the total as the bet/raise amount
5. Mobile-first: large touch targets (min 56px diameter), readable denominations

### S-6.4 — Player Action Buttons (Fold / Check / Call / Bet / Raise)

**As a** player, **I want** clear action buttons on my hand screen so that I can signal my decision each street, **so that** my actions are tracked and the game progresses smoothly.

**Acceptance Criteria:**
1. After submitting hole cards, the player sees action buttons: Fold, Check, Call, Bet, Raise
2. Fold sends `POST .../actions` with `{ "action": "fold" }` and updates player state to "folded"
3. Check sends `{ "action": "check" }`
4. Call sends `{ "action": "call" }` (no chip picker — amount is implicit)
5. Bet/Raise opens the chip picker; confirming sends `{ "action": "bet"/"raise", "amount": <total> }`
6. After acting, buttons are disabled until the next street becomes available (detected via polling when new community cards appear)
7. Street is auto-determined from the current community card state: 0 cards → preflop, 3 → flop, 4 → turn, 5 → river

### S-6.5 — Player Blind & Position Display

**As a** player, **I want** to see who is small blind and big blind on my screen, **so that** I know the current positions and forced bets.

**Acceptance Criteria:**
1. Current hand's SB/BB player names are displayed above the action buttons (data from `HandResponse.sb_player_name` / `bb_player_name`)
2. If the current player IS the SB or BB, the label is highlighted prominently
3. Current blind amounts are shown: "Blinds: $0.10 / $0.20"
4. Display updates when blind level changes (via game state polling)

---

## Epic 7: Player 3D Visualization

A separate "Table View" screen accessible from the player menu where players can see a mobile-first 3D poker table with their hand, the board, and adjusted equity — plus a hand scrubber to review previous hands. Showdown reveals opponents' cards.

### S-7.1 — Player Table View Screen

**As a** player, **I want** a "Table View" screen with a 3D poker table showing my cards and the board, **so that** I can visualize the game state in an immersive way.

**Acceptance Criteria:**
1. A "Table View" tab/button is accessible from the player playing screen
2. Renders a mobile-first Three.js scene reusing `pokerScene.ts`
3. The player's own hole cards are face-up; all other players' cards are face-down
4. Community cards are displayed as they become available
5. Touch-enabled orbit controls for rotation; default view centers on the player's own seat
6. "Back to Hand" button returns to the action/decision screen

### S-7.2 — Adjusted Equity Display (Player Perspective)

**As a** player, **I want** to see my equity calculated from only my cards and the board (opponents unknown), **so that** I know my odds without seeing anyone else's hand.

**Acceptance Criteria:**
1. Call the existing `GET /equity` endpoint with only the current player's hole cards vs. unknown opponents
2. Display equity as a percentage overlay near the player's cards in the 3D view (e.g., "62%")
3. Equity recalculates when new community cards appear
4. If no community cards exist, show preflop equity (hole cards vs. random hands)
5. Equity display is optional — a toggle hides/shows it

### S-7.3 — Showdown Card Reveals

**As a** player, **I want** to see the hole cards of all players who went to showdown in my 3D table view, **so that** I can see the final hands.

**Acceptance Criteria:**
1. When a hand's results include `won` or `lost` (showdown occurred), all non-folded players' cards are revealed in the 3D scene
2. The winner's cards have a glow animation (existing `holeCards.ts` pattern)
3. Folded players remain face-down with a "FOLD" sprite
4. Card reveals happen when the player scrubs to or polls a finalized hand

### S-7.4 — Player Game Scrubber

**As a** player, **I want** a range slider to scrub through all hands of the current game, **so that** I can review previous hands while waiting.

**Acceptance Criteria:**
1. A range slider at the bottom of the Table View shows "Hand X / Y"
2. Dragging the slider loads the selected hand's data and updates the 3D scene
3. The slider defaults to the latest hand
4. Touch-friendly: min 48px slider thumb on mobile
5. Scrubbing fetches hand data from the existing `GET /games/{id}/hands/{num}` endpoint

---

## Epic 8: Visualization Improvements (Mobile-First)

Upgrade the 3D visualization across all views (mobile playback, desktop playback, player table view) with a range slider scrubber, seat-snap camera, and live hand updates. All improvements are mobile-first.

### S-8.1 — Range Slider Scrubber

**As a** user, **I want** a draggable range slider to scrub through hands instead of button-only navigation, **so that** navigating 44+ hands is fast and fluid.

**Acceptance Criteria:**
1. `SessionScrubber` component gains an `<input type="range">` slider alongside the existing prev/next buttons
2. Dragging the slider smoothly scrubs through hands
3. Slider thumb is min 48px for mobile touch targets
4. Current hand number and total are displayed as a label
5. Applied to: `MobilePlaybackView`, desktop `playbackView`, and player Table View

### S-8.2 — Seat-Snap Camera View

**As a** user, **I want** to tap a player's seat to snap the 3D camera to their perspective, **so that** I can see the table from different angles.

**Acceptance Criteria:**
1. Tapping a seat label in the 3D scene triggers a smooth camera animation (300–500ms) to that seat's perspective
2. A "Reset View" button returns to the default overhead camera position
3. In player Table View, the camera defaults to the player's own seat on load
4. Works on mobile (tap) and desktop (click)
5. Camera positions are computed from existing seat positions in `tableGeometry.ts`

### S-8.3 — Live Hand Updates Without Refresh

**As a** user viewing the 3D scene, **I want** the visualization to auto-update when new hand data arrives, **so that** I don't have to refresh or navigate away.

**Acceptance Criteria:**
1. The visualization polls for hand list/data every 10 seconds
2. When a new hand is detected or existing hand data changes, the scene updates seamlessly (no page refresh, no scroll reset)
3. If the user is on the latest hand, new hands auto-advance the view
4. If the user is scrubbing through older hands, new data is noted ("New hand available") but doesn't disrupt the current view
5. Polling uses `AbortController` for clean unmount; transient network errors are silently retried

---

## Epic 9: Infrastructure Stabilization

Reduce polling overhead, add fine-grained timestamps for debugging, and fix known responsiveness issues.

### S-9.1 — Polling Optimization

**As a** developer, **I want** polling intervals tuned and conditional requests implemented, **so that** server load is reduced and the app feels responsive.

**Acceptance Criteria:**
1. Dealer polling: 3s (time-critical, no change)
2. Player status polling: 5s (increased from 3s)
3. Visualization polling: 10s (new, per S-8.3)
4. Backend hand status endpoint returns `ETag` header; clients skip re-rendering on 304 responses
5. `AbortController` properly cancels in-flight requests on component unmount across all polling loops
6. Transient network errors show a subtle indicator ("reconnecting…") rather than a blocking error message

### S-9.2 — Fine-Grained Timestamps & Logging

**As a** developer, **I want** millisecond-precision timestamps on API responses and structured request logging, **so that** I can diagnose latency and trace issues.

**Acceptance Criteria:**
1. A FastAPI middleware adds `X-Request-Id` (UUID) and `X-Response-Time-Ms` headers to every response
2. Structured log output includes: request ID, method, path, status code, and duration in ms
3. All `created_at` fields use `datetime.now(timezone.utc)` with full precision (already the case — verify)
4. Frontend logs poll cycle durations to `console.debug` in dev mode
5. No performance regression from the middleware (< 1ms overhead)

---

## Epic 10: Hand Turn-Order State Machine

A server-side state machine that tracks the current phase and active player within each hand, enforcing that actions are recorded in the correct turn order. Enables the frontend to query "whose turn is it?" and prevents out-of-order action recording.

### S-10.1 — Hand State Machine Table & Model

**As a** developer, **I want** a `hand_states` table to track the current phase, action pointer, and turn order for each hand, **so that** the system can enforce sequential play and expose turn information to clients.

**Acceptance Criteria:**
1. New `hand_states` table: `hand_state_id` (PK), `hand_id` (FK → hands, unique), `phase` (string: preflop/flop/turn/river/showdown), `current_seat` (integer, nullable — the seat_number of the player whose turn it is), `action_index` (integer, default 0 — sequential counter within the phase), `updated_at` (datetime)
2. Alembic migration creates the table; `HandState` SQLAlchemy model defined with relationship to `Hand`
3. A `HandState` row is auto-created when a hand is started via `POST /games/{id}/hands/start` (initial phase = `preflop`, current_seat = first-to-act seat)
4. First-to-act is the seat after BB (3+ players) or SB (heads-up)
5. Tests verify table creation, auto-creation on hand start, and initial state values

### S-10.2 — Turn Order Enforcement & Query Endpoints

**As a** dealer/player, **I want** the system to enforce turn order when actions are recorded and let me query whose turn it is, **so that** the game progresses in the correct sequence.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}/state` returns `{ phase, current_seat, current_player_name, action_index }`
2. `POST .../players/{name}/actions` validates that it is the named player's turn; returns 409 ("not your turn") if the action is out of order
3. After a valid action, `current_seat` advances to the next non-folded active player (clockwise by seat_number)
4. When all non-folded players have acted in a phase, the phase advances automatically (preflop→flop, etc.) and `current_seat` resets to the first-to-act for the new phase
5. Phase cannot advance past the number of community cards dealt (e.g., can't enter `flop` phase until 3 community cards are recorded)
6. Dealer can override turn order via a `force` query parameter on the action endpoint (for corrections)
7. Tests cover: normal rotation, fold skipping, phase advancement, heads-up edge case, dealer force override, out-of-order rejection

---

## Appendix: Nice-to-Haves (Deferred — No Beads)

The following items surfaced during planning but are deferred to future work. They will **not** be tracked as beads tasks for this project.

| Item | Description | Rationale for Deferral |
|---|---|---|
| Dealer-Player Dual-UID | Separate authentication identity for dealer vs. player roles per person | Low priority — current single-identity model works for home games; adds auth complexity |
| Batch "All Cards Dealt" Confirmation | A single button to confirm all detected cards for all players at once instead of per-player | Convenience feature — per-player review is more accurate; can add later if flow is too slow |
| Drink Tracker | Track drinks ordered per player per session for settlement at end of night | Fun but out of scope for core poker tracking; can be added as a lightweight plugin later |
