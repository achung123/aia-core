# Tasks — All In Analytics Core Backend

**Project ID:** aia-core-001
**Date:** 2026-03-09
**Total Tasks:** 74
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Set up Alembic for database migrations | setup | none | S-1.1 |
| T-002 | Create Player SQLAlchemy model | feature | T-001 | S-1.1 |
| T-003 | Create GameSession and GamePlayer models | feature | T-002 | S-1.2 |
| T-004 | Create Hand model | feature | T-003 | S-1.3 |
| T-005 | Create PlayerHand model | feature | T-004 | S-1.4 |
| T-006 | Write initial Alembic migration for all new models | setup | T-005 | S-1.1–S-1.4 |
| T-007 | Build card validation Pydantic models | feature | none | S-1.5 |
| T-008 | Build Game/Hand/Player request/response Pydantic models | feature | T-007 | S-2.1, S-3.1 |
| T-009 | Refactor FastAPI app structure — new router skeleton | refactor | none | — |
| T-010 | Implement database session dependency with new engine | refactor | T-006 | — |
| T-011 | Implement Player CRUD endpoints | feature | T-008, T-010 | S-1.1 |
| T-012 | Write tests for Player CRUD | test | T-011 | S-1.1 |
| T-013 | Implement Create Game Session endpoint | feature | T-011 | S-2.1 |
| T-014 | Implement Get Game Session endpoint | feature | T-013 | S-2.2 |
| T-015 | Implement List Game Sessions endpoint | feature | T-013 | S-2.3 |
| T-016 | Implement Complete Game Session endpoint | feature | T-013 | S-2.4 |
| T-017 | Write tests for Game Session CRUD | test | T-014, T-015, T-016 | S-2.1–S-2.4 |
| T-018 | Implement Record New Hand endpoint | feature | T-013, T-008 | S-3.1 |
| T-019 | Implement duplicate card validation logic | feature | T-007, T-018 | S-1.5 |
| T-020 | Implement Get Single Hand endpoint | feature | T-018 | S-3.2 |
| T-021 | Implement List Hands in Game endpoint | feature | T-018 | S-3.3 |
| T-022 | Implement Record Hand Result endpoint | feature | T-018 | S-3.4 |
| T-023 | Write tests for Hand Management endpoints | test | T-019, T-020, T-021, T-022 | S-3.1–S-3.4 |
| T-024 | Define CSV schema and build CSV parser | feature | T-007 | S-4.1 |
| T-025 | Implement CSV upload and validation endpoint | feature | T-024, T-010 | S-4.2 |
| T-026 | Implement CSV commit endpoint | feature | T-025, T-018 | S-4.3 |
| T-027 | Write tests for CSV ingestion pipeline | test | T-026 | S-4.1–S-4.3 |
| T-028 | Implement Edit Community Cards endpoint | feature | T-018, T-019 | S-5.1 |
| T-029 | Implement Edit Player Hole Cards endpoint | feature | T-018, T-019 | S-5.2 |
| T-030 | Implement Add/Remove Player from Hand endpoints | feature | T-018 | S-5.3 |
| T-031 | Write tests for editing endpoints | test | T-028, T-029, T-030 | S-5.1–S-5.3 |
| T-032 | Implement Player Stats endpoint (win rate, P/L, hand freq) | feature | T-022 | S-6.1, S-6.2, S-6.3 |
| T-033 | Implement Leaderboard endpoint | feature | T-032 | S-6.4 |
| T-034 | Implement Per-Session Stats endpoint | feature | T-032 | S-6.5 |
| T-035 | Write tests for statistics endpoints | test | T-032, T-033, T-034 | S-6.1–S-6.5 |
| T-036 | Implement Search Hands by Player endpoint | feature | T-020 | S-7.1 |
| T-037 | Implement Search Hands by Date Range and Card endpoints | feature | T-036 | S-7.2, S-7.3 |
| T-038 | Write tests for search/query endpoints | test | T-037 | S-7.1–S-7.3 |
| T-039 | Implement Image Upload endpoint | feature | T-010, T-008 | S-8.1 |
| T-040 | Implement Card Detection pipeline integration | feature | T-039 | S-8.2 |
| T-041 | Implement Review and Confirm Detected Cards endpoint | feature | T-040, T-018 | S-8.3 |
| T-042 | Implement Detection Correction feedback storage and tests | feature | T-041 | S-8.4 |
| T-043 | Migrate package manager from Poetry to uv | setup | none | — |
| T-044 | Fix: Add `Player.hands_played` relationship and wire `back_populates` | bug | none | S-1.4 |
| T-045 | Fix: Change `profit_loss` column type from `Float` to `Numeric(10,2)` | bug | none | S-1.4 |
| T-046 | Fix: Add `Enum` constraint on `PlayerHand.result` column | bug | none | S-1.4 |
| T-047 | Fix: Add `cascade='all, delete-orphan'` to `Hand.player_hands` relationship | bug | none | S-1.4 |
| T-048 | Fix: Add NOT NULL enforcement tests for `card_1`, `card_2`, `hand_id`, `player_id` | bug | none | S-1.4 |
| T-049 | Fix: Add `back_populates` to `PlayerHand.player` relationship | bug | T-044 | S-1.4 |
| T-050 | Fix: Enable SQLite FK enforcement (`PRAGMA foreign_keys = ON`) in test fixtures | bug | none | S-1.4 |
| T-051 | Fix: Catch `IntegrityError` on `create_player` and return 409 | bug | none | S-1.1 |
| T-052 | Fix: Add input validation and whitespace strip on `PlayerCreate.name` | bug | none | S-1.1 |
| T-053 | Fix: Remove duplicate DB setup in `test_player_api.py` | bug | none | — |
| T-054 | Fix: Add pagination to `GET /players` | bug | none | S-1.1 |
| T-055 | Fix: Add case-insensitive unique constraint on `Player.name` | bug | none | S-1.1 |
| T-056 | Fix: Deduplicate `player_names` before `GamePlayer` inserts | bug | none | S-2.1 |
| T-057 | Fix: Wrap player auto-creation in `try/except IntegrityError` with re-query fallback | bug | none | S-2.1 |
| T-058 | Fix: Deduplicate resolved `player_id` set after lookup for case-variant `player_names` | bug | T-056 | S-2.1 |
| T-059 | Fix: Wire duplicate card validation into record_hand() before Hand flush | bug | T-019, T-018 | S-3.1 |
| T-060 | Fix: Handle race condition in hand_number assignment | bug | T-018 | S-3.1 |
| T-061 | Fix: Guard against duplicate player_entries in record_hand() | bug | T-018 | S-3.1 |
| T-062 | Perf: Move db.flush() outside player_entries loop in record_hand() | task | T-018 | S-3.1 |
| T-063 | Cleanup: Remove unnecessary db.refresh(hand) after commit in record_hand() | task | T-018 | S-3.1 |
| T-064 | Perf: Use selectinload on Hand.player_hands in get_hand() | task | T-020 | S-3.2 |
| T-065 | Fix: Add explicit guard on Game query before Hand query in get_hand() | bug | T-020 | S-3.2 |
| T-066 | Fix: Wrap CSV `file.read().decode()` in `try/except` and return 400 on `UnicodeDecodeError` | bug | T-025 | S-4.2 |
| T-067 | Fix: Add file size limit (10 MB) to CSV upload endpoint and return 413 if exceeded | bug | T-025 | S-4.2 |
| T-068 | Fix: Validate non-card fields (game_date, hand_number, profit_loss) before CSV commit | bug | T-025 | S-4.3 |
| T-069 | Perf: Replace per-row GamePlayer existence check in CSV commit with pre-loaded pair set | task | T-026 | S-4.3 |
| T-070 | Fix: Add community card consistency check across CSV rows for the same hand group | bug | T-026 | S-4.3 |
| T-071 | Perf: Add GamePlayer existence cache in CSV commit to eliminate redundant reads for cached players | task | T-026 | S-4.3 |
| T-072 | Fix: Sanitize uploaded filename to prevent path traversal | bug | T-039 | S-8.1 |
| T-073 | Fix: Replace Content-Type-only validation with magic byte inspection for image uploads | bug | T-039 | S-8.1 |
| T-074 | Fix: Prevent silent overwrite of uploaded files with same game_id and filename | bug | T-039, T-072 | S-8.1 |

---

## Task Details

### T-001 — Set up Alembic for database migrations

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Add Alembic to the project dependencies. Initialize Alembic (`alembic init`). Configure `alembic.ini` and `env.py` to use the SQLAlchemy engine from the app. Ensure `alembic revision --autogenerate` works with the existing (soon-to-be-replaced) models.

**Acceptance Criteria:**
1. `alembic` is in `pyproject.toml` dependencies
2. `alembic/` directory exists with `env.py` configured to import the app's `Base` and engine
3. `alembic revision --autogenerate -m "init"` runs without error

---

### T-002 — Create Player SQLAlchemy model

**Category:** feature
**Dependencies:** T-001
**Story Ref:** S-1.1

Create a `Player` model in the database layer with columns: `player_id` (Integer PK), `name` (String, unique, case-insensitive via collation or check), `created_at` (DateTime, server default). Place in a new `src/app/database/models.py` file (replacing the old `database_models.py` over time).

**Acceptance Criteria:**
1. `Player` model exists with `player_id`, `name`, `created_at`
2. `name` uniqueness is enforced at the DB level
3. Model imports cleanly and `Base.metadata` includes it

---

### T-003 — Create GameSession and GamePlayer models

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.2

Create `GameSession` model: `game_id` (PK), `game_date` (Date), `status` (String, default "active"), `created_at`. Create `GamePlayer` association table: `game_id` (FK → GameSession), `player_id` (FK → Player), composite PK. Add SQLAlchemy relationships on `GameSession.players` and `Player.games`.

**Acceptance Criteria:**
1. `GameSession` and `GamePlayer` models exist with correct columns and FKs
2. `GameSession.players` relationship returns associated `Player` objects
3. `status` defaults to `"active"`

---

### T-004 — Create Hand model

**Category:** feature
**Dependencies:** T-003
**Story Ref:** S-1.3

Create `Hand` model: `hand_id` (PK), `game_id` (FK → GameSession), `hand_number` (Integer), `flop_1`, `flop_2`, `flop_3` (String, not null), `turn` (String, nullable), `river` (String, nullable), `created_at`. Add unique constraint on (`game_id`, `hand_number`). Add relationship `GameSession.hands`.

**Acceptance Criteria:**
1. `Hand` model exists with all specified columns and the FK to GameSession
2. Unique constraint on (game_id, hand_number) prevents duplicates
3. `turn` and `river` are nullable

---

### T-005 — Create PlayerHand model

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-1.4

Create `PlayerHand` model: `player_hand_id` (PK), `hand_id` (FK → Hand), `player_id` (FK → Player), `card_1` (String), `card_2` (String), `result` (String, nullable — win/loss/fold), `profit_loss` (Float, nullable), `created_at`. Add unique constraint on (`hand_id`, `player_id`). Add relationships on `Hand.player_hands` and `Player.hands_played`.

**Acceptance Criteria:**
1. `PlayerHand` model exists with all specified columns and FKs
2. Unique constraint on (hand_id, player_id) prevents duplicates
3. `result` and `profit_loss` are nullable

---

### T-006 — Write initial Alembic migration for all new models

**Category:** setup
**Dependencies:** T-005
**Story Ref:** S-1.1–S-1.4

Generate an Alembic migration that creates all five new tables (player, game_session, game_player, hand, player_hand). Test by running `alembic upgrade head` against a fresh SQLite database. Confirm all tables and constraints are created correctly.

**Acceptance Criteria:**
1. Migration file exists under `alembic/versions/`
2. `alembic upgrade head` creates all 5 tables with correct columns, FKs, and constraints
3. `alembic downgrade base` drops all tables cleanly

---

### T-007 — Build card validation Pydantic models

**Category:** feature
**Dependencies:** none
**Story Ref:** S-1.5

Create updated Pydantic models for `Card` (rank + suit enums), a `CardValidator` utility that checks for valid rank/suit and detects duplicates within a set of cards. Reuse existing `CardRank` and `CardSuit` enums or refactor them. Add a function `validate_no_duplicate_cards(cards: list[str]) -> None` that raises `ValueError` on duplicates.

**Acceptance Criteria:**
1. `Card` model validates rank ∈ {A,2–10,J,Q,K} and suit ∈ {S,H,D,C}
2. `validate_no_duplicate_cards` raises on duplicates within a list
3. Unit tests cover valid cards, invalid cards, and duplicate detection

---

### T-008 — Build Game/Hand/Player request/response Pydantic models

**Category:** feature
**Dependencies:** T-007
**Story Ref:** S-2.1, S-3.1

Create Pydantic v2 models: `GameSessionCreate` (date, player names), `GameSessionResponse`, `HandCreate` (community cards + list of player entries), `HandResponse`, `PlayerHandEntry`, `PlayerResponse`, `HandResultUpdate`. These models use the `Card` model from T-007 for validation.

**Acceptance Criteria:**
1. All request models validate required fields and card values
2. All response models serialize SQLAlchemy objects cleanly
3. Unit tests cover serialization round-trips

---

### T-009 — Refactor FastAPI app structure — new router skeleton

**Category:** refactor
**Dependencies:** none
**Story Ref:** —

Create the new router files: `routes/games.py`, `routes/hands.py`, `routes/players.py`, `routes/upload.py`, `routes/stats.py`, `routes/search.py`. Each file contains an empty `APIRouter` with the correct prefix and tags. Update `main.py` to include all new routers. Keep the old `routes/game.py` temporarily (to be removed after migration).

**Acceptance Criteria:**
1. All 6 new router files exist with `APIRouter` instances
2. `main.py` includes all new routers
3. App starts without errors (`uvicorn app.main:app`)

---

### T-010 — Implement database session dependency with new engine

**Category:** refactor
**Dependencies:** T-006
**Story Ref:** —

Create a `src/app/database/session.py` that configures the SQLAlchemy engine and `SessionLocal` from a central location. Create a `get_db` dependency function for FastAPI. Update all routers to use this shared dependency instead of per-file engine creation. Remove the old engine setup from `database_models.py`.

**Acceptance Criteria:**
1. `session.py` exists with `engine`, `SessionLocal`, and `get_db`
2. All routers use the shared `get_db` dependency
3. No duplicate engine creation across the codebase

---

### T-011 — Implement Player CRUD endpoints

**Category:** feature
**Dependencies:** T-008, T-010
**Story Ref:** S-1.1

In `routes/players.py`, implement: `POST /players` (create player), `GET /players` (list all), `GET /players/{player_name}` (get by name). Auto-handles case-insensitive name lookup.

**Acceptance Criteria:**
1. Create player returns 201 with player data
2. Duplicate name returns 409 Conflict
3. Get by name is case-insensitive

---

### T-012 — Write tests for Player CRUD

**Category:** test
**Dependencies:** T-011
**Story Ref:** S-1.1

Write pytest tests for all Player endpoints: create, list, get by name, duplicate handling. Use in-memory SQLite with the test fixtures pattern from `conftest.py`.

**Acceptance Criteria:**
1. Tests cover create (happy path), duplicate (409), get (200), get not found (404), list
2. All tests pass with `pytest`

---

### T-013 — Implement Create Game Session endpoint

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-2.1

In `routes/games.py`, implement `POST /games` accepting `GameSessionCreate` (date + player names). Auto-creates players that don't exist. Links players via `GamePlayer`. Returns `GameSessionResponse`.

**Acceptance Criteria:**
1. Creates game session with correct date and status "active"
2. Auto-creates missing players
3. Returns game ID, date, player list, and status

---

### T-014 — Implement Get Game Session endpoint

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-2.2

Implement `GET /games/{game_id}`. Returns game session with players and hand count. 404 if not found.

**Acceptance Criteria:**
1. Returns full game session data including player list and hand count
2. Returns 404 for nonexistent game_id

---

### T-015 — Implement List Game Sessions endpoint

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-2.3

Implement `GET /games` with optional `date_from` and `date_to` query params. Returns games ordered by date descending with player count, hand count, status.

**Acceptance Criteria:**
1. Returns all games ordered by date desc when no filters
2. Filters by date range when params provided
3. Each entry includes game_id, date, player_count, hand_count, status

---

### T-016 — Implement Complete Game Session endpoint

**Category:** feature
**Dependencies:** T-013
**Story Ref:** S-2.4

Implement `PATCH /games/{game_id}/complete`. Sets status to "completed". 404 if not found, 400 if already completed.

**Acceptance Criteria:**
1. Sets status to "completed" and returns updated session
2. Returns 404 for nonexistent game
3. Returns 400 if already completed

---

### T-017 — Write tests for Game Session CRUD

**Category:** test
**Dependencies:** T-014, T-015, T-016
**Story Ref:** S-2.1–S-2.4

Write tests for all Game Session endpoints. Cover happy paths, auto-creation of players, date filtering, duplicate completion, and 404 cases.

**Acceptance Criteria:**
1. Tests cover create, get, list (with and without date filters), complete, and error cases
2. All tests pass

---

### T-018 — Implement Record New Hand endpoint

**Category:** feature
**Dependencies:** T-013, T-008
**Story Ref:** S-3.1

In `routes/hands.py`, implement `POST /games/{game_id}/hands`. Accepts `HandCreate` with community cards and player entries (hole cards, optional result/P&L). Auto-increments `hand_number`. Validates game exists. Returns `HandResponse`.

**Acceptance Criteria:**
1. Creates Hand and PlayerHand records with correct FKs
2. `hand_number` auto-increments (max existing + 1 for the game)
3. Returns full hand data including player hands

---

### T-019 — Implement duplicate card validation logic

**Category:** feature
**Dependencies:** T-007, T-018
**Story Ref:** S-1.5

Integrate card duplicate validation into the hand creation flow. Before committing a hand, collect all cards (community + all player hole cards) and validate no duplicates. Return 400 with a clear error listing the duplicated card(s).

**Acceptance Criteria:**
1. POST hand with duplicate cards returns 400 with the specific duplicated card(s)
2. Validation covers community-to-community, community-to-hole, and hole-to-hole duplicates
3. Valid hands with no duplicates pass through

---

### T-020 — Implement Get Single Hand endpoint

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-3.2

Implement `GET /games/{game_id}/hands/{hand_number}`. Returns full hand details: community cards, all player hole cards, results. 404 if not found.

**Acceptance Criteria:**
1. Returns community cards and all player entries
2. Returns 404 if game or hand doesn't exist

---

### T-021 — Implement List Hands in Game endpoint

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-3.3

Implement `GET /games/{game_id}/hands`. Returns all hands ordered by hand number. Each includes community cards and a summary (player count, street reached).

**Acceptance Criteria:**
1. Returns hands ordered by hand_number ascending
2. Each hand includes player count and farthest street (flop/turn/river)

---

### T-022 — Implement Record Hand Result endpoint

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-3.4

Implement `PATCH /games/{game_id}/hands/{hand_number}/results`. Accepts list of `{player_name, result, profit_loss}`. Updates only specified players. 404 if game/hand/player not found.

**Acceptance Criteria:**
1. Updates result and profit_loss for specified players only
2. Leaves unspecified players untouched
3. Returns 404 for nonexistent game, hand, or player

---

### T-023 — Write tests for Hand Management endpoints

**Category:** test
**Dependencies:** T-019, T-020, T-021, T-022
**Story Ref:** S-3.1–S-3.4

Write tests for hand creation, duplicate card rejection, get/list hands, and result recording. Include edge cases: hand with only flop, turn without river, duplicate cards across players.

**Acceptance Criteria:**
1. Tests cover create (flop only, full board), duplicate rejection, get, list, result update
2. Tests cover 404 cases for missing game/hand/player
3. All tests pass

---

### T-024 — Define CSV schema and build CSV parser

**Category:** feature
**Dependencies:** T-007
**Story Ref:** S-4.1

Define the canonical CSV column schema. Build a parser function that reads a CSV file (via `csv` module), maps rows to intermediate data structures, and validates column headers. Add a `GET /upload/csv/schema` endpoint that returns the expected schema.

**Acceptance Criteria:**
1. CSV schema is defined: `game_date,hand_number,player_name,hole_card_1,hole_card_2,flop_1,flop_2,flop_3,turn,river,result,profit_loss`
2. Parser reads CSV and returns structured data grouped by game_date + hand_number
3. Schema endpoint returns the column list and format expectations

---

### T-025 — Implement CSV upload and validation endpoint

**Category:** feature
**Dependencies:** T-024, T-010
**Story Ref:** S-4.2

Implement `POST /upload/csv` that accepts a file upload (using `python-multipart`). Parse the CSV, run validation (headers, card values, duplicate cards per hand), and return a validation report. Do NOT commit data yet.

**Acceptance Criteria:**
1. Accepts CSV file upload via multipart form
2. Returns validation report with per-row errors
3. Returns 400 if headers don't match schema

---

### T-026 — Implement CSV commit endpoint

**Category:** feature
**Dependencies:** T-025, T-018
**Story Ref:** S-4.3

Implement `POST /upload/csv/commit` (or a `commit=true` param on the upload endpoint). After successful validation, bulk-insert game sessions, players, hands, and player hands in a single transaction. Return summary counts.

**Acceptance Criteria:**
1. All data committed in one transaction (rollback on any error)
2. Auto-creates game sessions grouped by date and players by name
3. Returns summary: games created, hands created, players created/matched

---

### T-027 — Write tests for CSV ingestion pipeline

**Category:** test
**Dependencies:** T-026
**Story Ref:** S-4.1–S-4.3

Write tests with sample CSV fixtures: valid file, invalid headers, invalid cards, duplicate cards, multi-game file. Test both validation-only and commit flows.

**Acceptance Criteria:**
1. Tests cover valid upload + commit, header mismatch, invalid cards, duplicate cards
2. Tests confirm transactional rollback on error
3. All tests pass

---

### T-028 — Implement Edit Community Cards endpoint

**Category:** feature
**Dependencies:** T-018, T-019
**Story Ref:** S-5.1

Implement `PATCH /games/{game_id}/hands/{hand_number}` accepting updated community card values. Re-run duplicate card validation against existing player hole cards. Return updated hand.

**Acceptance Criteria:**
1. Updates community card columns on the Hand record
2. Rejects edits that introduce duplicate cards
3. Returns updated hand with all player entries

---

### T-029 — Implement Edit Player Hole Cards endpoint

**Category:** feature
**Dependencies:** T-018, T-019
**Story Ref:** S-5.2

Implement `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}` accepting updated hole cards. Re-run duplicate validation. Return updated player hand.

**Acceptance Criteria:**
1. Updates card_1 and card_2 on the PlayerHand record
2. Rejects edits that introduce duplicates within the hand
3. Returns 404 if player not found in that hand

---

### T-030 — Implement Add/Remove Player from Hand endpoints

**Category:** feature
**Dependencies:** T-018
**Story Ref:** S-5.3

Implement `POST /games/{game_id}/hands/{hand_number}/players` (add) and `DELETE /games/{game_id}/hands/{hand_number}/players/{player_name}` (remove). Validate cards on add. Return 404 on missing entities for delete.

**Acceptance Criteria:**
1. Add creates a PlayerHand with hole cards and validates no duplicates
2. Delete removes the PlayerHand record
3. Appropriate 404 responses for nonexistent entities

---

### T-031 — Write tests for editing endpoints

**Category:** test
**Dependencies:** T-028, T-029, T-030
**Story Ref:** S-5.1–S-5.3

Write tests for editing community cards, hole cards, adding/removing players. Include tests for duplicate card rejection after edits and 404 cases.

**Acceptance Criteria:**
1. Tests cover edit community, edit hole cards, add player, remove player
2. Tests cover duplicate rejection on edits
3. All tests pass

---

### T-032 — Implement Player Stats endpoint (win rate, P/L, hand freq)

**Category:** feature
**Dependencies:** T-022
**Story Ref:** S-6.1, S-6.2, S-6.3

Implement `GET /stats/players/{player_name}` returning computed stats: `win_rate`, `total_profit_loss`, `avg_profit_loss_per_session`, `avg_profit_loss_per_hand`, `total_hands_played`, `hands_won`, `hands_lost`, `hands_folded`, and street-reached distribution (% flop/turn/river).

**Acceptance Criteria:**
1. All stats derived from PlayerHand records with non-null results
2. Win rate = wins / total hands with results, as percentage
3. Street distribution computed from associated Hand's community card presence

---

### T-033 — Implement Leaderboard endpoint

**Category:** feature
**Dependencies:** T-032
**Story Ref:** S-6.4

Implement `GET /stats/leaderboard`. Returns all players ranked by total profit/loss descending. Each entry: rank, player name, total P/L, win rate, hands played. Optional `metric` query param for alternate sort.

**Acceptance Criteria:**
1. Default sort by total_profit_loss descending
2. `metric=win_rate` and `metric=hands_played` supported
3. Each entry includes rank, name, P/L, win rate, hands played

---

### T-034 — Implement Per-Session Stats endpoint

**Category:** feature
**Dependencies:** T-032
**Story Ref:** S-6.5

Implement `GET /stats/games/{game_id}`. Returns total hands, and per-player: win rate, profit/loss for that session. 404 if game doesn't exist.

**Acceptance Criteria:**
1. Returns total hands and per-player breakdown
2. Stats are scoped to only the specified game session
3. Returns 404 for nonexistent game

---

### T-035 — Write tests for statistics endpoints

**Category:** test
**Dependencies:** T-032, T-033, T-034
**Story Ref:** S-6.1–S-6.5

Write tests for player stats, leaderboard, and per-session stats. Seed data with known outcomes to verify computation accuracy.

**Acceptance Criteria:**
1. Tests verify correct win rate, P/L, and hand frequency calculations with known data
2. Tests cover leaderboard sorting by all supported metrics
3. All tests pass

---

### T-036 — Implement Search Hands by Player endpoint

**Category:** feature
**Dependencies:** T-020
**Story Ref:** S-7.1

Implement `GET /hands?player={player_name}`. Returns all hands the player participated in with game date, hand number, community cards, player's hole cards, and result. Paginated (default 50 per page, `page` and `per_page` params).

**Acceptance Criteria:**
1. Returns hands filtered by player participation
2. Response is paginated with total count, page, and per_page metadata
3. Each result includes full hand context

---

### T-037 — Implement Search Hands by Date Range and Card endpoints

**Category:** feature
**Dependencies:** T-036
**Story Ref:** S-7.2, S-7.3

Extend `GET /hands` with `date_from`, `date_to`, and `card` query params. Card search matches community or hole cards. Optional `location=community|hole` narrows card search. All filters are combinable and paginated.

**Acceptance Criteria:**
1. Date range filter works independently and combined with player filter
2. Card filter matches any occurrence by default; `location` narrows scope
3. Combined filters produce correct intersection results

---

### T-038 — Write tests for search/query endpoints

**Category:** test
**Dependencies:** T-037
**Story Ref:** S-7.1–S-7.3

Write tests for player search, date range filtering, card search, combined filters, and pagination. Seed sufficient data to verify filtering correctness and pagination boundaries.

**Acceptance Criteria:**
1. Tests cover single filter, combined filters, pagination edges
2. Tests verify card search across community and hole cards
3. All tests pass

---

### T-039 — Implement Image Upload endpoint

**Category:** feature
**Dependencies:** T-010, T-008
**Story Ref:** S-8.1

Create `routes/images.py`. Implement `POST /games/{game_id}/hands/image` accepting JPEG/PNG (max 10MB). Store image on local filesystem under `uploads/{game_id}/`. Create `ImageUpload` SQLAlchemy model (upload_id, game_id, file_path, status, created_at). Return upload_id with status "processing".

**Acceptance Criteria:**
1. Validates file type (JPEG/PNG) and size (≤ 10MB)
2. Stores file on disk and creates DB record
3. Returns upload_id and status "processing"

---

### T-040 — Implement Card Detection pipeline integration

**Category:** feature
**Dependencies:** T-039
**Story Ref:** S-8.2

Create a `CardDetector` protocol/interface with a `detect(image_path) -> list[DetectionResult]` method. Implement a `MockCardDetector` stub. Create `CardDetection` model (detection_id, upload_id, card_position, detected_value, confidence, bbox). After upload, run detection and store results.

**Acceptance Criteria:**
1. `CardDetector` protocol is defined with `detect` method
2. `MockCardDetector` returns plausible stub results
3. Detection results stored in `CardDetection` table with confidence scores
4. `GET /games/{game_id}/hands/image/{upload_id}` returns detection results

---

### T-041 — Implement Review and Confirm Detected Cards endpoint

**Category:** feature
**Dependencies:** T-040, T-018
**Story Ref:** S-8.3

Implement `POST /games/{game_id}/hands/image/{upload_id}/confirm` accepting confirmed card values (may differ from detected). Create a Hand + PlayerHand record from confirmed data. Link hand to the upload via a `source_upload_id` field. Run standard card validation.

**Acceptance Criteria:**
1. Creates Hand and PlayerHand records from confirmed values
2. Card validation runs (duplicates rejected)
3. Hand record links back to the source image upload

---

### T-042 — Implement Detection Correction feedback storage and tests

**Category:** feature
**Dependencies:** T-041
**Story Ref:** S-8.4

Create `DetectionCorrection` model (correction_id, upload_id, card_position, detected_value, corrected_value, created_at). When confirm payload differs from detection, store corrections. Implement `GET /images/corrections` returning all correction pairs. Write tests for the full image pipeline (upload → detect → review → confirm → corrections).

**Acceptance Criteria:**
1. Corrections stored when confirmed value ≠ detected value
2. `GET /images/corrections` returns full correction history
3. Tests cover upload, mock detection, confirm with corrections, and correction retrieval

---

### T-043 — Migrate package manager from Poetry to uv

**Category:** setup
**Dependencies:** none
**Story Ref:** —

Replace Poetry with uv as the project package manager. Convert `pyproject.toml` from Poetry-style `[tool.poetry]` sections to uv-compatible format (PEP 621 `[project]` metadata with `[dependency-groups]` for dev/test groups). Replace `poetry.lock` with `uv.lock`. Update `Dockerfile` to install and use `uv` instead of Poetry. Update `scripts/setup_poetry.sh` or replace with `scripts/setup_uv.sh`. Update `README.md` setup instructions. Verify `uv sync`, `uv run pytest`, and `uv run uvicorn` all work.

**Acceptance Criteria:**
1. `pyproject.toml` uses PEP 621 `[project]` metadata and `[dependency-groups]` — no `[tool.poetry]` sections remain
2. `uv.lock` exists and `poetry.lock` is removed
3. `Dockerfile` installs uv and uses `uv sync` / `uv run`
4. `uv run pytest` and `uv run uvicorn src.app.main:app` both succeed
5. Setup script and README updated with uv instructions

---

## Bugs / Findings

*Tasks in this section were discovered during code review. Each is linked to its source task via `discovered-from`. Priority mapping: HIGH → 1, MEDIUM → 2, LOW → 3.*

---

### T-044 — Fix: Add `Player.hands_played` relationship and wire `back_populates`

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4
**Blocks:** T-032

The T-005 spec explicitly required adding a `Player.hands_played` relationship, but it was never added to the `Player` model. `PlayerHand.player` was also defined without `back_populates`, leaving the relationship unidirectional. Accessing `player.hands_played` at runtime raises `AttributeError`. This breaks ORM traversal from `Player → PlayerHand` and will block the Player Stats endpoint (T-032).

**Fix:**
In `src/app/database/models.py`, add to the `Player` model:
```python
hands_played = relationship('PlayerHand', back_populates='player')
```
And update `PlayerHand.player` to:
```python
player = relationship('Player', back_populates='hands_played')
```

**Acceptance Criteria:**
1. `Player` has a `hands_played` attribute that returns associated `PlayerHand` records via ORM traversal
2. `PlayerHand.player` has `back_populates='hands_played'`
3. `some_player.hands_played` does not raise `AttributeError`
4. Existing tests continue to pass

---

### T-045 — Fix: Change `profit_loss` column type from `Float` to `Numeric(10,2)`

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4

`profit_loss` is stored as IEEE 754 `Float`, which accumulates binary rounding errors. For a poker analytics app where P&L values are summed across many hands for session and lifetime stats, these errors compound silently. This should use `Numeric(precision=10, scale=2)` for exact decimal representation, which supports values up to ±99,999,999.99 — sufficient for poker P&L.

**Fix:**
In `src/app/database/models.py`, update the `PlayerHand.profit_loss` column:
```python
profit_loss = Column(Numeric(precision=10, scale=2), nullable=True)
```
Ensure `Numeric` is imported from `sqlalchemy`.

**Acceptance Criteria:**
1. `profit_loss` column uses `Numeric(10, 2)` in the model
2. The Alembic migration (T-006) reflects the `Numeric` type, not `Float`
3. Values stored and retrieved round-trip without floating-point error (e.g., `0.10` returns `Decimal('0.10')`)

---

### T-046 — Fix: Add `Enum` constraint on `PlayerHand.result` column

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4

`result` is defined as an unbounded `String`, allowing any value (`"WIN"`, `"loser"`, `""`) to be inserted without error. The spec defines `result` as `"win/loss/fold"`, implying a fixed vocabulary. Without a DB-level constraint, stats queries that group on `result` will silently produce wrong output if inconsistent values are present. The Pydantic layer (T-007/T-008) should use the same enum values.

**Fix:**
In `src/app/database/models.py`, update the `PlayerHand.result` column:
```python
result = Column(Enum('win', 'loss', 'fold', name='hand_result'), nullable=True)
```
Ensure `Enum` is imported from `sqlalchemy`.

**Acceptance Criteria:**
1. `result` column uses `Enum('win', 'loss', 'fold', name='hand_result')`
2. Inserting a value outside `{'win', 'loss', 'fold'}` raises a DB-level error
3. `None` (nullable) is still accepted
4. The Alembic migration (T-006) includes the enum type definition

---

### T-047 — Fix: Add `cascade='all, delete-orphan'` to `Hand.player_hands` relationship

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4

`Hand.player_hands` has no `cascade` argument. Deleting a `Hand` via the ORM will not automatically delete associated `PlayerHand` records. Under SQLite (FK enforcement off by default), this leaves orphaned rows. Under PostgreSQL, it raises an `IntegrityError`. This is a latent data integrity risk ahead of T-030 (Add/Remove Player from Hand) and any future editing flow that deletes or replaces hands.

**Fix:**
In `src/app/database/models.py`, update the `Hand.player_hands` relationship:
```python
player_hands = relationship('PlayerHand', back_populates='hand', cascade='all, delete-orphan')
```

**Acceptance Criteria:**
1. `Hand.player_hands` relationship includes `cascade='all, delete-orphan'`
2. Deleting a `Hand` via the ORM automatically deletes all associated `PlayerHand` records
3. Existing tests continue to pass

---

### T-048 — Fix: Add NOT NULL enforcement tests for `card_1`, `card_2`, `hand_id`, `player_id`

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4

`card_1`, `card_2`, `hand_id`, and `player_id` are all `nullable=False` in the `PlayerHand` model, but no test asserts this. A typo or future refactor changing any to `nullable=True` would pass all 23 current tests undetected. Tests should assert the `nullable=False` constraint is present on each required column.

**Fix:**
Add a `TestPlayerHandNotNullColumns` class to `test/test_player_hand_model.py` (or extend `TestPlayerHandNullableColumns`). For each required column, assert that its `nullable` attribute is `False`:
```python
from sqlalchemy import inspect

def test_card_1_not_nullable(self):
    mapper = inspect(PlayerHand)
    col = next(c for c in mapper.columns if c.key == 'card_1')
    assert not col.nullable, 'card_1 should be NOT NULL'
```
Repeat for `card_2`, `hand_id`, and `player_id`.

**Acceptance Criteria:**
1. Test class exists asserting `nullable=False` for `card_1`, `card_2`, `hand_id`, and `player_id`
2. Tests are parametrized or cover all four columns explicitly
3. All new tests pass

---

### T-049 — Fix: Add `back_populates` to `PlayerHand.player` relationship

**Category:** bug
**Severity:** LOW
**Priority:** 3
**Discovered-from:** T-005
**Dependencies:** T-044
**Story Ref:** S-1.4

`PlayerHand.player` was defined without `back_populates`, making it unidirectional and inconsistent with `PlayerHand.hand` (which correctly uses `back_populates='player_hands'`). This is a direct symptom of the missing `Player.hands_played` relationship (H-1 / T-044). Fixing T-044 resolves this finding as a side-effect; this task serves as an explicit reminder to verify the wiring is complete and consistent.

**Fix:**
Verify that after applying T-044, `PlayerHand.player` reads:
```python
player = relationship('Player', back_populates='hands_played')
```
This task is considered complete once T-044 is merged and the `back_populates` on both sides is confirmed.

**Acceptance Criteria:**
1. `PlayerHand.player` has `back_populates='hands_played'`
2. `PlayerHand.hand` has `back_populates='player_hands'` (unchanged — confirming consistency)
3. Both relationships are bidirectional and symmetric

---

### T-050 — Fix: Enable SQLite FK enforcement (`PRAGMA foreign_keys = ON`) in test fixtures

**Category:** bug
**Severity:** LOW
**Priority:** 3
**Discovered-from:** T-005
**Dependencies:** none
**Story Ref:** S-1.4

SQLite disables FK enforcement by default. The `db_session` fixture in `test/test_player_hand_model.py` (and other model test files) does not execute `PRAGMA foreign_keys = ON`. Any test asserting that an FK violation raises `IntegrityError` would produce a false pass. This is a cross-cutting concern — the fix belongs in `test/conftest.py` so all test modules benefit automatically.

**Fix:**
In `test/conftest.py`, add an SQLAlchemy event listener to the shared test engine:
```python
from sqlalchemy import event

@event.listens_for(engine, 'connect')
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys=ON')
    cursor.close()
```
If individual test files create their own engines (rather than using the shared fixture), apply the same listener in each file or refactor them to use the `conftest.py` engine.

**Acceptance Criteria:**
1. `PRAGMA foreign_keys = ON` is applied to all SQLite test connections via `conftest.py`
2. A test that inserts a `PlayerHand` with a non-existent `hand_id` raises `IntegrityError` (verifying enforcement is active)
3. All existing tests continue to pass

---

### T-051 — Fix: Catch `IntegrityError` on `create_player` and return 409

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-abj (T-011)
**Dependencies:** none
**Story Ref:** S-1.1

TOCTOU race condition: `create_player` reads for an existing player with `func.lower(name)`, then inserts. Two concurrent requests can both pass the duplicate guard before either commits. On PostgreSQL, `Player.name` `unique=True` is case-sensitive, so `"Adam"` and `"adam"` are distinct rows — the application-level guard is the only protection. The second insert raises an unhandled `sqlalchemy.exc.IntegrityError`, returning HTTP 500 instead of 409.

**Fix:**
In `src/app/routes/players.py`, wrap `session.commit()` in a try/except and handle `IntegrityError`:
```python
from sqlalchemy.exc import IntegrityError

try:
    session.commit()
    session.refresh(player)
except IntegrityError:
    session.rollback()
    raise HTTPException(status_code=409, detail="Player already exists")
```
The existing pre-commit `func.lower()` check may be retained as a fast-path for sequential requests.

**Acceptance Criteria:**
1. A duplicate `POST /players` (same name, any case variation) returns 409, not 500
2. The session is rolled back before raising 409
3. A concurrent duplicate blocked only by the DB constraint also returns 409
4. All existing Player CRUD tests pass

---

### T-052 — Fix: Add input validation and whitespace strip on `PlayerCreate.name`

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-abj (T-011)
**Dependencies:** none
**Story Ref:** S-1.1

`PlayerCreate.name` is declared as `name: str` with no constraints. Empty strings, all-whitespace strings, and arbitrarily long names pass validation silently, potentially inserting junk rows or causing unexpected query behaviour.

**Fix:**
In `src/pydantic_models/app_models.py`, update `PlayerCreate`:
```python
from pydantic import BaseModel, Field, field_validator

class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name')
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError('name must not be blank')
        return stripped
```

**Acceptance Criteria:**
1. `PlayerCreate(name='')` raises a validation error
2. `PlayerCreate(name='   ')` raises a validation error
3. `PlayerCreate(name='  Alice  ')` normalises to `'Alice'`
4. `PlayerCreate(name='x' * 101)` raises a validation error
5. Existing valid-input tests pass without modification

---

### T-053 — Fix: Remove duplicate DB setup in `test_player_api.py`

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-abj (T-011)
**Dependencies:** none
**Story Ref:** —

`test/test_player_api.py` declares its own module-level `engine`, `SessionLocal`, `override_get_db`, and an `autouse` `setup_db` fixture, duplicating `conftest.py`. This creates a second independent in-memory engine with its own `create_all`/`drop_all` cycle. If any `conftest.py` fixture is also used in these tests, the two engines are out of sync and test isolation is fragile.

**Fix:**
Delete the module-level `engine`, `SessionLocal`, `override_get_db`, and `setup_db` declarations from `test/test_player_api.py`. Replace all local references with the shared `client` and `db_session` fixtures from `conftest.py`.

**Acceptance Criteria:**
1. `test_player_api.py` contains no module-level `create_engine`, `SessionLocal`, `override_get_db`, or `autouse` DB-setup fixture
2. All tests in the file pass using the shared `conftest.py` fixtures
3. `pytest test/test_player_api.py -v` shows no new failures

---

### T-054 — Fix: Add pagination to `GET /players`

**Category:** bug
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-abj (T-011)
**Dependencies:** none
**Story Ref:** S-1.1

`list_players` issues `SELECT *` with no `LIMIT` or `OFFSET`. A production table with thousands of players returns all rows in a single response, causing unbounded memory usage and slow response times.

**Fix:**
In `src/app/routes/players.py`, add `skip` and `limit` query parameters:
```python
@router.get('/players')
def list_players(skip: int = 0, limit: int = 100, session: Session = Depends(get_db)):
    return session.query(Player).offset(skip).limit(limit).all()
```

**Acceptance Criteria:**
1. `GET /players` accepts optional `skip` (default 0) and `limit` (default 100) query params
2. The underlying query applies `.offset(skip).limit(limit)`
3. `GET /players?skip=0&limit=2` returns at most 2 players
4. Existing list-players tests pass; a new test verifies the limit is applied

---

### T-055 — Fix: Add case-insensitive unique constraint on `Player.name`

**Category:** bug
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-abj (T-011)
**Dependencies:** none
**Story Ref:** S-1.1

`Player.name` carries a standard `unique=True` constraint, which is case-sensitive on PostgreSQL. This allows `"Alice"` and `"alice"` to coexist as separate rows. The application-layer `func.lower()` guard is the sole protection and is subject to the TOCTOU race in T-051.

**Fix:**
Remove `unique=True` from `Player.name` and introduce a functional unique index on `lower(name)`:
```python
# In Player model — Column definition
name = Column(String, nullable=False)
# In __table_args__:
__table_args__ = (
    Index('ix_player_name_lower', func.lower(name), unique=True),
)
```
Generate an Alembic migration to apply this change.

**Acceptance Criteria:**
1. `Player.name` column definition no longer carries `unique=True`
2. A functional unique index on `lower(name)` exists in the migration
3. Attempting to insert `"Alice"` when `"alice"` already exists raises `IntegrityError`
4. A new test verifies case-insensitive uniqueness is enforced at the DB level
5. Existing Player model tests pass

---

### T-056 — Fix: Deduplicate `player_names` before `GamePlayer` inserts

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-9cv (T-013)
**Dependencies:** none
**Story Ref:** S-2.1

`POST /games` accepts a `player_names` list with no deduplication. If `player_names` contains duplicates (e.g. `['Adam', 'Adam']`), the loop in `src/app/routes/games.py` (lines 25–33) finds or creates a single `Player` record but then attempts to insert two `GamePlayer` rows with identical composite primary key `(game_id, player_id)`. The second insert raises an unhandled `sqlalchemy.exc.IntegrityError`, returning HTTP 500 instead of 422.

**Fix:**
In `src/app/routes/games.py`, deduplicate `player_names` before the loop:
```python
unique_names = list(dict.fromkeys(payload.player_names))  # preserves insertion order
for name in unique_names:
    ...
```
Alternatively, catch `IntegrityError` on the `GamePlayer` insert and re-query, but input deduplication at the entry point is simpler and avoids the exception path entirely.

**Acceptance Criteria:**
1. `POST /games` with `player_names: ['Adam', 'Adam']` returns 201 with Adam listed once, not 500
2. A test asserts the deduplicated behaviour
3. Existing game session creation tests continue to pass

---

### T-057 — Fix: Wrap player auto-creation in `try/except IntegrityError` with re-query fallback

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-9cv (T-013)
**Dependencies:** none
**Story Ref:** S-2.1

Two concurrent `POST /games` requests with the same new player name will both reach the `if player is None` branch (`src/app/routes/games.py` lines 25–30) before either flush completes. Both then attempt `INSERT INTO players`; the second hits the `Player.name` unique constraint and raises an unhandled `IntegrityError`, returning HTTP 500. This is the same TOCTOU class as T-051 / F-020 but in the player auto-creation path inside `create_game_session`.

**Fix:**
In `src/app/routes/games.py`, wrap the auto-creation block in a `try/except IntegrityError` with a re-query fallback:
```python
from sqlalchemy.exc import IntegrityError

if player is None:
    try:
        player = Player(name=name)
        db.add(player)
        db.flush()
    except IntegrityError:
        db.rollback()
        player = (
            db.query(Player)
            .filter(func.lower(Player.name) == func.lower(name))
            .first()
        )
```

**Acceptance Criteria:**
1. A concurrent duplicate player-name insertion returns 201 for both callers, not 500
2. The re-queried player is correctly linked to the new game session via `GamePlayer`
3. Existing game session creation tests continue to pass

---

### T-058 — Fix: Deduplicate resolved `player_id` set after lookup for case-variant `player_names`

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-y3f (T-056)
**Beads:** aia-core-z9f
**Dependencies:** T-056
**Story Ref:** S-2.1

T-056 introduced `list(dict.fromkeys(payload.player_names))` to deduplicate the `player_names` list before the `GamePlayer` insert loop. However, `dict.fromkeys()` is case-sensitive: `["Adam", "adam"]` produces two distinct loop iterations. Both resolve to the same `Player` record via the case-insensitive lookup (`func.lower(Player.name) == func.lower(name)`), yielding the same `player_id`. The second `db.add(GamePlayer(game_id=..., player_id=...))` then attempts to insert a duplicate composite PK `(game_id, player_id)`, raising an unhandled `sqlalchemy.exc.IntegrityError` and returning HTTP 500.

**Fix:**
In `src/app/routes/games.py`, track already-inserted player IDs and skip any duplicate after resolution:
```python
seen_player_ids: set[int] = set()
for name in list(dict.fromkeys(payload.player_names)):
    player = db.query(Player).filter(func.lower(Player.name) == func.lower(name)).first()
    if player is None:
        player = Player(name=name)
        db.add(player)
        db.flush()
    if player.player_id in seen_player_ids:
        continue
    seen_player_ids.add(player.player_id)
    db.add(GamePlayer(game_id=game.game_id, player_id=player.player_id))
```

**Acceptance Criteria:**
1. `POST /games` with `player_names: ['Adam', 'adam']` returns 201 with Adam listed exactly once, not 500
2. A test asserts the case-variant deduplicated behaviour end-to-end
3. The exact-duplicate test added by T-056 (`['Adam', 'Adam']`) continues to pass
4. All existing game session creation tests continue to pass

---

### T-059 — Fix: Wire duplicate card validation into record_hand() before Hand flush

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-az2 (T-018)
**Beads:** TBD
**Dependencies:** T-019, T-018
**Story Ref:** S-3.1

S-3.1 AC-3 requires that a `POST /games/{game_id}/hands` request containing duplicate cards across community cards and all player hole cards is rejected. T-019 is scoped to build the `validate_no_duplicate_cards` utility and unit-test it in isolation. However, `record_hand()` never calls it. A request where Alice holds `AS/KH` and Bob also holds `AS/2D` returns HTTP 201 and stores the invalid data permanently. The endpoint is in a spec-violating state until the validator is wired in before `db.flush()` on the `Hand`.

**Fix:**
In `src/app/routes/hands.py`, before `db.add(hand)`, collect all card strings from the payload and call the validator:
```python
from pydantic_models.card_validator import validate_no_duplicate_cards

all_cards = [
    str(payload.flop_1), str(payload.flop_2), str(payload.flop_3),
    *(str(payload.turn),) if payload.turn else (),
    *(str(payload.river),) if payload.river else (),
    *(str(e.card_1) for e in payload.player_entries),
    *(str(e.card_2) for e in payload.player_entries),
]
try:
    validate_no_duplicate_cards(all_cards)
except ValueError as exc:
    raise HTTPException(status_code=422, detail=str(exc))
```

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands` with duplicate cards across community + player hole cards returns 422 (not 201)
2. No `Hand` or `PlayerHand` row is written to the database on rejection
3. A test confirms the rejection: e.g. Alice `AS/KH`, Bob `AS/2D` → 422
4. Existing valid-hand tests continue to return 201
5. The validator is invoked before the first `db.flush()` (no DB writes on failure)

---

### T-060 — Fix: Handle race condition in hand_number assignment

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-az2 (T-018)
**Dependencies:** T-018
**Story Ref:** S-3.1

`record_hand()` reads the current maximum `hand_number` for a game (`func.max(Hand.hand_number)`), increments it, and writes the result as the new hand's `hand_number`. This is a classic read-then-write TOCTOU race: two concurrent `POST /games/{game_id}/hands` requests can both read the same maximum (e.g. 3), both compute 4, and both attempt to insert a row with `hand_number = 4`. The second insert hits the `uq_hand_game_number` unique constraint and raises an unhandled `sqlalchemy.exc.IntegrityError`, returning HTTP 500 to the client.

**Fix (preferred):** Catch `IntegrityError` on the `db.flush()` after `db.add(hand)` and re-raise as HTTP 409:
```python
from sqlalchemy.exc import IntegrityError

try:
    db.flush()
except IntegrityError:
    db.rollback()
    raise HTTPException(
        status_code=409,
        detail="Hand number conflict — a concurrent request already recorded this hand. Please retry.",
    )
```
**Alternative:** Use a DB-level sequence or `AUTOINCREMENT`-like column for `hand_number` scoped to `game_id`, eliminating the read step entirely (requires a schema migration).

**Acceptance Criteria:**
1. Two simultaneous `POST /games/{game_id}/hands` requests do not produce HTTP 500
2. The second request receives HTTP 409 with a descriptive message (preferred fix) or succeeds with the next available number (sequence fix)
3. The `uq_hand_game_number` constraint is never violated in production
4. Existing single-request hand recording tests continue to pass

---

### T-061 — Fix: Guard against duplicate player_entries in record_hand()

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-az2 (T-018)
**Dependencies:** T-018
**Story Ref:** S-3.1

`record_hand()` iterates over `payload.player_entries` without checking for duplicate player names. If the same player appears twice (e.g. `[{player_name: "Alice", ...}, {player_name: "alice", ...}]`), the first iteration adds a `PlayerHand` and flushes. The second resolves the same `Player` record via the case-insensitive lookup, creates another `PlayerHand` for the same `(hand_id, player_id)` pair, and the `db.flush()` hits the `uq_player_hand` unique constraint, raising an unhandled `IntegrityError` → HTTP 500.

**Fix:**
Before the loop, check for duplicate player names:
```python
seen_names = {e.player_name.lower() for e in payload.player_entries}
if len(seen_names) != len(payload.player_entries):
    raise HTTPException(
        status_code=400,
        detail="Duplicate player names in player_entries are not allowed.",
    )
```

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands` with duplicate player names in `player_entries` returns 400 (not 500)
2. No `Hand` or `PlayerHand` row is written for the rejected request
3. A test confirms: same player name (case-insensitive) in two entries → 400
4. Existing tests with distinct player entries continue to pass

---

### T-062 — Perf: Move db.flush() outside player_entries loop in record_hand()

**Category:** task
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-az2 (T-018)
**Dependencies:** T-018
**Story Ref:** S-3.1

`record_hand()` calls `db.flush()` inside the `for entry in payload.player_entries` loop, once per player. Each flush forces a DB round-trip with no functional justification — no subsequent loop iteration reads the previously-flushed row, and `db.commit()` at the end persists all rows atomically. With N players this generates N unnecessary round-trips. The `hand_id` required by each `PlayerHand` is already available from the earlier `db.flush()` on the `Hand` row before the loop begins.

**Fix:**
Remove `db.flush()` from inside the loop and allow all `PlayerHand` inserts to flush as part of `db.commit()`.

**Acceptance Criteria:**
1. `db.flush()` does not appear inside the `player_entries` loop
2. All `PlayerHand` rows are still committed correctly on success
3. No functional change to the endpoint's response or error behaviour
4. Existing record-hand tests continue to pass

---

### T-063 — Cleanup: Remove unnecessary db.refresh(hand) after commit in record_hand()

**Category:** task
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-az2 (T-018)
**Dependencies:** T-018
**Story Ref:** S-3.1

After `db.commit()`, `record_hand()` calls `db.refresh(hand)`, issuing a `SELECT` to reload the `Hand` row from the database. The call is effectless: `HandResponse` is built from Python attributes already set before the commit (`hand.hand_id`, `hand.game_id`, `hand.hand_number`, community card fields, and `player_hand_responses` assembled during the loop). `db.refresh` would be necessary only if the response required a server-computed value not yet reflected in the Python object (e.g. a DB trigger-set timestamp). No such values are read.

**Fix:**
Remove `db.refresh(hand)` from `record_hand()`.

**Acceptance Criteria:**
1. `db.refresh(hand)` is not called after `db.commit()`
2. The `HandResponse` returned is unchanged — same fields, same values
3. Existing record-hand tests continue to pass

---

### T-064 — Perf: Use selectinload on Hand.player_hands in get_hand()

**Category:** task
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-rso (T-020)
**Dependencies:** T-020
**Story Ref:** S-3.2

`get_hand()` in `src/app/routes/hands.py` loads the `Hand` ORM object and then accesses `hand.player_hands` to build `HandResponse`. Because `player_hands` is a lazy-loaded relationship, SQLAlchemy issues a second `SELECT` query at the point of access — one query to fetch the `Hand` row, a second to load its `PlayerHand` children. For an endpoint that semantically returns a single record, this is an unnecessary extra round-trip. Any future addition of further nested relationships (e.g. loading `PlayerHand.player`) would compound the problem.

**Fix:**
In `src/app/routes/hands.py`, update the `get_hand()` query to eagerly load `Hand.player_hands` using `selectinload`:
```python
from sqlalchemy.orm import selectinload

hand = (
    db.query(Hand)
    .options(selectinload(Hand.player_hands))
    .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
    .first()
)
```
`selectinload` is preferred over `joinedload` here because the relationship is a collection and `selectinload` avoids row-multiplication.

**Acceptance Criteria:**
1. The `get_hand()` query uses `selectinload(Hand.player_hands)` at query time
2. No additional lazy-load `SELECT` is issued when `hand.player_hands` is accessed to build the response
3. Existing `GET /games/{game_id}/hands/{hand_number}` tests continue to pass

---

### T-065 — Fix: Add explicit guard on Game query before Hand query in get_hand()

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-rso (T-020)
**Dependencies:** T-020
**Story Ref:** S-3.2

`get_hand()` queries for the `Hand` directly using `(Hand.game_id == game_id, Hand.hand_number == hand_number)`. If the `game_id` does not exist, the `Hand` query correctly returns `None` and the existing 404 guard fires. However, there is no prior explicit check that the `GameSession` itself exists. A future refactor that inlines or reorders the query — or one that returns a stale session object through a different code path — could bypass the implicit guard and allow execution to proceed with a `None` game, risking an unhandled `AttributeError`. The guard is also semantically important for producing a diagnostic 404 message that distinguishes between "game not found" and "hand not found" — currently both collapse to the same 404.

**Fix:**
In `src/app/routes/hands.py`, add an explicit game existence check before the `Hand` query:
```python
game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
if game is None:
    raise HTTPException(status_code=404, detail=f"Game {game_id} not found")

hand = (
    db.query(Hand)
    .options(selectinload(Hand.player_hands))
    .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
    .first()
)
if hand is None:
    raise HTTPException(status_code=404, detail=f"Hand {hand_number} not found in game {game_id}")
```

**Acceptance Criteria:**
1. A `GET /games/{game_id}/hands/{hand_number}` request where `game_id` does not exist returns 404 with a message containing `"Game"` (not just `"Hand"`)
2. A request where the game exists but the hand does not returns 404 with a message containing `"Hand"`
3. A valid request returns 200 with the full hand data
4. Existing tests continue to pass; a new test covers the game-not-found 404 path

---

### T-066 — Fix: Wrap CSV `file.read().decode()` in `try/except` and return 400 on `UnicodeDecodeError`

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-pk6 (T-025)
**Dependencies:** T-025
**Story Ref:** S-4.2

`POST /upload/csv` calls `await file.read()` and immediately calls `.decode('utf-8')` on the raw bytes. If the uploaded file is not valid UTF-8 (e.g. a Latin-1 or Windows-1252 CSV), `.decode('utf-8')` raises an unhandled `UnicodeDecodeError`, which propagates to FastAPI's default exception handler and returns HTTP 500. The caller receives no actionable information; since the error is caused by a bad client input (a non-UTF-8 file), the correct response is HTTP 400 with a descriptive error message.

**Fix:**
In `src/app/routes/upload.py`, wrap the decode call in a `try/except`:
```python
try:
    content = (await file.read()).decode('utf-8')
except UnicodeDecodeError:
    raise HTTPException(
        status_code=400,
        detail="CSV file must be UTF-8 encoded. Re-save the file as UTF-8 and retry.",
    )
```

**Acceptance Criteria:**
1. Uploading a non-UTF-8 CSV file (e.g. Latin-1 or Windows-1252 encoded) returns HTTP 400, not 500
2. The 400 response body contains a `detail` message indicating the file must be UTF-8 encoded
3. A valid UTF-8 CSV continues to be processed normally
4. A test covers the non-UTF-8 path: upload a bytes payload that is valid Latin-1 but raises `UnicodeDecodeError` under UTF-8, and assert HTTP 400

---

### T-067 — Fix: Add file size limit (10 MB) to CSV upload endpoint and return 413 if exceeded

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-pk6 (T-025)
**Dependencies:** T-025
**Story Ref:** S-4.2

`POST /upload/csv` calls `await file.read()` with no size limit, buffering the entire multipart file body into memory before any validation occurs. A malicious or accidental large upload (hundreds of MB) will consume heap memory until the server exhausts available RAM, causing OOM errors or degrading service for concurrent requests. This is a memory-exhaustion denial-of-service vector. A 10 MB cap is consistent with the image upload limit applied in T-039 and is sufficient for any realistic poker session CSV file.

**Fix:**
In `src/app/routes/upload.py`, read only up to the size cap and reject if exceeded:
```python
MAX_CSV_SIZE = 10 * 1024 * 1024  # 10 MB

raw = await file.read(MAX_CSV_SIZE + 1)
if len(raw) > MAX_CSV_SIZE:
    raise HTTPException(
        status_code=413,
        detail="CSV file exceeds the maximum allowed size of 10 MB.",
    )
```
Reading `MAX_CSV_SIZE + 1` bytes allows detection of oversized files without loading the full body: if `len(raw) > MAX_CSV_SIZE`, the file was larger than the cap.

**Acceptance Criteria:**
1. An upload whose body exceeds 10 MB returns HTTP 413, not 200 or 500
2. The 413 response body contains a `detail` message stating the 10 MB limit
3. An upload of exactly 10 MB (or under) is processed normally
4. A test sends a payload of `MAX_CSV_SIZE + 1` bytes and asserts HTTP 413
5. The in-memory buffer never holds more than `MAX_CSV_SIZE + 1` bytes for any single request

---

### T-068 — Fix: Validate non-card fields (game_date, hand_number, profit_loss) before CSV commit

**Category:** bug
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-chy (T-026)
**Dependencies:** T-025
**Story Ref:** S-4.3

`validate_csv_rows` validates card values (hole cards, community cards) but does not validate non-card scalar fields. An invalid `game_date` format (e.g. `"not-a-date"`), a non-integer `hand_number` (e.g. `"two"`), or a non-numeric `profit_loss` (e.g. `"abc"`) all pass the validation step without error. When `POST /upload/csv/commit` subsequently coerces these values (e.g. `datetime.strptime(row['game_date'], ...)` or `int(row['hand_number'])`), an unhandled `ValueError` or `TypeError` propagates through FastAPI's exception handler as HTTP 500. The caller received a clean validation report, making the crash on commit surprising and providing no actionable information about which row caused the failure.

**Fix:**
Extend `validate_csv_rows` (or add a `validate_commit_fields` step invoked from the same validation pass) to coerce and check non-card fields during upload:
```python
from datetime import datetime

# game_date: must be parseable as YYYY-MM-DD
try:
    datetime.strptime(row['game_date'], '%Y-%m-%d')
except ValueError:
    errors.append(f"Row {i}: invalid game_date '{row['game_date']}' — expected YYYY-MM-DD")

# hand_number: must be a positive integer
if not str(row['hand_number']).isdigit() or int(row['hand_number']) < 1:
    errors.append(f"Row {i}: hand_number must be a positive integer, got '{row['hand_number']}'")

# profit_loss: if present, must be parseable as a float
if row.get('profit_loss') not in (None, ''):
    try:
        float(row['profit_loss'])
    except ValueError:
        errors.append(f"Row {i}: profit_loss must be a number, got '{row['profit_loss']}'")
```

**Acceptance Criteria:**
1. A CSV row with `game_date` not matching `YYYY-MM-DD` returns HTTP 400 with a per-row error from `POST /upload/csv`, not a 500 from `POST /upload/csv/commit`
2. A CSV row with a non-integer `hand_number` (e.g. `"two"`) returns HTTP 400 with a per-row error
3. A CSV row with a non-numeric `profit_loss` (e.g. `"abc"`) returns HTTP 400 with a per-row error
4. A CSV with valid non-card fields continues to commit successfully
5. The error detail includes the row index and the field name

---

### T-069 — Perf: Replace per-row GamePlayer existence check in CSV commit with pre-loaded pair set

**Category:** task
**Severity:** MEDIUM
**Priority:** 2
**Discovered-from:** aia-core-chy (T-026)
**Dependencies:** T-026
**Story Ref:** S-4.3

`POST /upload/csv/commit` checks whether each `(game_id, player_id)` pair already exists as a `GamePlayer` row before inserting it. The check is issued inside the per-row processing loop: `db.query(GamePlayer).filter(GamePlayer.game_id == ..., GamePlayer.player_id == ...).first()` is called for every player row in the CSV. A CSV with 10 players and 100 hands generates up to 1 000 individual SQL queries for membership checks alone. The pattern is structurally identical to the N+1 issue in F-062 / F-042, but occurs in a bulk write path where transaction overhead amplifies the cost. A single commit of a moderately sized session CSV can degrade performance and exhaust the database connection pool under concurrent load.

**Fix:**
Pre-load the complete set of existing `(game_id, player_id)` pairs for all relevant games in a single query before the loop, then use in-memory set membership to decide whether each insert is needed:
```python
relevant_game_ids = {row['_game_id'] for row in processed_rows}
existing_pairs: set[tuple[int, int]] = set(
    db.query(GamePlayer.game_id, GamePlayer.player_id)
    .filter(GamePlayer.game_id.in_(relevant_game_ids))
    .all()
)

for row in processed_rows:
    pair = (row['_game_id'], row['_player_id'])
    if pair not in existing_pairs:
        db.add(GamePlayer(game_id=pair[0], player_id=pair[1]))
        existing_pairs.add(pair)  # guard against duplicate inserts within this commit
```
Alternatively, use a bulk `INSERT ... ON CONFLICT DO NOTHING` (`insert().prefix_with('OR IGNORE')` on SQLite, or `on_conflict_do_nothing()` on PostgreSQL).

**Acceptance Criteria:**
1. `db.query(GamePlayer)` is not called inside the per-row or per-player-entry loop
2. A single pre-load query retrieves all existing `(game_id, player_id)` pairs for the CSV's games before processing begins
3. Total `GamePlayer`-related DB round-trips scale O(G) where G = number of distinct game IDs in the CSV, not O(N) where N = total player-row count
4. Existing CSV commit tests continue to pass
5. A CSV with 10 players × 100 hands does not issue more than O(10) `GamePlayer` queries

---

### T-070 — Fix: Add community card consistency check across CSV rows for the same hand group

**Category:** bug
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-chy (T-026)
**Dependencies:** T-026
**Story Ref:** S-4.3

The CSV commit handler groups rows by `(game_date, hand_number)` and takes `first_row = rows[0]` to obtain community card values for the `Hand` record. No check verifies that all rows in the group carry identical community card values. If two rows for the same hand differ on any community card field — for example, one row has `flop_1 = 'AS'` and another has `flop_1 = 'KH'` — the discrepancy is silently ignored: `first_row`'s values are used and the conflicting value is discarded without warning. The committed `Hand` record may therefore not reflect the actual game state, and the data loss is undetectable after commit.

**Fix:**
During the validation pass, compare every row in each hand group against `first_row` for the five community card fields and collect errors for any mismatch:
```python
COMMUNITY_FIELDS = ('flop_1', 'flop_2', 'flop_3', 'turn', 'river')

for (game_date, hand_number), rows in hand_groups.items():
    first = rows[0]
    for i, row in enumerate(rows[1:], start=2):
        for field in COMMUNITY_FIELDS:
            if row.get(field) != first.get(field):
                errors.append(
                    f"Hand {hand_number} on {game_date}: conflicting '{field}' values "
                    f"(row 1: '{first.get(field)}', row {i}: '{row.get(field)}')"
                )
```
This check should run during `POST /upload/csv` (the validation-only endpoint) so that errors surface as HTTP 400 before any writes occur.

**Acceptance Criteria:**
1. A CSV where two rows for the same hand have different `flop_1` values returns HTTP 400 with a per-hand error during the upload/validation step
2. The error message identifies the hand (`game_date` + `hand_number`), the conflicting field name, and both differing values
3. A CSV with consistent community card values across all rows for each hand continues to commit successfully
4. The consistency check covers all five community card fields: `flop_1`, `flop_2`, `flop_3`, `turn`, and `river`
5. The check runs during the validation pass (pre-commit), not inside the commit transaction

---

### T-071 — Perf: Add GamePlayer existence cache in CSV commit to eliminate redundant reads for cached players

**Category:** task
**Severity:** LOW
**Priority:** 3
**Discovered-from:** aia-core-chy (T-026)
**Dependencies:** T-026
**Story Ref:** S-4.3

The CSV commit handler caches resolved `Player` objects in `player_by_name` to avoid re-querying the `players` table on every row. No equivalent cache exists for the `GamePlayer` existence check. For a player appearing in 50 hands of the same game, the `Player` lookup is issued once and reused from cache — but `db.query(GamePlayer).filter(...).first()` is re-issued for the same `(game_id, player_id)` pair on every one of those 50 rows. The `player_by_name` optimisation reduces player lookups from O(N) to O(P) while `GamePlayer` checks remain O(N), where N = total player-row count and P = distinct player count.

Note: T-069 addresses this concern at a broader level by pre-loading all `(game_id, player_id)` pairs before the loop. T-071 is retained as an independent task to document the cache asymmetry and ensure it is not re-introduced if T-069 is partially applied (e.g. the pre-load covers existing pairs from prior commits but not pairs inserted during the current commit).

**Fix:**
Add a `game_player_seen` set that tracks `(game_id, player_id)` pairs already checked or inserted during the current commit request:
```python
game_player_seen: set[tuple[int, int]] = set()

for row in processed_rows:
    pair = (row['_game_id'], row['_player_id'])
    if pair not in game_player_seen:
        exists = db.query(GamePlayer).filter(
            GamePlayer.game_id == pair[0],
            GamePlayer.player_id == pair[1],
        ).first()
        if not exists:
            db.add(GamePlayer(game_id=pair[0], player_id=pair[1]))
        game_player_seen.add(pair)  # within-request cache only
```
This reduces `GamePlayer` queries from O(N) to O(P × G), matching the effective complexity of the `player_by_name` cache for player lookups.

**Acceptance Criteria:**
1. `db.query(GamePlayer)` is called at most once per distinct `(game_id, player_id)` pair within a single commit request
2. A player appearing in 50 hands of the same game triggers at most one `GamePlayer` DB query, not 50
3. All required `GamePlayer` rows are still created correctly for new player-game pairs
4. Existing CSV commit tests continue to pass
5. The `game_player_seen` variable (or equivalent) is scoped to the request handler, not the module, to prevent cross-request state leakage

---

### T-072 — Fix: Sanitize uploaded filename to prevent path traversal

**Category:** bug
**Severity:** CRITICAL
**Priority:** 0
**Discovered-from:** aia-core-tk6 (T-039)
**Dependencies:** T-039
**Story Ref:** S-8.1

The image upload handler passes `file.filename` directly to `os.path.join(upload_dir, file.filename)` without any sanitization. An attacker supplying a crafted filename such as `../../etc/cron.d/evil` or `../app/main.py` bypasses the intended `uploads/{game_id}/` isolation and writes arbitrary content to any path the server process can access. This is a path traversal vulnerability (OWASP A01 — Broken Access Control / CWE-22). A single POST request to any valid `game_id` is sufficient to exploit this.

**Fix:**
```python
safe_name = os.path.basename(file.filename)
file_path = os.path.join(upload_dir, safe_name)
```
`os.path.basename` returns only the terminal component (e.g. `evil` from `../../etc/cron.d/evil`), confining all writes to `upload_dir`.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/image` with `filename='../../etc/cron.d/evil'` does NOT write outside `uploads/`
2. The stored `file_path` value begins with `uploads/{game_id}/`
3. Filenames containing `/`, `..`, or absolute paths are safely reduced to their basename only
4. Existing upload tests continue to pass with valid filenames

---

### T-073 — Fix: Replace Content-Type-only validation with magic byte inspection for image uploads

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-tk6 (T-039)
**Dependencies:** T-039
**Story Ref:** S-8.1

The upload handler validates the file type solely by checking `file.content_type` against `ALLOWED_CONTENT_TYPES`. The `Content-Type` header is fully client-controlled: any client can submit a shell script, binary executable, or PHP file with `Content-Type: image/jpeg` and the check will pass. The file is then written to disk, where it may be served or executed depending on server configuration. Magic byte (file signature) inspection of the actual file content is the accepted mitigation for this class of attack. JPEG files begin with `\xff\xd8\xff`; PNG files begin with `\x89PNG\r\n\x1a\n`.

**Fix:**
```python
JPEG_MAGIC = b'\xff\xd8\xff'
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'

if not (content.startswith(JPEG_MAGIC) or content.startswith(PNG_MAGIC)):
    raise HTTPException(
        status_code=415,
        detail='File content does not match a recognized JPEG or PNG signature.',
    )
```
The existing `content_type` check may be retained as a cheap first-pass filter, but the magic byte check is the authoritative gate.

**Acceptance Criteria:**
1. Uploading a text file with `Content-Type: image/jpeg` returns HTTP 415
2. Uploading a valid JPEG with `Content-Type: image/jpeg` returns HTTP 201
3. Uploading a valid PNG with `Content-Type: image/png` returns HTTP 201
4. Magic byte check runs after `await file.read()` — no second read is needed
5. The JPEG check uses the three-byte prefix `\xff\xd8\xff`; the PNG check uses the eight-byte signature `\x89PNG\r\n\x1a\n`

---

### T-074 — Fix: Prevent silent overwrite of uploaded files with same game_id and filename

**Category:** bug
**Severity:** HIGH
**Priority:** 1
**Discovered-from:** aia-core-tk6 (T-039)
**Dependencies:** T-039, T-072
**Story Ref:** S-8.1

The upload handler constructs the file path as `uploads/{game_id}/{filename}`. A second upload for the same `game_id` with an identical filename causes `open(file_path, 'wb')` to silently overwrite the existing file on disk. The DB insert creates a second `ImageUpload` record pointing to the same path, the first record's data is destroyed without error, and any downstream detection workflow operating on the first `upload_id` will process incorrect (overwritten) image data. The API returns HTTP 201 for both requests with no indication of the data loss.

**Fix:** Incorporate `upload_id` into the stored filename so every upload writes to a unique path. This requires a two-step DB interaction — flush to obtain the primary key, then rename the file and update the record:
```python
import uuid
# Write to a temporary path to avoid contention before upload_id is known
tmp_path = os.path.join(upload_dir, f'tmp_{uuid.uuid4().hex}')
with open(tmp_path, 'wb') as f:
    f.write(content)

record = ImageUpload(game_id=game_id, file_path=tmp_path, status='processing')
db.add(record)
db.flush()  # assigns upload_id without committing

safe_name = os.path.basename(file.filename)  # T-072 prerequisite
final_name = f'{record.upload_id}_{safe_name}'
final_path = os.path.join(upload_dir, final_name)
os.rename(tmp_path, final_path)
record.file_path = final_path
db.commit()
db.refresh(record)
```
Note: apply T-072 first so that `safe_name` is already sanitized before being incorporated into `final_path`.

**Acceptance Criteria:**
1. Two uploads for the same `game_id` with identical filenames produce two distinct files on disk (e.g. `1_photo.jpg` and `2_photo.jpg`)
2. Each `ImageUpload` DB record's `file_path` is unique and matches a file that exists on disk
3. Files from prior uploads are not overwritten on subsequent uploads with the same filename
4. If `db.commit()` fails after the disk write, the temporary file is deleted and no orphaned file is left in `uploads/`

---

## Bugs / Findings

### F-001 — Single-record-only traversal test (T-044)

**Source Task:** aia-core-q9i (T-044: Fix: Add Player.hands_played relationship and wire back_populates)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_player_model.py — `test_player_hands_played_traversal`

`test_player_hands_played_traversal` creates exactly one `PlayerHand` record and asserts `len(player.hands_played) == 1`. A multi-hand case (same player, two distinct hands) is not tested, leaving a collection-loading edge case unverified. If the relationship were misconfigured to return only the first record, this test would not catch it.

**Suggested follow-up:** Add a parameterised or second test that creates two `PlayerHand` records for the same player and asserts `len(player.hands_played) == 2`.

---

### F-002 — No empty-list baseline test (T-044)

**Source Task:** aia-core-q9i (T-044: Fix: Add Player.hands_played relationship and wire back_populates)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_player_model.py — `TestPlayerHandsPlayedRelationship`

No test in `TestPlayerHandsPlayedRelationship` verifies that a freshly created `Player` with zero associated `PlayerHand` records returns `[]` from `player.hands_played`. This is the normal initial state for any new player and is directly relevant to T-032 (Player Stats endpoint), which iterates over `player.hands_played` to compute stats — an unverified `None` vs `[]` distinction could cause a runtime `TypeError` there.

**Suggested follow-up:** Add a test `test_player_hands_played_empty_by_default` that creates a `Player`, commits, refreshes, and asserts `player.hands_played == []`.

---

### F-003 — env.py missing render_as_batch=True (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** alembic/env.py — both `context.configure` calls (offline and online)

`render_as_batch=True` is absent from both `context.configure` calls. SQLite does not support `ALTER TABLE` natively; any future ALTER-based migration (T-045, T-046) will fail or emit invalid SQL without this flag.

**Suggested follow-up:** Add `render_as_batch=True` to both `context.configure` calls (offline and online) before any ALTER migration is authored.

---

### F-004 — profit_loss uses Float, not Numeric(10,2) (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** alembic/versions/731dac60f062_create_initial_tables.py — `profit_loss` column definition

The migration uses `Float` for the `profit_loss` column. Known debt tracked in T-045, but shipping in the initial migration means the fix requires an ALTER migration rather than a simple schema edit. All P&L aggregations will silently accumulate floating-point rounding errors until fixed.

**Suggested follow-up:** Address in T-045; ensure `render_as_batch=True` (F-003) is in place before authoring that ALTER migration.

---

### F-005 — result uses unbounded String, no Enum constraint (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** alembic/versions/731dac60f062_create_initial_tables.py — `result` column definition

Known debt tracked in T-046. The `result` column accepts any string value with no Enum or CHECK constraint enforced at the database level. Any invalid string written to this column will silently break `GROUP BY result` stats queries.

**Suggested follow-up:** Address in T-046 by converting `result` to a constrained Enum or adding a CHECK constraint.

---

### F-006 — FK columns have no indexes (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** alembic/versions/731dac60f062_create_initial_tables.py — `game_players`, `hands`, `player_hands` table definitions

`game_players.game_id` / `player_id`, `hands.game_id`, and `player_hands.hand_id` / `player_id` have no explicit indexes. SQLite does not auto-create indexes for FK columns. This will cause full-table scans on every join used by the Stats and Search endpoints.

**Suggested follow-up:** Add explicit `sa.Index` entries for each FK column in the migration (or in a follow-up migration before the Stats/Search endpoints are wired up).

---

### F-007 — Tests verify table presence only (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_alembic_setup.py — `test_upgrade_head_creates_all_tables`

`test_upgrade_head_creates_all_tables` asserts only that expected table names exist; it does not assert column types, nullability, FK presence, or named constraint existence. AC-2 states "correct columns, FKs, and constraints" — those are entirely untested.

**Suggested follow-up:** Extend the test (or add a companion test) to introspect column definitions and FK metadata using SQLAlchemy's `inspect()` API.

---

### F-008 — Module docstring references T-001 instead of T-006 (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_alembic_setup.py — module docstring

The module docstring says T-001; the file now covers T-006. Documentation drift that will confuse future readers tracing test coverage.

**Suggested follow-up:** Update the module docstring to reference T-006.

---

### F-009 — alembic.ini hardcodes poker.db with no env-var override (T-006)

**Source Task:** aia-core-ewq (T-006: Write initial Alembic migration for all new models)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** alembic.ini — `sqlalchemy.url`

`alembic upgrade head` run from the repo root will target the production `poker.db` file with no warning and no mechanism to override the target via environment variable. Running migrations in CI or a dev environment will silently modify or create the production database file.

**Suggested follow-up:** Read `DATABASE_URL` (or equivalent) from the environment in `alembic/env.py` and fall back to the `alembic.ini` value only when the variable is unset.

---

### F-010 — Online env.py test uses unbounded EOF slice (T-047)

**Source Task:** aia-core-uas (T-047: Fix: Add render_as_batch=True to Alembic env.py context.configure calls)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_alembic_setup.py — `test_env_py_has_render_as_batch_online`

`test_env_py_has_render_as_batch_online` slices `env_py[online_start:]` to EOF, while the offline test correctly bounds its slice to the next dispatch block. If `render_as_batch=True` were ever present in dead code appended after the function — but absent from the actual `context.configure()` call — the online test would pass despite the fix being missing, producing a false positive.

**Suggested fix:** Bound the online slice to stop at the dispatch block (e.g. the next `def ` or `with context.begin_transaction()` boundary), mirroring the approach used in the offline assertion.

---

### F-011 — check_same_thread: False applied unconditionally (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/database/session.py

`connect_args={"check_same_thread": False}` is passed to `create_engine` regardless of the database URL. This is a SQLite-only DBAPI argument. When `DATABASE_URL` is set to a PostgreSQL URL, `psycopg2` rejects the unknown kwarg with a `TypeError` at engine creation, making the env-var pathway non-functional.

**Suggested fix:** Make `connect_args` conditional on `DATABASE_URL.startswith('sqlite')`.

---

### F-012 — client fixture never clears dependency_overrides (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** test/conftest.py

The `client` fixture uses `return` instead of `yield`, so `app.dependency_overrides` is never cleared after the test. The in-memory DB override persists for the entire test session on the shared app singleton, potentially contaminating unrelated tests.

**Suggested fix:** Change to `yield TestClient(app)` and add `app.dependency_overrides.clear()` in teardown.

---

### F-013 — get_db missing rollback on exception (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/session.py — `get_db`

`get_db` has no exception handling. `Session.close()` does not rollback, so a partial transaction from an error path can leave the connection dirty.

**Suggested fix:** Add `except Exception: db.rollback(); raise` before the `finally` block.

---

### F-014 — test_engine_uses_database_url_env_or_default assertion too loose (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_session_dependency.py — `test_engine_uses_database_url_env_or_default`

The assertion `('sqlite' in url or 'postgresql' in url)` passes for any SQLite URL, providing no coverage of the specific required default.

**Suggested fix:** Assert the exact default value `'sqlite:///./poker.db'` rather than a broad substring check.

---

### F-015 — Missing return type annotation on get_db (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/database/session.py — `get_db`

`get_db` has no return type annotation. The correct annotation is `Generator[Session, None, None]`.

**Suggested fix:** Add `-> Generator[Session, None, None]` to the function signature and import `Generator` from `typing`.

---

### F-016 — Path-relative Path('src/...') in test assertions (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_session_dependency.py

Assertions using `Path('src/...')` are fragile when pytest is invoked from a directory other than the project root, causing tests to fail with misleading path errors.

**Suggested fix:** Use `Path(__file__).parent.parent / 'src' / ...` to anchor paths relative to the test file.

---

### F-017 — Env-var DATABASE_URL branch has zero test coverage (T-010)

**Source Task:** aia-core-8h2 (T-010: Implement database session dependency with new engine)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/database/session.py

The `DATABASE_URL` env-var branch is executed at module import time. Once the module is cached in `sys.modules`, setting the env var in a test has no effect, making the branch untestable without explicit test isolation (e.g. `importlib.reload` or `monkeypatch` + module reload).

**Suggested fix:** Wrap engine creation in a factory function or lazy-initializer so the env var is read at call time, enabling proper test isolation.

---

### F-018 — .clear() vs targeted key removal in conftest fixture (T-049)

**Source Task:** aia-core-med (T-049: Fix: client fixture in conftest.py must yield and clear dependency_overrides)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/conftest.py (line 37)

`app.dependency_overrides.clear()` removes all overrides, but the fixture only owns the `get_db` entry. If a future test registers additional overrides before this fixture tears down, they will be silently wiped. The more precise pattern is `app.dependency_overrides.pop(get_db, None)`, which removes only the entry this fixture installed.

No active bug since only one override exists today.

**Suggested fix:** Replace `app.dependency_overrides.clear()` with `app.dependency_overrides.pop(get_db, None)`.

---

### F-019 — TestClient not used as context manager (T-049)

**Source Task:** aia-core-med (T-049: Fix: client fixture in conftest.py must yield and clear dependency_overrides)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/conftest.py

`yield TestClient(app)` (bare) skips app startup and shutdown lifespan events. FastAPI recommends using `TestClient` as a context manager so that lifespan handlers are exercised: `with TestClient(app) as client: yield client`. No current impact since no lifespan handlers are registered, but the pattern should be adopted before any are added.

**Suggested fix:** Replace `yield TestClient(app)` with `with TestClient(app) as client: yield client`.

---

### F-020 — TOCTOU race condition on duplicate detection (T-011)

**Source Task:** aia-core-abj (T-011: Implement Player CRUD endpoints)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/players.py — `create_player` (lines 20–31)

The handler reads for an existing player with `func.lower(name)`, then inserts. Two concurrent requests can both pass the guard before either commits. On PostgreSQL, `Player.name unique=True` is case-sensitive, so `"Adam"` and `"adam"` are distinct rows — the application-level guard is the sole protection. The second insert raises an unhandled `IntegrityError`, returning HTTP 500 instead of 409. **Tracked as T-051.**

**Suggested follow-up:** Catch `sqlalchemy.exc.IntegrityError` after commit and raise 409; see also T-055 / F-024 for the complementary DB-level fix.

---

### F-021 — No input validation on `PlayerCreate.name` (T-011)

**Source Task:** aia-core-abj (T-011: Implement Player CRUD endpoints)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/pydantic_models/app_models.py — `PlayerCreate.name`

`name: str` has no `min_length`, no `strip()`, and no max length. Empty strings and all-whitespace values pass validation silently. **Tracked as T-052.**

**Suggested follow-up:** Use `name: str = Field(min_length=1, max_length=100)` and add a `field_validator` that strips whitespace and rejects blank strings.

---

### F-022 — Test file reinvents conftest infrastructure (T-011)

**Source Task:** aia-core-abj (T-011: Implement Player CRUD endpoints)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_player_api.py — module-level setup

Module-level `engine`, `SessionLocal`, `override_get_db`, and `setup_db` (autouse) duplicate `conftest.py`, creating two independent `create_all`/`drop_all` cycles on separate engines. **Tracked as T-053.**

**Suggested follow-up:** Remove the module-level DB setup from `test_player_api.py` and rely on the shared `client` and `db_session` fixtures from `conftest.py`.

---

### F-023 — No pagination on `GET /players` (T-011)

**Source Task:** aia-core-abj (T-011: Implement Player CRUD endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/players.py — `list_players`

`SELECT *` with no `LIMIT`/`OFFSET`. A large player table returns all rows in a single response. **Tracked as T-054.**

**Suggested follow-up:** Add `skip: int = 0` and `limit: int = 100` query params; apply `.offset(skip).limit(limit)` to the query.

---

### F-024 — `Player.name` unique constraint is case-sensitive at DB level (T-011)

**Source Task:** aia-core-abj (T-011: Implement Player CRUD endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/database/models.py — `Player.name`

`unique=True` is case-sensitive in PostgreSQL, allowing `"Alice"` and `"alice"` to coexist as separate rows. The application layer's `func.lower()` guard is the sole protection and is subject to the TOCTOU race in F-020. **Tracked as T-055.**

**Suggested follow-up:** Add a functional unique index on `lower(name)` or use a case-insensitive collation (`CITEXT` on PostgreSQL).

---

### F-025 — Unused fixture parameter in `test_integrity_error_on_commit_rolls_back` (T-051)

**Source Task:** aia-core-m41 (T-051: Fix: Catch IntegrityError on create_player and return 409)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_player_api.py — `test_integrity_error_on_commit_rolls_back`

The test declares `client_with_racy_db` in its parameter list but never references it inside the body. The fixture's patched session setup is silently discarded; the test then rebuilds its own `MagicMock` session and `TestClient` inline. The intent of the test is indeterminate — either the fixture was added by mistake and the inline setup is what's actually under test, or the fixture was meant to drive the test and the inline duplication should be removed. Either way, the fixture parameter creates false documentation: a reader assumes the fixture is doing work it is not.

**Suggested fix:** If the inline mock approach is intentional, remove `client_with_racy_db` from the function signature. If the fixture is meant to own the setup, delete the inline `MagicMock`/`TestClient` block and use `client_with_racy_db` directly.

---

### F-026 — `raise HTTPException from None` suppresses IntegrityError context (T-051)

**Source Task:** aia-core-m41 (T-051: Fix: Catch IntegrityError on create_player and return 409)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/players.py — `create_player` (line 33)

`raise HTTPException(status_code=409, ...) from None` explicitly suppresses the original `IntegrityError` as the exception context. For HTTP responses this is invisible, but structured logging middleware and APM tools (Sentry, OpenTelemetry) inspect `__cause__` and `__context__` to capture root-cause detail. Suppressing the cause means the DB constraint name, violation detail, and stack frame are all lost at the tracing layer, making production diagnosis harder.

**Suggested fix:** Replace `from None` with `from exc` (where `exc` is the caught `IntegrityError`) so the original exception is preserved as the explicit cause while still raising the 409 response.

---

### F-027 — Unhandled `IntegrityError` on duplicate `player_names` in request payload (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/games.py — lines 25–33
**Tracked as:** T-056

If `player_names` contains duplicates (e.g. `['Adam', 'Adam']`), the first iteration finds or creates a `Player` and flushes a `GamePlayer`. The second iteration resolves the same player and attempts a second `db.add(GamePlayer(game_id=..., player_id=...))` with the identical composite PK `(game_id, player_id)`. The unhandled `IntegrityError` surfaces as HTTP 500 instead of 422.

**Suggested follow-up:** Implement T-056 — deduplicate `player_names` before the loop using `list(dict.fromkeys(payload.player_names))`.

---

### F-028 — TOCTOU race during player auto-creation in `create_game_session` (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/games.py — lines 25–30
**Tracked as:** T-057

Two concurrent `POST /games` requests with the same new player name both pass the `if player is None` guard before either flush completes. Both attempt `INSERT INTO players`; the second hits the `Player.name` unique constraint and raises an unhandled `IntegrityError` (HTTP 500). Same TOCTOU class as T-051 / F-020, but in the auto-creation path inside `create_game_session`.

**Suggested follow-up:** Implement T-057 — wrap the `db.add(player)` / `db.flush()` block in a `try/except IntegrityError` with a re-query fallback.

---

### F-029 — No input validation on individual `player_names` entries (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/pydantic_models/app_models.py — `GameSessionCreate.player_names` (line 216)

`GameSessionCreate.player_names` is `list[str] = Field(..., min_length=1)`, which validates only that the list is non-empty. Individual entries are unconstrained: blank strings (`''`), all-whitespace strings (`'   '`), and arbitrarily long names pass validation silently and are forwarded directly to `Player(name=name)`, creating malformed rows.

**Suggested follow-up:** Add a `@field_validator('player_names')` that strips each entry, rejects blanks, and enforces a `max_length` (e.g. 100 characters) consistent with the planned T-052 fix for `PlayerCreate.name`.

---

### F-030 — `GameSession.status` is an unconstrained `String` — no Enum or CHECK constraint (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/models.py — `GameSession.status` (line 36)

`status` is `Column(String, nullable=False, default='active')` with no DB-level constraint. Any string (e.g. `'Active'`, `'DONE'`, `'foo'`) persists without error. The planned `PATCH /games/{game_id}/complete` endpoint (T-016) will compare against the literal `'completed'`; inconsistent capitalisation or typos will defeat that check silently.

**Suggested follow-up:** Replace with `Column(Enum('active', 'completed', name='game_status'), nullable=False, default='active')`, mirroring the T-046 fix for `PlayerHand.result`, with a corresponding Alembic migration.

---

### F-031 — No test for duplicate entries in `player_names` (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_create_game_session_api.py

The bug tracked in F-027 / T-056 has zero test coverage. No existing test calls `POST /games` with a `player_names` list containing repeated entries, leaving the duplicate-`GamePlayer` `IntegrityError` path entirely unexercised.

**Suggested follow-up:** Add a test `test_create_game_session_with_duplicate_player_names` that POSTs `player_names: ['Adam', 'Adam']` and asserts a 201 response with Adam appearing exactly once in the returned player list.

---

### F-032 — No test for S-2.1 AC4 — same-date duplicate sessions (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_create_game_session_api.py

S-2.1 AC4 ("two game sessions on the same date return different `game_id`s") is not covered. `test_create_two_games_get_different_ids` uses two different dates (`2025-01-01` and `2025-01-02`) and does not exercise the same-date path.

**Suggested follow-up:** Add a test that creates two sessions with identical `game_date` values and asserts the returned `game_id` values are distinct.

---

### F-033 — Response built from lazy-loaded relationships after commit — `DetachedInstanceError` risk (T-013)

**Source Task:** aia-core-9cv (T-013: Implement Create Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/games.py — lines 36–44

After `db.commit()` and `db.refresh(game)`, the handler accesses `game.players` and `game.hands` to build `GameSessionResponse`. With the current session strategy these lazy loads succeed. If the strategy changes — e.g. `expire_on_commit=True` without an explicit refresh of the relationships, or an object passed to a background task outside the session scope — accessing these attributes raises `DetachedInstanceError`.

**Suggested follow-up:** Eagerly load `players` and `hands` before commit using `options(selectinload(...))`, or explicitly refresh the required relationships after `db.refresh(game)`, to make response-building independent of the session's post-commit expiry behaviour.

---

### F-034 — Case-variant duplicates in `player_names` still produce `IntegrityError` after T-056 fix

**Source Task:** aia-core-y3f (T-056: Fix: Deduplicate `player_names` before `GamePlayer` inserts)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/games.py — player loop
**Tracked as:** T-058 (tasks.md) / aia-core-z9f (beads)

`dict.fromkeys()` is case-sensitive, so `["Adam", "adam"]` passes through as two distinct loop iterations. Both resolve to the same `Player` record via the case-insensitive lookup (`func.lower(Player.name) == func.lower(name)`), yielding the same `player_id`. The second `db.add(GamePlayer(game_id=..., player_id=...))` then attempts to insert a duplicate composite PK `(game_id, player_id)`, raising an unhandled `sqlalchemy.exc.IntegrityError` and returning HTTP 500. The T-056 fix handles only exact-string duplicates; case-variant duplicates remain unhandled.

**Suggested follow-up:** Implement T-058 — deduplicate the resolved `player_id` set after lookup using a `seen_player_ids` set, and skip the `GamePlayer` insert for any already-seen ID.

---

### F-035 — No test coverage for case-variant duplicates in `player_names`

**Source Task:** aia-core-y3f (T-056: Fix: Deduplicate `player_names` before `GamePlayer` inserts)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_create_game_session_api.py

The T-056 fix deduplicates exact-string entries via `dict.fromkeys()`, but no test covers case-variant duplicates such as `['Adam', 'adam']`. This gap means the regression tracked in F-034 / T-058 will not be caught by the test suite until it surfaces in production.

**Suggested follow-up:** Add `test_create_game_session_with_case_variant_duplicate_player_names` that POSTs `player_names: ['Adam', 'adam']` and asserts a 201 response with the player appearing exactly once. The test should be authored alongside the T-058 fix so it fails before the fix is applied and passes after.

---

### F-036 — Case-variant dedup test does not assert first-occurrence semantics

**Source Task:** aia-core-z9f (T-058: Fix: Deduplicate resolved player_id set after lookup for case-variant player_names)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_create_game_session_api.py

The case-variant deduplication test (added per T-058 AC-2) asserts only that the duplicate resolves to a single entry, but does not pin *which* form is returned. Without `assert set(data['player_names']) == {'Adam', 'Gil'}`, a regression that returned `'adam'` instead of `'Adam'` (last-occurrence wins) would still pass the test. Explicitly asserting the set locks in first-occurrence retention semantics, making the contract visible and regression-proof.

**Suggested fix:** In `test_create_game_session_with_case_variant_duplicate_player_names`, replace or supplement the count assertion with:
```python
assert set(data['player_names']) == {'Adam', 'Gil'}
```
This confirms that the first-seen casing (`'Adam'`) is preserved and that no additional players are introduced.

---

### F-037 — Undefended `None` after re-query in `IntegrityError` except branch (T-057)

**Source Task:** aia-core-dce (T-057: Fix: Wrap player auto-creation in try/except IntegrityError with re-query fallback)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `IntegrityError` except branch

After catching `IntegrityError` and rolling back, the except branch re-queries the player by `func.lower(Player.name) == func.lower(name)` and assigns the result directly to `player`. If the re-query returns `None` — because the player was deleted between the failed insert and the re-query, or because the `IntegrityError` was triggered by a constraint other than the `Player.name` unique index — execution continues with `player = None`. The subsequent `db.add(GamePlayer(game_id=game.game_id, player_id=player.player_id))` then raises `AttributeError: 'NoneType' object has no attribute 'player_id'`, returning an unhandled HTTP 500.

**Suggested fix:**
In `src/app/routes/games.py`, add a guard immediately after the re-query inside the `except IntegrityError` block:
```python
except IntegrityError:
    db.rollback()
    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == func.lower(name))
        .first()
    )
    if player is None:
        raise HTTPException(
            status_code=500,
            detail=f"Player '{name}' could not be created or retrieved.",
        )
```
Alternatively, assert: `assert player is not None, f"Re-query for player '{name}' returned None after IntegrityError"` — but the `HTTPException` form is preferable in a request handler since it produces a structured response rather than an unhandled `AssertionError`.

**Acceptance Criteria:**
1. When the re-query after `IntegrityError` returns `None`, the handler raises `HTTPException(500)` with a descriptive message rather than propagating `AttributeError`
2. A unit test covering this branch mocks the re-query to return `None` and asserts a 500 response (not an unhandled exception)
3. The normal TOCTOU path (re-query returns the existing player) continues to return 201

---

### F-038 — N+1 query pattern on `game.players` and `game.hands` in `get_game_session`

**Source Task:** aia-core-5a4 (T-014: Implement Get Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `get_game_session`

`game.players` and `game.hands` are lazy-loaded relationships. When `get_game_session` accesses both to build the response, SQLAlchemy issues two additional `SELECT` statements after the initial `GET` query for the `GameSession` — one for players, one for hands. This is a textbook N+1 pattern: a single endpoint call that semantically fetches one record generates three round-trips. The problem compounds if this endpoint is called in a list context or if additional relationships are added later.

**Suggested fix:** Use `joinedload` or `selectinload` at query time to eagerly load both relationships in the initial `SELECT`:
```python
from sqlalchemy.orm import selectinload

game = (
    db.query(GameSession)
    .options(selectinload(GameSession.players), selectinload(GameSession.hands))
    .filter(GameSession.game_id == game_id)
    .first()
)
```
`selectinload` is preferred over `joinedload` here because it avoids row multiplication when both `players` and `hands` are loaded simultaneously.

---

### F-039 — `GameSessionResponse` construction duplicated across `create_game_session` and `get_game_session`

**Source Task:** aia-core-5a4 (T-014: Implement Get Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `create_game_session` and `get_game_session` response blocks

The block that builds a `GameSessionResponse` from a `GameSession` ORM object — extracting `game_id`, `game_date`, `status`, computing `player_names`, and computing `hand_count` — is duplicated verbatim in both `create_game_session` and `get_game_session`. Any future change to the response shape (e.g. adding a new field, changing the serialisation of `game_date`) must be applied in two places or the endpoints will diverge silently.

**Suggested fix:** Extract a private helper function (or configure Pydantic ORM mode) to centralise the mapping:
```python
def _build_game_response(game: GameSession) -> GameSessionResponse:
    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        player_names=[p.name for p in game.players],
        hand_count=len(game.hands),
    )
```
Both handlers then call `return _build_game_response(game)`. Alternatively, enable Pydantic's `model_config = ConfigDict(from_attributes=True)` on `GameSessionResponse` and call `GameSessionResponse.model_validate(game)` directly, provided the field names align.

---

### F-040 — `hand_count` test covers zero only — no assertion after hands are recorded

**Source Task:** aia-core-5a4 (T-014: Implement Get Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_get_game_session_api.py

The test that asserts `hand_count` in the `GET /games/{game_id}` response only verifies the zero case (a freshly created session with no hands). No test records one or more hands and then re-fetches the session to assert `hand_count` increments. A regression that hard-coded `hand_count: 0`, or miscounted by off-by-one, would not be caught.

**Suggested follow-up:** Add a test that:
1. Creates a game session
2. POSTs one (or more) hands to that session
3. GETs the session and asserts `hand_count == 1` (or the expected value)

---

### F-041 — `player_names` ordering in `GET /games/{game_id}` response is nondeterministic and undocumented

**Source Task:** aia-core-5a4 (T-014: Implement Get Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/games.py — `get_game_session` response construction; specs/aia-core-001/spec.md — S-2.2

`player_names` is built as `[p.name for p in game.players]`, where `game.players` is loaded via an ORM relationship with no explicit `ORDER BY`. The order of names in the response is therefore determined by whatever the database returns — which may vary across queries, database engines, or SQLAlchemy versions. This means two identical GETs can return different orderings, making client-side equality assertions brittle and the API contract ambiguous.

The spec (S-2.2) does not document ordering semantics for `player_names`, leaving the behaviour undefined by design.

**Suggested follow-up (code):** Add an `order_by` clause to the relationship or query to enforce a stable ordering (e.g. alphabetical by `Player.name`):
```python
player_names=[p.name for p in sorted(game.players, key=lambda p: p.name)]
```
Or apply `order_by` at the relationship level in the model:
```python
players = relationship('Player', secondary='game_players', order_by='Player.name')
```

**Suggested follow-up (spec):** Update S-2.2 acceptance criteria to document the ordering guarantee (alphabetical, insertion order, or explicitly unordered) so it is testable and contractual.

---

### F-042 — N+1 query problem on `game.players` and `game.hands` in `GET /games`

**Source Task:** aia-core-bzj (T-015: Implement List Game Sessions endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `list_game_sessions` response construction

`len(game.players)` and `len(game.hands)` are evaluated inside the list-comprehension that builds the response for `GET /games`. Both are lazy-loaded relationships, so accessing them triggers two additional `SELECT` statements per game row — `2N + 1` total queries for a result set of N games. On a table with 100 sessions this generates 201 round-trips; the pattern worsens linearly as data grows. The problem is structurally the same as F-038 on `get_game_session`, but the impact is higher because it applies to the full result set rather than a single record.

**Suggested fix:** Replace the lazy-load path with aggregated SQL using `func.count` and `GROUP BY` so player and hand counts are retrieved in the initial query, eliminating all per-row subqueries:
```python
from sqlalchemy import func

results = (
    db.query(
        GameSession,
        func.count(GamePlayer.player_id.distinct()).label('player_count'),
        func.count(Hand.hand_id.distinct()).label('hand_count'),
    )
    .outerjoin(GamePlayer, GameSession.game_id == GamePlayer.game_id)
    .outerjoin(Hand, GameSession.game_id == Hand.game_id)
    .filter(...)
    .group_by(GameSession.game_id)
    .order_by(GameSession.game_date.desc())
    .all()
)
```
Alternatively, use `subqueryload` or `selectinload` on both relationships before accessing them — but the aggregated-SQL approach avoids loading full ORM objects for the counts at all.

---

### F-043 — No pagination on `GET /games`

**Source Task:** aia-core-bzj (T-015: Implement List Game Sessions endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `list_game_sessions`

`list_game_sessions` issues a `SELECT` with no `LIMIT` or `OFFSET`. All rows matching the date filter are returned in a single response. On a production instance recording daily sessions over multiple years, this can return hundreds of rows with their full relationship payloads in one unbounded response, causing memory pressure and slow response times. This is the same class of issue as F-023 / T-054 on `GET /players`, which was tracked and resolved.

**Suggested fix:** Add `skip` and `limit` query parameters with sensible defaults:
```python
@router.get('/games')
def list_game_sessions(
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    ...
    return query.offset(skip).limit(limit).all()
```
The response should also include pagination metadata (`total`, `skip`, `limit`) so clients can page through results.

---

### F-044 — No test for invalid date format in `GET /games` query params

**Source Task:** aia-core-bzj (T-015: Implement List Game Sessions endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_list_game_sessions_api.py

`GET /games?date_from=not-a-date` should return 422 (FastAPI/Pydantic automatically rejects non-`date` values at the routing layer), but no explicit test asserts this behaviour. If the parameter type were ever changed from `date` to `str` during a refactor, automatic validation would silently degrade and no test would catch the regression.

**Suggested follow-up:** Add a test `test_list_game_sessions_invalid_date_format` that calls `GET /games?date_from=not-a-date` and asserts a 422 response. A companion test for `date_to=not-a-date` provides symmetrical coverage.

---

### F-045 — No test for inverted date range (`date_from > date_to`) — behaviour undocumented

**Source Task:** aia-core-bzj (T-015: Implement List Game Sessions endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/games.py — `list_game_sessions`; test/test_list_game_sessions_api.py

When `date_from > date_to`, the current implementation silently applies both filter predicates to the query, which produces an impossible range and returns an empty list. No test asserts this outcome and the API spec (S-2.3) does not document the expected behaviour. A consumer supplying an inverted range may assume the endpoint is malfunctioning or the database is empty.

**Suggested follow-up:** Decide and document the contract — two reasonable options:
1. **Return 422** with a descriptive message (`"date_from must not be later than date_to"`). This is explicit and self-documenting. Add a `@field_validator` or request-level guard.
2. **Return empty list** (current behaviour) and document this in the spec (S-2.3 AC) and the OpenAPI description for the endpoint.

Whichever is chosen, add a test `test_list_game_sessions_inverted_date_range` that calls `GET /games?date_from=2025-12-31&date_to=2025-01-01` and asserts the documented response (422 or `[]`).

---

### F-046 — `game.status == 'completed'` comparison is case-sensitive with no DB-level constraint

**Source Task:** aia-core-pnq (T-016: Implement Complete Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/games.py — `complete_game_session`

The guard `if game.status == 'completed'` that prevents double-completion is a plain Python string equality check. Because `GameSession.status` is an unconstrained `String` column (no Enum or CHECK constraint — see F-030), values such as `'Completed'` or `'COMPLETED'` can exist in the database and will silently bypass the guard. The endpoint would then attempt to set status to `'completed'` again, returning a spurious 200 response instead of 400. This is a pre-existing model issue (not introduced by T-016), but the Complete endpoint is the first caller that relies on status equality for correctness.

**Suggested follow-up:** Address the root cause via F-030 — add a DB-level `Enum('active', 'completed', name='game_status')` constraint to `GameSession.status`. Once the constraint is in place, the only valid status values are `'active'` and `'completed'`, and the string comparison in `complete_game_session` becomes reliable. Until then, consider normalising the comparison: `if game.status.lower() == 'completed'`.

---

### F-047 — Test file duplicates engine/session/override boilerplate from `test_create_game_session_api.py`

**Source Task:** aia-core-pnq (T-016: Implement Complete Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_complete_game_session_api.py — module-level setup

`test_complete_game_session_api.py` reproduces the module-level `engine`, `SessionLocal`, `override_get_db`, and `autouse` `setup_db` fixture verbatim from `test_create_game_session_api.py`. This is consistent with the pattern already noted in F-022 / T-053 for `test_player_api.py`. The duplication creates a third independent `create_all`/`drop_all` cycle on a separate in-memory engine, with the same fragile isolation risks: if any `conftest.py` fixture is also used in these tests, the two engines are out of sync.

No new action required beyond T-053; this finding confirms the scope of that task extends to `test_complete_game_session_api.py`.

---

### F-048 — Detail message not asserted in `test_complete_game_400_detail_message_if_already_completed`

**Source Task:** aia-core-pnq (T-016: Implement Complete Game Session endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_complete_game_session_api.py — `test_complete_game_400_detail_message_if_already_completed`

The test asserts only `assert 'detail' in response.json()`, confirming that a `detail` key is present in the error body but not what it says. The actual message text (e.g. `"Game session is already completed"`) is never checked. A regression that changed the message to an empty string, a generic `"Bad Request"`, or an unrelated error description would pass this test undetected. The test name explicitly promises `detail_message` coverage, making the gap misleading.

**Suggested fix:** Replace the existence check with a value assertion:
```python
assert response.json()['detail'] == 'Game session is already completed'
```
This pins the contract for the error response and ensures that any rephrase of the message is a conscious, test-breaking decision.

---

### F-049 — S-3.1 AC-3 not implemented — no duplicate card validation wired into record_hand()

**Source Task:** aia-core-az2 (T-018: Implement Record New Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/hands.py — `record_hand`
**Tracked as:** T-059 (tasks.md) / TBD (beads)

S-3.1 AC-3 requires that requests containing duplicate cards across community cards and all player hole cards are rejected. T-019 is scoped to build the `validate_no_duplicate_cards` utility and unit-test it in isolation, but `record_hand()` never calls it. A request where Alice holds `AS/KH` and Bob also holds `AS/2D` succeeds with HTTP 201 and stores the invalid data permanently. The endpoint is in a spec-violating state until T-019's validator is wired in before the first `db.flush()` on the `Hand`.

**Suggested follow-up:** Implement T-059 — collect all card fields from `payload` (community + all player hole cards) and call `validate_no_duplicate_cards` before `db.add(hand)`, raising 422 on failure.

---

### F-050 — Race condition in hand_number assignment

**Source Task:** aia-core-az2 (T-018: Implement Record New Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `record_hand` (hand_number assignment block)
**Tracked as:** T-060

`func.max(Hand.hand_number) + 1` is a read-then-write. Two concurrent `POST /games/{game_id}/hands` requests for the same game read the same maximum, compute the same next `hand_number`, and both attempt to insert. The second insert hits the `uq_hand_game_number` unique constraint as an unhandled `sqlalchemy.exc.IntegrityError`, returning HTTP 500.

**Suggested follow-up:** Implement T-060 — catch `IntegrityError` on the `Hand` flush and return 409, or migrate to a DB-level sequence for `hand_number` scoped to `game_id`.

---

### F-051 — Duplicate player names in player_entries cause unhandled IntegrityError 500

**Source Task:** aia-core-az2 (T-018: Implement Record New Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `record_hand` player loop
**Tracked as:** T-061

No guard exists before the loop to detect duplicate player names. A `player_entries` list containing the same player twice (case-insensitively) resolves to the same `player_id` on both iterations. The second `db.flush()` inside the loop hits the `uq_player_hand` unique constraint and raises an unhandled `IntegrityError` → HTTP 500. The fix is to check `len(player_entries) == len({e.player_name.lower() for e in payload.player_entries})` before the loop and raise 400 on mismatch.

**Suggested follow-up:** Implement T-061 — add the duplicate-name guard before the loop.

---

### F-052 — Per-entry db.flush() inside player_entries loop is unnecessary

**Source Task:** aia-core-az2 (T-018: Implement Record New Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — `record_hand` player loop
**Tracked as:** T-062

`db.flush()` is called once per `PlayerHand` inside the loop. Each call forces a DB round-trip before the next iteration with no functional justification — no subsequent iteration reads the previously-flushed row, and all inserts are committed atomically by `db.commit()` at the end. With N players this generates N unnecessary round-trips.

**Suggested follow-up:** Implement T-062 — remove `db.flush()` from inside the loop.

---

### F-053 — db.refresh(hand) after commit is effectively a no-op

**Source Task:** aia-core-az2 (T-018: Implement Record New Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — `record_hand` (line after db.commit())
**Tracked as:** T-063

`db.refresh(hand)` issues a `SELECT` to reload the `Hand` row after commit. The `HandResponse` is built entirely from Python attributes already set before the commit (set in the `Hand(...)` constructor; `player_hand_responses` assembled during the loop). No server-computed value is read from `hand` after the refresh. The call adds one unnecessary DB round-trip on every successful request.

**Suggested follow-up:** Implement T-063 — remove `db.refresh(hand)`.

---

### F-054 — Turn/river duplicate paths lack explicit test coverage in `TestDuplicateCardValidation`

**Source Task:** aia-core-4fy (T-059: Wire duplicate card validation into record_hand)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_record_hand_api.py — `TestDuplicateCardValidation`

`record_hand()` conditionally appends `turn` and `river` to `all_cards` only when those fields are present in the payload — which is correct. However, no test in `TestDuplicateCardValidation` asserts that a duplicate involving the turn or river field returns 422. For example, the case where `turn == flop_1` (e.g. `turn='AS'` when `flop_1='AS'`) is not exercised. If the conditional inclusion of `turn` and `river` were inadvertently removed during a refactor, all existing duplicate tests would continue to pass.

The implementation is correct — this is a test coverage gap only.

**Suggested follow-up:** Add at least two test cases to `TestDuplicateCardValidation`:
1. `turn` duplicates a community card (e.g. `turn == flop_1`) → assert 422.
2. `river` duplicates a community or turn card → assert 422.

---

### F-055 — AC-2 not verified at DB layer — no assertion that Hand row is absent on 422

**Source Task:** aia-core-4fy (T-059: Wire duplicate card validation into record_hand)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_record_hand_api.py — `TestDuplicateCardValidation`

T-059 AC-2 states: *"No `Hand` or `PlayerHand` row is written to the database on rejection."* The tests in `TestDuplicateCardValidation` assert that the endpoint returns 422, but none query the database afterward to confirm that zero `Hand` rows were written for that game. The implementation validates before the first `db.flush()` so the contract is upheld in code, but the test exercises only the surface HTTP contract — a future regression that validated after the flush (writing a partial row before rejecting) would pass all current tests.

The implementation is correct — this is a test coverage gap only.

**Suggested follow-up:** In one or more `TestDuplicateCardValidation` tests, after asserting 422, query the `db_session` fixture directly and assert that no `Hand` row exists for the game:
```python
from src.app.database.models import Hand
hand_count = db_session.query(Hand).filter(Hand.game_id == game_id).count()
assert hand_count == 0, "No Hand row should be written on duplicate-card rejection"
```

---

### F-056 — `db.refresh(hand)` on line 106 is effectless (pre-existing)

**Source Task:** aia-core-4fy (T-059: Wire duplicate card validation into record_hand)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — line 106 (`db.refresh(hand)` after `db.commit()`)
**Tracked as:** F-053 / T-063

`db.refresh(hand)` issues a `SELECT` to reload the `Hand` row after `db.commit()`. The `HandResponse` is built entirely from Python attributes set before the commit; no server-computed value is read from `hand` after the refresh. The call is a wasted round-trip on every successful request. This is a pre-existing finding — already captured as F-053 and tracked for resolution in T-063. Noted here for completeness as it was observed during the aia-core-4fy review.

---

### F-057 — Turn/river duplicate paths lack explicit rejection tests (aia-core-wxn / T-019)

**Source Task:** aia-core-wxn (T-019: Implement duplicate card validation logic)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_record_hand_api.py — `TestDuplicateCardValidation`
**Suggested follow-up:** T-023 (aia-core-3yf) — Write tests for Hand Management endpoints

`validate_no_duplicate_cards` correctly handles turn- and river-involved duplicates at the utility level, and `record_hand()` correctly includes `turn` and `river` in `all_cards` conditionally. However, no integration test in `TestDuplicateCardValidation` exercises a rejection path where the duplicate card is the turn or river field. For example, the case `turn == flop_1` (e.g. `turn='AS'` when `flop_1='AS'`) is not asserted as returning 422. If the conditional inclusion of `turn` or `river` in `all_cards` were inadvertently dropped during a refactor, all existing duplicate tests would still pass.

The implementation is correct — this is a test coverage gap only. It overlaps with F-054 (discovered during the T-059 review) and is consolidated for resolution in T-023.

**Suggested follow-up:** In T-023, add at least two test cases to `TestDuplicateCardValidation`:
1. `turn` duplicates a community card (e.g. `turn == flop_1`) → assert 422.
2. `river` duplicates a community or turn card → assert 422.

---

### F-058 — No explicit integration test that duplicate card rejection returns 400, not 422 (aia-core-wxn / T-019)

**Source Task:** aia-core-wxn (T-019: Implement duplicate card validation logic)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_record_hand_api.py — `TestDuplicateCardValidation`; src/app/routes/hands.py — `record_hand`

`record_hand()` catches `ValueError` from `validate_no_duplicate_cards` and raises `HTTPException(status_code=400, ...)`. The existing tests assert that a duplicate-card request returns a non-2xx response, but no test explicitly asserts `response.status_code == 400`. If `status_code=400` were accidentally changed back to `422` (the default Pydantic validation error code), or if the `try/except ValueError` block were removed and the `ValueError` propagated as an unhandled 500, the existing tests would not catch the regression. The distinction between 400 and 422 is contractual: 400 signals a domain-level rule violation (cards already in play), while 422 signals a structural validation failure; they carry different semantics for API consumers.

**Suggested follow-up:** In `TestDuplicateCardValidation`, update at least one existing test (or add a dedicated one) to assert the exact status code:
```python
assert response.status_code == 400
```
This guards against accidental reversion to 422 or propagation as 500.

---

### F-059 — N+1 query pattern on player_hands in GET /games/{game_id}/hands/{hand_number}

**Source Task:** aia-core-rso (T-020: Implement Get Single Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `get_hand`
**Tracked as:** T-064

`get_hand()` fetches the `Hand` ORM object with a primary query, then accesses `hand.player_hands` to build `HandResponse`. Because `Hand.player_hands` is a lazy-loaded relationship, SQLAlchemy issues a second `SELECT` at the point of attribute access — one query for the `Hand` row, one for its `PlayerHand` children. For a single-record endpoint this is one unnecessary round-trip; the pattern scales poorly if additional nested relationships (e.g. `PlayerHand.player`) are added later.

**Suggested fix:** Apply `selectinload(Hand.player_hands)` at query time so the relationship is loaded in a single batched `SELECT IN` rather than deferred:
```python
from sqlalchemy.orm import selectinload

hand = (
    db.query(Hand)
    .options(selectinload(Hand.player_hands))
    .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
    .first()
)
```

---

### F-060 — Silent null guard risk: no explicit game existence check before Hand query in get_hand()

**Source Task:** aia-core-rso (T-020: Implement Get Single Hand endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `get_hand`
**Tracked as:** T-065

`get_hand()` queries `Hand` directly using `(Hand.game_id == game_id, Hand.hand_number == hand_number)`. When the game does not exist, the `Hand` query correctly returns `None` and the 404 fires. However, there is no prior explicit check that the `GameSession` itself exists. A future refactor that inlines or reorders the query could allow execution to proceed with a `None` game context, causing an unhandled `AttributeError` or a misleading 404 body. Additionally, the current implementation cannot distinguish between "game not found" and "hand not found" in its 404 detail message — both collapse to a single message — making it harder for callers to diagnose the failure.

**Suggested fix:** Add an explicit game existence guard before the `Hand` query (see T-065 for full implementation). This makes the defensive intent explicit, guards against future code-path regressions, and enables distinct 404 messages for the two failure modes.

---

### F-061 — Missing `player_count` and `street_reached` summary fields in `HandResponse` (aia-core-szn / T-021)

**Source Task:** aia-core-szn (T-021: Implement List Hands in Game endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/pydantic_models/app_models.py — `HandResponse`

T-021 AC-2 requires that each hand in the `GET /games/{game_id}/hands` response includes `player_count` and `street_reached` (farthest street: flop/turn/river). S-3.3 AC-2 states the same. `HandResponse` is currently constructed from raw ORM data and does not expose either field as an explicit computed summary. The raw player list is present via `player_hands`, and the community card columns are present, but callers must recompute these summaries client-side — which violates the spec contract and makes `HandResponse` unusable as-is for the list view.

**Suggested fix:** Add `@computed_field` properties to `HandResponse` in `src/pydantic_models/app_models.py`:
```python
from pydantic import computed_field

class HandResponse(BaseModel):
    ...
    player_hands: list[PlayerHandResponse]
    flop_1: str
    flop_2: str
    flop_3: str
    turn: str | None
    river: str | None

    @computed_field
    @property
    def player_count(self) -> int:
        return len(self.player_hands)

    @computed_field
    @property
    def street_reached(self) -> str:
        if self.river:
            return 'river'
        if self.turn:
            return 'turn'
        return 'flop'
```

**Acceptance Criteria:**
1. `HandResponse` exposes `player_count` (integer) as a computed summary field
2. `HandResponse` exposes `street_reached` (one of `'flop'`, `'turn'`, `'river'`) as a computed summary field
3. Both fields are included in the JSON serialisation of the response
4. T-021 AC-2 and S-3.3 AC-2 are satisfied without client-side recomputation

---

### F-062 — N+1 query anti-pattern: per-player `db.query(Player)` lookup inside `list_hands` loop (aia-core-szn / T-021)

**Source Task:** aia-core-szn (T-021: Implement List Hands in Game endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `list_hands`

For each hand in the result set, for each `PlayerHand` associated with that hand, `list_hands` issues a separate `db.query(Player).filter(Player.player_id == ph.player_id).first()` call. With H hands and an average of P players per hand, this produces O(H × P) database round-trips. On a game with 20 hands of 6 players each, this is 120 individual `SELECT` statements where a single pre-loaded map or JOIN would suffice. The pattern is structurally identical to the N+1 issue flagged in F-038 / F-042 for game sessions, but with a multiplicative (not additive) round-trip cost.

**Suggested fix:** Pre-load a `player_id → Player` map from a single query before entering the loop, then resolve player names from the in-memory map:
```python
player_ids = {ph.player_id for hand in hands for ph in hand.player_hands}
players_by_id = {
    p.player_id: p
    for p in db.query(Player).filter(Player.player_id.in_(player_ids)).all()
}

for hand in hands:
    player_hand_responses = [
        PlayerHandResponse(
            player_name=players_by_id[ph.player_id].name,
            ...
        )
        for ph in hand.player_hands
    ]
```
Alternatively, add `selectinload(Hand.player_hands).selectinload(PlayerHand.player)` to the initial `Hand` query so the ORM resolves all relationships in two batched `SELECT IN` statements instead of H × P individual queries.

**Acceptance Criteria:**
1. `list_hands` does not issue a per-`PlayerHand` `db.query(Player)` call inside any loop
2. All player names are resolved via a single pre-loaded map or via eagerly-loaded ORM relationships
3. Total DB round-trips for the endpoint are O(1) or O(2) regardless of hand or player count
4. Existing `GET /games/{game_id}/hands` tests continue to pass

---

### F-063 — Silent empty-string fallback on missing player in `list_hands` and `get_hand` (aia-core-szn / T-021)

**Source Task:** aia-core-szn (T-021: Implement List Hands in Game endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — `list_hands` and `get_hand` player lookup

Both `list_hands` and `get_hand` resolve a `Player` from `db.query(Player).filter(Player.player_id == ph.player_id).first()` and then produce `player_name = player.name if player else ''`. A missing player (`player is None`) indicates a broken FK relationship — a `PlayerHand` row references a `player_id` that no longer exists in the `players` table. This is a database corruption scenario, not a valid application state. Silently returning an empty string masks the corruption: the response looks structurally valid but contains meaningless data, making the bug invisible to callers and future debugging sessions. The correct response is HTTP 500 with a diagnostic detail, so the problem surfaces immediately.

**Suggested fix:** In both `list_hands` and `get_hand`, replace the silent fallback with an explicit guard:
```python
if player is None:
    raise HTTPException(
        status_code=500,
        detail=f"Data integrity error: PlayerHand {ph.player_hand_id} references "
               f"non-existent player_id {ph.player_id}",
    )
player_name = player.name
```

**Acceptance Criteria:**
1. When `db.query(Player)` returns `None` for a `PlayerHand.player_id`, the handler raises `HTTPException(500)` with a diagnostic message in both `list_hands` and `get_hand`
2. No empty-string `player_name` is ever returned in a response
3. A unit test mocking the player query to return `None` asserts a 500 response

---

### F-064 — Duplicate `PlayerHandResponse` construction logic in `list_hands` and `get_hand` (aia-core-szn / T-021)

**Source Task:** aia-core-szn (T-021: Implement List Hands in Game endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — `list_hands` and `get_hand`

Both `list_hands` and `get_hand` contain near-identical loops that iterate over `hand.player_hands`, resolve a `Player` from the DB, and construct a `PlayerHandResponse`. Any change to the shape of `PlayerHandResponse` or to the player-lookup logic (e.g. the fix in F-062 or F-063) must be applied in two places or the endpoints will silently diverge. This is the same duplication pattern noted in F-039 for `GameSessionResponse` construction across `create_game_session` and `get_game_session`.

**Suggested fix:** Extract a private helper function that encapsulates the loop:
```python
def _build_player_hand_responses(
    hand: Hand, players_by_id: dict[int, Player]
) -> list[PlayerHandResponse]:
    responses = []
    for ph in hand.player_hands:
        player = players_by_id.get(ph.player_id)
        if player is None:
            raise HTTPException(
                status_code=500,
                detail=f"Data integrity error: PlayerHand {ph.player_hand_id} references "
                       f"non-existent player_id {ph.player_id}",
            )
        responses.append(PlayerHandResponse(
            player_name=player.name,
            card_1=ph.card_1,
            card_2=ph.card_2,
            result=ph.result,
            profit_loss=ph.profit_loss,
        ))
    return responses
```
Both `list_hands` and `get_hand` then call `_build_player_hand_responses(hand, players_by_id)`. This consolidates both F-063 (silent fallback) and F-064 (duplication) in a single fix.

**Acceptance Criteria:**
1. A private helper `_build_player_hand_responses` (or equivalent) is extracted and used by both `list_hands` and `get_hand`
2. The player-lookup and `PlayerHandResponse` construction logic appears exactly once in the codebase
3. Any modification to `PlayerHandResponse` construction only requires a single edit
4. All existing tests for both endpoints continue to pass

---

### F-065 — No tests asserting `player_count` and `street_reached` values in `test_list_hands_api.py` (aia-core-szn / T-021)

**Source Task:** aia-core-szn (T-021: Implement List Hands in Game endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_list_hands_api.py

`test_list_hands_api.py` does not assert the values of `player_count` or `street_reached` in any response object. T-021 AC-2 explicitly requires these as per-hand summary fields. Without assertions on their values, the test suite cannot detect a regression where (a) the fields are present but always return zero/null, (b) `street_reached` returns the wrong street (e.g. `'flop'` when a river card is present), or (c) `player_count` is miscounted. These tests should be added when F-061 is addressed and the fields are added to `HandResponse`.

**Suggested follow-up:** After implementing F-061 (`@computed_field` properties on `HandResponse`), add tests to `test_list_hands_api.py` covering:
1. A hand with only flop cards and 2 players: assert `street_reached == 'flop'` and `player_count == 2`.
2. A hand with flop + turn and 4 players: assert `street_reached == 'turn'` and `player_count == 4`.
3. A hand with flop + turn + river: assert `street_reached == 'river'`.
4. A hand with 0 players (edge case): assert `player_count == 0`.

---

### F-066 — No enum constraint on `result` field in `PlayerResultEntry` and `PlayerHandCreate` (aia-core-mu4 / T-022)

**Source Task:** aia-core-mu4 (T-022: Implement Record Hand Result endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/pydantic_models/app_models.py — `PlayerResultEntry.result` and `PlayerHandCreate.result`

`PlayerResultEntry.result` is declared as `result: str` with no constraint. Any arbitrary string — including `'banana'`, `'WIN'`, or the empty string — passes Pydantic validation and is forwarded directly into the `PlayerHand.result` column. S-3.4 specifies the valid vocabulary as `win`, `loss`, and `fold`. The identical gap exists on `PlayerHandCreate.result`, which is used by the `POST /games/{game_id}/hands` endpoint. Both fields ultimately write to the same `PlayerHand.result` column; without a Pydantic-level constraint, invalid values bypass the DB-level enum guard (T-046) only if that migration has not yet been applied, and produce schema-violating data in any environment where T-046 is still outstanding.

**Fix:**
Add a shared `HandResult` string enum in `src/pydantic_models/app_models.py`:
```python
from enum import Enum

class HandResult(str, Enum):
    win = 'win'
    loss = 'loss'
    fold = 'fold'
```
Then update both fields to use it:
```python
# In PlayerResultEntry:
result: HandResult | None = None

# In PlayerHandCreate:
result: HandResult | None = None
```
Using `str, Enum` ensures FastAPI serialises the field as a plain string in JSON responses and OpenAPI docs display the allowed values as an enum.

**Acceptance Criteria:**
1. `PlayerResultEntry(player_name='Alice', result='banana')` raises a Pydantic `ValidationError`
2. `PlayerHandCreate(..., result='WIN')` raises a Pydantic `ValidationError`
3. `PlayerResultEntry(player_name='Alice', result='win')` is valid
4. `result=None` remains valid (nullable)
5. The OpenAPI schema for both fields lists `win`, `loss`, `fold` as the allowed values
6. Existing tests that pass valid result values continue to pass without modification

---

### F-067 — Dead code: `HandResultUpdate` class is defined but never used (aia-core-mu4 / T-022)

**Source Task:** aia-core-mu4 (T-022: Implement Record Hand Result endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/pydantic_models/app_models.py — `HandResultUpdate`

`HandResultUpdate` is defined in `app_models.py` but is never imported, referenced, or instantiated anywhere in the codebase — not in any route handler, test, or other module. The T-022 endpoint uses `PlayerResultEntry` (a list thereof) as its request body, not `HandResultUpdate`. The class appears to be an early draft that was superseded by `PlayerResultEntry` and not removed. Dead model classes inflate the public surface area of the module, mislead readers into assuming the class is load-bearing, and create maintenance debt as the surrounding schema evolves.

**Fix:**
Delete the `HandResultUpdate` class from `src/pydantic_models/app_models.py`. Verify with a project-wide search that no import or reference to `HandResultUpdate` exists before deletion.

**Acceptance Criteria:**
1. `HandResultUpdate` is removed from `src/pydantic_models/app_models.py`
2. No import or reference to `HandResultUpdate` exists anywhere in `src/` or `test/`
3. All existing tests continue to pass after the deletion

---

### F-068 — No test for empty `players` payload — `PATCH` with `[]` silently succeeds (aia-core-mu4 / T-022)

**Source Task:** aia-core-mu4 (T-022: Implement Record Hand Result endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_record_hand_result_api.py; src/app/routes/hands.py — `update_hand_results`

`PATCH /games/{game_id}/hands/{hand_number}/results` with `{"players": []}` skips the update loop entirely, calls `db.commit()`, and returns the hand unchanged with HTTP 200. This is a valid no-op semantically, but it is completely untested. Without a test, a future refactor that inadvertently raises an error on an empty list (e.g. adding a `min_length=1` validator or a pre-loop guard) would not be caught by the existing suite, and the edge-case contract would remain invisible to reviewers.

**Suggested follow-up:** Add a test `test_update_hand_results_empty_players_list` to `test/test_record_hand_result_api.py`:
1. Create a game, hand, and at least one player entry with a recorded result.
2. PATCH with `{"players": []}`.
3. Assert HTTP 200.
4. Assert the existing player result is unchanged (no accidental reset).

**Acceptance Criteria:**
1. `PATCH` with `{"players": []}` returns 200
2. The existing `PlayerHand` records for the hand are unmodified after the empty PATCH
3. The test is present in `test_record_hand_result_api.py` and passes

---

### F-069 — No idempotency/overwrite test for repeated `PATCH` on the same player (aia-core-mu4 / T-022)

**Source Task:** aia-core-mu4 (T-022: Implement Record Hand Result endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_record_hand_result_api.py; src/app/routes/hands.py — `update_hand_results`

The endpoint is intended to be idempotent and to overwrite on repeated calls: a second `PATCH` for the same player should supersede the first. No test exercises this contract. Without it, a regression that accumulated results (e.g. appending instead of overwriting) or raised a conflict error on a second PATCH to the same player would go undetected by the existing suite.

**Suggested follow-up:** Add a test `test_update_hand_results_overwrite_existing` to `test/test_record_hand_result_api.py`:
1. Create a game, hand, and player.
2. PATCH to set Alice's result to `'win'` and `profit_loss` to `10.00`.
3. Assert the first PATCH returns 200 with `result == 'win'`.
4. PATCH again with Alice's result set to `'loss'` and `profit_loss` to `-5.00`.
5. Assert the second PATCH returns 200 and the stored values are now `result == 'loss'` and `profit_loss == -5.00` (not the original values).

**Acceptance Criteria:**
1. A second `PATCH` for the same player with different values returns 200 and overwrites the first
2. The `PlayerHand` record reflects the most-recent PATCH values after the second call
3. No error is raised on repeated PATCHing of the same player

---

### F-070 — River duplicate test missing in `TestEditCommunityCards` (aia-core-qjt / T-028)

**Source Task:** aia-core-qjt (T-028: Implement Edit Community Cards endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_edit_community_cards_api.py — `TestEditCommunityCards`

`TestEditCommunityCards` contains duplicate-rejection tests for the flop and turn streets, but no test asserts that setting `river` to a value already present as a community card or player hole card returns 400. Because `edit_community_cards()` passes the full set of community cards (including the new `river` value) plus all player hole cards into `validate_no_duplicate_cards`, the river path is exercised by the same code as the flop/turn paths. However, without an explicit test, a regression that accidentally excluded `river` from the `all_cards` assembly — for example, a conditional that checked `payload.turn` but not `payload.river` — would not be caught by the existing suite. The test gap leaves the river duplicate validation contract effectively unverified at the integration level.

**Suggested follow-up:** Add at least one test to `TestEditCommunityCards` that:
1. Creates a game, hand, and at least one player with known hole cards.
2. PATCHes the hand setting `river` to a card already present as one of the player's hole cards.
3. Asserts HTTP 400 is returned (no update written).
4. Optionally: a second case where `river` duplicates an existing community card (e.g. `river == flop_1`).

**Acceptance Criteria:**
1. A test exists asserting that `river` set to an existing hole card value returns 400
2. A test exists (or the above covers) asserting that `river` set to an existing community card value returns 400
3. Both new tests pass against the current implementation

---

### F-071 — Full-replace PATCH semantics for optional community card fields are non-standard and undocumented (aia-core-qjt / T-028)

**Source Task:** aia-core-qjt (T-028: Implement Edit Community Cards endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `edit_community_cards`; src/pydantic_models/app_models.py — `CommunityCardUpdate`

`PATCH /games/{game_id}/hands/{hand_number}` uses a full-replace model for the optional `turn` and `river` fields: if the caller sends `{"turn": null}`, the handler sets `hand.turn = None`, clearing the field. This deviates from RFC 7396 merge-patch semantics, where an absent key means "leave unchanged" and `null` means "delete the field". Under the current implementation, omitting `turn` from the payload also clears it (because `CommunityCardUpdate` defaults it to `None`), making omission and explicit null indistinguishable. The behaviour is intentional and is covered by tests, but it is not documented in the OpenAPI endpoint description or in the spec (S-5.1). API consumers expecting standard PATCH semantics — where an absent field is a no-op — will silently lose `turn` or `river` data on a partial PATCH.

**Suggested fix:** Add an explicit note to the FastAPI route decorator describing the semantics:
```python
@router.patch(
    '/games/{game_id}/hands/{hand_number}',
    summary='Edit community cards',
    description=(
        'Updates community card values for the specified hand. '
        '**Full-replace semantics apply to optional fields**: '
        'omitting `turn` or `river` from the request body clears those fields. '
        'To preserve an existing value, repeat it in the payload.'
    ),
)
```
Alternatively, switch to explicit optional-with-sentinel semantics using `turn: str | None | Unset = UNSET` (or Pydantic v2's `model_fields_set`) so omission and null are distinguishable — but this is a larger change and should be weighed against consistency with other PATCH endpoints.

**Acceptance Criteria:**
1. The endpoint's OpenAPI `description` (or equivalent docstring) explicitly states that omitting `turn` or `river` clears the field
2. S-5.1 acceptance criteria in `specs/aia-core-001/spec.md` are updated to document the full-replace behaviour
3. No change to the current functional behaviour is required — documentation only

---

### F-072 — Misleading 404 detail text when player exists globally but not in the hand (aia-core-xw3 / T-029)

**Source Task:** aia-core-xw3 (T-029: Implement Edit Player Hole Cards endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `edit_player_hole_cards`

`edit_player_hole_cards` performs two sequential existence checks:

1. **Global player lookup** — queries `Player` by `player_id`; if not found, raises `HTTPException(404, detail="Player not found")`.
2. **Hand membership lookup** — queries `PlayerHand` for `(hand_id, player_id)`; if not found, raises `HTTPException(404, detail=...)`.

The problem is in the first check. A player who exists in the `players` table but was never enrolled in this specific hand clears the global guard and reaches the second check, which correctly returns 404. However, a player whose `player_id` does not exist at all also returns a 404 — with the message `"Player not found"`. This message is technically correct for that case, but the two-step path means that a caller passing a valid `player_id` that is simply absent from this hand will first hit the global check (passes), then the `PlayerHand` check (fails with the second detail message). As long as the second message is specific (e.g. `"Player not in this hand"`), the end-to-end behaviour is fine. The risk is that a future refactor collapses the two checks into a single `PlayerHand` query, which would silently lose the distinction between "player does not exist" and "player exists but not in this hand" — both would return the less-informative message.

Additionally, the current two-query path issues an extra `SELECT` against `players` on every request, even when the `PlayerHand` lookup alone would be sufficient to determine non-membership. If a `PlayerHand` row is missing it is ambiguous whether the player ID is invalid or simply not enrolled, but that ambiguity is acceptable for a 404 in most API contracts.

**Suggested fix (low-risk):** Ensure the second 404 message explicitly states `"Player not in this hand"` (or similar) so the two 404 paths always produce distinguishable detail strings. Add a test that asserts the exact `detail` text for each path.

**Suggested fix (optional refactor):** Collapse to a single `PlayerHand` query using a JOIN on `Player`:
```python
player_hand = (
    db.query(PlayerHand)
    .join(Player, Player.player_id == PlayerHand.player_id)
    .filter(PlayerHand.hand_id == hand.hand_id, PlayerHand.player_id == player_id)
    .first()
)
if player_hand is None:
    raise HTTPException(status_code=404, detail="Player not found in this hand")
```
This eliminates the extra round-trip and produces a single, unambiguous 404 message. The distinction between "unknown player ID" and "player not enrolled" is collapsed, which is acceptable if the API contract does not require distinguishing the two cases.

**Acceptance Criteria:**
1. A request with a `player_id` that does not exist in the `players` table returns 404
2. A request with a valid `player_id` that is not enrolled in the specified hand returns 404 with a detail message that clearly references the hand (e.g. contains `"hand"` or `"not in this hand"`)
3. The two 404 paths produce distinguishable `detail` strings
4. Tests exist asserting the exact `detail` text for both paths

---

### F-073 — `test_player_not_in_hand_returns_404` manages its own `dependency_overrides` and `TestClient` — teardown not guaranteed (aia-core-xw3 / T-029)

**Source Task:** aia-core-xw3 (T-029: Implement Edit Player Hole Cards endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_edit_hole_cards_api.py — `test_player_not_in_hand_returns_404`

`test_player_not_in_hand_returns_404` manually sets `app.dependency_overrides[get_db] = lambda: session` and constructs a bare `TestClient(app)` inline, rather than using the shared `client` fixture from `conftest.py`. Because the override is set inside the test body with no `try/finally` guard and no `yield`-based teardown, an unexpected exception mid-test (e.g. an assertion error, a DB error during setup) will exit the function before the cleanup line is reached. `app.dependency_overrides` remains populated for all subsequent tests in the session, injecting a stale DB session into every endpoint that calls `get_db`. This is the same class of issue resolved for the `client` fixture in F-012 / T-049, now reproduced in a single test.

Additionally, the inline `TestClient` does not enter a context manager, so FastAPI lifespan events are not exercised — consistent with the pattern noted in F-019, but still a latent risk when lifespan handlers are added.

**Suggested fix:** Remove the inline `dependency_overrides` manipulation and `TestClient` construction. Use the `client` fixture (and the shared `db_session` fixture for any direct DB assertions), which already handles teardown via `yield` + `app.dependency_overrides.clear()`:

```python
def test_player_not_in_hand_returns_404(client, db_session):
    # ... setup using db_session ...
    response = client.patch(f"/games/{game_id}/hands/{hand_number}/players/{player_id}/hole-cards", json={...})
    assert response.status_code == 404
```

**Acceptance Criteria:**
1. `test_player_not_in_hand_returns_404` uses the `client` fixture and does not set `app.dependency_overrides` directly
2. No inline `TestClient` is constructed inside the test body
3. The test continues to assert a 404 response and passes
4. If the test raises mid-execution, `app.dependency_overrides` is left clean for subsequent tests

---

### F-074 — Unhandled IntegrityError on concurrent add_player_to_hand calls (aia-core-3r6 / T-030)

**Source Task:** aia-core-3r6 (T-030: Implement Add/Remove Player from Hand endpoints)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/hands.py — `add_player_to_hand`

`add_player_to_hand` performs an explicit duplicate check (`db.query(PlayerHand).filter(...).first()`) before inserting a new `PlayerHand` row. Two concurrent `POST` requests for the same `(hand_id, player_id)` pair can both pass this guard before either completes its commit. Both then proceed to `db.add(ph)` / `db.commit()`. The second commit hits the `uq_player_hand` unique constraint and raises an unhandled `sqlalchemy.exc.IntegrityError`, which propagates as HTTP 500 instead of a structured error response. This is the same TOCTOU class as F-020 (T-051 / `create_player`), F-027 (T-056 / `create_game_session`), and F-050 (T-060 / `record_hand`).

**Suggested fix:** Wrap the `db.add(ph)` / `db.commit()` block in a `try/except IntegrityError` and re-raise as HTTP 400:
```python
from sqlalchemy.exc import IntegrityError

try:
    db.add(ph)
    db.commit()
except IntegrityError as exc:
    db.rollback()
    raise HTTPException(
        status_code=400,
        detail="Player is already in this hand.",
    ) from exc
```

**Acceptance Criteria:**
1. When two concurrent `POST` requests for the same `(game_id, hand_number, player_id)` race past the duplicate guard, the second request receives HTTP 400 (not 500)
2. The HTTP 400 detail message indicates the player is already enrolled in the hand
3. A unit test using a mocked session simulates the `IntegrityError` on commit and asserts a 400 response
4. The existing explicit-duplicate-check path (sequential duplicate POST) continues to return 400 as before

---

### F-075 — No integration test for identical hole cards in add_player_to_hand payload (aia-core-3r6 / T-030)

**Source Task:** aia-core-3r6 (T-030: Implement Add/Remove Player from Hand endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_add_remove_player_hand_api.py

`add_player_to_hand` passes `card_1` and `card_2` (along with all existing community and hole cards for the hand) through `validate_no_duplicate_cards` before inserting the new `PlayerHand` row. A payload where `card_1 == card_2` (e.g. `{"card_1": "AS", "card_2": "AS"}`) would therefore be rejected with HTTP 400 via the validator. However, no test in `test_add_remove_player_hand_api.py` exercises this specific path. The validator unit tests (`test_card_validator.py`) cover the self-duplicate case at the utility level, but the same-card-twice case is not verified end-to-end through the `POST /games/{game_id}/hands/{hand_number}/players` endpoint. If the call site inadvertently excluded `card_1` or `card_2` from the `all_cards` assembly (e.g. only passing community cards and other players' hole cards but not the new player's own cards), the regression would be invisible to the current test suite.

**Suggested follow-up:** Add a test `test_add_player_with_identical_hole_cards_returns_400` to `test/test_add_remove_player_hand_api.py`:
1. Create a game, hand (with known community cards), and a player.
2. `POST` to add the player with `card_1 == card_2` (e.g. `"AS"` / `"AS"`).
3. Assert HTTP 400.
4. Assert no `PlayerHand` row was written for that player.

**Acceptance Criteria:**
1. A `POST` with `card_1 == card_2` returns 400
2. No `PlayerHand` row is written to the database on rejection
3. The test is present in `test_add_remove_player_hand_api.py` and passes

---

### F-076 — game.players lazy-loads all game participants per add_player_to_hand call (aia-core-3r6 / T-030)

**Source Task:** aia-core-3r6 (T-030: Implement Add/Remove Player from Hand endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/hands.py — `add_player_to_hand`

`add_player_to_hand` accesses `game.players` to verify that the target player is enrolled in the game session before adding them to the hand. `GameSession.players` is a lazy-loaded relationship, so accessing it triggers a full `SELECT` of all `GamePlayer` rows for that `game_id`. For a game session with a large roster (e.g. a tournament with 50+ registered players) this loads all participant records into memory for a membership check that only needs a single row. The issue is consistent with the pattern used in `record_hand` (noted in F-042 / F-038 for game session list/get endpoints) and does not represent a regression introduced by T-030 specifically.

No immediate action required beyond existing tracking. This finding is noted to establish a complete picture of lazy-load patterns in `hands.py` so that a future performance pass (e.g. when T-064 is addressed) considers `add_player_to_hand` alongside `get_hand` and `list_hands`.

**Suggested follow-up:** When the lazy-load pattern in `hands.py` is systematically addressed (e.g. as part of T-064 or a follow-on perf task), replace the `game.players` access with a targeted existence query:
```python
membership = (
    db.query(GamePlayer)
    .filter(GamePlayer.game_id == game_id, GamePlayer.player_id == player_id)
    .first()
)
if membership is None:
    raise HTTPException(status_code=400, detail="Player is not enrolled in this game session.")
```
This reduces the membership check to a single indexed lookup regardless of roster size.

**Acceptance Criteria:**
1. No code change is required at this time — this is a documentation-only finding
2. A follow-up task or note is filed to consider `add_player_to_hand` during any future lazy-load remediation pass in `hands.py`

---

### F-077 — Non-deterministic tie-breaking in leaderboard sort (aia-core-3lv / T-033)

**Source Task:** aia-core-3lv (T-033: Implement Leaderboard endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/stats.py — leaderboard query `ORDER BY` clause

The leaderboard query sorts rows by the selected metric (e.g. `total_profit_loss DESC`) but specifies no secondary sort key. When two or more players share the same metric value, their relative order is determined by whatever the database engine returns — which is unspecified and may vary between queries, query plans, or database versions. This means two identical `GET /stats/leaderboard` requests can return players in different orders for tied positions, making the response non-deterministic and breaking client-side equality assertions in tests.

**Fix:**
Add `Player.name.asc()` as a secondary sort key to every leaderboard `ORDER BY` clause so that ties are broken alphabetically:
```python
.order_by(sort_column.desc(), Player.name.asc())
```
This applies regardless of which `metric` query param is active (`total_profit_loss`, `win_rate`, or `hands_played`).

**Acceptance Criteria:**
1. Two `GET /stats/leaderboard` requests with the same `metric` and tied players always return those players in the same order
2. Tied players are ordered alphabetically by `player_name` ascending
3. A test seeds two players with identical metric values and asserts the response lists them in alphabetical order
4. Existing leaderboard tests continue to pass

---

### F-078 — `wins or 0` guard in leaderboard query is unreachable dead code (aia-core-3lv / T-033)

**Source Task:** aia-core-3lv (T-033: Implement Leaderboard endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/stats.py — leaderboard win-rate calculation

The leaderboard route computes `wins` via `func.sum(case(..., else_=0))`. Because `else_=0` is always provided, the aggregate can never return `NULL` — SQLAlchemy's `func.sum` returns `NULL` only when all input rows are `NULL`, and the `case` expression guarantees an integer `0` for every non-matching row. The downstream expression `wins or 0` is therefore unreachable: `wins` is always an integer, never `None` or falsy (unless the player has zero hands, in which case `wins == 0` and `wins or 0` still evaluates to `0`). The guard adds no protection and misleads readers into thinking `wins` can be `None` at that point.

**Fix:**
Remove the `or 0` guard and use `wins` directly:
```python
# Before:
win_rate = round((wins or 0) / total_hands * 100, 2) if total_hands else 0.0

# After:
win_rate = round(wins / total_hands * 100, 2) if total_hands else 0.0
```

**Acceptance Criteria:**
1. The `or 0` fallback is removed from the `wins` usage in the win-rate calculation
2. All existing leaderboard tests continue to pass without modification
3. No functional change to the endpoint's response values

---

### F-079 — Unnecessary Player JOIN gives false impression of eager loading in `get_game_stats` (aia-core-5pi / T-034)

**Source Task:** aia-core-5pi (T-034: Implement Per-Session Stats endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/stats.py — `get_game_stats` player_hands query

The `player_hands` query in `get_game_stats` includes `.join(Player, PlayerHand.player_id == Player.player_id)`, but the `Player` table is never referenced in any `.filter()` or `.order_by()` clause — it has no effect on the result set. The join exists solely because the loop body then accesses `ph.player.name` to populate the `player_name` key in the per-player stats dict. However, SQLAlchemy does not use a raw SQL `JOIN` in a `.query(PlayerHand)` call to populate `PlayerHand.player` — that relationship is lazy-loaded separately. The JOIN therefore does nothing except make the query wider, while `ph.player.name` still triggers one lazy-load `SELECT` per distinct `player_id` encountered in the loop. The net result is a misleading JOIN that provides no eager-loading benefit and incurs unnecessary SQL overhead.

**Fix:**
Remove the `.join(Player, ...)` from the query and instead add `.options(joinedload(PlayerHand.player))` to request genuine eager loading. `joinedload` is already imported from `sqlalchemy.orm` in this file:
```python
player_hands = (
    db.query(PlayerHand)
    .join(Hand, PlayerHand.hand_id == Hand.hand_id)
    .options(joinedload(PlayerHand.player))
    .filter(Hand.game_id == game_id, PlayerHand.result.isnot(None))
    .all()
)
```
With `joinedload(PlayerHand.player)`, SQLAlchemy performs a single SQL `JOIN` that populates `ph.player` for all returned rows, eliminating the per-player lazy-load selects.

**Acceptance Criteria:**
1. The `.join(Player, PlayerHand.player_id == Player.player_id)` line is removed from the `player_hands` query
2. `.options(joinedload(PlayerHand.player))` is added to the same query
3. `ph.player.name` accesses in the loop do not trigger additional SQL queries after the change
4. Existing `GET /stats/games/{game_id}` tests continue to pass

---

### F-080 — `game.players` triggers lazy load on stats fallback path in `get_game_stats` (aia-core-5pi / T-034)

**Source Task:** aia-core-5pi (T-034: Implement Per-Session Stats endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/stats.py — `get_game_stats` game query and `game.players` access

`game` is loaded via `db.query(GameSession).filter(GameSession.game_id == game_id).first()` with no `.options()` clause. Later, the fallback loop `for player in game.players:` — which ensures players with zero recorded results appear in the response — accesses `GameSession.players`, a lazy-loaded relationship. This triggers a second SQL query to load all `GamePlayer` rows for the session. The pattern is structurally identical to F-038 (`get_game_session`) and F-042 (`list_game_sessions`): a relationship is accessed after the initial query without having been eagerly loaded. Here the impact is limited to a single extra round-trip per stats request, but it is unnecessary and inconsistent with how `get_player_stats` loads its relationships.

**Fix:**
Add `.options(joinedload(GameSession.players))` to the initial game query:
```python
from sqlalchemy.orm import joinedload

game = (
    db.query(GameSession)
    .options(joinedload(GameSession.players))
    .filter(GameSession.game_id == game_id)
    .first()
)
```
`joinedload` is already imported in this file. With this change, `game.players` is populated in the initial `SELECT` and accessing it in the fallback loop issues no additional SQL.

**Acceptance Criteria:**
1. The `game` query uses `.options(joinedload(GameSession.players))`
2. Accessing `game.players` in the fallback loop does not trigger a separate SQL query
3. Existing `GET /stats/games/{game_id}` tests continue to pass

---

### F-081 — Naming inconsistency: `GameStatsPlayerEntry.profit_loss` vs `PlayerStatsResponse.total_profit_loss` (aia-core-5pi / T-034)

**Source Task:** aia-core-5pi (T-034: Implement Per-Session Stats endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/pydantic_models/app_models.py — `GameStatsPlayerEntry` (line 366) and `PlayerStatsResponse` (line 337)

Both `GameStatsPlayerEntry` and `PlayerStatsResponse` expose a player's profit/loss figure, but the field names differ: `GameStatsPlayerEntry` uses `profit_loss` while `PlayerStatsResponse` uses `total_profit_loss`. An API consumer building a unified analytics view from both `GET /stats/games/{game_id}` and `GET /stats/players/{player_name}` must handle two different field names for the conceptually equivalent value. The inconsistency is invisible at the HTTP level (both fields appear in JSON), making it an easy source of silent client-side bugs (e.g. a consumer reads `.profit_loss` on a `PlayerStatsResponse` object and gets `None` or `AttributeError`).

No functional bug exists — both fields are correctly populated. However, the inconsistency will surface as a friction point for any typed client SDK auto-generated from the OpenAPI schema.

**Suggested follow-up:** Decide on a canonical field name for the P/L figure across all stats response models. Options:
1. Rename `GameStatsPlayerEntry.profit_loss` → `total_profit_loss` (matches `PlayerStatsResponse` and `LeaderboardEntry`, which also uses `total_profit_loss`)
2. Rename `PlayerStatsResponse.total_profit_loss` → `profit_loss` (shorter, but less consistent with `LeaderboardEntry`)

Option 1 is preferred for consistency with `LeaderboardEntry`. Renaming requires updating the route handler (`stats.py`) and any tests that assert on the `profit_loss` key in game stats responses.

---

### F-082 — Silent asymmetry between `total_hands` and per-player `hands_played` counts (aia-core-5pi / T-034)

**Source Task:** aia-core-5pi (T-034: Implement Per-Session Stats endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/stats.py — `get_game_stats`

`get_game_stats` returns two hand-count figures that are computed from different populations with no explanation in the code:

- `total_hands` (`GameStatsResponse.total_hands`) — counts **all** `Hand` rows for the game via `func.count(Hand.hand_id)`, regardless of whether any player result has been recorded.
- `hands_played` per player (`GameStatsPlayerEntry.hands_played`) — counts only `PlayerHand` rows where `result IS NOT NULL`, because the `player_hands` query filters on `PlayerHand.result.isnot(None)`.

This means `total_hands` can be, for example, `10` while all players show `hands_played == 7` — the three-hand gap represents hands that were recorded but whose results have not yet been entered. The behaviour is correct and intentional (it allows the response to convey both "how many hands were played" and "how many hands have complete results"), but it is entirely unexplained in the code. A future maintainer is likely to perceive the discrepancy as a bug and attempt to "fix" the query in a way that silently changes the semantics.

**Suggested follow-up:** Add an inline comment to the `player_hands` query or to the `total_hands` computation to explain the intentional asymmetry:
```python
# total_hands counts all recorded hands, including those with no results entered yet.
total_hands = (
    db.query(func.count(Hand.hand_id)).filter(Hand.game_id == game_id).scalar()
)

# player_hands filters to result IS NOT NULL — hands_played per player reflects
# only hands where a result has been recorded, which may be fewer than total_hands.
player_hands = (
    ...
    .filter(Hand.game_id == game_id, PlayerHand.result.isnot(None))
    ...
)
```

**Acceptance Criteria:**
1. Inline comments in `get_game_stats` explain that `total_hands` counts all hands and that per-player `hands_played` counts only result-recorded hands
2. No functional change to the endpoint's response values
3. The asymmetry is documented in the OpenAPI endpoint description or in the spec (S-6.5 AC) so that API consumers understand why the numbers may differ

---

### F-083 — Inefficient `query.count()` on multi-join ORM query in `search_hands_by_player` (aia-core-dqj / T-036)

**Source Task:** aia-core-dqj (T-036: Implement Search Hands by Player endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/search.py — `search_hands_by_player` (line 36)

`total = query.count()` is called on the full four-table join query (`Hand`, `PlayerHand`, `Player`, `GameSession`). SQLAlchemy wraps the entire join as a subquery — `SELECT count(*) FROM (SELECT hand.hand_id, player_hand.player_hand_id, player.player_id, game_session.game_id FROM ... WHERE ...)` — even though the count only needs to know how many `PlayerHand` rows match the player filter. The `GameSession` join (needed only to fetch `game_date` for the result payload) participates in the count subquery unnecessarily, increasing its cost. As the dataset grows, the difference between a focused count and a full-join count compounds.

**Suggested fix:** Issue a separate, targeted count query scoped to the minimum tables required (PlayerHand + Player):
```python
total = (
    db.query(func.count(PlayerHand.player_hand_id))
    .join(Player, Player.player_id == PlayerHand.player_id)
    .filter(func.lower(Player.name) == player.lower())
    .scalar()
)
```
This executes a simple two-table aggregate rather than wrapping the full four-join query in a subquery.

**Acceptance Criteria:**
1. The count query touches only `PlayerHand` and `Player` (no `Hand` or `GameSession` join)
2. The returned `total` value is identical to the previous result for any valid input
3. Existing `GET /hands` pagination tests continue to pass

---

### F-084 — Non-deterministic ordering when player participated in two games on the same date (aia-core-dqj / T-036)

**Source Task:** aia-core-dqj (T-036: Implement Search Hands by Player endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/search.py — `search_hands_by_player` (line 32)

`.order_by(GameSession.game_date, Hand.hand_number)` is ambiguous when a player participated in two or more games on the same calendar date. `hand_number` is scoped to a single `GameSession` and restarts at 1 for every new game, so for two games on the same date the combined result set contains interleaved rows from both games without a stable, predictable sequence. The database is free to return these rows in any order it chooses, and the ordering will vary between PostgreSQL and SQLite and may differ across query plans for the same query in production. This makes paginated results non-reproducible: fetching page 1 and page 2 separately may yield different orderings than fetching all rows at once.

**Suggested fix:** Add `GameSession.game_id` as a tiebreaker after `game_date`:
```python
.order_by(GameSession.game_date, GameSession.game_id, Hand.hand_number)
```
`game_id` is a monotonically increasing integer PK, providing a stable and consistent ordering for games on the same date.

**Acceptance Criteria:**
1. The `order_by` clause includes `GameSession.game_id` between `game_date` and `hand_number`
2. A test with two games on the same date verifies that the result order is deterministic and consistent across both calls (e.g. page 1 then page 2 produce no duplicate or missing rows)
3. Existing search tests continue to pass

---

### F-085 — `profit_loss` not asserted in `test_search_hands_player_api.py` tests (aia-core-dqj / T-036)

**Source Task:** aia-core-dqj (T-036: Implement Search Hands by Player endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_search_hands_player_api.py — result assertions

The test fixture creates a `PlayerHand` with `profit_loss=50.0`, but no assertion in the test verifies that `profit_loss` is present and correct in the API response. The field appears in `PlayerHandResponse` and is populated by `ph.profit_loss` in the route handler, but the absence of a test assertion means a future regression silently zeroing or omitting `profit_loss` would go undetected. This is the same class of coverage gap noted in F-001 (single-record traversal) — the fixture establishes intent but the assertion does not follow through.

**Suggested fix:** Add an assertion on the `player_hand` sub-object in the happy-path test:
```python
assert result['player_hand']['profit_loss'] == 50.0
```

**Acceptance Criteria:**
1. At least one test in `test_search_hands_player_api.py` asserts `result['player_hand']['profit_loss'] == 50.0`
2. The assertion is placed where the fixture value is verifiable (i.e. in a test that uses the fixture creating `profit_loss=50.0`)
3. All existing tests continue to pass

---

### F-086 — `player_name` not asserted in `PlayerHandResponse` in search result tests (aia-core-dqj / T-036)

**Source Task:** aia-core-dqj (T-036: Implement Search Hands by Player endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_search_hands_player_api.py — result assertions

`PlayerHandResponse` carries a `player_name` field populated from `player_obj.name` in the route handler. No test in `test_search_hands_player_api.py` asserts that `player_name` is present and correctly set in the serialised response. If the `player_obj.name` assignment were accidentally replaced with a hardcoded value, an empty string, or dropped entirely, all search tests would still pass. This gap also leaves the contract between `search_hands_by_player` and its callers unverified for this field.

**Suggested fix:** Add an assertion on `player_name` in the happy-path test:
```python
assert result['player_hand']['player_name'] == 'Alice'  # or whichever name the fixture uses
```

**Acceptance Criteria:**
1. At least one test asserts `result['player_hand']['player_name']` equals the fixture player's name
2. All existing tests continue to pass

---

### F-087 — `per_page` upper bound of 200 is undocumented in the API (aia-core-dqj / T-036)

**Source Task:** aia-core-dqj (T-036: Implement Search Hands by Player endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/search.py — `search_hands_by_player` (line 24)

`per_page: Annotated[int, Query(ge=1, le=200)] = 50` enforces a maximum of 200 results per page. The constraint is sensible — it prevents clients from requesting arbitrarily large pages and overloading the server — but it is implicit. The `le=200` validator produces a 422 response for `per_page=201` with a generic FastAPI validation error; there is no `description` on the `Query` field and no OpenAPI doc comment explaining the cap. API consumers discovering this limit for the first time will receive an opaque validation error with no context.

**Suggested fix:** Add a `description` to the `Query` annotation:
```python
per_page: Annotated[
    int,
    Query(ge=1, le=200, description='Number of results per page (max 200)'),
] = 50
```

**Acceptance Criteria:**
1. The `per_page` `Query` annotation includes a `description` that mentions the 200-result maximum
2. The OpenAPI spec (e.g. `GET /openapi.json`) reflects the description on `per_page`
3. No functional change to the endpoint's validation behaviour

---

### F-088 — Non-UTF-8 CSV upload raises unhandled `UnicodeDecodeError` → HTTP 500

**Source Task:** aia-core-pk6 (T-025: Implement CSV upload and validation endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/upload.py — CSV decode path
**Tracked as:** T-066

`POST /upload/csv` reads the uploaded file bytes and calls `.decode('utf-8')` without a `try/except`. Any file that is not valid UTF-8 (e.g. Latin-1, Windows-1252, or binary data) raises an unhandled `UnicodeDecodeError`, propagating through FastAPI's default exception handler as HTTP 500. The root cause is a client-supplied input error, so the correct response is HTTP 400 with an actionable message. The current behaviour exposes an internal server error to the caller and provides no guidance on how to correct the upload.

**Suggested follow-up:** Implement T-066 — wrap `.decode('utf-8')` in a `try/except UnicodeDecodeError` and raise `HTTPException(status_code=400, detail="CSV file must be UTF-8 encoded...")`.

---

### F-089 — No file size cap on CSV upload — memory exhaustion DoS vector

**Source Task:** aia-core-pk6 (T-025: Implement CSV upload and validation endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/upload.py — `await file.read()` call
**Tracked as:** T-067

`POST /upload/csv` calls `await file.read()` with no size argument, buffering the entire multipart file body into memory before any validation occurs. An attacker (or misconfigured client) submitting a multi-hundred-megabyte file will consume heap memory until the server exhausts available RAM, causing OOM errors or degrading concurrent request handling. This is a memory-exhaustion denial-of-service vector that can be triggered by any unauthenticated caller. The image upload endpoint (T-039) applies a 10 MB cap; the CSV endpoint should apply an equivalent or stricter limit given that CSV data is text and any legitimate session CSV will be well under 1 MB.

**Suggested follow-up:** Implement T-067 — read at most `MAX_CSV_SIZE + 1` bytes and raise `HTTPException(status_code=413)` if the read buffer exceeds the cap.

---

### F-090 — Invalid non-card fields crash CSV commit as HTTP 500, not HTTP 400

**Source Task:** aia-core-chy (T-026: Implement CSV commit endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/upload.py — `validate_csv_rows` and CSV commit handler
**Tracked as:** T-068

`validate_csv_rows` validates card fields (hole cards, community cards) but does not validate non-card scalar fields. An invalid `game_date` format (e.g. `"not-a-date"`), a non-integer `hand_number` (e.g. `"two"`), or a non-numeric `profit_loss` (e.g. `"abc"`) all pass the validation step without error. When the commit handler subsequently coerces these values (e.g. `datetime.strptime(row['game_date'], ...)` or `int(row['hand_number'])`), an unhandled `ValueError` or `TypeError` propagates through FastAPI's exception handler as HTTP 500. The caller has already been told the CSV is valid (the validation pass returned no errors), making the 500 on commit surprising and providing no actionable information about which row caused the failure.

**Suggested follow-up:** Implement T-068 — extend `validate_csv_rows` (or add a `validate_commit_fields` step) to coerce and check `game_date`, `hand_number`, and `profit_loss` during the upload/validation pass, returning per-row HTTP 400 errors for any format violation.

---

### F-091 — N+1 GamePlayer existence checks in CSV commit — up to O(players × hands) queries

**Source Task:** aia-core-chy (T-026: Implement CSV commit endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/upload.py — CSV commit loop
**Tracked as:** T-069

For every player row in the CSV, `POST /upload/csv/commit` issues `db.query(GamePlayer).filter(GamePlayer.game_id == ..., GamePlayer.player_id == ...).first()` to check whether the association already exists before inserting it. With a CSV containing 10 players and 100 hands, this generates up to 1 000 individual SQL queries for membership checks alone — before accounting for player lookups or inserts. The pattern is structurally identical to the N+1 issue in F-062 / F-042, but occurs in a bulk write path where transaction overhead amplifies the cost. A single commit of a moderately sized session CSV can degrade performance and exhaust the database connection pool under concurrent load.

**Suggested follow-up:** Implement T-069 — pre-load the complete set of existing `(game_id, player_id)` pairs in a single query before the loop and use in-memory set membership to determine whether each `GamePlayer` row needs to be inserted.

---

### F-092 — Conflicting community card values for the same hand group silently discarded — first row wins

**Source Task:** aia-core-chy (T-026: Implement CSV commit endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/upload.py — hand-group processing in CSV commit handler
**Tracked as:** T-070

The CSV commit handler groups rows by `(game_date, hand_number)` and takes `first_row = rows[0]` to populate community card values for the `Hand` record. No consistency check verifies that all rows in the group carry identical community card values. If two rows for the same hand have different values for any community card field — for example, `flop_1 = 'AS'` in one row and `flop_1 = 'KH'` in another — the discrepancy is silently ignored: the first row's values are used and the conflicting value is discarded without warning. The committed `Hand` record may not reflect the actual game state, and the data loss is undetectable after commit.

**Suggested follow-up:** Implement T-070 — add a group-consistency check during the validation pass that compares all rows within each hand group against the first row for all five community card fields (`flop_1`, `flop_2`, `flop_3`, `turn`, `river`), returning a per-hand HTTP 400 error on any mismatch.

---

### F-093 — Asymmetric caching: player_by_name cached, GamePlayer existence uncached — O(N) reads for repeated player-game pairs

**Source Task:** aia-core-chy (T-026: Implement CSV commit endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/upload.py — CSV commit loop
**Tracked as:** T-071

The CSV commit handler caches resolved `Player` objects in `player_by_name` to avoid re-querying the `players` table on every row. No equivalent cache exists for the `GamePlayer` existence check. For a player appearing in 50 hands of the same game, the `Player` lookup is issued once and reused from cache — but `db.query(GamePlayer).filter(...).first()` is re-issued for the same `(game_id, player_id)` pair on every one of those 50 rows. The `player_by_name` optimisation reduces player lookups from O(N) to O(P) while `GamePlayer` checks remain O(N), where N = total player-row count and P = distinct player count.

Note: T-069 addresses this concern at a broader level by pre-loading all `(game_id, player_id)` pairs before the loop. T-071 tracks the narrower in-loop cache fix to ensure the asymmetry is not re-introduced if T-069 covers only the pre-load path.

**Suggested follow-up:** Implement T-071 — add a `game_player_seen` set (scoped to the request handler, not the module) that tracks `(game_id, player_id)` pairs already checked or inserted during the current commit request, skipping the DB query for any pair that has been seen.

---

### F-094 — No format validation on `card` query parameter — invalid values silently return 0 results (aia-core-slu / T-037)

**Source Task:** aia-core-slu (T-037: Implement Search Hands by Date Range and Card endpoints)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/search.py — `card` parameter definition (line 32–34)

The `card` query parameter is declared as `str | None` with only a human-readable `description`. No regex pattern constraint is applied, so any arbitrary string passes FastAPI/Pydantic validation without error. A request such as `GET /hands?card=as` (lowercase suit) or `GET /hands?card=Ace` silently returns zero results — the value fails to match any `Hand` or `PlayerHand` column value, but the response is `200 OK` with an empty `results` list and `total=0`. The caller receives no indication that the parameter value is malformed. Per the card format used throughout the system (rank + suit, e.g. `AS`, `10H`, `KD`), the correct response for an invalid card string is HTTP 422.

**Fix:**
In `src/app/routes/search.py`, add a `pattern` constraint to the `card` `Query` annotation:
```python
card: Annotated[
    str | None,
    Query(
        description='Card to search for, e.g. AS or KH',
        pattern=r'^(A|2|3|4|5|6|7|8|9|10|J|Q|K)(S|H|D|C)$',
    ),
] = None,
```
FastAPI will automatically return HTTP 422 for any value that does not match the pattern.

**Acceptance Criteria:**
1. `GET /hands?card=as` returns HTTP 422 (lowercase suit fails the pattern)
2. `GET /hands?card=Ace` returns HTTP 422 (invalid format)
3. `GET /hands?card=AS` returns HTTP 200 (valid format, results may be empty)
4. `GET /hands?card=10H` returns HTTP 200 (ten of hearts — valid two-character rank)
5. The OpenAPI schema for the `card` parameter reflects the regex pattern
6. Existing card-search tests with valid card values continue to pass

---

### F-095 — `location` param silently discarded when `card` is absent — undocumented no-op (aia-core-slu / T-037)

**Source Task:** aia-core-slu (T-037: Implement Search Hands by Date Range and Card endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/search.py — `search_hands` (lines 62–77)

The `location` filter is applied only inside the `if card is not None:` block (lines 62–77). When a caller supplies `location=community` without a `card` value, the parameter is silently ignored and the full unfiltered result set is returned — as if `location` were never sent. This is an undocumented no-op: the API accepts the parameter, returns HTTP 200 with no error, and discards the caller's intent without notification. A consumer who passes `GET /hands?location=community` expecting only community-card hands will receive all hands with no indication that their filter had no effect.

Two valid resolutions exist:

1. **Return 422** if `location` is supplied without `card` — enforcing the documented dependency and preventing silent discards.
2. **Document the no-op** in the OpenAPI endpoint description and in S-7.3 acceptance criteria so the behaviour is an explicit, testable contract rather than an undocumented side-effect.

**Suggested follow-up:**
Either add a validation guard at the top of `search_hands`:
```python
if location is not None and card is None:
    raise HTTPException(
        status_code=422,
        detail="'location' requires 'card' to be specified.",
    )
```
Or add the following note to the route decorator and to the spec (S-7.3):
> `location` is ignored when `card` is not specified; all results are returned regardless of card position.

Whichever is chosen, add a test `test_location_without_card_returns_422_or_all_hands` to `test/test_search_hands_date_card_api.py` that asserts the documented behaviour.

**Acceptance Criteria:**
1. `GET /hands?location=community` (no `card`) either returns 422 with a descriptive message, or returns 200 with all hands (no location filtering applied)
2. The chosen behaviour is documented in the OpenAPI endpoint description
3. S-7.3 acceptance criteria in `specs/aia-core-001/spec.md` are updated to describe the `location`-without-`card` behaviour
4. A test asserts the documented response

---

### F-096 — Non-deterministic row ordering within a hand — no tie-breaker on PlayerHand (aia-core-slu / T-037)

**Source Task:** aia-core-slu (T-037: Implement Search Hands by Date Range and Card endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/search.py — `search_hands` (line 78)

`.order_by(GameSession.game_date, Hand.hand_number)` sorts the result rows by date and hand number, but provides no secondary sort key to distinguish multiple `PlayerHand` rows belonging to the same hand. For a hand with N players, the query returns N rows — one per `(Hand, PlayerHand, Player, GameSession)` tuple — whose relative order is determined by whatever the database returns after exhausting the two declared sort keys. This order is unspecified, may vary between query plans, and is not reproducible across paginated requests. A caller fetching page 1 and page 2 separately may see different player orderings for the same hand, or may miss or duplicate a player row at a page boundary.

This finding is the same class as F-084 (non-deterministic ordering in `search_hands_by_player` on same-date games), but the tie condition is narrower: it applies *within* a single hand across its player rows.

**Fix:**
In `src/app/routes/search.py`, add `PlayerHand.player_id` as a tertiary tie-breaker:
```python
query = query.order_by(GameSession.game_date, Hand.hand_number, PlayerHand.player_id)
```
`PlayerHand.player_id` is a `NOT NULL` FK column with an implicit column-level index on most DB engines, providing a stable, indexed secondary key that is cheaper than a name-based alphabetical sort.

**Acceptance Criteria:**
1. The `order_by` clause in `search_hands` includes `PlayerHand.player_id` as a tertiary sort key after `hand_number`
2. Two identical `GET /hands` requests for a hand with multiple players always return those player rows in the same order
3. Paginated results (page 1 then page 2) produce no duplicate or missing rows at a page boundary for multi-player hands
4. Existing search tests continue to pass; a test with two players on the same hand asserts a consistent player row ordering across two sequential requests

---

### F-097 — `total` in `PaginatedHandSearchResponse` counts player-hand rows, not unique hands — valid but undocumented (aia-core-slu / T-037)

**Source Task:** aia-core-slu (T-037: Implement Search Hands by Date Range and Card endpoints)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/search.py — `total = query.count()` (line 80); src/pydantic_models/app_models.py — `PaginatedHandSearchResponse`

`total = query.count()` counts rows in the four-table join — one row per `(Hand, PlayerHand, Player, GameSession)` tuple. For a result set containing 2 hands each with 2 enrolled players, `total` is `4`, not `2`. A caller expecting `total` to represent the number of distinct hands (as would be natural for a "search hands" endpoint) will compute incorrect pagination logic — for example, inferring `ceil(4 / per_page)` pages when only `ceil(2 / per_page)` unique hands exist. The last page will also appear non-empty at `total / per_page` but return no new hands, confusing pagination clients.

The behaviour is a valid design choice: each player-hand row is an independently addressable record, and the `results` list returns one entry per row (including the specific `PlayerHandResponse` for the matching player). However, neither the field description in `PaginatedHandSearchResponse` nor the OpenAPI endpoint documentation mentions this semantics. Without documentation, callers will routinely misinterpret `total` as a unique-hand count.

**Suggested follow-up:** Two options:

1. **Document the existing semantics:** Add a `description` to `PaginatedHandSearchResponse.total` and a note in the OpenAPI endpoint description:
   > `total` counts the number of player-hand result rows returned, not the number of unique hands. A hand with N enrolled players contributes N rows to the total. Use `total / per_page` to compute page count only if each page is consumed row-by-row.

2. **Split the count:** Expose both `total_rows` (current `query.count()`) and `total_hands` (a separate `SELECT COUNT(DISTINCT hand_id)` over the same filter) in the response. This is a larger response-schema change and should be weighed against whether callers actually need the distinct-hand count.

Option 1 is lower-risk and sufficient to prevent misuse.

**Acceptance Criteria:**
1. `PaginatedHandSearchResponse.total` carries a `Field(description=...)` value that explicitly states it counts player-hand rows (not unique hands)
2. The OpenAPI endpoint description for `GET /hands` notes the row-counting semantics
3. No functional change to the response values or query is required
4. A test comment or assertion in `test/test_search_hands_date_card_api.py` confirms the expected `total` value for a 2-hand × 2-player fixture is `4`, not `2`

---

## Review Findings — aia-core-tk6 (T-039: Implement Image Upload endpoint)

*Review Date: 2026-03-11*

---

### F-098 — Path traversal via unsanitized `file.filename` in image upload (CRITICAL) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** CRITICAL
**OWASP:** A01 Broken Access Control / CWE-22 Path Traversal
**File:** src/app/routes/images.py — line 43
**Tracked as:** T-072

`file.filename` is passed directly to `os.path.join(upload_dir, file.filename)` with no sanitization. An attacker supplying `../../etc/cron.d/evil` as the multipart filename component will cause the server to write the uploaded bytes to a path outside the intended `uploads/` directory — to any location the server process has write permission. This is exploitable with a single POST request to any valid `game_id` and requires no authentication bypass. The attacker can overwrite application source files, cron jobs, SSH `authorized_keys`, or other sensitive filesystem locations.

**Fix:**
```python
safe_name = os.path.basename(file.filename)
file_path = os.path.join(upload_dir, safe_name)
```

**Suggested follow-up:** Implement T-072 — apply `os.path.basename()` to `file.filename` before constructing `file_path`.

---

### F-099 — Content-Type-only image validation — any file passes with a spoofed MIME type (HIGH) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — lines 28–33
**Tracked as:** T-073

`file.content_type` is client-supplied and trivially spoofable. The guard at lines 28–33 does not inspect the actual file bytes, so any file — binary, script, or executable — passes with `Content-Type: image/jpeg`. Without magic byte inspection the endpoint provides no real content-type enforcement; an attacker can upload arbitrary data to the server filesystem under a `.jpg` extension.

JPEG signature: `\xff\xd8\xff` (3 bytes). PNG signature: `\x89PNG\r\n\x1a\n` (8 bytes). Both signatures can be checked against `content` which is already buffered in memory after `await file.read()`.

**Suggested follow-up:** Implement T-073 — add magic byte inspection on `content` and reject uploads whose bytes do not match a known JPEG or PNG header.

---

### F-100 — Silent file overwrite on duplicate game_id + filename — prior upload data destroyed (HIGH) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — lines 44–47
**Tracked as:** T-074

`open(file_path, 'wb')` is called with a path constructed solely from `upload_dir` and `file.filename`. A second upload to the same `game_id` with the same filename silently overwrites the existing file on disk while inserting a second `ImageUpload` DB record pointing to the same path. The first record's image data is permanently destroyed without error; the API returns HTTP 201 for both requests. Any downstream detection pipeline operating on the first `upload_id` will silently process incorrect (overwritten) image data.

**Suggested follow-up:** Implement T-074 — write to a temporary UUID-named path, flush to obtain `upload_id`, rename to `{upload_id}_{safe_name}`, then commit.

---

### F-101 — Full file buffered into memory before size check — chunked early exit not possible (MEDIUM) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py — lines 35–40
**Tracked as:** none

`await file.read()` at line 35 buffers the entire multipart body into memory before the 10 MB size check at line 36. A client submitting a 500 MB file fully saturates available heap before the 413 response is sent. Although `MAX_FILE_SIZE` is defined, the cap is enforced after the memory is already allocated. A chunked read with early exit would cap memory consumption to at most `MAX_FILE_SIZE + chunk_size` bytes regardless of upload size.

**Fix:**
```python
CHUNK_SIZE = 64 * 1024  # 64 KB
content = b''
async for chunk in file:
    content += chunk
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail='File too large. Maximum allowed size is 10 MB.')
```

**Acceptance Criteria:**
1. A 50 MB upload is rejected with HTTP 413 without buffering more than `MAX_FILE_SIZE + 64 KB` into memory
2. Valid ≤10 MB uploads continue to be accepted with HTTP 201

---

### F-102 — File written to disk before `db.commit()` — orphaned file on commit failure (MEDIUM) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py — lines 44–52
**Tracked as:** none

The file is written to disk (lines 44–47) before `db.commit()` (line 51). If the commit fails — due to a constraint violation, lost DB connection, or SQLAlchemy error — the file persists on disk with no corresponding `ImageUpload` record. These orphaned files accumulate indefinitely, cannot be associated with any game session, and require manual cleanup.

**Fix:** Wrap the disk write and DB commit together and delete the file if the commit fails:
```python
try:
    with open(file_path, 'wb') as f:
        f.write(content)
    record = ImageUpload(game_id=game_id, file_path=file_path, status='processing')
    db.add(record)
    db.commit()
except Exception:
    if os.path.exists(file_path):
        os.remove(file_path)
    raise
```
Note: T-074 addresses this more comprehensively via the tmp-path-then-rename pattern; if T-074 is implemented the cleanup logic should target the temporary path.

**Acceptance Criteria:**
1. If `db.commit()` raises, no file is left on disk for that upload attempt
2. If the disk write raises, the exception propagates with no DB record created
3. Successful uploads are unaffected

---

### F-103 — `file.filename` can be `None` — unguarded `os.path.join` raises `TypeError` → HTTP 500 (LOW) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py — line 43
**Tracked as:** none

FastAPI's `UploadFile.filename` is typed `Optional[str]` and is `None` when the multipart part carries no `filename` parameter. When `filename` is `None`, `os.path.join(upload_dir, file.filename)` raises `TypeError: expected str, bytes or os.PathLike object, not NoneType`, which propagates as an unhandled exception and returns HTTP 500. A malformed or programmatically-generated multipart request with no filename is sufficient to trigger this.

**Fix:** Add an explicit guard after the content-type check:
```python
if not file.filename:
    raise HTTPException(status_code=400, detail='Upload must include a filename.')
```

**Acceptance Criteria:**
1. A multipart upload with no `filename` field returns HTTP 400 with a descriptive message
2. The guard is placed before the `os.path.basename` / `os.path.join` calls to prevent the `TypeError`
3. A test `test_upload_image_no_filename_returns_400` covers this path

---

### F-104 — No path traversal test — CRITICAL-1 (T-072) can regress undetected (LOW) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_image_upload_api.py
**Tracked as:** none

There is no test that supplies a path-traversal filename (e.g. `../../etc/passwd`) and asserts the file is not written outside `uploads/`. Once T-072 is implemented, a regression test should be added to prevent the `os.path.basename` sanitization from being inadvertently removed in future refactors.

**Suggested follow-up:** After T-072 is implemented, add a test that:
1. Posts a multipart upload with `filename='../../evil.txt'`
2. Asserts HTTP 201 is returned (the upload succeeds but the path is sanitized)
3. Asserts the stored `file_path` starts with `uploads/` and contains no `..` component
4. Asserts no file was written outside the `uploads/` directory tree

**Acceptance Criteria:**
1. Test added to `test/test_image_upload_api.py` (or a dedicated `test_image_upload_security_api.py`)
2. Test passes after T-072 is applied
3. Test fails if `os.path.basename` sanitization is removed — providing regression protection

---

### F-105 — Disk write not verified in tests — response `file_path` not checked against filesystem (LOW) (aia-core-tk6 / T-039)

**Source Task:** aia-core-tk6 (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_image_upload_api.py
**Tracked as:** none

Existing upload tests assert on the JSON response fields (`upload_id`, `file_path`, `status`) but do not verify that a file was actually written to the path indicated by `file_path`. A bug that sets `file_path` correctly in the DB record but fails the disk write — e.g. a wrong directory, a permissions error, or an incorrect `open` mode — would not be caught by the current test suite.

**Suggested follow-up:** Add an assertion to the happy-path upload test that calls `os.path.isfile(response.json()['file_path'])` after a successful upload. Scope the upload directory to a temporary directory fixture to ensure cleanup.

**Acceptance Criteria:**
1. At least one test asserts `os.path.isfile(file_path)` is `True` for a successful upload, using the path from the response body
2. The test cleans up the written file after the assertion, or uses a temporary upload directory scoped to the test session

---

## Cycle 1 — aia-core-6il Findings (2026-03-11)

*Source task: aia-core-6il (T-039: Implement Image Upload endpoint — fix cycle)*
*Review Date: 2026-03-11*

---

### H-1 — No cleanup of disk files on error paths (HIGH) (aia-core-6il / T-039)

**Source Task:** aia-core-6il (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [lines 48–62](src/app/routes/images.py#L48-L62)

If `os.rename` raises or `db.commit()` fails after the rename, the renamed file is left on disk with no corresponding DB record. Over time, failed uploads accumulate as orphaned files that consume disk space and cannot be reclaimed automatically.

**Suggested fix:** Wrap the rename-and-commit block in a `try/finally` (or `try/except`) that deletes the destination file if an exception is raised after the rename succeeds.

**Acceptance Criteria:**
1. A simulated `db.commit()` failure after `os.rename` leaves no file on disk
2. A simulated `os.rename` failure leaves no file under the final path on disk
3. The endpoint returns an appropriate 5xx response in both failure scenarios

---

### M-1 — `file.filename` can be `None` → unhandled `TypeError` (MEDIUM) (aia-core-6il / T-039)

**Source Task:** aia-core-6il (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py

`os.path.basename(file.filename)` raises `TypeError` when `file.filename` is `None`, which is a valid state for multipart uploads that omit the `filename` parameter. The unhandled exception propagates as an HTTP 500 instead of a descriptive client error.

**Suggested fix:** Add an explicit guard before the `os.path.basename` call and return HTTP 400 with a descriptive message when `file.filename is None`.

**Acceptance Criteria:**
1. A multipart upload with no `filename` field returns HTTP 400 (not 500)
2. The 400 response body contains a message indicating the filename is required
3. A test covers this path

---

### M-2 — No DB-level uniqueness constraint on `file_path` in `image_uploads` table (MEDIUM) (aia-core-6il / T-039)

**Source Task:** aia-core-6il (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/ (model and migration for `image_uploads`)

The `file_path` column on the `image_uploads` table has no `UNIQUE` constraint. Application logic prevents duplicate paths under normal operation, but a race condition or a future code path that bypasses the check could insert two records pointing to the same file, breaking the invariant that each DB record maps to a distinct file.

**Suggested fix:** Add `unique=True` to the `file_path` column in the SQLAlchemy model and generate an Alembic migration to add the constraint.

**Acceptance Criteria:**
1. The `image_uploads.file_path` column carries a `UNIQUE` constraint in the SQLAlchemy model
2. An Alembic migration applies the constraint to the table
3. Attempting to insert a duplicate `file_path` raises an `IntegrityError` (verified by test)

---

### L-1 — Relative `upload_dir` path is process-cwd dependent (LOW) (aia-core-6il / T-039)

**Source Task:** aia-core-6il (T-039: Implement Image Upload endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py

`upload_dir` is constructed from a relative path, meaning the actual upload directory changes depending on the working directory from which the server process is launched. Running the server from a different directory (e.g. `uvicorn src.app.main:app` from `/`) silently writes files to an unexpected location.

**Suggested fix:** Anchor the path to the project root using `Path(__file__).resolve().parent` or an environment variable so the directory is consistent regardless of cwd.

**Acceptance Criteria:**
1. The resolved `upload_dir` is identical whether `uvicorn` is launched from the project root, from `src/`, or from `/`
2. No existing tests break after the path anchoring change

---

## Cycle 2 — aia-core-x03 Findings (2026-03-11)

*Source task: aia-core-x03 (error-path cleanup fix)*
*Review Date: 2026-03-11*

---

### H-1 — `db.flush()` failure orphans `tmp_path` (HIGH) (aia-core-x03)

**Source Task:** aia-core-x03 (error-path cleanup fix)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [lines 50–57](src/app/routes/images.py#L50-L57)

No `try/except` wraps the `db.flush()` call, so if `flush()` raises the temporary file written to disk is never cleaned up.  The orphaned `tmp_path` accumulates on disk with no corresponding DB record.

**Suggested fix:** Wrap the `db.flush()` call in a `try/except` block (or extend the surrounding error-path handler) that deletes `tmp_path` before re-raising.

**Acceptance Criteria:**
1. A simulated `db.flush()` failure leaves no `tmp_path` file on disk
2. The endpoint returns an appropriate 5xx response
3. A test covers this failure path

---

### H-2 — `os.remove(final_path)` in commit-failure handler is unguarded (HIGH) (aia-core-x03)

**Source Task:** aia-core-x03 (error-path cleanup fix)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [lines 69–73](src/app/routes/images.py#L69-L73)

If `os.remove(final_path)` raises `OSError`, the bare `except` block exits before `db.rollback()` is reached, leaving the database session in a broken state for the remainder of the request lifecycle.

**Suggested fix:** Guard `os.remove` with its own `try/except OSError` so that `db.rollback()` is always called regardless of whether the file removal succeeds.

**Acceptance Criteria:**
1. A simulated `os.remove` `OSError` during commit-failure handling still triggers `db.rollback()`
2. The endpoint returns an appropriate 5xx response
3. A test covers this scenario

---

### M-1 — `os.remove(tmp_path)` in rename-failure handler is unguarded (MEDIUM) (aia-core-x03)

**Source Task:** aia-core-x03 (error-path cleanup fix)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py — [lines 63–65](src/app/routes/images.py#L63-L65)

If `os.remove(tmp_path)` raises `OSError` in the rename-failure handler, the `HTTPException` is never raised and FastAPI receives an unhandled `OSError`, producing an opaque 500 instead of a descriptive error response.

**Suggested fix:** Wrap `os.remove(tmp_path)` in a `try/except OSError` so that control always reaches the `HTTPException` raise.

**Acceptance Criteria:**
1. A simulated `os.remove` `OSError` in the rename-failure handler still results in an `HTTPException` being raised
2. The endpoint returns a 5xx response with a meaningful message
3. A test covers this path

---

### M-2 — No test covers `db.flush()` failure (MEDIUM) (aia-core-x03)

**Source Task:** aia-core-x03 (error-path cleanup fix)
**Review Date:** 2026-03-11
**Severity:** MEDIUM

The `db.flush()` failure path introduced by the H-1 gap is completely untested.  A regression in this code path would go undetected by the test suite.

**Suggested fix:** Add a unit/integration test that patches `db.flush` to raise and asserts both that `tmp_path` is cleaned up and that the endpoint returns a 5xx response.

**Acceptance Criteria:**
1. A test exists that mocks `db.flush()` to raise a `SQLAlchemyError`
2. The test asserts no `tmp_path` file remains on disk after the failure
3. The test asserts the endpoint returns a 5xx status code

---

### L-1 — `file.filename` can be `None` → unhandled `TypeError` (LOW) (aia-core-x03)

**Source Task:** aia-core-x03 (error-path cleanup fix)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py — [line 46](src/app/routes/images.py#L46)

`os.path.basename(file.filename)` raises `TypeError` when `file.filename` is `None`, which is a valid state for multipart uploads that omit the `filename` parameter.  The unhandled exception surfaces as an HTTP 500 instead of a descriptive 422 client error.

**Suggested fix:** Add an explicit guard before the `os.path.basename` call and raise `HTTPException(status_code=422)` when `file.filename is None`.

**Acceptance Criteria:**
1. A multipart upload with no `filename` field returns HTTP 422 (not 500)
2. The response body contains a message indicating the filename is required
3. A test covers this path

---

## Cycle 3 — aia-core-i8r Findings (2026-03-11)

*Source task: aia-core-i8r*
*Review Date: 2026-03-11*

---

### M-1 — `os.remove(tmp_path)` in rename-failure path is unguarded (MEDIUM) (aia-core-i8r)

**Source Task:** aia-core-i8r
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py — [L63](src/app/routes/images.py#L63)

`os.remove(tmp_path)` in the rename-failure handler is not wrapped in a `try/except`. If `tmp_path` disappears between the failed `os.rename` and the `os.remove` call (e.g. another process or a prior cleanup routine has already removed it), the `OSError` propagates unhandled and the `HTTPException` is never raised — FastAPI surfaces an opaque 500 instead.

**Suggested fix:** Apply the same `try/except OSError: pass` pattern used elsewhere in the file around this `os.remove` call so that control always reaches the `raise HTTPException(...)` line.

**Acceptance Criteria:**
1. A simulated `OSError` from `os.remove(tmp_path)` in the rename-failure path still results in the `HTTPException` being raised
2. The endpoint returns a structured error response (not an unhandled 500) in this scenario
3. A test covers this path

---

### M-2 — `get_db()` never calls `db.rollback()` on exception exit (MEDIUM) (aia-core-i8r)

**Source Task:** aia-core-i8r
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/session.py — [L19-L22](src/app/database/session.py#L19-L22)

The rename-failure path (and other error paths) raise `HTTPException` without an explicit rollback. `get_db()` relies on implicit rollback-on-close behaviour from the DB driver, but `Session.close()` does not guarantee a rollback in all SQLAlchemy configurations. Adding an explicit `db.rollback()` to the `get_db` `finally` block (or a dedicated `except` branch) would make all error paths consistent and safe regardless of driver or session configuration. This is closely related to the pre-existing finding F-013.

**Suggested fix:** Add `db.rollback()` to the `get_db` generator's `finally` block (or inside an `except Exception: db.rollback(); raise` clause before `finally`) so that any uncommitted transaction is reliably rolled back on exception exit.

**Acceptance Criteria:**
1. `get_db()` explicitly calls `db.rollback()` when the request exits via an exception
2. A test verifies the rollback is invoked on an error path (e.g. by asserting no partial data is committed after a handler raises)
3. Normal (non-exception) request paths are unaffected

---

### L-1 — Overly broad `os.remove` mock in regression test (LOW) (aia-core-i8r)

**Source Task:** aia-core-i8r
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_image_upload_api.py — [L311](test/test_image_upload_api.py#L311)

The regression test patches `os.remove` with a blanket mock that intercepts every call to `os.remove` for the duration of the test, including any internal calls made by other library code or fixtures. A targeted `side_effect` function — one that raises only when called with `tmp_path` and passes through (or no-ops) for any other argument — would be more precise and would prevent the mock from accidentally suppressing legitimate `os.remove` calls in the test environment.

**Suggested fix:** Replace the blanket mock with a `side_effect` that selectively raises `OSError` only for the specific path under test:
```python
target_path = ...  # the tmp_path value for this test
def raise_for_target(path):
    if path == target_path:
        raise OSError("simulated failure")
mocker.patch("os.remove", side_effect=raise_for_target)
```

**Acceptance Criteria:**
1. The `os.remove` mock targets only the specific path being tested
2. The test continues to assert the intended failure behaviour
3. No unrelated `os.remove` calls in the test environment are inadvertently suppressed

---

### L-2 — `raise HTTPException(...) from None` silently discards root-cause exception (LOW) (aia-core-i8r)

**Source Task:** aia-core-i8r
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py — [L76-L77](src/app/routes/images.py#L76-L77)

`raise HTTPException(...) from None` explicitly suppresses the original exception's context. Structured logging middleware and APM tools (Sentry, OpenTelemetry) inspect `__cause__` and `__context__` to capture root-cause detail; suppressing the chain means the DB error, constraint name, and originating stack frame are all discarded at the tracing layer. No logging statement precedes the raise, so commit-failure diagnosis in production requires attaching a debugger. This is the same pattern flagged in F-026 for `create_player`.

**Suggested fix:** Replace `from None` with `from exc` (where `exc` is the caught exception) so the original exception is preserved as the explicit chain. Additionally, consider logging the exception before re-raising:
```python
except Exception as exc:
    # log exc here if a logger is available
    raise HTTPException(status_code=500, detail="Failed to save upload record.") from exc
```

**Acceptance Criteria:**
1. The `HTTPException` raised on commit failure carries the original exception as its `__cause__` (i.e. `from exc` rather than `from None`)
2. No functional change to the HTTP response sent to the client
3. Structured logging or APM tooling can capture the root-cause exception chain

---

## Cycle 4 — aia-core-3gp Findings (2026-03-11)

*Source task: aia-core-3gp*
*Review Date: 2026-03-11*

---

### M-1 — `_has_valid_image_magic` is format-agnostic (MEDIUM) (aia-core-3gp)

**Source Task:** aia-core-3gp
**Review Date:** 2026-03-11
**Severity:** MEDIUM

PNG bytes uploaded with `Content-Type: image/jpeg` pass validation silently. The magic-byte helper inspects only whether the bytes match *any* known image format, without cross-checking against the declared `Content-Type`. A client can therefore store a PNG file under a JPEG content-type (and vice versa) with no rejection.

**Suggested fix:** Thread the declared `content_type` into `_has_valid_image_magic` and enforce that the actual bytes match the declared format — i.e. if `content_type` is `image/jpeg`, only accept JPEG magic bytes; if `image/png`, only accept PNG magic bytes.

**Acceptance Criteria:**
1. PNG bytes submitted with `Content-Type: image/jpeg` are rejected with HTTP 415
2. JPEG bytes submitted with `Content-Type: image/png` are rejected with HTTP 415
3. Correctly paired content-type + magic bytes continue to pass
4. Tests cover each mismatch combination

---

### M-2 — No test for empty file body (MEDIUM) (aia-core-3gp)

**Source Task:** aia-core-3gp
**Review Date:** 2026-03-11
**Severity:** MEDIUM

An empty upload (zero-byte body) correctly returns HTTP 415, but this behaviour is untested. A future refactor of the magic-byte or content-length guard could silently regress the empty-body path without any test catching it.

**Suggested fix:** Add a test that uploads a zero-byte file and asserts a 415 response.

**Acceptance Criteria:**
1. A test uploads an empty file body and asserts HTTP 415
2. The test is grouped with other magic-byte / content-type validation tests

---

### L-1 — Asymmetry between JPEG and PNG magic-byte checks (LOW) (aia-core-3gp)

**Source Task:** aia-core-3gp
**Review Date:** 2026-03-11
**Severity:** LOW

The JPEG check inspects only 3 bytes (`FF D8 FF`), while the PNG check inspects all 8 signature bytes. The JPEG check could be tightened by also verifying that the 4th byte is a known APP marker (e.g. `E0` for JFIF, `E1` for Exif), which would reduce the chance of a non-JPEG file that happens to start with `FF D8 FF` passing validation.

**Suggested fix:** Extend the JPEG check to also validate the 4th byte against a set of known APP markers (`{0xE0, 0xE1, 0xE2, 0xE8, 0xEE, 0xFE}`).

**Acceptance Criteria:**
1. The JPEG magic-byte check includes a 4th-byte APP-marker validation
2. Valid JFIF and Exif JPEG files continue to pass
3. A file with `FF D8 FF` followed by an unknown 4th byte is rejected

---

### L-2 — Test helper comment for `_make_jpeg` undersells the 4th byte (LOW) (aia-core-3gp)

**Source Task:** aia-core-3gp
**Review Date:** 2026-03-11
**Severity:** LOW

The comment on the `_make_jpeg` test helper implies that all 4 bytes (`FF D8 FF E0`) are magic/signature bytes, when in fact only the first 3 are the universal JPEG SOI + marker prefix; `0xE0` is specifically the APP0 marker for JFIF. This is a minor documentation inaccuracy but could mislead future contributors into treating `E0` as a required JPEG magic byte rather than one valid APP marker among several.

**Suggested fix:** Update the comment to clarify that `0xE0` is the APP0 (JFIF) marker, not part of the universal JPEG magic bytes.

**Acceptance Criteria:**
1. The `_make_jpeg` helper comment accurately describes which bytes are universal JPEG magic and which byte is the APP0 marker
2. No functional change

---

## Cycle 5 — aia-core-4qe Findings (2026-03-11)

*Source task: aia-core-4qe (db.flush() try/except fix)*
*Review Date: 2026-03-11*

---

### H-1 — Missing db.rollback() after flush failure (HIGH) (aia-core-4qe)

**Source Task:** aia-core-4qe
**Review Date:** 2026-03-11
**Severity:** HIGH

`src/app/routes/images.py` L66-74: the flush error handler removes `tmp_path` and raises `HTTPException` without calling `db.rollback()`. The session is left in an invalid/error state for the remainder of the request lifecycle. The commit-failure handler at L87-95 does call `db.rollback()` — this path must be made consistent.

**Suggested fix:** Add `db.rollback()` before `raise HTTPException(...)` in the flush error handler (L66-74), mirroring the pattern already used in the commit-failure handler.

**Acceptance Criteria:**
1. `db.rollback()` is called in the flush error handler before the `HTTPException` is raised
2. Behaviour is consistent with the commit-failure error path
3. Existing flush-failure tests are updated to assert `db.rollback()` is called

---

### M-1 — Original DB exception discarded with no logging (MEDIUM) (aia-core-4qe)

**Source Task:** aia-core-4qe
**Review Date:** 2026-03-11
**Severity:** MEDIUM

All three error paths use `raise HTTPException(...) from None`, which discards the original DB exception and produces no log output. DB flush/commit failures are therefore completely invisible in production. Operators have no signal when the database layer is misbehaving.

**Suggested fix:** Log the original exception before raising (e.g. `logger.exception("DB flush failed: %s", exc)`) or replace `from None` with `from exc` to preserve the exception chain. Apply consistently across all three error paths.

**Acceptance Criteria:**
1. Each error path logs the original exception at ERROR level before raising `HTTPException`
2. The original exception is not silently swallowed
3. Tests verify that logging occurs on each error path

---

### L-1 — test_flush_failure_removes_tmp_file does not assert db.rollback() (LOW) (aia-core-4qe)

**Source Task:** aia-core-4qe
**Review Date:** 2026-03-11
**Severity:** LOW

`test_flush_failure_removes_tmp_file` verifies that the temporary file is removed on a flush failure but does not assert that `db.rollback()` is called. This gap allowed H-1 to land undetected — the test passed even though the session was left in a broken state.

**Suggested fix:** Extend the test to assert `mock_db.rollback.assert_called_once()` (or equivalent) after the flush failure is triggered.

**Acceptance Criteria:**
1. `test_flush_failure_removes_tmp_file` asserts `db.rollback()` is called
2. The test fails before H-1 is fixed and passes after

---

## T-040 (aia-core-e7q) — Card Detection Pipeline Integration Findings (2026-03-11)

*Source task: aia-core-e7q (T-040: Implement Card Detection pipeline integration)*
*Review Date: 2026-03-11*

---

### H-1 — Module-level singleton `_detector` prevents dependency injection and testability (HIGH) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [L22](src/app/routes/images.py#L22)

`_detector = MockCardDetector()` is hardcoded at module level. The route imports `MockCardDetector` directly rather than the `CardDetector` protocol. When a real detector is implemented, swapping requires editing production code. Tests cannot inject a controlled detector.

**Suggested fix:** Use FastAPI dependency injection with `Depends(get_card_detector)` and `app.dependency_overrides` for tests.

**Acceptance Criteria:**
1. `_detector` is no longer instantiated at module level
2. Card detector is injected via `Depends(get_card_detector)`
3. Tests override the detector via `app.dependency_overrides`

---

### H-2 — No error handling around `_detector.detect()` call (HIGH) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [L132](src/app/routes/images.py#L132)

If `detect()` raises, the endpoint returns an unhandled 500 with no rollback. Upload status stays in `processing` limbo. Partial `CardDetection` rows could be inconsistent.

**Suggested fix:** Wrap detection + insert in `try/except`. On failure, rollback and set `upload.status = 'failed'`.

**Acceptance Criteria:**
1. A `detect()` exception is caught and does not produce an unhandled 500
2. On detection failure, `upload.status` is set to `'failed'` and the transaction is rolled back
3. Partial `CardDetection` rows are not left in the database
4. A test covers the detection-failure path

---

### H-3 — Race condition on concurrent GET requests for the same upload (HIGH) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — [L130-L142](src/app/routes/images.py#L130-L142)

Two simultaneous GET requests for a `processing` upload will both detect and insert 14 rows instead of 7.

**Suggested fix:** Add a unique constraint on `(upload_id, card_position)` and/or use `SELECT FOR UPDATE`.

**Acceptance Criteria:**
1. Concurrent GET requests for the same `processing` upload do not produce duplicate `CardDetection` rows
2. A unique constraint on `(upload_id, card_position)` exists at the DB level
3. The endpoint handles the constraint violation gracefully (no unhandled 500)

---

### M-1 — `safe_name` variable — `file.filename` could be `None`, causing `TypeError` in `os.path.basename(None)` (MEDIUM) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py

Inherited from T-039. `file.filename` can be `None` for multipart uploads that omit the `filename` parameter. `os.path.basename(None)` raises `TypeError` → HTTP 500.

---

### M-2 — `CardDetection` model lacks unique constraint on `(upload_id, card_position)` (MEDIUM) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/ (CardDetection model and migration)

DB-level aspect of H-3. Without a unique constraint on `(upload_id, card_position)`, duplicate detection rows can be inserted by concurrent requests or buggy detection logic with no DB-level safeguard.

---

### M-3 — Migration creates both `image_uploads` and `card_detections` in one file but title only mentions `card_detections` (MEDIUM) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** alembic/versions/ (card_detections migration)

The migration file title references only `card_detections` but the migration body creates or modifies both `image_uploads` and `card_detections` tables. Misleading title makes it harder to trace schema changes to specific migrations.

---

### M-4 — `detect()` return type is `list[dict]` — untyped dicts (MEDIUM) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/services/ (CardDetector protocol / MockCardDetector)

`detect()` returns `list[dict]` with no type enforcement on dict keys or values. Should use `TypedDict` or a dataclass for contract enforcement so that callers get static type checking on detection results.

---

### L-1 — `@runtime_checkable` on `CardDetector` protocol is unused (LOW) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** LOW

The `@runtime_checkable` decorator on the `CardDetector` protocol is present but no code uses `isinstance()` checks against it. Dead decorator that adds no value.

---

### L-2 — `MockCardDetector` confidence range hardcoded to 0.75–0.99 (LOW) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** LOW

The mock always returns confidence values between 0.75 and 0.99. Tests cannot exercise low-confidence thresholding or edge cases near a confidence cutoff without a way to control the range.

---

### L-3 — Tests don't verify `detection_id` is populated as positive integer (LOW) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** LOW

No test asserts that `detection_id` in the response is a positive integer. A bug returning `null` or `0` for the primary key would go undetected.

---

### L-4 — `file.filename` null-check inherited from T-039 (LOW) (aia-core-e7q / T-040)

**Source Task:** aia-core-e7q (T-040: Implement Card Detection pipeline integration)
**Review Date:** 2026-03-11
**Severity:** LOW

Same root cause as M-1 (inherited from T-039). Tracked separately as a low-severity reminder that the upstream fix in T-039 resolves this for the T-040 code path as well.

---

## T-041 (aia-core-xmu) — Confirm Detection Endpoint Code Review Findings (2026-03-11)

*Source task: aia-core-xmu (T-041: Implement Confirm Detection endpoint)*
*Review Date: 2026-03-11*

---

### H-1 — Duplicate player in `player_hands` causes unhandled 500 (HIGH) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** HIGH
**File:** src/app/routes/images.py — confirm endpoint (around L280-293)

If the same `player_name` appears twice in `player_hands`, the second flush violates the `uq_player_hand` constraint → `IntegrityError` → unhandled 500. The same pattern exists in the `record_hand` endpoint (inherited, not newly introduced).

**Suggested fix:** Validate uniqueness of `player_name` values before insertion, or catch `IntegrityError` and return 400.

**Acceptance Criteria:**
1. A request with duplicate `player_name` values in `player_hands` returns HTTP 400 (not 500)
2. The 400 response body identifies the duplicate player name
3. No `PlayerHand` rows are written on rejection
4. A test covers the duplicate `player_name` path

---

### M-1 — Race condition on `hand_number` auto-increment (MEDIUM) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/routes/images.py — confirm endpoint

Concurrent confirms could produce the same `hand_number` → `IntegrityError` → 500. Pre-existing pattern inherited from `record_hand`.

---

### M-2 — No `UniqueConstraint` on `source_upload_id` column in Hand model (MEDIUM) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** src/app/database/models.py — `Hand` model

The status guard prevents double-confirm at the application level, but there is no DB-level defense. A race condition or future code path bypassing the status check could insert two `Hand` rows from the same upload with no constraint violation.

**Suggested fix:** Add `UniqueConstraint('source_upload_id', name='uq_hand_source_upload')` to the `Hand` model and generate a corresponding Alembic migration.

**Acceptance Criteria:**
1. The `Hand` model includes a unique constraint on `source_upload_id`
2. An Alembic migration applies the constraint
3. Attempting to insert a second `Hand` with the same `source_upload_id` raises `IntegrityError`

---

### M-3 — Missing test for duplicate `player_name` in request body (MEDIUM) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** MEDIUM
**File:** test/test_confirm_detection_api.py

The bug tracked in H-1 has zero test coverage. No existing test calls the confirm endpoint with a `player_hands` list containing repeated `player_name` entries.

**Suggested follow-up:** Add a test `test_confirm_detection_duplicate_player_name_returns_400` that submits `player_hands` with the same player name twice and asserts HTTP 400.

**Acceptance Criteria:**
1. A test exists that submits duplicate `player_name` values in `player_hands`
2. The test asserts HTTP 400 is returned
3. The test verifies no `Hand` or `PlayerHand` rows are written

---

### L-1 — No explicit rollback on validation failure mid-loop (LOW) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py — confirm endpoint

If a validation failure (e.g. player not found) raises `HTTPException` mid-loop after some `PlayerHand` rows have been flushed, the handler relies on implicit session close to roll back the partial transaction rather than an explicit `db.rollback()` call.

---

### L-2 — No test for single-player confirm (LOW) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** test/test_confirm_detection_api.py

No test exercises the confirm endpoint with exactly one player in `player_hands`. The minimum-player path is unverified, leaving edge cases around single-entry list handling untested.

**Suggested follow-up:** Add a test `test_confirm_detection_single_player` that submits a confirm request with one player and asserts HTTP 201 with correct response data.

---

### L-3 — Upload status `'confirmed'` not explicitly handled in GET detection endpoint (LOW) (aia-core-xmu / T-041)

**Source Task:** aia-core-xmu (T-041: Implement Confirm Detection endpoint)
**Review Date:** 2026-03-11
**Severity:** LOW
**File:** src/app/routes/images.py — GET detection endpoint

After a successful confirm, the upload status transitions to `'confirmed'`. The GET detection endpoint does not explicitly check for or document behaviour when `status == 'confirmed'`. The endpoint works correctly (returns the existing detections), but the intent is unclear — it is not documented whether a confirmed upload should still serve detection results or return a different response (e.g. a redirect to the created hand).
