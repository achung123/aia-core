# `src/app/database` — Documentation

**Generated:** 2026-03-11 (updated 2026-03-21 — `ImageUpload` + `CardDetection` enrichment)
**Artifacts:** 10 ORM model classes · 2 utility modules · 12 public symbols

---

## Module Overview

This directory is the **persistence layer** of AIA Core. It contains:

- **`models.py`** — the canonical SQLAlchemy ORM for all active tables: players, game sessions, hands, player hands, image uploads, card detections, and detection corrections.
- **`database_models.py`** — a legacy ORM module containing the `Community` and `Game` tables from the original prototype. These tables are **not used by current route handlers** but still exist in the schema (see Open Questions).
- **`session.py`** — the shared database engine, `SessionLocal` factory, and the `get_db()` FastAPI dependency injected into every route handler.
- **`database_queries.py`** — legacy query helpers that operate on the legacy `Community` and `Game` tables.

**Architecture position:** Routes (`src/app/routes/`) receive a `Session` via `get_db()`, call query functions or operate on ORM models directly, and marshal results through Pydantic schemas in `src/pydantic_models/`. No business logic lives in this directory — it is purely data access.

**Database:** SQLite by default (`poker.db`); switchable via the `DATABASE_URL` environment variable. SQLAlchemy 2.x ORM, Alembic for migrations.

---

## Discovery Manifest

| File | Classification | Template Used | Artifacts Found |
|---|---|---|---|
| `models.py` | ORM Data Model | `remy.data-model.template.md` | 8 classes |
| `database_models.py` | ORM Data Model | `remy.data-model.template.md` | 2 classes (legacy) |
| `session.py` | Utility Reference | `remy.concept-explainer.template.md` | `engine`, `SessionLocal`, `get_db()` |
| `database_queries.py` | Utility Reference | `remy.concept-explainer.template.md` | 2 query functions (legacy) |
| `__pycache__/` | Skipped | — | — |

---

## `session.py` — Engine, Session Factory & FastAPI Dependency

**Source:** [`src/app/database/session.py`](session.py)

### Purpose

Provides the single shared SQLAlchemy `engine` and `SessionLocal` factory used throughout the application. Exposes `get_db()` as a FastAPI dependency that yields a database session and guarantees it is closed after each request.

### Configuration

| Symbol | Type | Description |
|---|---|---|
| `DATABASE_URL` | `str` | Read from the `DATABASE_URL` environment variable; defaults to `"sqlite:///./poker.db"` |
| `engine` | `Engine` | SQLAlchemy engine bound to `DATABASE_URL`. For SQLite, `check_same_thread=False` is set to allow FastAPI's thread pool to reuse the connection. |
| `SessionLocal` | `sessionmaker` | Session factory. `autocommit=False`, `autoflush=False`. Callers must call `db.commit()` explicitly. |

### `get_db()`

```python
def get_db() -> Generator[Session, None, None]
```

FastAPI dependency. Yields a `Session` from `SessionLocal`, then closes it in the `finally` block regardless of whether the request succeeded or raised.

**Usage in a route:**
```python
from app.database.session import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

@router.get("/example")
def example(db: Session = Depends(get_db)):
    ...
```

---

## `models.py` — Active ORM Models

**Source:** [`src/app/database/models.py`](models.py)

All active tables use a shared `Base = declarative_base()` defined in this file. Alembic migrations reference this `Base` via `env.py`.

---

### `Player`

**Table:** `players`
**Source:** [`models.py:18`](models.py#L18)

Represents a named poker player. Players participate in game sessions and appear in individual hands.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `player_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `name` | `String` | `unique`, `not null` | Player's display name. Case-sensitive unique constraint — `"Adam"` and `"adam"` are distinct rows. |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `games` | `GameSession` | `game_players` (many-to-many) | All game sessions this player has participated in |
| `hands_played` | `PlayerHand` | direct FK | All individual hand records for this player |

#### Example

```json
{
  "player_id": 1,
  "name": "Alice",
  "created_at": "2026-01-15T19:00:00Z"
}
```

---

### `GameSession`

**Table:** `game_sessions`
**Source:** [`models.py:30`](models.py#L30)

A single poker session — one night of play among a fixed set of players, containing one or more hands.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `game_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `game_date` | `Date` | `not null` | Calendar date the session was played |
| `status` | `String` | `not null`, default `"active"` | Lifecycle state. Known values: `"active"`, `"complete"`. No DB-level CHECK constraint. |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `players` | `Player` | `game_players` (many-to-many) | Players registered for this session |
| `hands` | `Hand` | direct FK | All hands dealt in this session |

#### Example

```json
{
  "game_id": 42,
  "game_date": "2026-01-15",
  "status": "active",
  "created_at": "2026-01-15T19:00:00Z"
}
```

---

### `GamePlayer`

**Table:** `game_players`
**Source:** [`models.py:44`](models.py#L44)

Many-to-many junction table linking players to game sessions. Both columns form a composite primary key.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `game_id` | `Integer` | PK, FK → `game_sessions.game_id` | References the game session |
| `player_id` | `Integer` | PK, FK → `players.player_id` | References the player |

> No additional metadata (e.g., buy-in amount, seat position) is stored here. See Open Questions.

---

### `Hand`

**Table:** `hands`
**Source:** [`models.py:51`](models.py#L51)

One complete round of Texas Hold'em within a game session. Stores the five community board cards (flop, turn, river) and the hand's sequential number within the session.

#### Unique Constraint

`uq_hand_game_number` — (`game_id`, `hand_number`) — a hand number is unique within a session.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `hand_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `game_id` | `Integer` | FK → `game_sessions.game_id`, `not null` | The session this hand belongs to |
| `hand_number` | `Integer` | `not null`, unique per game | Sequential hand index within the session (1-based assumed) |
| `flop_1` | `String` | `not null` | First flop community card, e.g. `"AH"` |
| `flop_2` | `String` | `not null` | Second flop community card, e.g. `"10S"` |
| `flop_3` | `String` | `not null` | Third flop community card, e.g. `"KD"` |
| `turn` | `String` | nullable | Turn community card; `NULL` if hand ended on the flop |
| `river` | `String` | nullable | River community card; `NULL` if hand ended before river |
| `source_upload_id` | `Integer` | FK → `image_uploads.upload_id`, nullable | Image upload that provided the community card values, if card detection was used |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `game_session` | `GameSession` | direct FK | The parent session |
| `player_hands` | `PlayerHand` | direct FK | All per-player hand records for this hand |

#### Card Notation

Cards are stored as `rank + suit` strings: ranks `A, 2–10, J, Q, K`; suits `S` (Spades), `H` (Hearts), `D` (Diamonds), `C` (Clubs). Example: `"AH"` = Ace of Hearts, `"10S"` = Ten of Spades.

#### Example

```json
{
  "hand_id": 7,
  "game_id": 42,
  "hand_number": 3,
  "flop_1": "AH",
  "flop_2": "10S",
  "flop_3": "KD",
  "turn": "2C",
  "river": null,
  "source_upload_id": 12,
  "created_at": "2026-01-15T19:32:00Z"
}
```

---

### `PlayerHand`

**Table:** `player_hands`
**Source:** [`models.py:76`](models.py#L76)

Records one player's two hole cards and outcome for a specific hand.

#### Unique Constraint

`uq_player_hand` — (`hand_id`, `player_id`) — a player appears at most once per hand.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `player_hand_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `hand_id` | `Integer` | FK → `hands.hand_id`, `not null` | The hand this record belongs to |
| `player_id` | `Integer` | FK → `players.player_id`, `not null` | The player |
| `card_1` | `String` | `not null` | First hole card, e.g. `"AH"` |
| `card_2` | `String` | `not null` | Second hole card, e.g. `"KS"` |
| `result` | `String` | nullable | Outcome. Known values: `"win"`, `"loss"`, `"split"`. No DB-level CHECK constraint. |
| `profit_loss` | `Float` | nullable | Net chip/monetary gain (positive) or loss (negative) for this hand |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `hand` | `Hand` | direct FK | The parent hand |
| `player` | `Player` | direct FK | The player |

#### Example

```json
{
  "player_hand_id": 55,
  "hand_id": 7,
  "player_id": 1,
  "card_1": "AH",
  "card_2": "KS",
  "result": "win",
  "profit_loss": 42.50,
  "created_at": "2026-01-15T19:33:00Z"
}
```

---

### `ImageUpload`

**Table:** `image_uploads`
**Source:** [`models.py:96`](models.py#L96)

Tracks image files uploaded for computer-vision card detection. Each upload is associated with a game session.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `upload_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `game_id` | `Integer` | FK → `game_sessions.game_id`, `not null` | The session this image was uploaded for |
| `file_path` | `String` | `not null` | Server-side filesystem path where the uploaded file is stored |
| `status` | `String` | `not null`, default `"processing"` | Processing lifecycle state. Known values: `"processing"`, `"detected"`, `"failed"`, `"confirmed"`. No DB-level CHECK constraint. |
| `image_width` | `Integer` | nullable | Source image width in pixels, populated when detection runs. `NULL` until first detection attempt. |
| `image_height` | `Integer` | nullable | Source image height in pixels, populated when detection runs. `NULL` until first detection attempt. |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `detections` | `CardDetection` | direct FK | Detection results produced from this upload |

---

### `CardDetection`

**Table:** `card_detections`
**Source:** [`models.py:108`](models.py#L108)

One computer-vision detection result for a single card position within an uploaded image.

#### Unique Constraint

`uq_detection_upload_position` — (`upload_id`, `card_position`) — each position is detected at most once per upload.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `detection_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `upload_id` | `Integer` | FK → `image_uploads.upload_id`, `not null` | Parent upload |
| `card_position` | `String` | `not null` | Logical position label, e.g. `"flop_1"`, `"turn"`, `"river"`. Vocabulary is not enforced by a CHECK constraint. |
| `detected_value` | `String` | `not null` | Raw card string as detected, e.g. `"AH"` |
| `confidence` | `Float` | `not null` | Model confidence score (range not enforced; assumed 0.0–1.0) |
| `bbox_x` | `Float` | nullable | Bounding box left edge (pixels or normalised units — unspecified) |
| `bbox_y` | `Float` | nullable | Bounding box top edge |
| `bbox_width` | `Float` | nullable | Bounding box width |
| `bbox_height` | `Float` | nullable | Bounding box height |
| `position_confidence` | `String` | nullable | Confidence in the spatial position assignment. Values: `"high"` (well within spatial region), `"low"` (near community/hole boundary), `"unassigned"` (fallback — fewer than 3 community cards detected). `NULL` if position assignment was not run. Set by `PositionAssigner.assign()` during the detection pipeline. |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `image_upload` | `ImageUpload` | direct FK | The parent image upload |

---

### `DetectionCorrection`

**Table:** `detection_corrections`
**Source:** [`models.py:134`](models.py#L134)

Records a human correction applied to a computer-vision detection. Stores both the original detected value and the human-confirmed corrected value, providing an audit trail.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `correction_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `upload_id` | `Integer` | FK → `image_uploads.upload_id`, `not null` | The upload the correction applies to |
| `card_position` | `String` | `not null` | The card position being corrected, e.g. `"flop_1"` |
| `detected_value` | `String` | `not null` | The original (incorrect) value from card detection |
| `corrected_value` | `String` | `not null` | The human-confirmed correct card value |
| `created_at` | `DateTime` | default `utcnow` | Row creation timestamp (UTC) |

#### Relationships

| Relationship | Target | Via | Description |
|---|---|---|---|
| `image_upload` | `ImageUpload` | no `back_populates` | Parent upload. Note: this relationship is one-directional — `ImageUpload` does not declare a `corrections` back-reference. |

> There is no unique constraint preventing multiple corrections for the same (`upload_id`, `card_position`) pair. The most recent correction must be inferred by `created_at` ordering.

---

## `database_models.py` — Legacy ORM Models

**Source:** [`src/app/database/database_models.py`](database_models.py)

> **Status: Legacy.** These models pre-date the current schema. No active route handlers reference them. They persist alongside the newer `models.py` ORM and are kept for backwards compatibility with the `database_queries.py` helpers.

> **DDL side-effect warning:** This file calls `Base.metadata.create_all(engine)` at module import time ([`database_models.py:35`](database_models.py#L35)). Any import of this module triggers DDL against the live database engine.

---

### `Community` (Legacy)

**Table:** `community`
**Source:** [`database_models.py:8`](database_models.py#L8)

Stores community board cards for a hand, keyed by game date and hand number rather than by foreign key to a game session.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `Integer` | PK, index | Surrogate primary key |
| `game_date` | `String` | none | Date string. Format unspecified (no `Date` type used). |
| `time_stamp` | `String` | none | Timestamp string. Format unspecified. |
| `hand_number` | `Integer` | none | Hand sequence number. No uniqueness constraint with `game_date`. |
| `flop_card_0` | `String` | none | First flop card |
| `flop_card_1` | `String` | none | Second flop card |
| `flop_card_2` | `String` | none | Third flop card |
| `turn_card` | `String` | none | Turn card |
| `river_card` | `String` | none | River card |
| `players` | `String` | none | Player list, stored as a serialised string (format unspecified — likely comma-separated names) |

---

### `Game` (Legacy)

**Table:** `game`
**Source:** [`database_models.py:24`](database_models.py#L24)

Stores a summary of a single game with winner and player list as raw strings.

#### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `game_id` | `Integer` | PK, autoincrement | Surrogate primary key |
| `game_date` | `String` | none | Date string. Format unspecified. |
| `winner` | `String` | none | Winner's name as a plain string. No FK to `players`. |
| `players` | `String` | none | Serialised player list (format unspecified). |

---

## `database_queries.py` — Legacy Query Helpers

**Source:** [`src/app/database/database_queries.py`](database_queries.py)

> **Status: Legacy.** These helpers query the legacy `Community` and `Game` tables. No active route handlers call them.

---

### `query_community_with_date_and_hand`

```python
def query_community_with_date_and_hand(db: Session, date: str, hand: int) -> list[Community]
```

Returns all `Community` rows matching the given `game_date` string and `hand_number`, ordered by `id` ascending.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `db` | `Session` | SQLAlchemy session |
| `date` | `str` | Game date string to filter on (must match stored format exactly) |
| `hand` | `int` | Hand number to filter on |

**Returns:** `list[Community]`

---

### `query_game_with_date`

```python
def query_game_with_date(db: Session, date: str) -> list[Game]
```

Returns all `Game` rows for the given `game_date` string.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `db` | `Session` | SQLAlchemy session |
| `date` | `str` | Game date string to filter on |

**Returns:** `list[Game]`

---

## Entity Relationship Summary

```
Player ──< GamePlayer >── GameSession ──< Hand ──< PlayerHand >── Player
                                     │
                                     └──< ImageUpload ──< CardDetection
                                                      ──< DetectionCorrection
```

(`──<` = one-to-many, `>──<` = many-to-many via junction table)

---

## Open Questions

**Q1** [`database_models.py:35`](database_models.py#L35) — `Base.metadata.create_all(engine)` is called at module import time. Any import of `database_models.py` (including via `database_queries.py`) silently runs DDL against the connected database. In a test or CI environment that imports this module, tables may be created outside of Alembic's control.
*Why it matters:* Creates schema state that Alembic is unaware of; can cause conflicts in migration runs and makes test isolation harder.
*Suggested resolution:* Remove the `create_all` call from module scope; run it explicitly only in a controlled startup path or remove it entirely now that Alembic manages the schema.

**Q2** [`models.py:21`](models.py#L21) — `players.name` has a `unique` constraint, but it is case-sensitive at the SQLite level (`"Alice"` and `"alice"` are distinct rows). Spec S-1.1 AC2 may require case-insensitive uniqueness.
*Why it matters:* Duplicate player identities can be created by capitalisation differences, corrupting statistics aggregation.
*Suggested resolution:* Add a `CheckConstraint` normalising to lowercase on insert, or enforce case-normalisation in the service layer before write.

**Q3** [`models.py:36`](models.py#L36), [`models.py:100`](models.py#L100), [`models.py:83`](models.py#L83) — `GameSession.status`, `ImageUpload.status`, and `PlayerHand.result` are all free-form `String` columns. The application relies on string literals (`"active"`, `"complete"`, `"processing"`, `"win"`, `"loss"`, `"split"`) without any DB-level CHECK constraint.
*Why it matters:* A typo or inconsistent value (e.g., `"completed"` vs `"complete"`) silently enters the database and breaks any code filtering on status.
*Suggested resolution:* Add a SQLAlchemy `CheckConstraint` for each column, or migrate to a Python `Enum` type with `native_enum=False`.

**Q4** [`models.py:108`](models.py#L108) — `CardDetection.card_position` vocabulary (e.g., `"flop_1"`, `"turn"`, `"river"`) is not enforced by any constraint. The set of valid positions is implied by `Hand`'s column names but not formalised.
*Why it matters:* An out-of-vocabulary position value would be stored silently and never mapped to a `Hand` column during confirmation.
*Suggested resolution:* Define an enum of valid positions and add a CHECK constraint or use the Pydantic layer to enforce it before persistence.

**Q5** [`models.py:119`](models.py#L119) — `CardDetection.confidence` has no range constraint. Values outside `[0.0, 1.0]` could be stored if the detection model misbehaves.
*Why it matters:* Downstream confidence thresholds and UI indicators would misinterpret out-of-range values.
*Suggested resolution:* Add `CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='ck_detection_confidence_range')`.

**Q6** [`models.py:121`](models.py#L121) — The bounding box columns (`bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`) have no documented unit. It is unclear whether they are pixel coordinates, normalised image fractions (0.0–1.0), or something else.
*Why it matters:* Front-end engineers rendering bounding box overlays need to know the coordinate space.
*Suggested resolution:* Add a doc comment in the model or open a spec issue to define the bounding box coordinate system.

**Q7** [`models.py:134`](models.py#L134) — `DetectionCorrection` has no unique constraint on (`upload_id`, `card_position`). Multiple corrections can exist for the same position within one upload; the "current" value must be inferred by `created_at` ordering. `ImageUpload` does not declare a `corrections` back-reference.
*Why it matters:* Querying "the correction for position X" requires an application-level `ORDER BY created_at DESC LIMIT 1` rather than a simple FK lookup, and callers who forget this will read stale data.
*Suggested resolution:* Either add a unique constraint (only one active correction per position) or add an explicit `is_active` flag; add a `corrections` back-populates to `ImageUpload`.

**Q8** [`database_models.py:8`](database_models.py#L8), [`database_models.py:24`](database_models.py#L24) — The legacy `Community` and `Game` tables and their query helpers appear to be dead code: no active route handlers import or call them.
*Why it matters:* Dead code increases maintenance surface, causes confusion about the canonical data model, and the DDL side-effect (Q1) actively harms test isolation.
*Suggested resolution:* Confirm with the team that these tables are unused, then remove `database_models.py`, `database_queries.py`, and author a migration that drops the `community` and `game` tables.

**Q9** [`models.py:96`](models.py#L96) — `ImageUpload.file_path` stores a raw filesystem path. The `uploads/` directory in this workspace contains files named `passwd` and `evil`, indicating prior path traversal testing. If `file_path` values are read back and used to serve files without sanitisation, an OWASP A01 path traversal vulnerability exists.
*Why it matters:* A malicious or malformed `file_path` value could expose arbitrary server files.
*Suggested resolution:* Ensure the service layer validates that resolved `file_path` values are strictly within the designated uploads directory before use (e.g., `Path(file_path).resolve().is_relative_to(UPLOAD_ROOT)`).
