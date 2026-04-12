# Spec — Player Analytics Dashboards

**Project ID:** player-analytics-007
**Date:** 2026-04-12
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Analytics API Foundation](#epic-1-analytics-api-foundation)
2. [Epic 2: Player Profile Dashboard](#epic-2-player-profile-dashboard)
3. [Epic 3: Single Game Recap](#epic-3-single-game-recap)
4. [Epic 4: Leaderboard & Rankings](#epic-4-leaderboard--rankings)
5. [Epic 5: Head-to-Head Comparisons](#epic-5-head-to-head-comparisons)
6. [Epic 6: Aggregate Trends](#epic-6-aggregate-trends)
7. [Epic 7: Fun Facts & Achievements](#epic-7-fun-facts--achievements)

---

## Epic 1: Analytics API Foundation

New backend API endpoints that power the analytics dashboards — head-to-head stats, session-over-session trends, hand-level trend data, and an extensible achievements engine. These endpoints complement the existing `/stats/players/{name}`, `/stats/leaderboard`, `/stats/games/{id}`, and `/hands` search APIs.

### S-1.1 — Head-to-Head API Endpoint

**As a** player, **I want** to query the matchup record between any two players, **so that** the frontend can display rivalry stats without client-side aggregation across all hands.

**Acceptance Criteria:**
1. `GET /stats/head-to-head?player1={name}&player2={name}` returns a JSON response
2. Response includes: total shared hands (hands where both players had a result), wins for each player, folds for each, and a list of shared hand references (game_id + hand_number)
3. Optional `game_id` query param filters to a single session
4. Returns 404 if either player name is not found
5. `handed_back` results are excluded from counts

### S-1.2 — Session Trend API Endpoint

**As a** player, **I want** to fetch my performance metrics aggregated per game session over time, **so that** I can see how my play style is evolving across game nights.

**Acceptance Criteria:**
1. `GET /stats/players/{name}/trends` returns a list of per-session data points ordered by game_date
2. Each data point includes: game_id, game_date, hands_played, hands_won, hands_lost, hands_folded, win_rate, profit_loss, flop_seen_pct, turn_seen_pct, river_seen_pct
3. Optional `date_from` / `date_to` query params filter the date range
4. Returns 404 if the player name is not found
5. Sessions where the player was registered but played 0 hands are omitted

### S-1.3 — Hand-Level Cumulative Trend API Endpoint

**As a** player, **I want** to see my cumulative stats evolving hand-over-hand within a single session, **so that** I can visualize momentum swings and turning points during a game night.

**Acceptance Criteria:**
1. `GET /stats/games/{game_id}/players/{name}/hand-trends` returns an ordered list of per-hand data points
2. Each data point includes: hand_number, cumulative_wins, cumulative_losses, cumulative_folds, cumulative_profit_loss, result (for that hand)
3. Returns 404 if the game or player is not found
4. Only includes hands where the player participated (has a player_hand row with a result)

### S-1.4 — Achievements Engine API Endpoint

**As a** player, **I want** to retrieve earned achievements/badges for any player, **so that** the frontend can display fun superlatives and milestones.

**Acceptance Criteria:**
1. `GET /stats/players/{name}/achievements` returns a list of earned achievement objects
2. Each achievement has: id (string slug), title, description, category, earned_date (game_date of the triggering event), and context (e.g. the game_id or hand_number)
3. Achievements are computed on-the-fly from player data (no separate persistence table)
4. The initial set includes at least: "Fold King" (highest fold % in a session, min 10 hands), "River Rat" (most river showdowns), "Hot Streak" (3+ consecutive wins), "Iron Player" (played every hand in a session), "First Blood" (won the first hand of a session)
5. Achievement definitions are loaded from a config structure (dict/list) that can be extended without modifying endpoint logic
6. Returns 404 if the player is not found

### S-1.5 — Enhanced Game Stats with Key Moments

**As a** player, **I want** the game stats endpoint to include "key moments" — notable hands like biggest pots, longest showdowns, and upsets, **so that** game recaps highlight the exciting parts.

**Acceptance Criteria:**
1. `GET /stats/games/{game_id}` response gains an additional `key_moments` list
2. Each key moment has: hand_number, moment_type (e.g. "biggest_pot", "most_players_showdown", "comeback"), description, and involved_players
3. At least 3 moment types are detected: biggest pot (by P&L when available), most players reaching showdown (river), and "upset" (player who folded least all game lost a hand at river)
4. Existing response fields remain unchanged (backward compatible)

---

## Epic 2: Player Profile Dashboard

A dedicated player profile page showing personal statistics, play style breakdown, recent game history, and trend visualizations — the "home base" for any player checking their performance.

### S-2.1 — Player Name Picker & Dashboard Shell

**As a** player, **I want** to select my name from a list and land on my personal dashboard, **so that** I can access my stats without any login process.

**Acceptance Criteria:**
1. A `/analytics` route exists with a player name picker (dropdown or search)
2. Selecting a name navigates to `/analytics/player/{name}`
3. The player picker lists all players from the `/players` API
4. The dashboard shell has a responsive layout with sections for stats cards, charts, and recent games
5. Works on mobile viewports (≥ 320px) with stacked layout

### S-2.2 — Stats Summary Cards

**As a** player, **I want** to see headline stats (total hands, win rate, fold rate, P&L) as prominent cards at the top of my profile, **so that** I get an instant snapshot of my performance.

**Acceptance Criteria:**
1. Cards display: total hands played, win rate %, fold rate %, total P&L (when available)
2. P&L card shows "$0.00" with a note "No P&L data" when all values are zero
3. Win rate and fold rate show with one decimal place
4. Cards are fetched from the existing `/stats/players/{name}` endpoint
5. Loading skeleton shown while data is in flight

### S-2.3 — Play Style Radar Chart

**As a** player, **I want** to see a radar/spider chart of my play style dimensions, **so that** I can understand my tendencies at a glance (aggressive vs. passive, tight vs. loose, etc.).

**Acceptance Criteria:**
1. A Recharts `RadarChart` renders with axes: Aggression (win rate), Tightness (fold rate), Endurance (river seen %), Consistency (std deviation of win rate across sessions), Volume (hands played relative to max)
2. Each axis is normalized to 0–100
3. Chart updates when player selection changes
4. Tooltip shows the raw value for each axis on hover

### S-2.4 — Recent Games List

**As a** player, **I want** to see a list of my recent game sessions with a quick summary, **so that** I can navigate to a specific game recap.

**Acceptance Criteria:**
1. Shows the 10 most recent game sessions the player participated in
2. Each row shows: game date, hands played, win count, W/L/F ratio bar, P&L
3. Clicking a row navigates to the single game recap page (`/analytics/game/{id}`)
4. Data sourced from the session trends endpoint (`/stats/players/{name}/trends`)

---

## Epic 3: Single Game Recap

A detailed post-game breakdown for a single session — hand timeline, player performance table, key moments, and hand-by-hand charts.

### S-3.1 — Game Recap Overview

**As a** player, **I want** to see a summary header for a game session (date, total hands, player count, winners), **so that** I immediately understand the game at a glance.

**Acceptance Criteria:**
1. `/analytics/game/{id}` route renders a game recap page
2. Header shows: game date, total hands, number of players, and session winner(s)
3. Data sourced from the existing `/games` and `/stats/games/{id}` endpoints
4. Displays loading state and 404-friendly error if game not found

### S-3.2 — Player Performance Table

**As a** player, **I want** to see a sortable table of all players' performance in a game session, **so that** I can compare how everyone did.

**Acceptance Criteria:**
1. Table columns: player name, hands played, wins, losses, folds, win rate, P&L
2. Sortable by any column (click header to toggle asc/desc)
3. Row for each player in the session, including those with 0 hands
4. Current user's row (if selected in global context) is highlighted
5. Data sourced from `/stats/games/{game_id}`

### S-3.3 — Hand Timeline Chart

**As a** player, **I want** to see a line chart of cumulative wins/P&L over the course of a game session, **so that** I can visualize momentum and turning points.

**Acceptance Criteria:**
1. Recharts `LineChart` with X-axis = hand number, Y-axis = cumulative wins (or cumulative P&L when available)
2. One line per player (distinguishable by color)
3. Player lines can be toggled on/off via legend clicks
4. Tooltip shows exact values for each player at the hovered hand
5. Data sourced from `/stats/games/{game_id}/players/{name}/hand-trends` for each player

### S-3.4 — Key Moments Highlights

**As a** player, **I want** to see the "key moments" of a game session highlighted in a card format, **so that** the most memorable hands are surfaced automatically.

**Acceptance Criteria:**
1. Key moments render as cards below the timeline chart
2. Each card shows: hand number, moment type icon/badge, description, involved players
3. Clicking a key moment scrolls/highlights the corresponding hand in the timeline
4. Data sourced from the enhanced `/stats/games/{game_id}` response

---

## Epic 4: Leaderboard & Rankings

An enhanced, filterable leaderboard that goes beyond the existing one — with date range filters, multiple metric views, and visual flair.

### S-4.1 — Filterable Leaderboard Page

**As a** player, **I want** to view the leaderboard filtered by date range and metric, **so that** I can see who's been performing best recently or overall.

**Acceptance Criteria:**
1. `/analytics/leaderboard` route renders the leaderboard
2. Date range picker filters the data (requires backend support or client-side filtering of trends data)
3. Metric toggle: Win Rate, Total P&L, Hands Played
4. Top 3 positions have visual distinction (gold/silver/bronze styling)
5. Responsive layout — table on desktop, cards on mobile

### S-4.2 — Leaderboard with Session History Sparklines

**As a** player, **I want** to see mini sparklines next to each player on the leaderboard showing their recent performance trend, **so that** I can tell who's hot and who's cold.

**Acceptance Criteria:**
1. Each leaderboard row includes a small Recharts sparkline (last 10 sessions of win rate)
2. Sparklines are loaded from the `/stats/players/{name}/trends` endpoint
3. Sparklines gracefully degrade to "—" if player has < 2 sessions

---

## Epic 5: Head-to-Head Comparisons

A rivalry page where two players can compare stats, see their shared hand history, and settle debates about who really wins more.

### S-5.1 — Head-to-Head Picker & Summary

**As a** player, **I want** to select two players and see their overall matchup record, **so that** I can see who dominates the rivalry.

**Acceptance Criteria:**
1. `/analytics/head-to-head` route with two player pickers
2. Summary cards: total shared hands, Player A wins, Player B wins, hands where both folded
3. Visual indicator of who leads the rivalry (larger side of a bar, color coding)
4. Data sourced from `/stats/head-to-head?player1=X&player2=Y`

### S-5.2 — Head-to-Head Game-by-Game Breakdown

**As a** player, **I want** to see the head-to-head record broken down by game session, **so that** I can see if one player dominated recently.

**Acceptance Criteria:**
1. Below the summary, a table shows each game session both players attended
2. Columns: game date, shared hands that session, Player A wins, Player B wins
3. Sortable by date or win differential
4. Links to the game recap for each session

### S-5.3 — Head-to-Head Shared Hand Details

**As a** player, **I want** to drill into individual shared hands, **so that** I can see the exact cards and outcomes of our head-to-head battles.

**Acceptance Criteria:**
1. Expandable rows showing the hand details: each player's hole cards, community cards, and result
2. Shows at most 50 most recent shared hands (paginated if more)
3. Community cards render as styled card icons

---

## Epic 6: Aggregate Trends

Cross-session trend charts that show a player's evolution over time — both session-level summaries and the ability to drill into hand-level within one session.

### S-6.1 — Session-over-Session Trend Charts

**As a** player, **I want** to see line charts of my win rate, fold rate, and P&L across game sessions, **so that** I can spot trends in my play over weeks/months.

**Acceptance Criteria:**
1. `/analytics/player/{name}/trends` route (or a tab within the player profile)
2. Recharts `LineChart` with X-axis = game dates, Y-axis togglable between: win rate, fold rate, P&L
3. Data points are one per session from `/stats/players/{name}/trends`
4. Hover tooltip shows game date, exact value, hands played that session
5. Optional date range filter narrows the chart

### S-6.2 — Hand-Level Drill-Down

**As a** player, **I want** to click a session data point and see the hand-by-hand trend within that session, **so that** I can explore micro-trends within a game night.

**Acceptance Criteria:**
1. Clicking a session point opens an inline or modal chart showing hand-level cumulative data
2. X-axis = hand number, Y-axis = cumulative wins (and P&L if available)
3. Data sourced from `/stats/games/{game_id}/players/{name}/hand-trends`
4. Close/back action returns to the session-level view

### S-6.3 — Play Style Evolution Over Time

**As a** player, **I want** to see how my play style radar chart changes across sessions, **so that** I can see if I'm becoming more aggressive, tighter, etc.

**Acceptance Criteria:**
1. A slider or small multiples view shows the radar chart at different points in time
2. At least 3 time slices: earliest session, midpoint session, latest session
3. Overlay mode lets me compare two time slices on one radar chart
4. Data derived from session-level trends endpoint

---

## Epic 7: Fun Facts & Achievements

An extensible achievement system that awards badges and surfaces fun superlatives — something players can brag about or trash-talk over.

### S-7.1 — Achievement Badge Display on Profile

**As a** player, **I want** to see my earned achievements displayed as badges on my profile page, **so that** I can celebrate milestones and show off to friends.

**Acceptance Criteria:**
1. An "Achievements" section on the player profile page
2. Badges render with icon, title, and earned date
3. Unearned achievements show as locked/greyed out
4. Achievements sorted: earned first (newest to oldest), then unearned
5. Data sourced from `/stats/players/{name}/achievements`

### S-7.2 — Achievement Detail Modal

**As a** player, **I want** to click an achievement and see the details of when and how I earned it, **so that** I can relive the moment.

**Acceptance Criteria:**
1. Clicking a badge opens a modal with: title, description, category, earned date, and a link to the triggering game/hand
2. Locked achievements show the description of how to earn them
3. Modal is keyboard-accessible and mobile-friendly

### S-7.3 — Game Night Awards

**As a** player, **I want** the game recap page to show "Game Night Awards" — per-session superlatives like "Most Hands Won", "Biggest Bluff", "Fold King of the Night", **so that** every game night feels special.

**Acceptance Criteria:**
1. A "Game Night Awards" section on the single game recap page
2. At least 5 awards computed: Most Wins, Most Folds, Iron Player (most hands played), Lucky River (most river wins), Cold Streak (most consecutive losses)
3. Each award shows: title, winning player name, and the stat value
4. Ties show all tied players
5. Awards computed from game stats data (no additional API call beyond enhanced game stats)

### S-7.4 — Achievement Definition Config

**As a** developer, **I want** achievement definitions stored in a structured config (Python dict or YAML), **so that** I can add new achievements without modifying endpoint logic.

**Acceptance Criteria:**
1. An `achievements.py` module in `app/services/` defines achievement rules as data structures
2. Each definition has: id, title, description, category, and a callable evaluator function
3. The evaluator receives player stats data and returns earned/not-earned plus context
4. Adding a new achievement requires only appending to the config and writing an evaluator — no router or endpoint changes
5. At least 10 achievements defined in the initial config
