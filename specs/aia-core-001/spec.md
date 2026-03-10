# Spec — All In Analytics Core Backend

**Project ID:** aia-core-001
**Date:** 2026-03-09
**Status:** Draft
**Scope:** Pilot (MVP text-only) through V1 (image ingestion) — backend only

---

## Table of Contents

1. [Epic 1: Data Model Redesign](#epic-1-data-model-redesign)
2. [Epic 2: Game Session Management](#epic-2-game-session-management)
3. [Epic 3: Hand Management](#epic-3-hand-management)
4. [Epic 4: CSV Ingestion](#epic-4-csv-ingestion)
5. [Epic 5: Hand & Data Editing](#epic-5-hand--data-editing)
6. [Epic 6: Player Statistics](#epic-6-player-statistics)
7. [Epic 7: Historical Querying & Browsing](#epic-7-historical-querying--browsing)
8. [Epic 8: Image Ingestion (V1)](#epic-8-image-ingestion-v1)

---

## Epic 1: Data Model Redesign

Overhaul the existing database schema to support per-player hole cards, proper relational structure, and the data required for full statistics. The current flat `Game`/`Community` models are replaced with a normalized relational design.

### S-1.1 — Player Registry

**As a** user, **I want** each player to exist as a distinct entity in the system, **so that** stats, hands, and game participation can be tracked per player over time.

**Acceptance Criteria:**
1. A `Player` table exists with at minimum: `player_id` (PK), `name` (unique), `created_at`
2. Player names are case-insensitive unique (no duplicate "Adam" / "adam")
3. Players can be created independently of a game session

### S-1.2 — Game Session Entity

**As a** user, **I want** each poker session to be a first-class entity with metadata, **so that** I can identify and query specific game nights.

**Acceptance Criteria:**
1. A `GameSession` table exists with: `game_id` (PK), `game_date`, `created_at`, `status` (active/completed)
2. A game session links to its participants via a many-to-many relationship
3. `game_date` is stored as a proper date type, not a string

### S-1.3 — Hand Entity with Community Cards

**As a** user, **I want** each hand within a game to be tracked with its community board cards and metadata, **so that** I can review the full board for any historical hand.

**Acceptance Criteria:**
1. A `Hand` table exists with: `hand_id` (PK), `game_id` (FK), `hand_number`, `flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `created_at`
2. Each hand belongs to exactly one game session
3. Community cards are stored as individual card values (rank + suit)
4. Turn and river are nullable (hand may end before those streets)

### S-1.4 — Player Hand (Hole Cards) Entity

**As a** user, **I want** each player's hole cards to be recorded per hand, **so that** I can see what everyone was dealt after the hand is over.

**Acceptance Criteria:**
1. A `PlayerHand` table exists with: `player_hand_id` (PK), `hand_id` (FK), `player_id` (FK), `card_1`, `card_2`, `result` (win/loss/fold), `profit_loss` (numeric)
2. Each player-hand belongs to exactly one hand and one player
3. A player cannot have more than one entry per hand
4. `result` and `profit_loss` are nullable (can be filled in after the hand)

### S-1.5 — Card Validation

**As a** user, **I want** all card values to be validated against a standard 52-card deck, **so that** invalid or duplicate cards within a single hand are rejected.

**Acceptance Criteria:**
1. Card values are validated as a valid rank (A,2–10,J,Q,K) + suit (S,H,D,C) combination
2. No duplicate cards exist within a single hand (community + all player hole cards combined)
3. Invalid card values return a clear error message

---

## Epic 2: Game Session Management

CRUD operations for creating, reading, updating, and completing game sessions.

### S-2.1 — Create a Game Session

**As a** user, **I want** to create a new game session with a date and player list, **so that** I can start recording hands for a poker night.

**Acceptance Criteria:**
1. `POST /games` accepts a date and list of player names
2. If any player name doesn't exist yet, the player is auto-created
3. Returns the created game session with ID, date, and player list
4. Duplicate game sessions on the same date are allowed (multiple sessions per day)

### S-2.2 — Get a Game Session

**As a** user, **I want** to retrieve a game session by ID, **so that** I can see its metadata and participants.

**Acceptance Criteria:**
1. `GET /games/{game_id}` returns the game session with its players and hand count
2. Returns 404 if the game ID doesn't exist

### S-2.3 — List Game Sessions

**As a** user, **I want** to list game sessions with optional date filters, **so that** I can find past game nights.

**Acceptance Criteria:**
1. `GET /games` returns all game sessions ordered by date descending
2. Optional query params `date_from` and `date_to` filter by date range
3. Response includes game ID, date, player count, hand count, and status

### S-2.4 — Complete a Game Session

**As a** user, **I want** to mark a game session as completed, **so that** it is distinguished from active/in-progress games.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/complete` sets the game status to "completed"
2. Returns 404 if game doesn't exist
3. Returns 400 if the game is already completed

---

## Epic 3: Hand Management

Record and manage individual hands within a game session, including community cards and player hole cards.

### S-3.1 — Record a New Hand

**As a** user, **I want** to record a new hand with community cards and player hole cards, **so that** the hand is persisted for historical review.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands` accepts community cards (flop required; turn and river optional) and a list of player entries (each with hole cards, result, and profit/loss)
2. Hand number is auto-incremented within the game session
3. Card validation rejects duplicate cards within the hand
4. Returns the created hand with all details

### S-3.2 — Get a Single Hand

**As a** user, **I want** to retrieve a specific hand by game and hand number, **so that** I can review the full board and all player cards.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/{hand_number}` returns community cards and all player hole cards with results
2. Returns 404 if game or hand doesn't exist

### S-3.3 — List Hands in a Game

**As a** user, **I want** to list all hands for a game session, **so that** I can browse the full history of a poker night.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands` returns all hands in the session ordered by hand number
2. Each hand includes community cards and a summary (player count, street reached)

### S-3.4 — Record Hand Result

**As a** user, **I want** to set or update the result (win/loss/fold) and profit/loss for each player in a hand, **so that** outcomes can be tracked after the fact.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/hands/{hand_number}/results` accepts a list of player results (player name, result, profit/loss)
2. Only updates the specified players — leave others unchanged
3. Returns 404 if game, hand, or player not found in that hand

---

## Epic 4: CSV Ingestion

Bulk upload of game data from CSV files with a defined schema.

### S-4.1 — Define CSV Schema

**As a** user, **I want** a documented CSV schema for bulk uploading hands, **so that** I can prepare data outside the app and import it.

**Acceptance Criteria:**
1. CSV schema is defined with columns: `game_date`, `hand_number`, `player_name`, `hole_card_1`, `hole_card_2`, `flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `result`, `profit_loss`
2. Community card columns are repeated per row (same for all players in a hand) — or are optional after the first player row per hand
3. Schema is documented in the API response or a dedicated endpoint

### S-4.2 — Upload and Validate CSV

**As a** user, **I want** to upload a CSV file that gets validated before ingestion, **so that** bad data doesn't corrupt the database.

**Acceptance Criteria:**
1. `POST /upload/csv` accepts a CSV file upload
2. Validates column headers match the expected schema
3. Validates all card values are valid
4. Validates no duplicate cards within a single hand
5. Returns a validation report listing any errors with row numbers before committing

### S-4.3 — Commit CSV Data

**As a** user, **I want** validated CSV data to be committed to the database as game sessions, hands, and player hands, **so that** bulk historical data is persisted.

**Acceptance Criteria:**
1. After successful validation, all rows are committed in a single transaction
2. Game sessions are auto-created (grouped by `game_date`)
3. Players are auto-created if they don't already exist
4. Hands and player hands are created with full card and result data
5. Returns a summary: games created, hands created, players created/matched

---

## Epic 5: Hand & Data Editing

Allow users to correct mis-entered data at the card and player level.

### S-5.1 — Edit Community Cards

**As a** user, **I want** to edit the community cards of an existing hand, **so that** I can fix a mis-entered board.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/hands/{hand_number}` accepts updated community card values
2. Card validation runs on the updated hand (no duplicates with existing player hole cards)
3. Returns the updated hand

### S-5.2 — Edit Player Hole Cards

**As a** user, **I want** to edit a player's hole cards in an existing hand, **so that** I can fix mis-entered player cards.

**Acceptance Criteria:**
1. `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}` accepts updated hole cards
2. Card validation runs on the full hand after the edit
3. Returns the updated player hand

### S-5.3 — Add or Remove Player from a Hand

**As a** user, **I want** to add a previously missing player to a hand or remove one entered by mistake, **so that** the participant list is accurate.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/{hand_number}/players` adds a player entry with hole cards
2. `DELETE /games/{game_id}/hands/{hand_number}/players/{player_name}` removes a player entry
3. Card validation runs after additions
4. Returns 404 if the player or hand doesn't exist for deletions

---

## Epic 6: Player Statistics

Expose computed statistics and aggregates derived from historical hand data.

### S-6.1 — Player Win Rate

**As a** user, **I want** to see each player's overall win rate, **so that** I can compare players' performance over time.

**Acceptance Criteria:**
1. `GET /stats/players/{player_name}` includes `win_rate` (wins / total hands played) as a percentage
2. Win rate is computed from all hands where the player has hole cards and a recorded result
3. Hands without a recorded result are excluded from the calculation

### S-6.2 — Player Profit/Loss Summary

**As a** user, **I want** to see each player's cumulative and per-session profit/loss, **so that** I can track who's up or down over time.

**Acceptance Criteria:**
1. Stats endpoint includes `total_profit_loss`, `avg_profit_loss_per_session`, and `avg_profit_loss_per_hand`
2. Per-session breakdown is available via `GET /stats/players/{player_name}/sessions`
3. Values are rounded to 2 decimal places

### S-6.3 — Hand Frequency Stats

**As a** user, **I want** to see how often each player plays different hand types and reaches different streets, **so that** I can understand playing tendencies.

**Acceptance Criteria:**
1. Stats endpoint includes `total_hands_played`, `hands_won`, `hands_lost`, `hands_folded`
2. Includes street-reached distribution: percentage of hands seen at flop, turn, river
3. All values computed from hands where the player has a recorded result

### S-6.4 — Leaderboard

**As a** user, **I want** a leaderboard ranking all players by key metrics, **so that** I can see standings at a glance.

**Acceptance Criteria:**
1. `GET /stats/leaderboard` returns all players ranked by total profit/loss (descending)
2. Each entry includes: rank, player name, total profit/loss, win rate, hands played
3. Optional query param `metric` allows sorting by `win_rate` or `hands_played` instead

### S-6.5 — Per-Session Stats

**As a** user, **I want** stats aggregated per game session, **so that** I can see how a specific poker night went.

**Acceptance Criteria:**
1. `GET /stats/games/{game_id}` returns: total hands, player summaries with per-player win rate and profit/loss for that session
2. Returns 404 if the game doesn't exist

---

## Epic 7: Historical Querying & Browsing

Advanced querying and filtering for historical game and hand data.

### S-7.1 — Search Hands by Player

**As a** user, **I want** to find all hands a specific player participated in, **so that** I can review their history.

**Acceptance Criteria:**
1. `GET /hands?player={player_name}` returns all hands where the player had hole cards
2. Results include game date, hand number, community cards, player's hole cards, and result
3. Results are paginated (default 50 per page)

### S-7.2 — Search Hands by Date Range

**As a** user, **I want** to filter hands by date range, **so that** I can focus on a specific time period.

**Acceptance Criteria:**
1. `GET /hands?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` filters hands within the range
2. Combinable with player filter
3. Results are paginated

### S-7.3 — Search Hands by Card

**As a** user, **I want** to find hands where a specific card appeared (in the community or a player's hand), **so that** I can explore specific scenarios.

**Acceptance Criteria:**
1. `GET /hands?card={rank}{suit}` returns hands where the card appeared anywhere
2. Optional param `location=community|hole` narrows the search
3. Results include full hand details

---

## Epic 8: Image Ingestion (V1)

Backend endpoints and processing pipeline for image-based card capture from the web app.

### S-8.1 — Image Upload Endpoint

**As a** user, **I want** to upload a photo of the poker table from my phone, **so that** cards can be detected automatically.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/image` accepts an image file (JPEG/PNG)
2. Validates file type and size (max 10MB)
3. Stores the image and returns an upload ID with status "processing"

### S-8.2 — Card Detection Pipeline Integration

**As a** user, **I want** uploaded images to be processed by a card detection model, **so that** community and hole cards are extracted automatically.

**Acceptance Criteria:**
1. After upload, a detection pipeline extracts card values from the image
2. Detection results are stored with confidence scores per card
3. Results are retrievable via `GET /games/{game_id}/hands/image/{upload_id}`
4. Each detected card includes: value, confidence score, bounding box coordinates

### S-8.3 — Review and Confirm Detected Cards

**As a** user, **I want** to review detected cards and confirm or correct them before they become a hand record, **so that** detection errors don't corrupt data.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/image/{upload_id}/confirm` accepts the final card values (detected or user-corrected)
2. Creates a proper Hand + PlayerHand record from the confirmed data
3. Links the hand record to the source image for audit trail
4. Card validation runs on the confirmed data

### S-8.4 — Detection Accuracy Feedback Loop

**As a** user, **I want** my manual corrections to be stored alongside original detections, **so that** the model can improve over time.

**Acceptance Criteria:**
1. When a user corrects a detected card, both the original detection and the correction are stored
2. `GET /images/corrections` returns all correction pairs for model retraining
3. Corrections include: upload ID, card position, detected value, corrected value
