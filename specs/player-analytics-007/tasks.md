# Tasks — Player Analytics Dashboards

**Project ID:** player-analytics-007
**Date:** 2026-04-12
**Total Tasks:** 30
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Head-to-head Pydantic response models | setup | none | S-1.1 |
| T-002 | Head-to-head API endpoint | feature | T-001 | S-1.1 |
| T-003 | Head-to-head endpoint tests | test | T-002 | S-1.1 |
| T-004 | Session trends Pydantic models + endpoint | feature | none | S-1.2 |
| T-005 | Session trends endpoint tests | test | T-004 | S-1.2 |
| T-006 | Hand-level cumulative trends endpoint | feature | none | S-1.3 |
| T-007 | Hand-level trends endpoint tests | test | T-006 | S-1.3 |
| T-008 | Achievements config module + initial 10 definitions | feature | none | S-1.4, S-7.4 |
| T-009 | Achievements API endpoint | feature | T-008 | S-1.4 |
| T-010 | Achievements endpoint tests | test | T-009 | S-1.4 |
| T-011 | Enhanced game stats with key_moments | feature | none | S-1.5 |
| T-012 | Key moments tests | test | T-011 | S-1.5 |
| T-013 | Analytics API client types (TypeScript) | setup | T-002, T-004, T-006, T-009 | S-2.1 |
| T-014 | Analytics route structure + player picker | feature | T-013 | S-2.1 |
| T-015 | Player profile stats summary cards | feature | T-014 | S-2.2 |
| T-016 | Play style radar chart component | feature | T-014 | S-2.3 |
| T-017 | Recent games list on player profile | feature | T-014 | S-2.4 |
| T-018 | Game recap page shell + overview header | feature | T-013 | S-3.1 |
| T-019 | Player performance sortable table | feature | T-018 | S-3.2 |
| T-020 | Hand timeline multi-player line chart | feature | T-018 | S-3.3 |
| T-021 | Key moments highlight cards | feature | T-018, T-011 | S-3.4 |
| T-022 | Game night awards section | feature | T-018, T-011 | S-7.3 |
| T-023 | Filterable leaderboard page | feature | T-013 | S-4.1 |
| T-024 | Leaderboard sparklines | feature | T-023 | S-4.2 |
| T-025 | Head-to-head picker + summary page | feature | T-013 | S-5.1 |
| T-026 | Head-to-head game breakdown + shared hand details | feature | T-025 | S-5.2, S-5.3 |
| T-027 | Session-over-session trend charts | feature | T-014 | S-6.1 |
| T-028 | Hand-level drill-down from trend chart | feature | T-027 | S-6.2 |
| T-029 | Play style evolution slider/overlay | feature | T-016, T-027 | S-6.3 |
| T-030 | Achievement badge grid + detail modal | feature | T-014 | S-7.1, S-7.2 |

---

## Task Details

### T-001 — Head-to-head Pydantic response models

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Add Pydantic v2 response models for the head-to-head endpoint to `src/pydantic_models/app_models.py`. Models: `HeadToHeadResponse` (player1_name, player2_name, total_shared_hands, player1_wins, player2_wins, player1_folds, player2_folds, shared_hands list), `SharedHandSummary` (game_id, hand_number, player1_result, player2_result).

**Acceptance Criteria:**
1. `HeadToHeadResponse` and `SharedHandSummary` classes exist in `app_models.py`
2. All fields have explicit type annotations
3. Ruff passes with no errors

---

### T-002 — Head-to-head API endpoint

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.1

Implement `GET /stats/head-to-head?player1={name}&player2={name}` in the stats (or new analytics) router. Query all hands where both players have a `player_hand` row with a non-null result (excluding `handed_back`). Aggregate wins, folds, and collect shared hand references. Support optional `game_id` filter.

**Acceptance Criteria:**
1. Endpoint returns `HeadToHeadResponse`
2. Returns 404 if either player not found
3. `handed_back` results excluded
4. Optional `game_id` query param filters to a single session
5. Ruff passes

---

### T-003 — Head-to-head endpoint tests

**Category:** test
**Dependencies:** T-002
**Story Ref:** S-1.1

Write pytest tests for the head-to-head endpoint. Cover: two players with shared hands, no shared hands, unknown player name, `game_id` filter, `handed_back` exclusion.

**Acceptance Criteria:**
1. At least 5 test cases covering the scenarios listed
2. All tests pass with `uv run pytest test/test_head_to_head_api.py`
3. Tests use the in-memory DB fixture from `conftest.py`

---

### T-004 — Session trends Pydantic models + endpoint

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.2

Add `SessionTrendPoint` and implement `GET /stats/players/{name}/trends`. For each game session the player participated in, aggregate: hands_played, hands_won, hands_lost, hands_folded, win_rate, profit_loss, flop_seen_pct, turn_seen_pct, river_seen_pct. Return ordered by game_date. Support optional `date_from`/`date_to` filters.

**Acceptance Criteria:**
1. `SessionTrendPoint` model added to `app_models.py`
2. Endpoint returns `list[SessionTrendPoint]`
3. 404 if player not found
4. Sessions with 0 hands omitted
5. Date filters work correctly

---

### T-005 — Session trends endpoint tests

**Category:** test
**Dependencies:** T-004
**Story Ref:** S-1.2

Write pytest tests for the session trends endpoint. Cover: player with multiple sessions, date filtering, player with no sessions, unknown player.

**Acceptance Criteria:**
1. At least 4 test cases
2. All pass with `uv run pytest`
3. Verify response ordering by game_date

---

### T-006 — Hand-level cumulative trends endpoint

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.3

Implement `GET /stats/games/{game_id}/players/{name}/hand-trends`. For each hand the player participated in (ordered by hand_number), return cumulative_wins, cumulative_losses, cumulative_folds, cumulative_profit_loss, and the result for that hand.

**Acceptance Criteria:**
1. `HandTrendPoint` model added to `app_models.py`
2. Endpoint returns `list[HandTrendPoint]`
3. 404 if game or player not found
4. Only hands where the player has a result are included
5. Cumulative values are correct (verified by test)

---

### T-007 — Hand-level trends endpoint tests

**Category:** test
**Dependencies:** T-006
**Story Ref:** S-1.3

Write pytest tests for the hand-level cumulative trends endpoint. Cover: basic cumulative calculation, player not in game, unknown game_id.

**Acceptance Criteria:**
1. At least 3 test cases
2. All pass with `uv run pytest`
3. Cumulative math verified in assertions

---

### T-008 — Achievements config module + initial 10 definitions

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.4, S-7.4

Create `src/app/services/achievements.py` with a config-driven achievement system. Define a base structure: each achievement has `id`, `title`, `description`, `category`, and an `evaluator` callable that receives player data and returns `(earned: bool, context: dict)`. Implement at least 10 achievements: Fold King, River Rat, Hot Streak (3+ consecutive wins), Iron Player, First Blood, Showdown Specialist, Marathon Player (40+ hands in a session), Comeback Kid, Early Exit (left before hand 10), Perfect Session (100% win rate, min 5 hands).

**Acceptance Criteria:**
1. `achievements.py` exists in `src/app/services/`
2. At least 10 achievement definitions in a registry list/dict
3. Each evaluator is a callable with a consistent signature
4. Adding a new achievement requires only appending to the registry
5. Unit tests for at least 3 evaluators pass

---

### T-009 — Achievements API endpoint

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-1.4

Implement `GET /stats/players/{name}/achievements`. Fetch all player data needed by evaluators, run each evaluator, and return earned achievements as a list.

**Acceptance Criteria:**
1. `AchievementResponse` model added to `app_models.py`
2. Endpoint returns `list[AchievementResponse]`
3. 404 if player not found
4. Earned achievements include context (game_id, hand_number, etc.)
5. Unearned achievements are NOT returned (frontend shows locked state based on absence)

---

### T-010 — Achievements endpoint tests

**Category:** test
**Dependencies:** T-009
**Story Ref:** S-1.4

Write pytest tests for the achievements endpoint. Cover: player with qualifying data earns achievements, player with no data gets empty list, unknown player 404.

**Acceptance Criteria:**
1. At least 3 test cases
2. All pass with `uv run pytest`
3. At least one test verifies a specific achievement is earned with correct context

---

### T-011 — Enhanced game stats with key_moments

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.5

Extend the existing `GET /stats/games/{game_id}` response with a `key_moments` list. Detect at least 3 moment types: biggest pot (max absolute P&L in a hand), most-players-showdown (hand with most players reaching river), and "upset" (player with highest overall win rate in the session losing at river). Add `KeyMoment` model and `key_moments` field to `GameStatsResponse`.

**Acceptance Criteria:**
1. `KeyMoment` model added to `app_models.py`
2. `GameStatsResponse.key_moments` is a `list[KeyMoment]` (defaults to empty list for backward compat)
3. Existing response fields unchanged
4. At least 3 moment types detected

---

### T-012 — Key moments tests

**Category:** test
**Dependencies:** T-011
**Story Ref:** S-1.5

Write pytest tests for the key moments enhancement. Cover: game with identifiable key moments, game with no P&L data (biggest pot falls back gracefully), backward compatibility of existing fields.

**Acceptance Criteria:**
1. At least 3 test cases
2. All pass with `uv run pytest`
3. Existing game stats tests still pass unchanged

---

### T-013 — Analytics API client types (TypeScript)

**Category:** setup
**Dependencies:** T-002, T-004, T-006, T-009
**Story Ref:** S-2.1

Add TypeScript interfaces and API client functions for all new analytics endpoints in the frontend. Create `frontend/src/api/analyticsClient.ts` with typed functions: `fetchHeadToHead()`, `fetchPlayerTrends()`, `fetchHandTrends()`, `fetchPlayerAchievements()`. Define matching TS interfaces for all response types.

**Acceptance Criteria:**
1. `analyticsClient.ts` exists with all 4 functions + types
2. Uses the existing `VITE_API_BASE_URL` base from the API client
3. All functions return typed Promises
4. File compiles with zero TS errors

---

### T-014 — Analytics route structure + player picker

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-2.1

Create the analytics page shell with React Router nested routes: `/analytics` (picker), `/analytics/player/:name`, `/analytics/game/:id`, `/analytics/leaderboard`, `/analytics/head-to-head`. Build the player name picker component (dropdown/search). Add "Analytics" link to the main navigation.

**Acceptance Criteria:**
1. All 5 routes resolve and render a placeholder
2. Player picker fetches from `/players` and navigates to `/analytics/player/{name}`
3. Layout is responsive (stacked on mobile, sidebar/tabs on desktop)
4. Navigation link added to the main nav bar
5. Vitest test for the player picker component

---

### T-015 — Player profile stats summary cards

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-2.2

Build stat summary cards at the top of the player profile page. Show total hands, win rate %, fold rate %, total P&L. P&L shows "$0.00 — No P&L data" when all zero. Loading skeleton while data fetches.

**Acceptance Criteria:**
1. Four cards render with data from `/stats/players/{name}`
2. P&L zero-state handled with explanatory note
3. Loading skeleton component shown during fetch
4. Vitest test verifying card content rendering

---

### T-016 — Play style radar chart component

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-2.3

Build a Recharts `RadarChart` component showing play style dimensions: Aggression (win rate), Tightness (fold rate), Endurance (river seen %), Consistency, Volume. Each axis normalized to 0–100. Tooltip shows raw values.

**Acceptance Criteria:**
1. `RadarProfileChart` component renders with 5 axes
2. Normalization logic documented in component (or a util)
3. Tooltip functional on hover
4. Chart updates when player prop changes
5. Vitest test for normalization logic

---

### T-017 — Recent games list on player profile

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-2.4

Build a "Recent Games" list showing the player's last 10 sessions. Each row: game date, hands played, win count, W/L/F ratio bar, P&L. Clicking navigates to `/analytics/game/{id}`.

**Acceptance Criteria:**
1. List shows up to 10 sessions from the trends endpoint
2. W/L/F ratio rendered as a horizontal stacked bar (colored segments)
3. Rows are clickable and navigate correctly
4. Empty state message when player has no sessions

---

### T-018 — Game recap page shell + overview header

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-3.1

Build the game recap page at `/analytics/game/:id`. Header section shows: game date, total hands, player count, winner(s). Fetches from `/games` and `/stats/games/{id}`. Loading and 404 states handled.

**Acceptance Criteria:**
1. Route renders with game overview header
2. Winners displayed prominently
3. 404 state shows friendly message
4. Loading skeleton during fetch
5. Vitest test for header rendering

---

### T-019 — Player performance sortable table

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-3.2

Build a sortable table of player performance within a game session. Columns: name, hands played, wins, losses, folds, win rate, P&L. Click column headers to sort.

**Acceptance Criteria:**
1. Table renders all players from `/stats/games/{id}`
2. Sorting works on all 7 columns (toggle asc/desc)
3. Players with 0 hands still appear
4. Vitest test for sort behavior

---

### T-020 — Hand timeline multi-player line chart

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-3.3

Build a Recharts `LineChart` showing cumulative wins (or P&L) per hand for each player in a session. Fetch hand-trends for each player. Toggleable legend to show/hide player lines. Tooltip at hover.

**Acceptance Criteria:**
1. One line per player, distinguished by color
2. Legend click toggles player visibility
3. Tooltip shows all visible players' values at hovered hand
4. Handles sessions with many players (9+) with a scrollable legend
5. Vitest test for chart data transformation

---

### T-021 — Key moments highlight cards

**Category:** feature
**Dependencies:** T-018, T-011
**Story Ref:** S-3.4

Render key_moments from the enhanced game stats as styled cards below the hand timeline chart. Each card shows hand number, moment type, description, involved players. Clicking scrolls/highlights the hand on the timeline.

**Acceptance Criteria:**
1. Cards render from `key_moments` array
2. Moment type has a visual icon/badge
3. Click interaction highlights the hand number on the timeline
4. Graceful handling when there are no key moments

---

### T-022 — Game night awards section

**Category:** feature
**Dependencies:** T-018, T-011
**Story Ref:** S-7.3

Build a "Game Night Awards" section on the game recap page. Compute from game stats: Most Wins, Most Folds, Iron Player, Lucky River (most river wins), Cold Streak (most consecutive losses). Each award shows title, player name, stat value. Ties show all tied players.

**Acceptance Criteria:**
1. At least 5 awards displayed
2. Computed client-side from game stats data
3. Ties handled gracefully
4. Vitest test for award computation logic

---

### T-023 — Filterable leaderboard page

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-4.1

Build `/analytics/leaderboard` page. Metric toggle (Win Rate, P&L, Hands Played). Date range picker for filtering. Top 3 have gold/silver/bronze visual distinction. Table on desktop, cards on mobile.

**Acceptance Criteria:**
1. Leaderboard renders from `/stats/leaderboard` endpoint
2. Metric toggle switches the sorting/display metric
3. Top 3 visually distinct
4. Responsive: table ≥ 768px, cards < 768px
5. Vitest test for metric toggle behavior

---

### T-024 — Leaderboard sparklines

**Category:** feature
**Dependencies:** T-023
**Story Ref:** S-4.2

Add mini sparkline charts next to each leaderboard entry showing the player's win rate over their last 10 sessions. Fetch from trends endpoint per player. Degrade to "—" if < 2 sessions.

**Acceptance Criteria:**
1. Sparkline renders per leaderboard row
2. Fetches trend data lazily (or batched on page load)
3. Players with < 2 sessions show "—"
4. Sparklines don't dominate the row visually (small, muted)

---

### T-025 — Head-to-head picker + summary page

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-5.1

Build `/analytics/head-to-head` with two player pickers and a rivalry summary. Show total shared hands, each player's wins, and a visual "rivalry bar" showing who leads.

**Acceptance Criteria:**
1. Two player pickers (both default empty, must select both)
2. Summary cards show shared hands and wins per player
3. Rivalry bar visualizes the split (e.g. 60/40 colored bar)
4. Updates when either player selection changes
5. Vitest test for rivalry bar calculation

---

### T-026 — Head-to-head game breakdown + shared hand details

**Category:** feature
**Dependencies:** T-025
**Story Ref:** S-5.2, S-5.3

Below the H2H summary, show a game-by-game breakdown table (game date, shared hands, per-player wins). Expandable rows reveal shared hand details: hole cards, community cards, and results.

**Acceptance Criteria:**
1. Breakdown table shows each shared session
2. Sorting by date or win differential
3. Expanding a row shows hand details with card rendering
4. Max 50 recent shared hands shown (paginated or capped)

---

### T-027 — Session-over-session trend charts

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-6.1

Build trend charts on the player profile (or a Trends tab). Recharts `LineChart` with X=game dates, Y togglable between win rate, fold rate, P&L. Date range filter. Tooltip with game date, value, hands played.

**Acceptance Criteria:**
1. Chart renders from `/stats/players/{name}/trends` data
2. Y-axis metric toggle works
3. Date range filter narrows chart
4. Tooltip shows full context
5. Vitest test for data transformation

---

### T-028 — Hand-level drill-down from trend chart

**Category:** feature
**Dependencies:** T-027
**Story Ref:** S-6.2

Clicking a session data point on the trend chart opens an inline/modal hand-level chart. X=hand number, Y=cumulative wins (and P&L). Close action returns to session view.

**Acceptance Criteria:**
1. Click interaction triggers drill-down
2. Hand-level chart renders from `/stats/games/{id}/players/{name}/hand-trends`
3. Close/back returns to session-level trend
4. Transition is smooth (no full page reload)

---

### T-029 — Play style evolution slider/overlay

**Category:** feature
**Dependencies:** T-016, T-027
**Story Ref:** S-6.3

Build a view showing how the radar chart changes over time. Slider selects a session, radar updates. Overlay mode compares two time slices on one chart. Minimum 3 sessions required.

**Acceptance Criteria:**
1. Slider moves through sessions chronologically
2. Radar chart updates per session
3. Overlay mode renders two overlapping radar shapes
4. Graceful state when < 3 sessions: message + no slider

---

### T-030 — Achievement badge grid + detail modal

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-7.1, S-7.2

Build an "Achievements" section on the player profile. Earned badges show with icon + title + date. Unearned are greyed/locked. Clicking opens a modal with full details and link to the triggering game/hand.

**Acceptance Criteria:**
1. Badge grid renders from `/stats/players/{name}/achievements`
2. Earned first, then unearned (locked)
3. Modal shows description, earned date, and link to game
4. Locked modal shows "how to earn" text
5. Modal is keyboard-accessible (Escape to close, focus trap)
6. Vitest test for badge grid rendering
