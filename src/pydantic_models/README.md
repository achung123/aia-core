# Documentation Index: `src/pydantic_models/`

**Generated:** 2025-03-13
**Artifacts found:** 35 · **Documents generated:** 1 (this file)

---

## Module Overview

This directory contains all Pydantic models, enumerations, and validation utilities that define the data contract layer of AIA Core. Every request body, response payload, and enum used across the FastAPI routes is defined here. The module sits between the HTTP API surface (`src/app/routes/`) and the persistence layer (`src/app/database/`), enforcing type safety and validation at system boundaries.

**Key responsibilities:**
- Validate incoming API request data (card formats, date formats, field constraints)
- Define response shapes returned to front-end consumers
- Provide canonical poker-domain enumerations (card ranks, suits, game states)
- Support the card detection pipeline with `DetectionResult` and confirmation models
- Parse and validate CSV bulk-upload data

---

## Discovery Manifest

| File | Classification | Template Used | Artifacts Found |
|---|---|---|---|
| `__init__.py` | Skipped (empty) | — | — |
| `app_models.py` | Pydantic Schema + Enums | `remy.schema-reference.template.md` | 4 enums, 27 BaseModel classes |
| `card_validator.py` | Utility Reference | `remy.concept-explainer.template.md` | 1 function |
| `csv_schema.py` | Utility Reference | `remy.concept-explainer.template.md` | 2 functions, 4 constants |

---

## Table of Contents

- [Enumerations](#enumerations)
  - [GameState](#gamestate)
  - [CardRank](#cardrank)
  - [CardSuit](#cardsuit)
  - [LeaderboardMetric](#leaderboardmetric)
- [Core Card Models](#core-card-models)
  - [Card](#card)
- [Card Detection Pipeline](#card-detection-pipeline)
  - [DetectionResult](#detectionresult)
  - [ConfirmCommunityCards](#confirmcommunitycards)
  - [ConfirmPlayerEntry](#confirmplayerentry)
  - [ConfirmDetectionRequest](#confirmdetectionrequest)
- [Game Session Models](#game-session-models)
  - [GameSessionCreate](#gamesessioncreate)
  - [GameSessionListItem](#gamesessionlistitem)
  - [GameSessionResponse](#gamesessionresponse)
- [Community Card Models](#community-card-models)
  - [CommunityState](#communitystate)
  - [CommunityRequest](#communityrequest)
  - [CommunityResponse](#communityresponse)
  - [CommunityErrorResponse](#communityerrorresponse)
  - [CommunityCardsUpdate](#communitycardsupdate)
- [Hand Models](#hand-models)
  - [HandCreate](#handcreate)
  - [HandResponse](#handresponse)
  - [HandResultUpdate](#handresultupdate)
  - [HandSearchResult](#handsearchresult)
  - [PaginatedHandSearchResponse](#paginatedhandsearchresponse)
- [Player Models](#player-models)
  - [PlayerCreate](#playercreate)
  - [PlayerResponse](#playerresponse)
  - [PlayerHandEntry](#playerhandentry)
  - [PlayerHandResponse](#playerhandresponse)
  - [PlayerResultEntry](#playerresultentry)
  - [HoleCardsUpdate](#holecardsupdate)
- [Statistics Models](#statistics-models)
  - [PlayerStatsResponse](#playerstatsresponse)
  - [LeaderboardEntry](#leaderboardentry)
  - [GameStatsPlayerEntry](#gamestatsplayerentry)
  - [GameStatsResponse](#gamestatsresponse)
- [Legacy Models](#legacy-models)
  - [GameRequest](#gamerequest)
  - [GameResponse](#gameresponse)
- [CSV Upload Models](#csv-upload-models)
  - [CSVCommitSummary](#csvcommitsummary)
- [Utility Modules](#utility-modules)
  - [card_validator.py](#card_validatorpy)
  - [csv_schema.py](#csv_schemapy)

---

## Enumerations

### `GameState`

**Base:** `str, Enum`
**Module:** `src/pydantic_models/app_models.py` (line 23)
**Role:** Enumeration — represents the current betting street in a Texas Hold'em hand.

| Member | Value | Poker Meaning |
|---|---|---|
| `FLOP` | `"flop"` | The first 3 community cards have been dealt; first post-flop betting round |
| `TURN` | `"turn"` | The 4th community card has been dealt; second post-flop betting round |
| `RIVER` | `"river"` | The 5th and final community card has been dealt; last betting round before showdown |
| `BAD_GAME_STATE` | `"bad_game_state"` | Sentinel for invalid/unrecognizable state — not a real poker term |

**Used in:** `CommunityState.game_state` computed field; `src/app/routes/game.py`

---

### `CardRank`

**Base:** `str, Enum`
**Module:** `src/pydantic_models/app_models.py` (line 43)
**Role:** Enumeration — canonical rank values for a standard 52-card deck.

| Member | Value | Poker Meaning |
|---|---|---|
| `ACE` | `"A"` | Ace — highest or lowest rank depending on context |
| `TWO` through `NINE` | `"2"` – `"9"` | Numeric pip cards |
| `TEN` | `"10"` | Ten (two-character rank) |
| `JACK` | `"J"` | Jack face card |
| `QUEEN` | `"Q"` | Queen face card |
| `KING` | `"K"` | King face card |

**Used in:** `Card.rank` field; CSV validation in `csv_schema.py`

---

### `CardSuit`

**Base:** `str, Enum`
**Module:** `src/pydantic_models/app_models.py` (line 78)
**Role:** Enumeration — canonical suit values for a standard 52-card deck.

| Member | Value | Poker Meaning |
|---|---|---|
| `SPADES` | `"S"` | Spades suit |
| `HEARTS` | `"H"` | Hearts suit |
| `DIAMONDS` | `"D"` | Diamonds suit |
| `CLUBS` | `"C"` | Clubs suit |

**Used in:** `Card.suit` field; CSV validation in `csv_schema.py`

---

### `LeaderboardMetric`

**Base:** `str, Enum`
**Module:** `src/pydantic_models/app_models.py` (line 334)
**Role:** Enumeration — available sorting metrics for the leaderboard endpoint.

| Member | Value | Meaning |
|---|---|---|
| `total_profit_loss` | `"total_profit_loss"` | Rank players by cumulative monetary result |
| `win_rate` | `"win_rate"` | Rank players by win percentage |
| `hands_played` | `"hands_played"` | Rank players by total hands participated in |

**Used in:** `GET /games/leaderboard` query parameter; `src/app/routes/stats.py`

---

## Core Card Models

### `Card`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 96)
**Role:** Shared model — represents a single playing card. Used as a building block in request bodies for community cards, hole cards, and hand recording.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `rank` | `CardRank` | Yes | — | Must be a valid `CardRank` enum value | The rank of the card (A, 2–10, J, Q, K) |
| `suit` | `CardSuit` | Yes | — | Must be a valid `CardSuit` enum value | The suit of the card (S, H, D, C) |

**Config:** `use_enum_values=True` — serializes enum members as their string values.

**Methods:**
- `__str__()` → `"{rank}{suit}"` (e.g., `"AH"`, `"10S"`)

**Example JSON:**
```json
{ "rank": "A", "suit": "H" }
```

**Used in:** `CommunityState`, `HandCreate`, `PlayerHandEntry`, `CommunityCardsUpdate`, `HoleCardsUpdate`, `ConfirmCommunityCards`, `ConfirmPlayerEntry`

**Related ORM:** Cards are stored as concatenated strings (e.g., `"AS"`) in ORM columns; the `Card` model is used only at the API boundary.

---

## Card Detection Pipeline

These models support the image-based card recognition workflow introduced in the `aia-card-recognition-002` spec. The pipeline flow is: **upload image → detect cards → review detections → confirm/correct → create hand**.

### `DetectionResult`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 10)
**Role:** Shared model — represents a single card detected from a poker table image by the card detection system. Output of `CardDetector.detect()` and input to `PositionAssigner.assign()`.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `detected_value` | `str` | Yes | — | — | The card value detected from the image (e.g., `"AS"`, `"10H"`) — rank + suit concatenated |
| `confidence` | `float` | Yes | — | `ge=0.0, le=1.0` | ML model confidence score; 1.0 = certain, 0.0 = no confidence |
| `bbox_x` | `float` | Yes | — | — | Bounding box X coordinate (top-left corner) in image pixel space |
| `bbox_y` | `float` | Yes | — | — | Bounding box Y coordinate (top-left corner) in image pixel space |
| `bbox_width` | `float` | Yes | — | `gt=0` | Bounding box width in pixels; must be positive |
| `bbox_height` | `float` | Yes | — | `gt=0` | Bounding box height in pixels; must be positive |
| `card_position` | `str \| None` | No | `None` | — | Assigned position on the table (e.g., `"flop_1"`, `"turn"`, `"river"`, `"hole_1"`); populated by `PositionAssigner`, not by the detector itself |
| `position_confidence` | `str \| None` | No | `None` | — | Confidence qualifier for position assignment (populated downstream) |

**Validators:** None defined.

**Example JSON:**
```json
{
  "detected_value": "AS",
  "confidence": 0.94,
  "bbox_x": 120.5,
  "bbox_y": 200.3,
  "bbox_width": 45.0,
  "bbox_height": 62.0,
  "card_position": "flop_1",
  "position_confidence": "high"
}
```

**Pipeline context:**
1. `CardDetector.detect(image_path)` returns raw detections with `detected_value`, `confidence`, and bounding box fields populated; `card_position` is `None`
2. `PositionAssigner.assign(detections, image_width, image_height)` populates `card_position` and `position_confidence` based on bounding box geometry
3. Detections are stored in the `card_detections` ORM table and returned to the front-end for user review
4. Users confirm or correct via `POST /games/{game_id}/uploads/{upload_id}/confirm` using `ConfirmDetectionRequest`

**Related ORM:** `CardDetection` in `src/app/database/models.py` — stores detection results with matching fields (`detected_value`, `confidence`, `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`, `card_position`)

**Used in:**

| Context | Location |
|---|---|
| `CardDetector` protocol return type (planned) | `src/app/services/card_detector.py` |
| `PositionAssigner` input/output | `src/app/services/position_assigner.py` |
| Unit tests | `test/test_detection_result_model.py` |

---

### `ConfirmCommunityCards`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 376)
**Role:** Request body (nested) — the user-confirmed community cards after reviewing detection results.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `flop_1` | `Card` | Yes | — | Valid `Card` | First flop card |
| `flop_2` | `Card` | Yes | — | Valid `Card` | Second flop card |
| `flop_3` | `Card` | Yes | — | Valid `Card` | Third flop card |
| `turn` | `Card \| None` | No | `None` | Valid `Card` if present | Turn card (4th community card); `None` if hand ended before turn |
| `river` | `Card \| None` | No | `None` | Valid `Card` if present | River card (5th community card); `None` if hand ended before river |

**Config:** `use_enum_values=True`

---

### `ConfirmPlayerEntry`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 386)
**Role:** Request body (nested) — a single player's confirmed hole cards after detection review.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_name` | `str` | Yes | — | — | Name of the player whose cards are being confirmed |
| `card_1` | `Card` | Yes | — | Valid `Card` | Player's first hole card |
| `card_2` | `Card` | Yes | — | Valid `Card` | Player's second hole card |

**Config:** `use_enum_values=True`

---

### `ConfirmDetectionRequest`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 394)
**Role:** Request body — top-level confirmation payload sent after a user reviews card detection results. Triggers hand creation from confirmed detections.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `community_cards` | `ConfirmCommunityCards` | Yes | — | Nested validation | The confirmed 3–5 community cards for this hand |
| `player_hands` | `list[ConfirmPlayerEntry]` | Yes | — | `min_length=1` | At least one player's confirmed hole cards |

**Example JSON:**
```json
{
  "community_cards": {
    "flop_1": { "rank": "A", "suit": "S" },
    "flop_2": { "rank": "K", "suit": "H" },
    "flop_3": { "rank": "10", "suit": "D" },
    "turn": { "rank": "7", "suit": "C" },
    "river": null
  },
  "player_hands": [
    {
      "player_name": "Alice",
      "card_1": { "rank": "Q", "suit": "S" },
      "card_2": { "rank": "J", "suit": "S" }
    }
  ]
}
```

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/games/{game_id}/uploads/{upload_id}/confirm` | Request body | `src/app/routes/images.py` |

**Related ORM:** Creates `Hand` + `PlayerHand` rows; generates `DetectionCorrection` rows for any values that differ from original detections.

---

## Game Session Models

### `GameSessionCreate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 226)
**Role:** Request body — create a new game session (a single poker night).

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_date` | `date` | Yes | — | Python `date` type | The calendar date of the poker session |
| `player_names` | `list[str]` | Yes | — | `min_length=1` | Players at the table; at least 1 required |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/games/` | Request body | `src/app/routes/games.py` |

---

### `GameSessionListItem`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 231)
**Role:** Response model — summary item when listing game sessions.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_id` | `int` | Yes | — | — | Unique game session identifier |
| `game_date` | `date` | Yes | — | — | Date the session was played |
| `status` | `str` | Yes | — | — | Session status (e.g., `"active"`, `"completed"`) |
| `player_count` | `int` | Yes | — | — | Number of players in the session |
| `hand_count` | `int` | Yes | — | — | Number of hands recorded |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/` | Response model (list) | `src/app/routes/games.py` |

---

### `GameSessionResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 241)
**Role:** Response model — detailed game session view.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_id` | `int` | Yes | — | — | Unique game session identifier |
| `game_date` | `date` | Yes | — | — | Date the session was played |
| `status` | `str` | Yes | — | — | Session status |
| `created_at` | `datetime` | Yes | — | — | Timestamp when the session was created |
| `player_names` | `list[str]` | Yes | — | — | Names of all players in the session |
| `hand_count` | `int` | Yes | — | — | Number of hands recorded |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/{game_id}` | Response model | `src/app/routes/games.py` |
| POST | `/games/` | Response model | `src/app/routes/games.py` |
| PUT | `/games/{game_id}/complete` | Response model | `src/app/routes/games.py` |

---

## Community Card Models

### `CommunityState`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 136)
**Role:** Shared model — represents the community board state at a point in time, including the dealing stage.

**Config:** `use_enum_values=True`

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `active_players` | `list[str]` | Yes | — | — | Players still in the hand |
| `flop_card_0` | `Card` | Yes | — | Valid `Card` | First flop card |
| `flop_card_1` | `Card` | Yes | — | Valid `Card` | Second flop card |
| `flop_card_2` | `Card` | Yes | — | Valid `Card` | Third flop card |
| `turn_card` | `Card \| None` | No | `None` | Valid `Card` if present | Turn card |
| `river_card` | `Card \| None` | No | `None` | Valid `Card` if present | River card |

**Computed Fields:**
- `game_state` → `str`: Derives the current `GameState` from which optional cards are present:
  - Both `turn_card` and `river_card` set → `"river"`
  - Only `turn_card` set → `"turn"`
  - Neither set → `"flop"`
  - `river_card` set without `turn_card` → `"bad_game_state"` (invalid)

**Used in:** `CommunityRequest`, `CommunityResponse`; `src/app/routes/game.py`, `src/app/routes/utils.py`

---

### `CommunityRequest`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 176)
**Role:** Request body — submit community card state.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `community_state` | `CommunityState` | Yes | — | Nested validation | The full community board state |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/game/` | Request body | `src/app/routes/game.py` |

---

### `CommunityResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 190)
**Role:** Response model — returned after recording community cards.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `status` | `str` | Yes | — | — | Operation result status |
| `message` | `str` | Yes | — | — | Human-readable message |
| `game_date` | `str` | Yes | — | — | Date of the game |
| `hand_number` | `int` | Yes | — | — | Sequential hand number within the session |
| `community_states` | `list[CommunityState]` | Yes | — | — | The recorded community board states |

**Used in:** `src/app/routes/game.py`

---

### `CommunityErrorResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 218)
**Role:** Response model — error envelope for community card endpoints.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `status` | `str` | Yes | — | — | Error status identifier |
| `message` | `str` | Yes | — | — | Error description |

**Used in:** `src/app/routes/game.py`

---

### `CommunityCardsUpdate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 306)
**Role:** Request body — update community cards on an existing hand.

**Config:** `use_enum_values=True`

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `flop_1` | `Card` | Yes | — | Valid `Card` | First flop card |
| `flop_2` | `Card` | Yes | — | Valid `Card` | Second flop card |
| `flop_3` | `Card` | Yes | — | Valid `Card` | Third flop card |
| `turn` | `Card \| None` | No | `None` | Valid `Card` if present | Turn card |
| `river` | `Card \| None` | No | `None` | Valid `Card` if present | River card |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| PUT | `/games/{game_id}/hands/{hand_number}/community-cards` | Request body | `src/app/routes/hands.py` |

---

## Hand Models

### `HandCreate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 267)
**Role:** Request body — record a new hand within a game session.

**Config:** `use_enum_values=True`

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `flop_1` | `Card` | Yes | — | Valid `Card` | First flop card |
| `flop_2` | `Card` | Yes | — | Valid `Card` | Second flop card |
| `flop_3` | `Card` | Yes | — | Valid `Card` | Third flop card |
| `turn` | `Card \| None` | No | `None` | Valid `Card` if present | Turn card |
| `river` | `Card \| None` | No | `None` | Valid `Card` if present | River card |
| `player_entries` | `list[PlayerHandEntry]` | Yes | — | `min_length=1` | Player hole cards and optional results; at least 1 player required |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/games/{game_id}/hands` | Request body | `src/app/routes/hands.py` |

---

### `HandResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 292)
**Role:** Response model — full hand details including all players.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `hand_id` | `int` | Yes | — | — | Unique hand identifier |
| `game_id` | `int` | Yes | — | — | Parent game session |
| `hand_number` | `int` | Yes | — | — | Sequential hand number within the session |
| `flop_1` | `str` | Yes | — | — | First flop card (stored as string, e.g., `"AS"`) |
| `flop_2` | `str` | Yes | — | — | Second flop card |
| `flop_3` | `str` | Yes | — | — | Third flop card |
| `turn` | `str \| None` | No | `None` | — | Turn card |
| `river` | `str \| None` | No | `None` | — | River card |
| `source_upload_id` | `int \| None` | No | `None` | — | Links to `ImageUpload` that created this hand (if from card detection) |
| `created_at` | `datetime` | Yes | — | — | Timestamp |
| `player_hands` | `list[PlayerHandResponse]` | No | `[]` | — | Player hole cards and results |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/games/{game_id}/hands` | Response model | `src/app/routes/hands.py` |
| GET | `/games/{game_id}/hands/{hand_number}` | Response model | `src/app/routes/hands.py` |
| GET | `/games/{game_id}/hands` | Response model (list) | `src/app/routes/hands.py` |
| POST | `/games/{game_id}/uploads/{upload_id}/confirm` | Response model | `src/app/routes/images.py` |

**Related ORM:** `Hand` in `src/app/database/models.py`

---

### `HandResultUpdate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 296)
**Role:** Request body — update a single player's hand result.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `result` | `str` | Yes | — | — | Outcome: `"win"`, `"loss"`, or `"fold"` |
| `profit_loss` | `float` | Yes | — | — | Monetary gain/loss for this hand |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| PUT | `/games/{game_id}/hands/{hand_number}/players/{player_name}/result` | Request body | `src/app/routes/hands.py` |

---

### `HandSearchResult`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 354)
**Role:** Response model — a single hand in search results, with the matched player's data.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `hand_id` | `int` | Yes | — | — | Hand identifier |
| `game_id` | `int` | Yes | — | — | Parent game session |
| `game_date` | `date` | Yes | — | — | Date the hand was played |
| `hand_number` | `int` | Yes | — | — | Sequential hand number |
| `flop_1`–`flop_3` | `str` | Yes | — | — | Community flop cards |
| `turn` | `str \| None` | No | `None` | — | Turn card |
| `river` | `str \| None` | No | `None` | — | River card |
| `created_at` | `datetime` | Yes | — | — | Timestamp |
| `player_hand` | `PlayerHandResponse` | Yes | — | — | The specific player's data that matched the search |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/search/hands/by-player` | Response (nested) | `src/app/routes/search.py` |
| GET | `/games/search/hands/by-date-and-card` | Response (nested) | `src/app/routes/search.py` |

---

### `PaginatedHandSearchResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 370)
**Role:** Response model — paginated wrapper for hand search results.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `total` | `int` | Yes | — | — | Total matching results |
| `page` | `int` | Yes | — | — | Current page number |
| `per_page` | `int` | Yes | — | — | Results per page |
| `results` | `list[HandSearchResult]` | Yes | — | — | Page of search results |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/search/hands/by-player` | Response model | `src/app/routes/search.py` |
| GET | `/games/search/hands/by-date-and-card` | Response model | `src/app/routes/search.py` |

---

## Player Models

### `PlayerCreate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 253)
**Role:** Request body — create a new player.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `name` | `str` | Yes | — | — | Player display name |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/players/` | Request body | `src/app/routes/players.py` |

---

### `PlayerResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 257)
**Role:** Response model — player details.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_id` | `int` | Yes | — | — | Unique player identifier |
| `name` | `str` | Yes | — | — | Player display name |
| `created_at` | `datetime` | Yes | — | — | Timestamp when the player was created |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/players/` | Response model | `src/app/routes/players.py` |
| GET | `/players/` | Response model (list) | `src/app/routes/players.py` |

---

### `PlayerHandEntry`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 264)
**Role:** Request body (nested) — a single player's hole cards and optional result when recording a hand.

**Config:** `use_enum_values=True`

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_name` | `str` | Yes | — | — | Player's name |
| `card_1` | `Card` | Yes | — | Valid `Card` | First hole card |
| `card_2` | `Card` | Yes | — | Valid `Card` | Second hole card |
| `result` | `str \| None` | No | `None` | — | Hand result: `"win"`, `"loss"`, `"fold"`, or `None` if not yet determined |
| `profit_loss` | `float \| None` | No | `None` | — | Monetary result; `None` if not yet determined |

**Used in:** `HandCreate.player_entries`

---

### `PlayerHandResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 280)
**Role:** Response model — a player's cards and result for a specific hand.

**Config:** `from_attributes=True` (ORM mode)

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_hand_id` | `int` | Yes | — | — | Unique player-hand association ID |
| `hand_id` | `int` | Yes | — | — | Parent hand |
| `player_id` | `int` | Yes | — | — | Player |
| `player_name` | `str` | Yes | — | — | Player display name |
| `card_1` | `str` | Yes | — | — | First hole card (stored string, e.g., `"QS"`) |
| `card_2` | `str` | Yes | — | — | Second hole card |
| `result` | `str \| None` | No | `None` | — | Hand outcome |
| `profit_loss` | `float \| None` | No | `None` | — | Monetary result |

**Related ORM:** `PlayerHand` in `src/app/database/models.py`

**Used in:** `HandResponse.player_hands`, `HandSearchResult.player_hand`; `src/app/routes/hands.py`, `src/app/routes/search.py`, `src/app/routes/images.py`

---

### `PlayerResultEntry`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 301)
**Role:** Request body (nested) — record result for a single player within a batch result update.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_name` | `str` | Yes | — | — | Player whose result is being recorded |
| `result` | `str` | Yes | — | — | Outcome: `"win"`, `"loss"`, or `"fold"` |
| `profit_loss` | `float` | Yes | — | — | Monetary result |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| PUT | `/games/{game_id}/hands/{hand_number}/results` | Request body (list) | `src/app/routes/hands.py` |

---

### `HoleCardsUpdate`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 315)
**Role:** Request body — update a player's hole cards on an existing hand.

**Config:** `use_enum_values=True`

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `card_1` | `Card` | Yes | — | Valid `Card` | Updated first hole card |
| `card_2` | `Card` | Yes | — | Valid `Card` | Updated second hole card |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| PUT | `/games/{game_id}/hands/{hand_number}/players/{player_name}/hole-cards` | Request body | `src/app/routes/hands.py` |

---

## Statistics Models

### `PlayerStatsResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 321)
**Role:** Response model — aggregate statistics for a single player across all sessions.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_name` | `str` | Yes | — | — | Player name |
| `total_hands_played` | `int` | Yes | — | — | Total hands across all sessions |
| `hands_won` | `int` | Yes | — | — | Hands with `result="win"` |
| `hands_lost` | `int` | Yes | — | — | Hands with `result="loss"` |
| `hands_folded` | `int` | Yes | — | — | Hands with `result="fold"` |
| `win_rate` | `float` | Yes | — | — | `hands_won / total_hands_played` |
| `total_profit_loss` | `float` | Yes | — | — | Cumulative monetary result |
| `avg_profit_loss_per_hand` | `float` | Yes | — | — | Mean P/L per hand |
| `avg_profit_loss_per_session` | `float` | Yes | — | — | Mean P/L per session |
| `flop_pct` | `float` | Yes | — | — | % of hands that reached flop |
| `turn_pct` | `float` | Yes | — | — | % of hands that reached turn |
| `river_pct` | `float` | Yes | — | — | % of hands that reached river |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/stats/players/{player_name}` | Response model | `src/app/routes/stats.py` |

---

### `LeaderboardEntry`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 340)
**Role:** Response model — a single row in the leaderboard.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `rank` | `int` | Yes | — | — | Position on the leaderboard |
| `player_name` | `str` | Yes | — | — | Player name |
| `total_profit_loss` | `float` | Yes | — | — | Cumulative monetary result |
| `win_rate` | `float` | Yes | — | — | Win percentage |
| `hands_played` | `int` | Yes | — | — | Total hands |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/leaderboard` | Response model (list) | `src/app/routes/stats.py` |

---

### `GameStatsPlayerEntry`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 348)
**Role:** Response model (nested) — per-player stats within a single game session.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `player_name` | `str` | Yes | — | — | Player name |
| `hands_played` | `int` | Yes | — | — | Hands in this session |
| `hands_won` | `int` | Yes | — | — | Wins in this session |
| `hands_lost` | `int` | Yes | — | — | Losses in this session |
| `hands_folded` | `int` | Yes | — | — | Folds in this session |
| `win_rate` | `float` | Yes | — | — | Win percentage for this session |
| `profit_loss` | `float` | Yes | — | — | Session monetary result |

---

### `GameStatsResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 358)
**Role:** Response model — aggregate statistics for a single game session.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_id` | `int` | Yes | — | — | Game session identifier |
| `game_date` | `date` | Yes | — | — | Date of the session |
| `total_hands` | `int` | Yes | — | — | Total hands played |
| `player_stats` | `list[GameStatsPlayerEntry]` | Yes | — | — | Per-player breakdown |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| GET | `/games/{game_id}/stats` | Response model | `src/app/routes/stats.py` |

---

## Legacy Models

These models support the original `/game/` route (singular) and may be superseded by the newer `/games/` endpoints.

### `GameRequest`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 113)
**Role:** Request body — create a game via the legacy endpoint.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_date` | `str` | Yes | — | `@field_validator`: parses via `dateutil.parser.parse`; must be valid date | Date in `MM-DD-YYYY` format |
| `players` | `list[str]` | Yes | — | — | Player names |

**Validators:**
- **`validate_game_date()`** — `@field_validator("game_date")`: Parses the string with `dateutil.parser.parse()`. Raises `ValueError("game_date must be a valid date in MM-DD-YYYY format")` on invalid input.

**Used in:** `src/app/routes/game.py`

---

### `GameResponse`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 131)
**Role:** Response model — legacy game response.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `game_id` | `int` | Yes | — | — | Game identifier |
| `game_date` | `str` | Yes | — | — | Date as string |
| `winner` | `str` | Yes | — | — | Winning player name |
| `losers` | `str` | Yes | — | — | Comma-separated loser names |

**Used in:** `src/app/routes/game.py`

---

## CSV Upload Models

### `CSVCommitSummary`

**Base:** `BaseModel`
**Module:** `src/pydantic_models/app_models.py` (line 399)
**Role:** Response model — summary statistics after committing a CSV bulk upload.

| Field | Type | Required | Default | Validation | Poker Domain Meaning |
|---|---|---|---|---|---|
| `games_created` | `int` | Yes | — | — | Number of new game sessions created |
| `hands_created` | `int` | Yes | — | — | Number of hands imported |
| `players_created` | `int` | Yes | — | — | Number of new players created |
| `players_matched` | `int` | Yes | — | — | Number of existing players matched by name |

**Used in:**

| Method | Path | As | Module |
|---|---|---|---|
| POST | `/upload/csv/{upload_id}/commit` | Response model | `src/app/routes/upload.py` |

---

## Utility Modules

### `card_validator.py`

**Module:** `src/pydantic_models/card_validator.py`
**Role:** Utility — card validation functions used at system boundaries.

#### `validate_no_duplicate_cards(cards: list[str]) -> None`

Checks a list of card strings for duplicates. Raises `ValueError` with the message `"Duplicate cards found: {duplicates}"` if any card appears more than once. Used during hand creation and detection confirmation to enforce the physical constraint that a standard deck has no duplicate cards.

**Arguments:**
| Param | Type | Description |
|---|---|---|
| `cards` | `list[str]` | Card strings (e.g., `["AS", "KH", "2D"]`) |

**Raises:** `ValueError` if duplicates are found.

**Used in:** `src/app/routes/images.py` (detection confirmation); `src/app/routes/hands.py` (hand recording)

---

### `csv_schema.py`

**Module:** `src/pydantic_models/csv_schema.py`
**Role:** Utility — CSV parsing and validation for bulk hand data import.

#### Constants

| Constant | Type | Description |
|---|---|---|
| `CSV_COLUMNS` | `list[str]` | Expected header columns in order: `game_date`, `hand_number`, `player_name`, `hole_card_1`, `hole_card_2`, `flop_1`–`flop_3`, `turn`, `river`, `result`, `profit_loss` |
| `CSV_COLUMN_FORMATS` | `dict[str, str]` | Human-readable format description per column (used in error messages / documentation) |
| `REQUIRED_CARD_FIELDS` | `list[str]` | Card columns that must always be valid: `hole_card_1`, `hole_card_2`, `flop_1`, `flop_2`, `flop_3` |
| `OPTIONAL_CARD_FIELDS` | `list[str]` | Card columns that may be empty: `turn`, `river` |

#### `is_valid_card(card_str: str) -> bool`

Returns `True` if the string is a valid card token (rank from `CardRank` + suit from `CardSuit`, e.g., `"AS"`, `"10D"`).

#### `parse_csv(csv_text: str) -> dict[tuple[str, str], list[dict[str, str]]]`

Parses raw CSV text with headers. Returns rows grouped by `(game_date, hand_number)` tuples. Raises `ValueError` if headers don't match `CSV_COLUMNS`.

#### `validate_csv_rows(grouped) -> list[dict]`

Validates parsed CSV data for card format correctness and duplicate cards within a hand. Returns a list of error dicts with keys: `row`, `field`, `value`, `message`.

**Validation rules:**
- All required card fields must contain valid card tokens
- Optional card fields, if non-empty, must contain valid card tokens
- No duplicate cards within a single hand (community cards counted once + each player's hole cards)

**Used in:** `src/app/routes/upload.py`

---

## Open Questions

**Q1 — `DetectionResult.detected_value` lacks card format validation**
- **Artifact:** `src/pydantic_models/app_models.py` line 11
- **Observation:** `detected_value` is typed as bare `str` with no `@field_validator` to ensure it conforms to the `{rank}{suit}` card format (e.g., `"AS"`, `"10H"`). Other card entry points use the strongly-typed `Card` model.
- **Why it matters:** Invalid or garbage strings from a misbehaving ML model would pass validation silently and persist to the database. Downstream code that parses card strings could fail unexpectedly.
- **Suggested resolution:** Consider adding a `@field_validator` on `detected_value` using the same `is_valid_card()` logic from `csv_schema.py`, or document that validation is intentionally deferred to allow raw ML output to be stored as-is for correction.

**Q2 — `DetectionResult.card_position` and `position_confidence` are untyped strings**
- **Artifact:** `src/pydantic_models/app_models.py` lines 17–18
- **Observation:** `card_position` accepts any string (e.g., `"flop_1"`, `"hole_1"`), but there is no enum or constrained set defining valid positions. `PositionAssigner` now produces a known vocabulary (`flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `hole_N`, `card_N`) and `position_confidence` uses `"high"`, `"low"`, or `"unassigned"`, but these are not enforced at the model level.
- **Why it matters:** Without a defined vocabulary, the front-end cannot reliably parse or display position data, and the ORM `card_position` column in `CardDetection` stores unconstrained values.
- **Suggested resolution:** Define a `CardPosition` enum (e.g., `flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `hole_1`, `hole_2`) and a `PositionConfidence` literal or enum (`"high"`, `"low"`, `"unassigned"`). The `PositionAssigner` already produces these exact values — an enum would enforce the contract at the model level.

**Q3 — `CardDetector` protocol still returns `list[dict]` instead of `list[DetectionResult]`**
- **Artifact:** `src/app/services/card_detector.py` line 13
- **Observation:** The `CardDetector` protocol and `MockCardDetector` return `list[dict]`, not `list[DetectionResult]` as specified in `specs/aia-card-recognition-002/tasks.md` (T-009). The `DetectionResult` model exists but is not yet wired into the service layer.
- **Why it matters:** The type-safety benefit of `DetectionResult` is not realized until the protocol is updated. The route in `images.py` constructs `CardDetection` ORM objects from dict keys, bypassing Pydantic validation.
- **Suggested resolution:** Update `CardDetector.detect()` to return `list[DetectionResult]` and update `MockCardDetector` accordingly, as specified in T-009.

**Q4 — `HandResultUpdate.result` and `PlayerResultEntry.result` lack constrained values**
- **Artifact:** `src/pydantic_models/app_models.py` lines 296, 301
- **Observation:** Both `result` fields are typed as bare `str`. By convention, valid values are `"win"`, `"loss"`, `"fold"`, but there is no enum or `Literal` constraint enforcing this.
- **Why it matters:** Arbitrary strings could be stored as results, making statistics aggregation unreliable.
- **Suggested resolution:** Define a `HandResult` enum with members `WIN = "win"`, `LOSS = "loss"`, `FOLD = "fold"` and use it in both models.

**Q5 — `GameRequest.game_date` format description says MM-DD-YYYY but validator accepts any parseable date**
- **Artifact:** `src/pydantic_models/app_models.py` line 114
- **Observation:** The field description says `"Date in MM-DD-YYYY format"`, but `dateutil.parser.parse` accepts many formats (ISO 8601, European day-first, etc.). The validator does not enforce the specific `MM-DD-YYYY` pattern.
- **Why it matters:** API consumers may send dates in varying formats, producing inconsistent stored values.
- **Suggested resolution:** Either enforce the format strictly with `datetime.strptime(value, "%m-%d-%Y")` or update the description to reflect that multiple formats are accepted.

**Q6 — `CardSuit` docstring contains a typo**
- **Artifact:** `src/pydantic_models/app_models.py` line 85
- **Observation:** Docstring says `"Heartss"` (double-s) and attributes are described as `int` type but are actually `str`.
- **Why it matters:** Minor, but misleading for generated API documentation.
- **Suggested resolution:** Fix to `"Hearts"` and change type references from `int` to `str`.
