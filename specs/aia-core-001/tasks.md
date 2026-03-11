# Tasks — All In Analytics Core Backend

**Project ID:** aia-core-001
**Date:** 2026-03-09
**Total Tasks:** 65
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
