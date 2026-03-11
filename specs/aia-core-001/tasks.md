# Tasks — All In Analytics Core Backend

**Project ID:** aia-core-001
**Date:** 2026-03-09
**Total Tasks:** 50
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
