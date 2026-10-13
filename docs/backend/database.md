# Backend Database Layer

| Field | Value |
|---|---|
| **Title** | All In Analytics — Database Layer Documentation |
| **Date** | 2026-04-14 |
| **Author** | Kurt (Nightcrawler) |
| **Scope** | `src/app/database/`, `alembic/`, SQLAlchemy models, session management, query helpers |
| **Status** | Current |

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Connection & Session Management](#connection--session-management)
4. [Entity-Relationship Diagram](#entity-relationship-diagram)
5. [Model Reference](#model-reference)
6. [Query Helpers](#query-helpers)
7. [Migrations (Alembic)](#migrations-alembic)
8. [Testing Strategy](#testing-strategy)

---

## Overview

The database layer uses **SQLAlchemy 2.x** with a declarative ORM and **Alembic** for migrations. In production, data is stored in a local SQLite file (`sqlite:///./poker.db`). Tests use an in-memory SQLite database with `StaticPool` to achieve per-test isolation without filesystem side effects.

All schema changes are managed through Alembic migrations — `Base.metadata.create_all()` is never called outside of tests.

---

## Directory Structure

```
src/app/database/
├── models.py     # All SQLAlchemy ORM models (declarative base)
├── session.py    # Engine creation, SessionLocal factory, get_db dependency
└── queries.py    # Reusable get-or-404 query helpers
```

---

## Connection & Session Management

Defined in [src/app/database/session.py](../../src/app/database/session.py).

| Component | Purpose |
|---|---|
| `DATABASE_URL` | Read from `DATABASE_URL` env var; defaults to `sqlite:///./poker.db` |
| `engine` | Created with `check_same_thread=False` for SQLite compatibility |
| `SessionLocal` | `sessionmaker` bound to the engine, `autocommit=False`, `autoflush=False` |
| `get_db()` | FastAPI dependency that yields a session and closes it in `finally` |

The `get_db()` generator is injected into every route via `Depends(get_db)`, ensuring each request gets its own session with automatic cleanup.

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    Player ||--o{ GamePlayer : "joins"
    GameSession ||--o{ GamePlayer : "has"
    GameSession ||--o{ Hand : "contains"
    GameSession ||--o{ Rebuy : "tracks"
    Hand ||--o{ PlayerHand : "includes"
    Hand ||--o| HandState : "has state"
    Hand }o--o| ImageUpload : "sourced from"
    PlayerHand ||--o{ PlayerHandAction : "records"
    Player ||--o{ PlayerHand : "plays"
    Player ||--o{ Rebuy : "makes"
    ImageUpload ||--o{ CardDetection : "produces"
    ImageUpload ||--o{ DetectionCorrection : "corrected by"

    Player {
        int player_id PK
        string name UK
        datetime created_at
    }

    GameSession {
        int game_id PK
        date game_date
        string status
        string winners
        float small_blind
        float big_blind
        int blind_timer_minutes
        bool blind_timer_paused
        datetime blind_timer_started_at
        int blind_timer_remaining_seconds
        float default_buy_in
        datetime created_at
    }

    GamePlayer {
        int game_id PK_FK
        int player_id PK_FK
        bool is_active
        int seat_number
        float buy_in
        float current_chips
    }

    Hand {
        int hand_id PK
        int game_id FK
        int hand_number
        string flop_1
        string flop_2
        string flop_3
        string turn
        string river
        int sb_player_id FK
        int bb_player_id FK
        int source_upload_id FK
        float pot
        string side_pots
        datetime created_at
    }

    PlayerHand {
        int player_hand_id PK
        int hand_id FK
        int player_id FK
        string card_1
        string card_2
        string result
        float profit_loss
        string outcome_street
        bool is_all_in
        datetime created_at
    }

    PlayerHandAction {
        int action_id PK
        int player_hand_id FK
        string street
        string action
        float amount
        datetime created_at
    }

    HandState {
        int hand_state_id PK
        int hand_id FK_UK
        string phase
        int current_seat
        int action_index
        datetime updated_at
    }

    ImageUpload {
        int upload_id PK
        int game_id FK
        string file_path
        string status
        datetime created_at
    }

    CardDetection {
        int detection_id PK
        int upload_id FK
        string card_position
        string detected_value
        float confidence
        float bbox_x
        float bbox_y
        float bbox_width
        float bbox_height
        datetime created_at
    }

    DetectionCorrection {
        int correction_id PK
        int upload_id FK
        string card_position
        string detected_value
        string corrected_value
        datetime created_at
    }

    Rebuy {
        int rebuy_id PK
        int game_id FK
        int player_id FK
        float amount
        datetime created_at
    }
```

---

## Model Reference

All models are defined in [src/app/database/models.py](../../src/app/database/models.py) and inherit from a shared `declarative_base()`.

### Player

Represents a registered poker player. Name is globally unique (case-insensitive uniqueness enforced at the application layer).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `player_id` | Integer | PK, autoincrement | |
| `name` | String | UNIQUE, NOT NULL | |
| `created_at` | DateTime | default=utcnow | |

**Relationships:** `games` (M2M via `GamePlayer`), `hands_played` (1:N `PlayerHand`)

### GameSession

A single poker game night. Tracks blind levels, timer state, and game lifecycle.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `game_id` | Integer | PK, autoincrement | |
| `game_date` | Date | NOT NULL | |
| `status` | String | NOT NULL, default `'active'` | `'active'` or `'completed'` |
| `winners` | String | nullable | JSON array of winner names |
| `small_blind` | Float | NOT NULL, default `0.10` | |
| `big_blind` | Float | NOT NULL, default `0.20` | |
| `blind_timer_minutes` | Integer | NOT NULL, default `15` | |
| `blind_timer_paused` | Boolean | NOT NULL, default `False` | |
| `blind_timer_started_at` | DateTime | nullable | |
| `blind_timer_remaining_seconds` | Integer | nullable | Stored when timer is paused |
| `default_buy_in` | Float | nullable | |
| `created_at` | DateTime | default=utcnow | |

**Relationships:** `players` (M2M via `GamePlayer`), `hands` (1:N, cascade delete)

### GamePlayer

Association table linking players to game sessions with per-game metadata.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `game_id` | Integer | PK, FK → `game_sessions` | |
| `player_id` | Integer | PK, FK → `players` | |
| `is_active` | Boolean | NOT NULL, default `True` | Can be toggled mid-game |
| `seat_number` | Integer | nullable | 1-based seat assignment |
| `buy_in` | Float | nullable | Per-player buy-in amount |
| `current_chips` | Float | nullable | Live chip stack tracking |

### Hand

A single dealt hand within a game session.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `hand_id` | Integer | PK, autoincrement | |
| `game_id` | Integer | FK → `game_sessions`, NOT NULL | |
| `hand_number` | Integer | NOT NULL | Unique within game (`uq_hand_game_number`) |
| `flop_1`–`flop_3` | String | nullable | Community cards |
| `turn` | String | nullable | |
| `river` | String | nullable | |
| `sb_player_id` | Integer | FK → `players`, nullable | Small blind player |
| `bb_player_id` | Integer | FK → `players`, nullable | Big blind player |
| `source_upload_id` | Integer | FK → `image_uploads`, nullable | Links to OCR source |
| `pot` | Float | NOT NULL, default `0` | Current pot total |
| `side_pots` | String | NOT NULL, default `'[]'` | JSON array of side pot dicts |
| `created_at` | DateTime | default=utcnow | |

**Relationships:** `game_session`, `player_hands` (cascade delete), `state` (1:1 `HandState`, cascade delete)

### PlayerHand

A player's participation in a specific hand — hole cards, result, and P/L.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `player_hand_id` | Integer | PK, autoincrement | |
| `hand_id` | Integer | FK → `hands`, NOT NULL | Unique with `player_id` |
| `player_id` | Integer | FK → `players`, NOT NULL | |
| `card_1`, `card_2` | String | nullable | Hole cards (e.g. `'AS'`, `'10H'`) |
| `result` | String | nullable | `won`, `lost`, `folded`, `handed_back` |
| `profit_loss` | Float | nullable | |
| `outcome_street` | String | nullable | Street where result was determined |
| `is_all_in` | Boolean | NOT NULL, default `False` | |
| `created_at` | DateTime | default=utcnow | |

**Relationships:** `hand`, `player`, `actions` (cascade delete)

### PlayerHandAction

Individual betting actions within a hand (fold, check, call, bet, raise, blind).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `action_id` | Integer | PK, autoincrement | |
| `player_hand_id` | Integer | FK → `player_hands`, NOT NULL | |
| `street` | String | NOT NULL | `preflop`, `flop`, `turn`, `river` |
| `action` | String | NOT NULL | `fold`, `check`, `call`, `bet`, `raise`, `blind` |
| `amount` | Float | nullable | Dollar amount for monetary actions |
| `created_at` | DateTime | default=utcnow | Server-side default for SQLite |

### HandState

Turn-state tracking for live betting flow. One-to-one with `Hand`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `hand_state_id` | Integer | PK, autoincrement | |
| `hand_id` | Integer | FK → `hands`, UNIQUE, NOT NULL | |
| `phase` | String | NOT NULL, default `'preflop'` | `awaiting_cards`, `preflop`, `flop`, `turn`, `river`, `showdown` |
| `current_seat` | Integer | nullable | Seat number of player to act |
| `action_index` | Integer | default `0` | Monotonic action counter |
| `updated_at` | DateTime | default=utcnow, onupdate=utcnow | Used for ETag generation |

### ImageUpload

Tracks image files uploaded for OCR card detection.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `upload_id` | Integer | PK, autoincrement | |
| `game_id` | Integer | FK → `game_sessions`, NOT NULL | |
| `file_path` | String | NOT NULL | Absolute path to stored image |
| `status` | String | NOT NULL, default `'processing'` | `processing`, `detected`, `failed` |
| `created_at` | DateTime | default=utcnow | |

**Relationships:** `detections` (1:N `CardDetection`)

### CardDetection

Individual card detections from a YOLO inference run.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `detection_id` | Integer | PK, autoincrement | |
| `upload_id` | Integer | FK → `image_uploads`, NOT NULL | Unique with `card_position` |
| `card_position` | String | NOT NULL | e.g. `community_1`, `hole_1`, `card_3` |
| `detected_value` | String | NOT NULL | e.g. `AS`, `10H` |
| `confidence` | Float | NOT NULL | YOLO confidence score |
| `bbox_x`, `bbox_y` | Float | nullable | Bounding box top-left |
| `bbox_width`, `bbox_height` | Float | nullable | Bounding box dimensions |
| `created_at` | DateTime | default=utcnow | |

### DetectionCorrection

User corrections to YOLO detection results, used for active learning.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `correction_id` | Integer | PK, autoincrement | |
| `upload_id` | Integer | FK → `image_uploads`, NOT NULL | |
| `card_position` | String | NOT NULL | |
| `detected_value` | String | NOT NULL | Original YOLO output |
| `corrected_value` | String | NOT NULL | Human-corrected value |
| `created_at` | DateTime | default=utcnow | |

### Rebuy

Tracks additional buy-ins during a game session.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `rebuy_id` | Integer | PK, autoincrement | |
| `game_id` | Integer | FK → `game_sessions`, NOT NULL | |
| `player_id` | Integer | FK → `players`, NOT NULL | |
| `amount` | Float | NOT NULL | |
| `created_at` | DateTime | default=utcnow | |

---

## Query Helpers

Defined in [src/app/database/queries.py](../../src/app/database/queries.py). These are reusable lookup functions that raise `HTTPException(404)` when a record is not found, keeping route code clean.

| Function | Lookup Key | Notes |
|---|---|---|
| `get_game_or_404(db, game_id)` | `GameSession.game_id` | |
| `get_hand_or_404(db, game_id, hand_number)` | `Hand.game_id` + `Hand.hand_number` | |
| `get_player_by_name_or_404(db, player_name)` | `Player.name` (case-insensitive) | Uses `func.lower()` |
| `get_player_hand_or_404(db, hand_id, player_id, player_name)` | `PlayerHand.hand_id` + `PlayerHand.player_id` | `player_name` used in error message |

---

## Migrations (Alembic)

Alembic configuration lives in [alembic.ini](../../alembic.ini) and [alembic/env.py](../../alembic/env.py). Migrations are stored in `alembic/versions/`.

**Common commands:**

```bash
# Generate a new migration from model changes
alembic revision --autogenerate -m "description of change"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

The Alembic env imports `Base.metadata` from `app.database.models` for autogeneration. The target database URL comes from the same `DATABASE_URL` environment variable used by the application.

---

## Testing Strategy

Tests use an in-memory SQLite database configured in [test/conftest.py](../../test/conftest.py):

- **Engine:** `sqlite:///:memory:` with `StaticPool` (single connection shared across threads)
- **Schema:** Created via `Base.metadata.create_all(engine)` — acceptable in tests only
- **Session override:** `app.dependency_overrides[get_db]` points to the test session
- **Isolation:** Each test function gets a fresh database (fixture scoped per-function)

Relevant test files:
- `test_app_models.py` — ORM model sanity checks
- `test_alembic_setup.py` — Verifies Alembic configuration
- `test_cascade_deletes.py` — Validates ORM cascade behavior
- `test_buy_in_column.py`, `test_blind_fields.py` — Column-level tests
