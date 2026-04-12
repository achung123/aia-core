# Spec — Analytics Dashboard

**Project ID:** analytics-dashboard-007
**Date:** 2026-04-12
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Single-Game Recap](#epic-1-single-game-recap)
2. [Epic 2: Career & Aggregate Stats](#epic-2-career--aggregate-stats)
3. [Epic 3: Head-to-Head Rivalries](#epic-3-head-to-head-rivalries)
4. [Epic 4: Fun Awards & Superlatives](#epic-4-fun-awards--superlatives)
5. [Epic 5: Backend Analytics API](#epic-5-backend-analytics-api)

---

## Epic 1: Single-Game Recap

Give players an immersive post-game breakdown of any individual session — hand-by-hand timeline, key moments, and per-player summaries — so they can relive the action and learn from it.

### S-1.1 — Game Recap Page Shell

**As a** player, **I want** to select any completed game from a list and open a dedicated recap page, **so that** I can review how a specific session played out.

**Acceptance Criteria:**
1. A `/games` route lists all completed game sessions with date, player count, and total hands
2. Clicking a game navigates to `/games/:gameId/recap`
3. The recap page loads the game stats and hand data from the existing `/stats/games/{game_id}` and `/games/{game_id}/hands` endpoints
4. A loading skeleton shows while data is being fetched
5. Mobile-first layout: single-column on small screens, two-column on desktop

### S-1.2 — Hand-by-Hand Timeline

**As a** player, **I want** to scroll through a visual timeline of every hand in a game, **so that** I can see how the session progressed chronologically.

**Acceptance Criteria:**
1. Each hand is rendered as a card in a vertical timeline showing hand number, community cards (rendered as mini card icons), and the winner
2. Expanding a hand card reveals all players' hole cards, results (won/lost/folded), and the outcome street
3. The current hand is highlighted; the timeline scrolls smoothly to a selected hand
4. Community cards that exist (flop/turn/river) show visually; streets that didn't happen are omitted (e.g. a hand that ended on the flop only shows flop cards)
5. Works on both mobile and desktop viewports

### S-1.3 — Single-Game Player Summary Cards

**As a** player, **I want** to see a summary card for each player in a game showing their win/loss/fold breakdown, **so that** I can quickly compare how everyone did.

**Acceptance Criteria:**
1. A horizontal scrollable row (mobile) or grid (desktop) of player cards appears at the top of the recap page
2. Each card shows: player name, hands played, wins, losses, folds, win rate %, and P&L (if available)
3. The winner(s) of the overall game are visually distinguished (border highlight, trophy icon, etc.)
4. P&L displays as "$0.00" with a muted style when no P&L data is recorded; shows actual values with green/red coloring when available

### S-1.4 — Key Moments Highlights

**As a** player, **I want** the system to automatically surface 3-5 "key moments" from a game (biggest pots, dramatic river cards, longest streak), **so that** I can jump to the most interesting hands.

**Acceptance Criteria:**
1. The recap page includes a "Key Moments" section with 3-5 auto-picked hands
2. Selection criteria include: hands where most players saw the river, hands with the most non-fold participants, and streak-start/end hands
3. Each key moment is linked to the corresponding entry in the hand timeline
4. If P&L data exists, "biggest pot" can be included as a criterion

---

## Epic 2: Career & Aggregate Stats

Show players their all-time and per-session performance trends — win rate evolution, street tendencies, session history — so they can see how their playstyle is developing.

### S-2.1 — Player Profile Page

**As a** player, **I want** a dedicated profile page showing my career stats at a glance, **so that** I can see my overall record.

**Acceptance Criteria:**
1. A `/players/:playerName` route renders a profile page
2. The page fetches from `/stats/players/{player_name}` and displays: total hands, win/loss/fold counts, win rate, P&L (if available), and street percentages (flop/turn/river)
3. A player selector (dropdown or search) lets you switch between players
4. Stat values of zero or null are shown gracefully (e.g. "—" or "No data yet")

### S-2.2 — Win Rate Trend Chart

**As a** player, **I want** a line chart showing my win rate per session over time, **so that** I can see if I'm improving.

**Acceptance Criteria:**
1. A Recharts `LineChart` plots win rate (Y-axis, 0-100%) against game date (X-axis)
2. Each data point is one game session the player participated in
3. Hovering a point shows a tooltip with: game date, hands played, wins, and win rate for that session
4. A horizontal reference line shows the player's all-time average win rate
5. The chart is responsive and readable on mobile (horizontal scroll if many sessions)

### S-2.3 — Outcome Distribution Charts

**As a** player, **I want** pie/donut charts showing my overall won/lost/folded distribution and my street-reach breakdown, **so that** I can understand my tendencies.

**Acceptance Criteria:**
1. A donut chart shows the proportion of won / lost / folded hands using consistent color coding (green/red/grey)
2. A second donut chart shows "How far do your hands go?" — percentage reaching flop only, turn, and river
3. Both charts are interactive — clicking a segment filters the visible data or shows a tooltip with counts
4. Charts render correctly on mobile with legends below the chart rather than beside it

### S-2.4 — Session History Table

**As a** player, **I want** a sortable table of every game session I've played in, **so that** I can drill into any session.

**Acceptance Criteria:**
1. A table lists each game session with columns: date, hands played, wins, losses, folds, win rate, P&L
2. Columns are sortable by clicking headers
3. Clicking a row navigates to the single-game recap page (`/games/:gameId/recap`)
4. The table is paginated or virtualized if more than 20 sessions exist
5. On mobile, the table is horizontally scrollable with the player name column frozen

---

## Epic 3: Head-to-Head Rivalries

Let players pick any two players and see deep rivalry stats — showdown records, fold tendencies against each other, and street-level breakdowns — for fun competitive analysis.

### S-3.1 — Head-to-Head Picker

**As a** player, **I want** to select two players from a list and enter a head-to-head comparison view, **so that** I can analyze my record against a specific rival.

**Acceptance Criteria:**
1. A `/head-to-head` route has two player selectors (dropdowns or autocomplete)
2. After selecting two players, the view fetches rivalry data from a new backend endpoint
3. A "Swap" button reverses the two players
4. If either player is not selected, a placeholder prompt is shown
5. Previously compared pairs are suggested as quick-pick buttons (stored in localStorage)

### S-3.2 — Showdown Record Summary

**As a** player, **I want** to see the overall head-to-head showdown record between two players, **so that** I know who dominates when they both stay in.

**Acceptance Criteria:**
1. A hero section shows "Player A vs Player B" with avatars/initials and a head-to-head win/loss/draw tally
2. "Showdown" is defined as hands where BOTH players had a non-fold result (won or lost)
3. The total number of shared hands (hands both players participated in, regardless of outcome) is displayed
4. A progress bar or split gauge visually shows the win ratio between the two players
5. If one player has a dominant record, a "rivalry verdict" label appears (e.g. "Matt owns this matchup 🔥")

### S-3.3 — Fold Behavior Against Each Other

**As a** player, **I want** to see how often each player folds in hands involving the other, **so that** I can spot who intimidates whom.

**Acceptance Criteria:**
1. A stat block shows: "Player A folded X% of shared hands" vs "Player B folded Y%"
2. A bar chart compares fold rates in shared hands vs each player's overall fold rate
3. If one player folds significantly more in shared hands vs their baseline, a callout label appears (e.g. "Zain folds 20% more when Matt is in the hand")

### S-3.4 — Street-Level Rivalry Breakdown

**As a** player, **I want** to see at which streets heads-up confrontations typically resolve, **so that** I can understand the dynamics of the rivalry.

**Acceptance Criteria:**
1. A stacked bar chart or table shows the distribution of shared hands by the street they resolved on: pre-flop, flop, turn, river
2. For each street, the win/loss split between the two players is shown
3. Tooltip or drill-down shows specific hand numbers for each category
4. Only hands where both players were still active at that street are counted for street-level stats

### S-3.5 — Head-to-Head Backend Endpoint

**As a** frontend developer, **I want** a `/stats/head-to-head?player1={name}&player2={name}` endpoint that returns pre-computed rivalry stats, **so that** the frontend can render the comparison without doing heavy client-side computation.

**Acceptance Criteria:**
1. The endpoint returns: total shared hands, showdown count, each player's wins in showdowns, each player's fold count in shared hands, and street-level breakdown
2. Players are matched case-insensitively
3. Returns 404 if either player doesn't exist
4. Response time < 200ms for a typical dataset (< 1000 hands)
5. Response schema is documented as a Pydantic model

---

## Epic 4: Fun Awards & Superlatives

Auto-generate fun award badges and superlatives from the game data, giving the group entertaining things to brag about and roast each other over.

### S-4.1 — Awards Engine (Backend)

**As a** system, **I want** a backend service that computes award superlatives from the hand data, **so that** the frontend can display fun auto-generated awards.

**Acceptance Criteria:**
1. A `/stats/awards` endpoint returns a list of award objects, each with: award name, description, winner player name, and supporting stat value
2. Awards are computed across all games (global) and optionally filterable by game_id
3. Minimum award set (8 awards):
   - **Iron Man** — most total hands played
   - **Sniper** — highest all-time win rate (min 20 hands)
   - **Paper Hands** — highest fold percentage
   - **Diamond Hands** — lowest fold percentage (stays in the most)
   - **River Rat** — highest % of hands reaching the river
   - **One and Done** — most pre-flop folds (hands where even flop didn't happen for them)
   - **Streak King** — longest consecutive win streak across all sessions
   - **Showdown Magnet** — most hands that went to showdown (non-fold result)
4. If P&L data exists, additional awards: **Big Stack** (highest total P&L), **Degen** (lowest total P&L)
5. Each award has a fun emoji and a one-liner description

### S-4.2 — Awards Display Page

**As a** player, **I want** a visually engaging awards page showing all auto-generated superlatives, **so that** I can see who holds each title and brag / trash talk.

**Acceptance Criteria:**
1. A `/awards` route renders a grid of award cards
2. Each card shows: emoji, award name, winner name, and the stat that earned it (e.g. "423 hands played")
3. Cards have a playful visual style — bold colors, large emoji, trophy-like feel
4. Clicking a card navigates to the winner's player profile page
5. A game-specific filter lets players view awards for just one session (queries `/stats/awards?game_id=X`)
6. Mobile layout: 1 column. Desktop: 2-3 column grid

### S-4.3 — Session Awards Banner

**As a** player, **I want** the single-game recap page to show 2-3 awards specific to that session, **so that** every game night has its own highlights.

**Acceptance Criteria:**
1. The game recap page (S-1.1) includes a "Session Awards" banner near the top
2. Awards are fetched from `/stats/awards?game_id={id}` and limited to the top 3
3. The banner is visually distinct — horizontal scroll on mobile, inline cards on desktop
4. If a session has fewer than 3 awardable categories (e.g. too few hands), fewer awards are shown gracefully

---

## Epic 5: Backend Analytics API

Extend the FastAPI backend with new analytical endpoints that power the dashboard features — head-to-head stats, career trend data, and awards computation.

### S-5.1 — Player Career Trend Endpoint

**As a** frontend developer, **I want** a `/stats/players/{player_name}/trends` endpoint that returns per-session stats in chronological order, **so that** I can plot trend lines.

**Acceptance Criteria:**
1. Returns an array of objects, each with: game_id, game_date, hands_played, hands_won, win_rate, and profit_loss for that session
2. Sorted by game_date ascending
3. Returns 404 if the player doesn't exist
4. Returns an empty array (not 404) if the player has no completed games

### S-5.2 — Shared Hands Query Helper

**As a** backend developer, **I want** a reusable query function that returns all hands where two specified players both participated, **so that** the head-to-head and awards endpoints can share this logic.

**Acceptance Criteria:**
1. A function `get_shared_hands(db, player1_id, player2_id)` returns a list of `(Hand, PlayerHand_p1, PlayerHand_p2)` tuples
2. "Participated" means the player has a `PlayerHand` record for that hand (regardless of result)
3. The function is importable from `app.database.queries` (or similar module)
4. Unit tested with at least 3 scenarios: both players present, one absent, both fold vs one wins

### S-5.3 — Game Highlights / Key Moments Endpoint

**As a** frontend developer, **I want** a `/stats/games/{game_id}/highlights` endpoint that returns 3-5 notable hands from a session, **so that** the recap page can feature key moments.

**Acceptance Criteria:**
1. Returns an array of "highlight" objects with: hand_number, highlight_type (e.g. "most_participants", "river_finish", "longest_streak_start"), and a human-readable description
2. Selection criteria:
   - Hand with the most non-fold players
   - Hand(s) that went to the river with 3+ active players
   - First hand in the longest win streak for any player
3. Returns at least 1 and at most 5 highlights
4. Returns an empty array for games with < 3 hands
