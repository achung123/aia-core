# Tasks — Analytics Dashboard

**Project ID:** analytics-dashboard-007
**Date:** 2026-04-12
**Total Tasks:** 28
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Pydantic models for analytics endpoints | setup | none | S-5.1, S-3.5, S-4.1, S-5.3 |
| T-002 | Player career trend endpoint | feature | T-001 | S-5.1 |
| T-003 | Shared hands query helper | feature | none | S-5.2 |
| T-004 | Head-to-head endpoint | feature | T-001, T-003 | S-3.5 |
| T-005 | Awards engine endpoint | feature | T-001 | S-4.1 |
| T-006 | Game highlights endpoint | feature | T-001 | S-5.3 |
| T-007 | Backend test suite for trend endpoint | test | T-002 | S-5.1 |
| T-008 | Backend test suite for head-to-head endpoint | test | T-004 | S-3.5 |
| T-009 | Backend test suite for awards endpoint | test | T-005 | S-4.1 |
| T-010 | Backend test suite for highlights endpoint | test | T-006 | S-5.3 |
| T-011 | TanStack Query setup + analytics API hooks | setup | none | S-2.1, S-3.1 |
| T-012 | CardIcon component | feature | none | S-1.2 |
| T-013 | PlayerSelector component | feature | T-011 | S-2.1, S-3.1 |
| T-014 | StatCard and AwardCard components | feature | none | S-1.3, S-4.2 |
| T-015 | Game list page and recap route shell | feature | T-011 | S-1.1 |
| T-016 | Single-game player summary cards | feature | T-014, T-015 | S-1.3 |
| T-017 | Hand-by-hand timeline component | feature | T-012, T-015 | S-1.2 |
| T-018 | Key moments highlights section | feature | T-006, T-015 | S-1.4 |
| T-019 | Session awards banner on recap page | feature | T-005, T-014, T-015 | S-4.3 |
| T-020 | Player profile page shell + career stats | feature | T-011, T-013, T-014 | S-2.1 |
| T-021 | Win rate trend line chart | feature | T-002, T-020 | S-2.2 |
| T-022 | Outcome distribution donut charts | feature | T-020 | S-2.3 |
| T-023 | Session history sortable table | feature | T-020 | S-2.4 |
| T-024 | Head-to-head page shell + player picker | feature | T-004, T-011, T-013 | S-3.1 |
| T-025 | Showdown record + fold behavior cards | feature | T-024 | S-3.2, S-3.3 |
| T-026 | Street-level rivalry chart | feature | T-024 | S-3.4 |
| T-027 | Awards grid page | feature | T-005, T-011, T-014 | S-4.2 |
| T-028 | Frontend test suite for dashboard components | test | T-012, T-013, T-014, T-017 | S-1.2, S-2.1, S-3.1 |

---

## Task Details

### T-001 — Pydantic models for analytics endpoints

**Category:** setup
**Dependencies:** none
**Story Ref:** S-5.1, S-3.5, S-4.1, S-5.3

Define all new Pydantic v2 response models in `src/pydantic_models/app_models.py` for the four new analytics endpoints: career trends, head-to-head, awards, and highlights.

**Acceptance Criteria:**
1. `PlayerSessionTrend` model with fields: `game_id`, `game_date`, `hands_played`, `hands_won`, `win_rate`, `profit_loss`
2. `HeadToHeadResponse` model with fields: `player1_name`, `player2_name`, `shared_hands_count`, `showdown_count`, `player1_showdown_wins`, `player2_showdown_wins`, `player1_fold_count`, `player2_fold_count`, `player1_fold_rate`, `player2_fold_rate`, `street_breakdown` (list of street-level objects)
3. `AwardEntry` model with fields: `award_name`, `emoji`, `description`, `winner_name`, `stat_value`, `stat_label`
4. `GameHighlight` model with fields: `hand_number`, `highlight_type`, `description`
5. All models pass `uv run ruff check`

---

### T-002 — Player career trend endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-5.1

Implement `GET /stats/players/{player_name}/trends` that returns per-session win rate and stats in chronological order.

**Acceptance Criteria:**
1. Endpoint queries all `PlayerHand` records for the player, grouped by `game_id`
2. Returns a list of `PlayerSessionTrend` objects sorted by `game_date` ascending
3. Returns 404 if the player doesn't exist
4. Returns an empty list (200) if the player exists but has no game data
5. Win rate is calculated as `hands_won / total_hands * 100` per session

---

### T-003 — Shared hands query helper

**Category:** feature
**Dependencies:** none
**Story Ref:** S-5.2

Create a reusable query function `get_shared_hands(db, player1_id, player2_id)` in the database layer that returns all hands where both players participated.

**Acceptance Criteria:**
1. Function lives in `src/app/database/queries.py` (create if it doesn't exist)
2. Returns a list of tuples: `(Hand, PlayerHand_p1, PlayerHand_p2)`
3. "Participated" means a `PlayerHand` record exists (regardless of result)
4. Results are ordered by `hand.hand_number` ascending within each game
5. Includes a unit test with 3 scenarios: both present, one absent from a hand, both fold vs one wins

---

### T-004 — Head-to-head endpoint

**Category:** feature
**Dependencies:** T-001, T-003
**Story Ref:** S-3.5

Implement `GET /stats/head-to-head?player1={name}&player2={name}` that returns full rivalry stats.

**Acceptance Criteria:**
1. Uses `get_shared_hands()` to find all hands where both players participated
2. Computes showdown stats (hands where both players have a non-fold result)
3. Computes fold behavior (how often each player folded in shared hands)
4. Computes street-level breakdown: how many shared hands ended at each street, with win/loss per player
5. Players matched case-insensitively; returns 404 if either doesn't exist
6. Returns the `HeadToHeadResponse` schema

---

### T-005 — Awards engine endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-4.1

Implement `GET /stats/awards?game_id={optional}` that computes and returns auto-generated superlative awards.

**Acceptance Criteria:**
1. Computes at least 8 awards: Iron Man, Sniper, Paper Hands, Diamond Hands, River Rat, One and Done, Streak King, Showdown Magnet
2. When `game_id` is provided, awards are scoped to that single session
3. When `game_id` is omitted, awards are computed across all games
4. Minimum thresholds applied (e.g. Sniper requires ≥ 20 hands) to avoid meaningless awards
5. Returns a list of `AwardEntry` objects; omits awards that can't be computed for the dataset
6. If P&L data is available, includes Big Stack and Degen awards

---

### T-006 — Game highlights endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-5.3

Implement `GET /stats/games/{game_id}/highlights` that returns 3-5 notable hands from a session.

**Acceptance Criteria:**
1. Returns an array of `GameHighlight` objects
2. Selection criteria: hand with most non-fold players; hand(s) reaching river with 3+ active; first hand in longest win streak
3. Returns 1-5 highlights; returns empty for games with < 3 hands
4. Returns 404 if the game doesn't exist

---

### T-007 — Backend test suite for trend endpoint

**Category:** test
**Dependencies:** T-002
**Story Ref:** S-5.1

Write pytest tests for the `/stats/players/{name}/trends` endpoint.

**Acceptance Criteria:**
1. Test: player with multiple sessions returns correct per-session stats
2. Test: player with no games returns empty list
3. Test: nonexistent player returns 404
4. Test: win rate calculation is correct (e.g. 2 wins out of 5 = 40.0)
5. Tests use the in-memory SQLite fixture from `conftest.py`

---

### T-008 — Backend test suite for head-to-head endpoint

**Category:** test
**Dependencies:** T-004
**Story Ref:** S-3.5

Write pytest tests for the `/stats/head-to-head` endpoint.

**Acceptance Criteria:**
1. Test: two players with shared hands returns correct showdown counts
2. Test: fold behavior stats are accurate
3. Test: street-level breakdown matches expected distribution
4. Test: nonexistent player returns 404
5. Test: case-insensitive player name matching works
6. Tests use the in-memory SQLite fixture from `conftest.py`

---

### T-009 — Backend test suite for awards endpoint

**Category:** test
**Dependencies:** T-005
**Story Ref:** S-4.1

Write pytest tests for the `/stats/awards` endpoint.

**Acceptance Criteria:**
1. Test: global awards return at least 4 awards with valid data
2. Test: game-scoped awards (`?game_id=X`) only consider hands from that game
3. Test: minimum thresholds are enforced (player with 2 hands doesn't get Sniper)
4. Test: each award has non-empty `winner_name`, `emoji`, and `description`
5. Tests use the in-memory SQLite fixture from `conftest.py`

---

### T-010 — Backend test suite for highlights endpoint

**Category:** test
**Dependencies:** T-006
**Story Ref:** S-5.3

Write pytest tests for the `/stats/games/{id}/highlights` endpoint.

**Acceptance Criteria:**
1. Test: game with 10+ hands returns 3-5 highlights
2. Test: game with 2 hands returns empty list
3. Test: nonexistent game returns 404
4. Test: highlight types are valid enum values
5. Tests use the in-memory SQLite fixture from `conftest.py`

---

### T-011 — TanStack Query setup + analytics API hooks

**Category:** setup
**Dependencies:** none
**Story Ref:** S-2.1, S-3.1

Install TanStack Query, configure the `QueryClientProvider`, and create typed custom hooks for all analytics endpoints.

**Acceptance Criteria:**
1. `@tanstack/react-query` is added to `package.json`
2. `QueryClientProvider` wraps the app in the root component
3. Hooks created: `usePlayerTrends(name)`, `useHeadToHead(p1, p2)`, `useAwards(gameId?)`, `useGameHighlights(gameId)`, `usePlayerStats(name)`, `useGameStats(gameId)`
4. Each hook returns typed data matching the backend Pydantic models
5. Hooks handle loading, error, and empty states

---

### T-012 — CardIcon component

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.2

Build a `CardIcon` React component that renders a mini playing card from a card string (e.g. "AH", "10C").

**Acceptance Criteria:**
1. Component accepts a `card` prop (string like "AH", "10C", "KD")
2. Renders a small card with rank and suit symbol in the correct color (red for hearts/diamonds, black for spades/clubs)
3. Handles edge cases: null/undefined renders nothing, invalid string shows a placeholder
4. Component has a test file with basic render tests

---

### T-013 — PlayerSelector component

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-2.1, S-3.1

Build a reusable `PlayerSelector` autocomplete/dropdown component that fetches the player list and lets the user pick a player.

**Acceptance Criteria:**
1. Fetches player names from the existing `/players` or `/stats/leaderboard` endpoint
2. Supports type-ahead filtering
3. Calls an `onSelect(playerName)` callback when a player is chosen
4. Supports a `value` prop for controlled usage
5. Mobile-friendly: full-width input, large touch targets

---

### T-014 — StatCard and AwardCard components

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.3, S-4.2

Build `StatCard` and `AwardCard` reusable display components.

**Acceptance Criteria:**
1. `StatCard` accepts: `label`, `value`, `trend` (optional: "up" | "down" | "neutral"), and renders a compact stat block
2. `AwardCard` accepts: `emoji`, `awardName`, `winnerName`, `statValue`, `statLabel`, and renders a visually engaging card
3. Both components handle null/zero values gracefully (muted style, "—" placeholder)
4. Both are responsive: stack vertically on mobile, inline on desktop
5. Basic render tests for each component

---

### T-015 — Game list page and recap route shell

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-1.1

Create the game list route (`/games`) and the recap page shell (`/games/:gameId/recap`) with data fetching.

**Acceptance Criteria:**
1. `/games` route lists all game sessions (date, player count, hand count) from the existing `/games` endpoint
2. Each game row links to `/games/:gameId/recap`
3. Recap page shell fetches game stats and hand data, shows loading skeleton while fetching
4. Mobile-first layout: single-column, with sections for summaries, timeline, highlights, and awards
5. Routes are registered in the React Router config

---

### T-016 — Single-game player summary cards

**Category:** feature
**Dependencies:** T-014, T-015
**Story Ref:** S-1.3

Render per-player summary cards at the top of the game recap page.

**Acceptance Criteria:**
1. A scrollable row of `StatCard`-based player cards showing: name, hands played, wins, losses, folds, win rate
2. Game winner(s) are visually highlighted (trophy icon or gold border)
3. P&L shows actual value when > 0, shows muted "—" when zero/null
4. Data comes from the `/stats/games/{id}` response (`player_stats` array)

---

### T-017 — Hand-by-hand timeline component

**Category:** feature
**Dependencies:** T-012, T-015
**Story Ref:** S-1.2

Build the vertical hand timeline for the game recap page.

**Acceptance Criteria:**
1. Each hand renders as a timeline card: hand number, community cards (via `CardIcon`), and winner name
2. Tapping/clicking a card expands it to show all players' hole cards, results, and outcome street
3. Community cards only render streets that exist (no empty slots for missing turn/river)
4. Timeline is scrollable; selected hand is highlighted
5. Mobile: full-width cards. Desktop: centered column with timeline connector lines

---

### T-018 — Key moments highlights section

**Category:** feature
**Dependencies:** T-006, T-015
**Story Ref:** S-1.4

Add a "Key Moments" section to the game recap page, powered by the highlights endpoint.

**Acceptance Criteria:**
1. Section fetches from `/stats/games/{id}/highlights`
2. Renders 3-5 highlight chips/cards with type icon and description
3. Clicking a highlight scrolls the hand timeline to that hand number
4. Gracefully handles empty highlights (section hidden)

---

### T-019 — Session awards banner on recap page

**Category:** feature
**Dependencies:** T-005, T-014, T-015
**Story Ref:** S-4.3

Add a session awards banner to the game recap page showing the top 3 awards for that game.

**Acceptance Criteria:**
1. Fetches from `/stats/awards?game_id={id}`
2. Renders up to 3 `AwardCard` components in a horizontal row (mobile: scrollable)
3. Each card links to the winner's player profile page
4. If fewer than 3 awards, renders what's available; if none, section is hidden

---

### T-020 — Player profile page shell + career stats

**Category:** feature
**Dependencies:** T-011, T-013, T-014
**Story Ref:** S-2.1

Build the `/players/:playerName` route with career stat summary.

**Acceptance Criteria:**
1. Route renders a player profile page with a `PlayerSelector` to switch players
2. Fetches from `/stats/players/{name}` and displays total hands, win/loss/fold, win rate, P&L, and street percentages using `StatCard` components
3. Zero/null values shown gracefully
4. Page title updates to show the selected player's name
5. Mobile-first single-column layout

---

### T-021 — Win rate trend line chart

**Category:** feature
**Dependencies:** T-002, T-020
**Story Ref:** S-2.2

Add a Recharts line chart to the player profile showing win rate per session over time.

**Acceptance Criteria:**
1. Fetches from `/stats/players/{name}/trends`
2. Plots win rate (0-100% Y-axis) against game date (X-axis)
3. Tooltip on hover shows: date, hands played, wins, win rate
4. Horizontal reference line at the player's all-time average win rate
5. Responsive: horizontal scroll on mobile if > 10 sessions

---

### T-022 — Outcome distribution donut charts

**Category:** feature
**Dependencies:** T-020
**Story Ref:** S-2.3

Add Recharts donut charts showing outcome and street-reach distributions on the player profile.

**Acceptance Criteria:**
1. Donut chart 1: won (green) / lost (red) / folded (grey) proportions
2. Donut chart 2: flop-only / turn / river reach percentages
3. Tooltips show counts and percentages
4. Charts render responsively; legends below on mobile, beside on desktop
5. Data derived from the existing `/stats/players/{name}` response fields

---

### T-023 — Session history sortable table

**Category:** feature
**Dependencies:** T-020
**Story Ref:** S-2.4

Add a sortable session history table to the player profile page.

**Acceptance Criteria:**
1. Table shows each game session: date, hands played, wins, losses, folds, win rate, P&L
2. Column headers are clickable to sort ascending/descending
3. Clicking a row navigates to `/games/:gameId/recap`
4. Paginated or virtualized if > 20 rows
5. Mobile: horizontally scrollable with first column frozen

---

### T-024 — Head-to-head page shell + player picker

**Category:** feature
**Dependencies:** T-004, T-011, T-013
**Story Ref:** S-3.1

Build the `/head-to-head` route with two player selectors and data fetching.

**Acceptance Criteria:**
1. Two `PlayerSelector` components for choosing Player 1 and Player 2
2. A "Swap" button reverses the two selections
3. Fetches from `/stats/head-to-head?player1=X&player2=Y` when both are selected
4. Quick-pick buttons for recently compared pairs (stored in localStorage)
5. Placeholder message when fewer than 2 players selected

---

### T-025 — Showdown record + fold behavior cards

**Category:** feature
**Dependencies:** T-024
**Story Ref:** S-3.2, S-3.3

Render the showdown summary and fold behavior comparison on the head-to-head page.

**Acceptance Criteria:**
1. Hero section: "Player A vs Player B" with showdown win/loss tally
2. Split gauge / progress bar showing win ratio
3. Rivalry verdict label when one player dominates (> 60% win rate)
4. Fold behavior block: each player's fold rate in shared hands vs their overall fold rate
5. Fold comparison rendered as horizontal bar chart (Recharts BarChart)

---

### T-026 — Street-level rivalry chart

**Category:** feature
**Dependencies:** T-024
**Story Ref:** S-3.4

Add a street-level breakdown chart to the head-to-head page.

**Acceptance Criteria:**
1. Stacked bar chart (Recharts) showing shared hands by resolution street: pre-flop, flop, turn, river
2. Each street bar is split by Player A wins vs Player B wins
3. Tooltip shows hand count and win/loss per player at that street
4. Chart is responsive and readable on mobile

---

### T-027 — Awards grid page

**Category:** feature
**Dependencies:** T-005, T-011, T-014
**Story Ref:** S-4.2

Build the `/awards` route with the full awards grid.

**Acceptance Criteria:**
1. Fetches from `/stats/awards` (global) or `/stats/awards?game_id=X` via a game filter toggle
2. Renders a grid of `AwardCard` components: 1 column on mobile, 2-3 on desktop
3. Each card shows emoji, award name, winner name, and stat value
4. Clicking a card navigates to `/players/:winnerName`
5. Playful visual style with bold colors

---

### T-028 — Frontend test suite for dashboard components

**Category:** test
**Dependencies:** T-012, T-013, T-014, T-017
**Story Ref:** S-1.2, S-2.1, S-3.1

Write Vitest + React Testing Library tests for the shared dashboard components.

**Acceptance Criteria:**
1. `CardIcon` tests: renders correct suit color, handles null input
2. `PlayerSelector` tests: renders options, fires onSelect callback
3. `StatCard` tests: displays value, shows "—" for null
4. `AwardCard` tests: displays emoji and winner name
5. `HandTimeline` tests: renders correct number of hands, expands on click
6. All tests pass with `npx vitest run`

---

## Bugs / Findings

Issues discovered during implementation review cycles. Each finding references the source task and cycle where it was identified.

---

### BF-001 — [HIGH] Partial error handling in GameRecapPage

**Source:** aia-core-hvc (Cycle 15)

Only `statsQuery.isError` is checked in `GameRecapPage`; errors from `handsQuery`, `awardsQuery`, and `highlightsQuery` are silently swallowed, causing the UI to show "No data" instead of proper error messages.

**Fix:** Compose all query error states (e.g. derive a combined `isError` / `error` from all queries) and surface appropriate error messages for each failing query.

---

### BF-002 — [MEDIUM] Duplicated query logic in GameRecapPage

**Source:** aia-core-hvc (Cycle 15)

`GameRecapPage` manually constructs `useQuery` calls for game stats, awards, and highlights despite existing custom hooks (`useGameStats`, `useAwards`, `useGameHighlights`) already encapsulating that logic. Duplicated query keys risk diverging from the canonical hooks.

**Fix:** Replace inline `useQuery` calls with the existing custom hooks from T-011.

---

### BF-003 — [LOW] Array index used as React key

**Source:** aia-core-hvc (Cycle 15)

Highlight and award lists in `GameRecapPage` use `key={i}` (array index) instead of stable identifiers. This can cause incorrect reconciliation if the list order changes.

**Fix:** Use stable IDs when available (e.g. `award_name`, `hand_number`) as the key prop.

---

### BF-004 — [LOW] Inline styles throughout game pages

**Source:** aia-core-hvc (Cycle 15)

Both the game list page and recap page use `style={{}}` for layout and spacing instead of CSS modules or a shared styling approach.

**Fix:** Migrate inline styles to CSS modules in a future cleanup pass to improve maintainability and consistency.
