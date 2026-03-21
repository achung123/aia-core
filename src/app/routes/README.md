# Routes — API Reference

**Directory:** `src/app/routes/`
**Generated:** 2026-03-20
**Artifacts found:** 10 (8 API routers, 1 utility module, 1 skipped) · **Endpoints:** 30

---

## Module Overview

This directory contains all FastAPI route handlers — the HTTP API surface of **AIA Core**. Each file defines a router for one domain area of the poker analytics system. Routers are registered in [`src/app/main.py`](../main.py) with their respective prefixes.

**Architecture layer:** HTTP transport — routes accept requests, validate input via Pydantic schemas (`src/pydantic_models/`), delegate persistence to SQLAlchemy ORM models (`src/app/database/models.py`), and return structured JSON responses.

**Domain coverage:**

| Router file | Prefix | Domain |
|---|---|---|
| `game.py` | `/game` | Legacy game + community card management |
| `games.py` | `/games` | Game session lifecycle (create, list, complete) |
| `hands.py` | `/games` | Hand recording, community/hole card editing, player management per hand |
| `images.py` | `/games` + `/images` | Image upload, card detection, detection confirmation, correction tracking |
| `players.py` | `/players` | Player CRUD |
| `search.py` | `/hands` | Cross-game hand search with filtering and pagination |
| `stats.py` | `/stats` | Player statistics, leaderboard, per-game stats |
| `upload.py` | `/upload` | CSV bulk import (validate + commit) |
| `utils.py` | — | Internal helpers for the legacy `game.py` router |

**Router registration order** (from `main.py`):
`game` → `games` → `hands` → `images.router` → `images.corrections_router` → `players` → `upload` → `stats` → `search`

---

## Discovery Manifest

| File | Classification | Template Used | Artifacts Found |
|---|---|---|---|
| `__init__.py` | Skipped | — | Empty file |
| `game.py` | API Router | `remy.api-reference.template.md` | 4 endpoints |
| `games.py` | API Router | `remy.api-reference.template.md` | 4 endpoints |
| `hands.py` | API Router | `remy.api-reference.template.md` | 8 endpoints |
| `images.py` | API Router | `remy.api-reference.template.md` | 4 endpoints (2 routers) |
| `players.py` | API Router | `remy.api-reference.template.md` | 3 endpoints |
| `search.py` | API Router | `remy.api-reference.template.md` | 1 endpoint |
| `stats.py` | API Router | `remy.api-reference.template.md` | 3 endpoints |
| `upload.py` | API Router | `remy.api-reference.template.md` | 3 endpoints |
| `utils.py` | Utility Reference | `remy.concept-explainer.template.md` | 3 helper functions |

---

## Images — Card Detection Pipeline

**Module:** `src/app/routes/images.py`
**Routers:** `router` (prefix `/games`, tags `images`) · `corrections_router` (prefix `/images`, tags `images`)
**Tags:** `images`

This module implements the **image-based card detection pipeline** — the core feature of the AIA Card Recognition system (project `aia-card-recognition-002`). It covers the full workflow: uploading a poker table photo, running card detection, presenting results for human review, confirming/correcting detections, and persisting the resulting hand data. Detection corrections are tracked separately for future model retraining.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| POST | `/games/{game_id}/hands/image` | Upload a JPEG/PNG poker table image | No |
| GET | `/games/{game_id}/hands/image/{upload_id}` | Get detection results for an upload | No |
| POST | `/games/{game_id}/hands/image/{upload_id}/confirm` | Confirm detections → create Hand | No |
| GET | `/images/corrections` | List all detection corrections | No |

---

### `POST /games/{game_id}/hands/image`

**Summary:** Accept a JPEG/PNG image upload, store it on disk, and create an `ImageUpload` record.

**Poker context:** A user photographs the poker table mid-hand. This endpoint stores that image and marks it for card detection processing.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `game_id` | integer | Yes | ID of the game session this image belongs to |

#### Request Body

Multipart file upload. The field name is `file`.

| Constraint | Value |
|---|---|
| Allowed content types | `image/jpeg`, `image/png` |
| Max file size | 10 MB |
| Magic byte validation | JPEG (`FF D8 FF`) or PNG (`89 50 4E 47 0D 0A 1A 0A`) |

#### Response

**Status:** `201 Created`

| Field | Type | Always Present | Description |
|---|---|---|---|
| `upload_id` | integer | Yes | Auto-generated upload record ID |
| `game_id` | integer | Yes | Game session ID |
| `file_path` | string | Yes | Server-side file path (format: `uploads/{game_id}/{upload_id}_{filename}`) |
| `status` | string | Yes | Always `"processing"` on creation |

**Example:**
```json
{
  "upload_id": 1,
  "game_id": 5,
  "file_path": "uploads/5/1_table_photo.jpg",
  "status": "processing"
}
```

#### Error Responses

| Status | Condition | Detail |
|---|---|---|
| `404 Not Found` | Game session does not exist | `"Game session not found"` |
| `413 Content Too Large` | File exceeds 10 MB | `"File too large. Maximum allowed size is 10 MB."` |
| `415 Unsupported Media Type` | Wrong content type or failed magic byte check | `"Unsupported file type: ..."` or `"File content does not match a valid JPEG or PNG image."` |
| `500 Internal Server Error` | DB flush or file rename failure | `"Failed to flush upload record"` / `"Failed to store uploaded file"` |

---

### `GET /games/{game_id}/hands/image/{upload_id}`

**Summary:** Return card detection results for an uploaded image. Triggers detection on first access if not already run.

**Poker context:** After uploading a table photo, the front end calls this to get the AI's best guess at which cards are on the table. Results include bounding boxes so the UI can overlay detection markers on the image.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `game_id` | integer | Yes | Game session ID |
| `upload_id` | integer | Yes | Upload record ID |

#### Response

**Status:** `200 OK`

| Field | Type | Always Present | Description |
|---|---|---|---|
| `upload_id` | integer | Yes | Upload record ID |
| `game_id` | integer | Yes | Game session ID |
| `status` | string | Yes | One of `"processing"`, `"detected"`, `"failed"`, `"confirmed"` |
| `detections` | array | Yes | List of detection results (empty if status is `"failed"`) |

Each detection object:

| Field | Type | Description |
|---|---|---|
| `detection_id` | integer | Auto-generated detection record ID |
| `card_position` | string | Position label assigned by `PositionAssigner`: `flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `hole_1`, `hole_2`, …, or `card_N` (fallback) |
| `detected_value` | string | Card in rank+suit notation, e.g. `"AH"`, `"10S"` |
| `confidence` | float | Detection confidence score (0.0–1.0) |
| `bbox_x` | float | Bounding box top-left X coordinate |
| `bbox_y` | float | Bounding box top-left Y coordinate |
| `bbox_width` | float | Bounding box width |
| `bbox_height` | float | Bounding box height |

**Example:**
```json
{
  "upload_id": 1,
  "game_id": 5,
  "status": "detected",
  "detections": [
    {
      "detection_id": 1,
      "card_position": "flop_1",
      "detected_value": "AH",
      "confidence": 0.95,
      "bbox_x": 120.5,
      "bbox_y": 80.0,
      "bbox_width": 60.0,
      "bbox_height": 90.0
    }
  ]
}
```

#### Error Responses

| Status | Condition | Detail |
|---|---|---|
| `404 Not Found` | Upload does not exist or wrong game | `"Upload not found"` |
| `500 Internal Server Error` | Detection processing failed | `"Card detection failed"` |

#### Behavior Notes

- Detection runs lazily on the first `GET` call when `status == "processing"`.
- The detector dependency is injected via `get_card_detector()` (currently returns `MockCardDetector`).
- If detection was already completed (status `"detected"` or `"confirmed"`), cached results are returned.
- If detection previously failed, returns an empty detections array with `status: "failed"`.
- `card_position` values are assigned by the detector or by `PositionAssigner` downstream, using the format: `flop_1`..`flop_3`, `turn`, `river` for community cards; `hole_1`, `hole_2`, … for player hole cards.

---

### `POST /games/{game_id}/hands/image/{upload_id}/confirm`

**Summary:** Confirm (and optionally correct) detected card values, creating a `Hand` with `PlayerHand` records and tracking any corrections for model retraining.

**Poker context:** After reviewing the AI's detections overlaid on the table photo, the user confirms the actual card values. This endpoint transforms the confirmed data into a complete hand record — community cards plus each player's hole cards — within the game session. If the user corrected any detection, a `DetectionCorrection` record is created linking the original detected value to the corrected value, building a feedback loop for future model training.

**Dynamic card count (aia-card-recognition-002):** The endpoint accepts a **variable number of player hands (0 or more)** and supports partial community boards. Community cards `flop_1`, `flop_2`, `flop_3` are always required; `turn` and `river` are optional. This allows confirming hands at any betting street (flop, turn, or river) and with any number of visible player hands.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `game_id` | integer | Yes | Game session ID |
| `upload_id` | integer | Yes | Upload record ID (must have status `"detected"`) |

#### Request Body

**Schema:** `ConfirmDetectionRequest`

```
ConfirmDetectionRequest
├── community_cards: ConfirmCommunityCards    (required)
│   ├── flop_1: Card                         (required)
│   ├── flop_2: Card                         (required)
│   ├── flop_3: Card                         (required)
│   ├── turn: Card | null                    (optional, default null)
│   └── river: Card | null                   (optional, default null)
└── player_hands: list[ConfirmPlayerEntry]   (optional, default [])
    └── each:
        ├── player_name: string              (required)
        ├── card_1: Card                     (required)
        └── card_2: Card                     (required)
```

**Card format:** Each `Card` is an object with `rank` (one of `A`, `2`–`10`, `J`, `Q`, `K`) and `suit` (one of `S`, `H`, `D`, `C`).

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `community_cards` | `ConfirmCommunityCards` | Yes | — | The 3–5 community cards |
| `community_cards.flop_1` | `Card` | Yes | Valid rank+suit | First flop card |
| `community_cards.flop_2` | `Card` | Yes | Valid rank+suit | Second flop card |
| `community_cards.flop_3` | `Card` | Yes | Valid rank+suit | Third flop card |
| `community_cards.turn` | `Card` or `null` | No | Valid rank+suit | Turn card (4th street) |
| `community_cards.river` | `Card` or `null` | No | Valid rank+suit | River card (5th street) |
| `player_hands` | `list[ConfirmPlayerEntry]` | No | Default `[]` | Zero or more player hole card entries |
| `player_hands[].player_name` | `string` | Yes | Must exist in DB and be a game participant | Player's name (case-insensitive lookup) |
| `player_hands[].card_1` | `Card` | Yes | Valid rank+suit | First hole card |
| `player_hands[].card_2` | `Card` | Yes | Valid rank+suit | Second hole card |

**Cross-field validation:**
- All cards (community + all player hole cards) must be unique — no duplicate cards across the entire hand (`validate_no_duplicate_cards`)
- Player names within `player_hands` must be unique (case-insensitive)
- Each player must exist in the `players` table
- Each player must be a registered participant in the game session (`game_players` table)

**Example request (flop only, 2 players):**
```json
{
  "community_cards": {
    "flop_1": {"rank": "A", "suit": "H"},
    "flop_2": {"rank": "K", "suit": "S"},
    "flop_3": {"rank": "10", "suit": "D"}
  },
  "player_hands": [
    {
      "player_name": "Gil",
      "card_1": {"rank": "Q", "suit": "H"},
      "card_2": {"rank": "J", "suit": "H"}
    },
    {
      "player_name": "Adam",
      "card_1": {"rank": "9", "suit": "C"},
      "card_2": {"rank": "8", "suit": "C"}
    }
  ]
}
```

**Example request (river, no player hands):**
```json
{
  "community_cards": {
    "flop_1": {"rank": "A", "suit": "H"},
    "flop_2": {"rank": "K", "suit": "S"},
    "flop_3": {"rank": "10", "suit": "D"},
    "turn": {"rank": "3", "suit": "C"},
    "river": {"rank": "7", "suit": "H"}
  },
  "player_hands": []
}
```

#### Response

**Status:** `201 Created`
**Schema:** `HandResponse`

| Field | Type | Always Present | Description |
|---|---|---|---|
| `hand_id` | integer | Yes | Auto-generated hand ID |
| `game_id` | integer | Yes | Game session ID |
| `hand_number` | integer | Yes | Auto-incremented within the game session |
| `flop_1` | string | Yes | First flop card as rank+suit string |
| `flop_2` | string | Yes | Second flop card |
| `flop_3` | string | Yes | Third flop card |
| `turn` | string or null | Yes | Turn card (null if not dealt) |
| `river` | string or null | Yes | River card (null if not dealt) |
| `source_upload_id` | integer | Yes | Links hand back to the image upload |
| `created_at` | string (ISO 8601) | Yes | Creation timestamp |
| `player_hands` | array | Yes | List of `PlayerHandResponse` (may be empty) |

Each `player_hands` entry:

| Field | Type | Description |
|---|---|---|
| `player_hand_id` | integer | Auto-generated player-hand record ID |
| `hand_id` | integer | Parent hand ID |
| `player_id` | integer | Player's ID |
| `player_name` | string | Player's display name |
| `card_1` | string | First hole card as rank+suit string |
| `card_2` | string | Second hole card |
| `result` | string or null | Always `null` at creation (set later via results endpoint) |
| `profit_loss` | float or null | Always `null` at creation |

**Example response:**
```json
{
  "hand_id": 12,
  "game_id": 5,
  "hand_number": 3,
  "flop_1": "AH",
  "flop_2": "KS",
  "flop_3": "10D",
  "turn": null,
  "river": null,
  "source_upload_id": 1,
  "created_at": "2026-03-20T18:30:00Z",
  "player_hands": [
    {
      "player_hand_id": 23,
      "hand_id": 12,
      "player_id": 1,
      "player_name": "Gil",
      "card_1": "QH",
      "card_2": "JH",
      "result": null,
      "profit_loss": null
    }
  ]
}
```

#### Correction Record Generation

After creating the hand, the endpoint compares each confirmed card value against the original detection results and creates `DetectionCorrection` records for any mismatches.

**Position mapping for corrections** uses keys that match the `DetectionResult` format from `PositionAssigner`:

| Confirmed field | Correction `card_position` key |
|---|---|
| `community_cards.flop_1` | `flop_1` |
| `community_cards.flop_2` | `flop_2` |
| `community_cards.flop_3` | `flop_3` |
| `community_cards.turn` | `turn` |
| `community_cards.river` | `river` |
| `player_hands[0].card_1` | `hole_1` |
| `player_hands[0].card_2` | `hole_2` |
| `player_hands[1].card_1` | `hole_3` |
| `player_hands[1].card_2` | `hole_4` |
| `player_hands[N].card_1` | `hole_{N*2+1}` |
| `player_hands[N].card_2` | `hole_{N*2+2}` |

A correction is only created when the detection map contains a matching position key **and** the detected value differs from the confirmed value. Positions that were not detected (absent from the detection map) produce no correction record.

#### Error Responses

| Status | Condition | Detail |
|---|---|---|
| `404 Not Found` | Game session does not exist | `"Game session not found"` |
| `404 Not Found` | Upload does not exist or wrong game | `"Upload not found"` |
| `409 Conflict` | Upload status is not `"detected"` | `"Upload status is '...', expected \"detected\""` |
| `400 Bad Request` | Duplicate cards in the hand | Duplicate card list message |
| `400 Bad Request` | Duplicate player names | `"Duplicate player_name in player_hands"` |
| `404 Not Found` | Player does not exist | `"Player '...' not found"` |
| `400 Bad Request` | Player not in game session | `"Player '...' is not a participant in this game"` |

#### Side Effects

1. Creates one `Hand` row linked to the game session and the image upload (`source_upload_id`)
2. Creates 0+ `PlayerHand` rows (one per entry in `player_hands`)
3. Creates 0+ `DetectionCorrection` rows (one per mismatched position)
4. Updates `ImageUpload.status` from `"detected"` → `"confirmed"`

---

### `GET /images/corrections`

**Summary:** Return all detection corrections across all uploads.

**Poker context:** Correction records form a feedback dataset for retraining the card detection model — each record pairs a model's incorrect prediction with the human-verified ground truth.

**Router:** `corrections_router` (prefix `/images`)

#### Response

**Status:** `200 OK`

Array of correction objects:

| Field | Type | Description |
|---|---|---|
| `correction_id` | integer | Auto-generated correction ID |
| `upload_id` | integer | Which image upload this correction belongs to |
| `card_position` | string | Position key (`flop_1`, `hole_3`, etc.) |
| `detected_value` | string | What the model predicted |
| `corrected_value` | string | What the human confirmed |
| `created_at` | string (ISO 8601) or null | When the correction was created |

**Example:**
```json
[
  {
    "correction_id": 1,
    "upload_id": 1,
    "card_position": "flop_2",
    "detected_value": "KH",
    "corrected_value": "KS",
    "created_at": "2026-03-20T18:31:00"
  }
]
```

---

## Games — Session Lifecycle

**Module:** `src/app/routes/games.py`
**Router prefix:** `/games`
**Tags:** `games`

Manages game session lifecycle — creating sessions with a set of players, listing sessions, fetching individual sessions, and marking sessions as completed.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| GET | `/games` | List game sessions with optional date filtering | No |
| POST | `/games` | Create a new game session with players | No |
| GET | `/games/{game_id}` | Get a single game session | No |
| PATCH | `/games/{game_id}/complete` | Mark a game session as completed | No |

---

### `POST /games`

**Summary:** Create a new game session for a given date with a list of player names. Players are created if they don't already exist.

**Poker context:** A new poker night begins. The host creates a game session listing all participants. The system auto-creates any first-time players.

#### Request Body

**Schema:** `GameSessionCreate`

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `game_date` | date (YYYY-MM-DD) | Yes | Valid date | Date of the poker session |
| `player_names` | list[string] | Yes | At least 1 name | Names of participating players |

**Example:**
```json
{
  "game_date": "2026-03-20",
  "player_names": ["Gil", "Adam", "Matt", "Zain"]
}
```

#### Response

**Status:** `201 Created` · **Schema:** `GameSessionResponse`

| Field | Type | Description |
|---|---|---|
| `game_id` | integer | Auto-generated session ID |
| `game_date` | date | Session date |
| `status` | string | Always `"active"` on creation |
| `created_at` | datetime | Creation timestamp |
| `player_names` | list[string] | Registered player names |
| `hand_count` | integer | Always `0` on creation |

---

### `GET /games`

**Summary:** List all game sessions, optionally filtered by date range.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `date_from` | date | No | null | Include sessions on or after this date |
| `date_to` | date | No | null | Include sessions on or before this date |

#### Response

**Status:** `200 OK` · **Schema:** `list[GameSessionListItem]`

| Field | Type | Description |
|---|---|---|
| `game_id` | integer | Session ID |
| `game_date` | date | Session date |
| `status` | string | `"active"` or `"completed"` |
| `player_count` | integer | Number of players in the session |
| `hand_count` | integer | Number of hands recorded |

---

### `GET /games/{game_id}`

**Summary:** Fetch a single game session by ID.

#### Response

**Status:** `200 OK` · **Schema:** `GameSessionResponse`

| Status | Condition | Detail |
|---|---|---|
| `404 Not Found` | Game session does not exist | `"Game session not found"` |

---

### `PATCH /games/{game_id}/complete`

**Summary:** Mark an active game session as completed.

**Poker context:** The poker night is over — this finalizes the session so historical stats can distinguish completed games from in-progress ones.

#### Response

**Status:** `200 OK` · **Schema:** `GameSessionResponse` (with `status: "completed"`)

| Status | Condition | Detail |
|---|---|---|
| `404 Not Found` | Session does not exist | `"Game session not found"` |
| `400 Bad Request` | Already completed | `"Game session already completed"` |

---

## Hands — Hand Recording & Editing

**Module:** `src/app/routes/hands.py`
**Router prefix:** `/games`
**Tags:** `hands`

Handles the full lifecycle of a poker hand within a game session: recording a new hand with community cards and player entries, editing community or hole cards after the fact, adding/removing players from a hand, and recording win/loss results.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| GET | `/games/{game_id}/hands` | List all hands in a game session | No |
| GET | `/games/{game_id}/hands/{hand_number}` | Get a single hand | No |
| POST | `/games/{game_id}/hands` | Record a new hand | No |
| PATCH | `/games/{game_id}/hands/{hand_number}` | Edit community cards | No |
| PATCH | `/games/{game_id}/hands/{hand_number}/players/{player_name}` | Edit a player's hole cards | No |
| POST | `/games/{game_id}/hands/{hand_number}/players` | Add a player to a hand | No |
| DELETE | `/games/{game_id}/hands/{hand_number}/players/{player_name}` | Remove a player from a hand | No |
| PATCH | `/games/{game_id}/hands/{hand_number}/results` | Record win/loss results | No |

---

### `POST /games/{game_id}/hands`

**Summary:** Record a complete new hand with community cards and player entries.

**Poker context:** After a hand concludes (or during live play), the user enters the flop/turn/river and each player's hole cards with their result. `hand_number` auto-increments within the game session.

#### Request Body

**Schema:** `HandCreate`

| Field | Type | Required | Description |
|---|---|---|---|
| `flop_1` | Card | Yes | First flop card |
| `flop_2` | Card | Yes | Second flop card |
| `flop_3` | Card | Yes | Third flop card |
| `turn` | Card or null | No | Turn card |
| `river` | Card or null | No | River card |
| `player_entries` | list[PlayerHandEntry] | Yes (min 1) | At least one player with hole cards |

Each `PlayerHandEntry`:

| Field | Type | Required | Description |
|---|---|---|---|
| `player_name` | string | Yes | Player name (must exist and be game participant) |
| `card_1` | Card | Yes | First hole card |
| `card_2` | Card | Yes | Second hole card |
| `result` | string or null | No | `"win"`, `"loss"`, or `"fold"` |
| `profit_loss` | float or null | No | Net profit/loss for this hand |

**Validation:** All cards must be unique across community + all player hands. Player names must be unique.

#### Response

**Status:** `201 Created` · **Schema:** `HandResponse`

---

### `PATCH /games/{game_id}/hands/{hand_number}`

**Summary:** Update the community cards (flop/turn/river) for an existing hand.

**Schema:** `CommunityCardsUpdate` — same structure as community fields in `HandCreate`.

**Validation:** New community cards are cross-validated against existing player hole cards for duplicates.

---

### `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}`

**Summary:** Update a player's hole cards for an existing hand.

**Schema:** `HoleCardsUpdate` (`card_1`, `card_2` — both required `Card` objects).

**Validation:** New hole cards are cross-validated against community cards and other players' hole cards for duplicates.

---

### `POST /games/{game_id}/hands/{hand_number}/players`

**Summary:** Add a player to an existing hand with their hole cards.

**Schema:** `PlayerHandEntry`

**Validation:** Player must exist, be a game participant, and not already be recorded in the hand. All cards must be unique across the hand.

**Status:** `201 Created`

---

### `DELETE /games/{game_id}/hands/{hand_number}/players/{player_name}`

**Summary:** Remove a player from a hand.

**Status:** `204 No Content`

---

### `PATCH /games/{game_id}/hands/{hand_number}/results`

**Summary:** Record win/loss/fold results and profit/loss amounts for players in a hand.

**Poker context:** After a hand resolves, update each player's outcome. This powers the stats and leaderboard endpoints.

#### Request Body

Array of `PlayerResultEntry`:

| Field | Type | Required | Description |
|---|---|---|---|
| `player_name` | string | Yes | Player name |
| `result` | string | Yes | `"win"`, `"loss"`, or `"fold"` |
| `profit_loss` | float | Yes | Net profit/loss for this hand |

#### Response

**Status:** `200 OK` · **Schema:** `HandResponse`

---

## Players — Player Management

**Module:** `src/app/routes/players.py`
**Router prefix:** `/players`
**Tags:** `players`

Simple CRUD for player records. Players are also auto-created by the game session creation endpoint, but this router allows explicit management.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| POST | `/players` | Create a new player | No |
| GET | `/players` | List all players | No |
| GET | `/players/{player_name}` | Get a player by name | No |

---

### `POST /players`

**Schema:** `PlayerCreate` — `{ "name": "Gil" }`
**Response:** `201 Created` · `PlayerResponse`
**Error:** `409 Conflict` if player already exists (case-insensitive match).

### `GET /players`

**Response:** `200 OK` · `list[PlayerResponse]`

### `GET /players/{player_name}`

**Response:** `200 OK` · `PlayerResponse`
**Error:** `404 Not Found` if player does not exist.

---

## Search — Cross-Game Hand Search

**Module:** `src/app/routes/search.py`
**Router prefix:** `/hands`
**Tags:** `search`

Provides a paginated search across all hands in the system with filters for player name, date range, and specific card values.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| GET | `/hands` | Search hands with multi-criteria filtering | No |

---

### `GET /hands`

**Summary:** Search for hands matching optional filters. Returns one result row per player-hand combination.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `player` | string | No | null | Filter by player name (case-insensitive) |
| `date_from` | date | No | null | Include hands from sessions on or after this date |
| `date_to` | date | No | null | Include hands from sessions on or before this date |
| `card` | string | No | null | Card to search for (e.g. `AS`, `KH`) |
| `location` | `"community"` or `"hole"` | No | null | Narrow card search scope |
| `page` | integer (≥1) | No | 1 | Page number |
| `per_page` | integer (1–200) | No | 50 | Results per page |

**Card search behavior:**
- `card=AS` with no `location` → matches community OR hole cards
- `card=AS&location=community` → matches only flop/turn/river
- `card=AS&location=hole` → matches only player hole cards

#### Response

**Status:** `200 OK` · **Schema:** `PaginatedHandSearchResponse`

| Field | Type | Description |
|---|---|---|
| `total` | integer | Total matching rows |
| `page` | integer | Current page |
| `per_page` | integer | Items per page |
| `results` | list[HandSearchResult] | Hand + player-hand result per row |

---

## Stats — Statistics & Leaderboard

**Module:** `src/app/routes/stats.py`
**Router prefix:** `/stats`
**Tags:** `stats`

Aggregated statistics for players and games. Only hands with a non-null `result` field are counted in stats.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| GET | `/stats/players/{player_name}` | Per-player lifetime stats | No |
| GET | `/stats/leaderboard` | Cross-player ranked leaderboard | No |
| GET | `/stats/games/{game_id}` | Per-game aggregated stats | No |

---

### `GET /stats/players/{player_name}`

**Response schema:** `PlayerStatsResponse`

| Field | Type | Description |
|---|---|---|
| `player_name` | string | Player display name |
| `total_hands_played` | integer | Total hands with a result |
| `hands_won` | integer | Count of `result == "win"` |
| `hands_lost` | integer | Count of `result == "loss"` |
| `hands_folded` | integer | Count of `result == "fold"` |
| `win_rate` | float | `hands_won / total * 100` |
| `total_profit_loss` | float | Lifetime net P/L |
| `avg_profit_loss_per_hand` | float | P/L per hand |
| `avg_profit_loss_per_session` | float | P/L per game session |
| `flop_pct` | float | Always 100.0 (all hands have a flop) |
| `turn_pct` | float | % of hands that reached the turn |
| `river_pct` | float | % of hands that reached the river |

---

### `GET /stats/leaderboard`

**Query:** `metric` — one of `total_profit_loss` (default), `win_rate`, `hands_played`

**Response:** `list[LeaderboardEntry]` — ranked list with `rank`, `player_name`, `total_profit_loss`, `win_rate`, `hands_played`.

---

### `GET /stats/games/{game_id}`

**Response schema:** `GameStatsResponse`

| Field | Type | Description |
|---|---|---|
| `game_id` | integer | Game session ID |
| `game_date` | date | Session date |
| `total_hands` | integer | Number of hands in the session |
| `player_stats` | list[GameStatsPlayerEntry] | Per-player stats for the session |

---

## Upload — CSV Bulk Import

**Module:** `src/app/routes/upload.py`
**Router prefix:** `/upload`
**Tags:** `upload`

Supports bulk importing hand data via CSV files — validate-then-commit pattern.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| GET | `/upload/csv/schema` | Get expected CSV column structure | No |
| POST | `/upload/csv` | Validate a CSV file (dry run) | No |
| POST | `/upload/csv/commit` | Validate and commit CSV data | No |

---

### `GET /upload/csv/schema`

**Response:** `{ "columns": [...], "formats": {...} }` — describes expected CSV structure.

### `POST /upload/csv`

**Summary:** Accepts a CSV upload, parses and validates it, and returns a validation report **without** persisting any data.

**Response:** `{ "valid": bool, "total_rows": int, "error_count": int, "errors": [...] }`

### `POST /upload/csv/commit`

**Summary:** Parse, validate, and bulk-commit CSV data in a single transaction. Creates game sessions, hands, players, and player-hand records.

**Response:** `201 Created` · **Schema:** `CSVCommitSummary`

| Field | Type | Description |
|---|---|---|
| `games_created` | integer | New game sessions created |
| `hands_created` | integer | New hands created |
| `players_created` | integer | New players created |
| `players_matched` | integer | Existing players matched by name |

---

## Game (Legacy) — Original Game & Community API

**Module:** `src/app/routes/game.py`
**Router prefix:** `/game`
**Tags:** `game`

> **Note:** This is the **legacy router** from the original AIA Core implementation. It uses a different data model (`Game`, `Community` from `database_models.py`) and a different card representation (`Card` objects with separate `rank`/`suit` fields). The newer `games.py` / `hands.py` routers supersede this for all new development. This router is retained for backward compatibility.

### Endpoints

| Method | Path | Summary | Auth |
|---|---|---|---|
| POST | `/game/` | Create a game for today's date | No |
| GET | `/game/{game_date}` | Get a game by date | No |
| POST | `/game/community/{game_date}/{hand_number}` | Push community cards for a hand | No |
| GET | `/game/community/{game_date}/{hand_number}` | Get community cards for a hand | No |

#### Notable legacy behaviors

- `create_game` hardcodes `winner='Gil'` and `losers='Adam,Matt,Zain'` — this is placeholder data from the original prototype.
- `game_date` uses `MM-DD-YYYY` string format (not ISO date objects).
- Community cards use the `CommunityState` model with `flop_card_0/1/2`, `turn_card`, `river_card` as `Card` objects — different from the newer `flop_1/2/3`, `turn`, `river` string representation.

---

## Utils — Legacy Route Helpers

**Module:** `src/app/routes/utils.py`

Internal utility functions supporting the legacy `game.py` router. These are prefixed with `_` to indicate private/internal use.

### Functions

| Function | Purpose |
|---|---|
| `_convert_community_query_to_state(community_query)` | Converts an ORM `Community` row into a `CommunityState` Pydantic model |
| `_convert_community_state_to_query(game_date, hand_number, community_state)` | Converts a `CommunityState` model into an ORM `Community` row for persistence |
| `_validate_game_date(value)` | Validates that a string follows `MM-DD-YYYY` date format using `dateutil.parser` |

**Dependencies:** `app.database.database_models.Community`, `pydantic_models.app_models.Card`, `pydantic_models.app_models.CommunityState`.

> **Note:** These utilities reference the legacy `database_models.py` module (not the current `models.py`). They are only used by `game.py`.

---

## Open Questions

**Q1 — Legacy router coexistence**
- **Location:** `src/app/routes/game.py:1`, `src/app/main.py:8`
- **Observation:** The `game.py` (prefix `/game`) and `games.py` (prefix `/games`) routers coexist with different data models, date formats, and card representations. `game.py` uses `database_models.Game` + `Community` while `games.py` uses `models.GameSession` + `Hand`.
- **Why it matters:** API consumers may be confused about which endpoints to use. The two systems store data in different tables with no cross-references.
- **Suggested resolution:** Deprecate the `/game` prefix in API docs and add a deprecation notice header to those endpoints, or remove them once all consumers have migrated.

**Q2 — `create_game` returns 404 for duplicate**
- **Location:** `src/app/routes/game.py:40`
- **Observation:** `POST /game/` raises `HTTPException(status_code=404)` when a game already exists for today. A 404 status code means "not found," but the semantics here are "already exists" — a 409 Conflict would be more appropriate.
- **Why it matters:** Front-end code checking for 404 may interpret this as a missing resource rather than a duplicate.
- **Suggested resolution:** Change to `status_code=409` with detail `"Game already exists for this date"`.

**Q3 — Upload status lifecycle is not explicitly enforced**
- **Location:** `src/app/routes/images.py:170` (status check), `src/app/database/models.py:97`
- **Observation:** `ImageUpload.status` is a free-form `String` column cycling through `"processing"` → `"detected"` / `"failed"` → `"confirmed"`. There is no enum or check constraint ensuring only valid transitions.
- **Why it matters:** A bug or race condition could set an unexpected status value, and the confirm endpoint only checks `!= "detected"`. Invalid states would silently prevent confirmation.
- **Suggested resolution:** Define a `UploadStatus` enum and use it as a column type or add a check constraint. Guard against double-confirmation (status already `"confirmed"`).

**Q4 — `get_detection_results` has a side-effect on GET**
- **Location:** `src/app/routes/images.py:133–170`
- **Observation:** `GET /games/{game_id}/hands/image/{upload_id}` triggers card detection as a side effect when status is `"processing"`. GET requests are expected to be idempotent and side-effect-free per HTTP semantics.
- **Why it matters:** Caching proxies, prefetch, and retry logic all assume GET requests are safe. Running detection on GET can lead to unexpected redundant processing.
- **Suggested resolution:** Move detection triggering to a dedicated `POST .../detect` endpoint, or document this non-standard behavior clearly for API consumers.

**Q5 — No pagination on `/images/corrections`**
- **Location:** `src/app/routes/images.py:316`
- **Observation:** `GET /images/corrections` returns all correction records without pagination. As the correction dataset grows (its purpose is retraining data), this will become a performance bottleneck.
- **Why it matters:** The endpoint is intended for model retraining pipelines that may process large volumes of data.
- **Suggested resolution:** Add `page` and `per_page` query parameters consistent with the `/hands` search endpoint pattern.

**Q6 — No `result` or `profit_loss` in confirm-detection player entries**
- **Location:** `src/pydantic_models/app_models.py:437–442` (`ConfirmPlayerEntry`)
- **Observation:** `ConfirmPlayerEntry` only includes `player_name`, `card_1`, and `card_2` — no `result` or `profit_loss` fields. This matches the detection-confirmation use case (results aren't known yet at detection time), but means a second API call to `PATCH .../results` is always required to complete the hand.
- **Why it matters:** Front-end developers need to know this is a two-step process: confirm detections first, then record results separately.
- **Suggested resolution:** Document this explicitly as a two-step workflow — this is by design, not a gap. Consider noting it in the endpoint description.

**Q7 — `record_hand` (hands.py) vs `confirm_detection` (images.py) create Hands differently**
- **Location:** `src/app/routes/hands.py:320`, `src/app/routes/images.py:190`
- **Observation:** `record_hand` requires at least 1 player entry (`min_length=1`) while `confirm_detection` allows 0 player hands. `record_hand` does not set `source_upload_id`; `confirm_detection` always sets it. The two paths create identical `Hand` rows but with different constraints.
- **Why it matters:** API consumers need to understand which endpoint to use: `record_hand` for manual entry, `confirm_detection` for image-based entry.
- **Suggested resolution:** Document the two hand-creation paths clearly, noting their distinct validation rules and use cases.
