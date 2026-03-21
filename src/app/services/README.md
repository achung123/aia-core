# Services — `src/app/services/`

**Generated:** 2026-03-21
**Artifacts found:** 4 · **Documents generated:** 1

---

## Module Overview

This directory contains the **service layer** for AIA Core's card detection pipeline. Services encapsulate domain logic that sits between the HTTP route handlers (`src/app/routes/`) and the data layer (`src/app/database/`). The pipeline flows:

1. An image is uploaded via the API
2. **`CardDetector`** runs inference on the image, returning raw YOLO class indices, confidence scores, and bounding boxes
3. **`card_class_map`** translates YOLO class indices into AIA card notation strings (e.g., class `0` → `"10C"`, class `39` → `"AS"`)
4. **`PositionAssigner`** maps those bounding boxes to Texas Hold'em position labels (`flop_1`, `turn`, `hole_1`, etc.) using spatial heuristics
5. Results are stored in the database and returned for user confirmation

All services operate on the shared `DetectionResult` Pydantic model defined in `src/pydantic_models/app_models.py`.

---

## Discovery Manifest

| File | Classification | Template Used | Artifacts Found |
|---|---|---|---|
| `__init__.py` | Skipped | — | — |
| `card_class_map.py` | Utility Module | Concept Explainer | `class_id_to_card()`, `card_to_class_id()`, lookup tables |
| `card_detector.py` | Protocol + Stub | Concept Explainer | `CardDetector` protocol, `MockCardDetector` class |
| `position_assigner.py` | Service Class | Concept Explainer | `PositionAssigner` class |

---

## `card_class_map` — YOLO ↔ AIA Card Notation Mapping

**Module:** `src/app/services/card_class_map.py`
**Task:** T-003 (Create class label → AIA notation mapping)
**Story Ref:** S-1.1, S-2.3

Provides a bidirectional mapping between YOLO object-detection class indices (0–51) and AIA card notation strings. The YOLO class indices originate from the Roboflow "Playing Cards" dataset defined in `data/cards/data.yaml`, where 52 class names are sorted alphabetically (index 0 = "10 of clubs", index 51 = "queen of spades"). This module translates those indices into the compact AIA notation used throughout the rest of the system.

### AIA Card Notation

AIA notation concatenates a **rank** and a **suit** into a short string:

| Rank token | Cards | Suit token | Suit |
|---|---|---|---|
| `A` | Ace | `S` | Spades |
| `2`–`9` | Pip cards | `H` | Hearts |
| `10` | Ten | `D` | Diamonds |
| `J` | Jack | `C` | Clubs |
| `Q` | Queen | | |
| `K` | King | | |

**Examples:** `"AS"` (Ace of Spades), `"10C"` (Ten of Clubs), `"KH"` (King of Hearts), `"2D"` (Two of Diamonds).

> **Note:** The `10` rank produces a 3-character string (`"10C"`, `"10H"`, etc.) while all other ranks produce 2-character strings. Consumers must not assume a fixed string length.

### Data Source

The 52 class names are copied from `data/cards/data.yaml` and stored directly in the module as the `_CLASS_NAMES` list (line 37). The list is **alphabetically sorted** — this is the order YOLO uses to assign integer class indices during training and inference:

| Index | Dataset label | AIA notation |
|---|---|---|
| 0 | 10 of clubs | `10C` |
| 1 | 10 of diamonds | `10D` |
| 2 | 10 of hearts | `10H` |
| 3 | 10 of spades | `10S` |
| 4 | 2 of clubs | `2C` |
| … | … | … |
| 36 | ace of clubs | `AC` |
| 37 | ace of diamonds | `AD` |
| 38 | ace of hearts | `AH` |
| 39 | ace of spades | `AS` |
| 40 | jack of clubs | `JC` |
| … | … | … |
| 44 | king of clubs | `KC` |
| 48 | queen of clubs | `QC` |
| 51 | queen of spades | `QS` |

### Internal Lookup Tables

Two dictionaries are built once at **import time** (line 79–80) from `_CLASS_NAMES`:

| Table | Type | Key → Value | Example |
|---|---|---|---|
| `_ID_TO_CARD` | `dict[int, str]` | YOLO class index → AIA notation | `0 → "10C"` |
| `_CARD_TO_ID` | `dict[str, int]` | AIA notation → YOLO class index | `"AS" → 39` |

Both tables contain exactly 52 entries — one per card in a standard deck.

### Conversion Helpers

Two private maps drive the label-to-notation conversion (`_label_to_aia`, line 76):

| Map | Purpose | Example entry |
|---|---|---|
| `_RANK_MAP` (line 14) | Dataset rank word → AIA rank token | `"ace" → "A"`, `"10" → "10"` |
| `_SUIT_MAP` (line 29) | Dataset suit word → AIA suit letter | `"clubs" → "C"`, `"spades" → "S"` |

### Function: `class_id_to_card(class_id: int) -> str`

**Line:** 83

Returns the AIA notation string for a YOLO class index.

| Parameter | Type | Description |
|---|---|---|
| `class_id` | `int` | YOLO class index (must be 0–51 inclusive) |
| **Returns** | `str` | AIA card notation (e.g., `"10C"`, `"AS"`) |
| **Raises** | `ValueError` | If `class_id` is not in the range 0–51 |

```python
>>> class_id_to_card(0)
'10C'
>>> class_id_to_card(39)
'AS'
```

### Function: `card_to_class_id(card: str) -> int`

**Line:** 93

Returns the YOLO class index for an AIA notation string.

| Parameter | Type | Description |
|---|---|---|
| `card` | `str` | AIA card notation (e.g., `"10C"`, `"AS"`) — case-sensitive |
| **Returns** | `int` | YOLO class index (0–51) |
| **Raises** | `ValueError` | If `card` is not a valid AIA notation string |

```python
>>> card_to_class_id('AS')
39
>>> card_to_class_id('10C')
0
```

### Round-Trip Guarantee

For every valid class index `i` in 0–51:

```python
card_to_class_id(class_id_to_card(i)) == i  # always True
```

For every valid AIA notation string `c`:

```python
class_id_to_card(card_to_class_id(c)) == c  # always True
```

This is verified by the smoke test in `test/test_card_class_map.py`.

### Related

| Context | Location |
|---|---|
| Dataset class definitions | `data/cards/data.yaml` |
| Dataset documentation | `data/cards/README.md` |
| Unit tests | `test/test_card_class_map.py` |
| Spec: class label mapping | `specs/aia-card-recognition-002/spec.md` — S-1.1 |
| Spec: card normalization | `specs/aia-card-recognition-002/spec.md` — S-2.3 |
| Task: create mapping | `specs/aia-card-recognition-002/tasks.md` — T-003 |
| Planned consumer: `CardNormalizer` | `specs/aia-card-recognition-002/tasks.md` — T-010 |
| Planned consumer: `YOLOCardDetector` | `specs/aia-card-recognition-002/tasks.md` — T-011 |

---

## `CardDetector` Protocol

**Module:** `src/app/services/card_detector.py` (line 11)
**Type:** `typing.Protocol` (runtime-checkable)

Defines the interface for card detection from poker table images. Any implementation must provide a `detect(image_path: str) -> list[dict]` method.

### Method: `detect(image_path: str) -> list[DetectionResult]`

Detects cards in the given image and returns a list of `DetectionResult` objects with `detected_value`, `confidence`, and bounding box fields populated. The `card_position` field is left as `None` — position assignment is handled by `PositionAssigner` downstream.

| Field | Type | Description |
|---|---|---|
| `detected_value` | `str` | Card notation string (e.g., `"AS"`, `"10H"`) |
| `confidence` | `float` | Detection confidence score (0.0–1.0) |
| `bbox_x` | `float` | Bounding box X coordinate |
| `bbox_y` | `float` | Bounding box Y coordinate |
| `bbox_width` | `float` | Bounding box width |
| `bbox_height` | `float` | Bounding box height |
| `card_position` | `str \| None` | Always `None` from detector — set by `PositionAssigner` |

### Related

| Context | Location |
|---|---|
| Dependency injection | `src/app/routes/images.py` line 41 (`get_card_detector()`) |
| Route usage | `src/app/routes/images.py` line 140 |
| Spec: protocol evolution | `specs/aia-card-recognition-002/spec.md` — S-2.1 |

---

## `MockCardDetector`

**Module:** `src/app/services/card_detector.py` (line 23)
**Implements:** `CardDetector` protocol

Stub implementation that returns randomly-selected cards with plausible confidence values and bounding boxes. Used for development and testing when no trained YOLO model is available.

**Behavior:**
- Samples 5–9 unique cards from a standard 52-card deck per call
- Generates AIA notation strings directly (e.g., `"AS"`, `"10H"`) without using `card_class_map`
- Assigns random confidence scores in the range [0.75, 0.99]
- Generates random bounding box coordinates within plausible image regions
- Does **not** set `card_position` — that is handled by `PositionAssigner`

---

## `PositionAssigner`

**Module:** `src/app/services/position_assigner.py` (line 20)
**Spec:** S-3.1 (Position Assignment Heuristic), S-3.2 (Position Assignment Fallback)
**Task:** T-012, T-020

Assigns Texas Hold'em card position labels to detected card bounding boxes using spatial heuristics. This is the second stage of the detection pipeline, running after `CardDetector.detect()`.

### Constructor

```python
PositionAssigner(
    community_y_min: float = 0.0,
    community_y_max: float = 0.4,
    min_community_cards: int = 3,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `community_y_min` | `float` | `0.0` | Top boundary of the community card region (normalized Y coordinate) |
| `community_y_max` | `float` | `0.4` | Bottom boundary of the community card region (normalized Y coordinate) |
| `min_community_cards` | `int` | `3` | Minimum cards that must fall in the community region for the heuristic to assign community/hole positions; fewer triggers the fallback |

### Method: `assign(detections, image_width, image_height) -> list[DetectionResult]`

```python
def assign(
    self,
    detections: list[DetectionResult],
    image_width: int,
    image_height: int,
) -> list[DetectionResult]
```

Takes a list of `DetectionResult` objects (with bounding boxes populated, `card_position` as `None`) and returns a new list with `card_position` and `position_confidence` populated.

**Input:** Raw detections from `CardDetector.detect()` with bounding box fields (`bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`).

**Output:** New `DetectionResult` copies with `card_position` and `position_confidence` populated.

> **Note:** `image_width` and `image_height` are accepted as parameters but are not currently used by the heuristic — bounding box coordinates are expected to be in normalized (0.0–1.0) space. These parameters are reserved for future use (e.g., pixel-space coordinate conversion).

### Position Labels

Community cards are labeled using Texas Hold'em street names, in left-to-right dealing order:

| Position | Label | Street | Description |
|---|---|---|---|
| 1 | `flop_1` | Flop | First flop card (leftmost) |
| 2 | `flop_2` | Flop | Second flop card |
| 3 | `flop_3` | Flop | Third flop card |
| 4 | `turn` | Turn | Turn card (fourth community card) |
| 5 | `river` | River | River card (fifth community card) |

Hole cards are labeled sequentially left-to-right: `hole_1`, `hole_2`, `hole_3`, etc. In Texas Hold'em, each player receives exactly 2 hole cards; pairing hole cards to specific players is resolved during the user confirmation step, not by the assigner.

### Algorithm

1. **Partition** — For each detection, compute the bounding box center `(cx, cy)`. If `community_y_min <= cy <= community_y_max`, classify as community; otherwise classify as hole.
2. **Fallback check** — If fewer than `min_community_cards` (default: 3) detections fall in the community region, abandon the community/hole split. Return all detections sorted left-to-right with generic labels `card_1`, `card_2`, … and `position_confidence = "unassigned"`.
3. **Sort** — Sort community and hole groups independently by `cx` (left-to-right).
4. **Overflow cap** — If more than 5 detections are in the community region, keep the leftmost 5 as community and push overflow cards into the hole group (re-sorted).
5. **Label** — Assign `flop_1`–`river` to community cards (by index), `hole_1`–`hole_N` to hole cards (by index).
6. **Confidence** — For each detection, compute `position_confidence` based on distance from the community boundary (`community_y_max`):
   - `"low"` if the center Y is within `_BOUNDARY_MARGIN` (0.05) of the boundary
   - `"high"` otherwise

### Position Confidence Values

| Value | Meaning |
|---|---|
| `"high"` | Card center is well within its assigned region (> 0.05 from boundary) |
| `"low"` | Card center is near the community/hole boundary (within 0.05) — may be misclassified |
| `"unassigned"` | Fallback mode — not enough community cards to determine layout; all positions are generic |

### Example

Given 7 detections from a standard poker table image:

```
Community region (y: 0.0–0.4):
  cx=0.2 → flop_1    cx=0.35 → flop_2    cx=0.5 → flop_3
  cx=0.65 → turn     cx=0.8 → river

Hole region (y: > 0.4):
  cx=0.3 → hole_1    cx=0.7 → hole_2
```

### Module Constants

| Constant | Value | Description |
|---|---|---|
| `_BOUNDARY_MARGIN` | `0.05` | Y-distance threshold for `"low"` vs `"high"` confidence |
| `_COMMUNITY_LABELS` | `["flop_1", "flop_2", "flop_3", "turn", "river"]` | Ordered community card labels |
| `_MAX_COMMUNITY` | `5` | Maximum community cards in Texas Hold'em |

### Related

| Context | Location |
|---|---|
| `DetectionResult` model (input/output) | `src/pydantic_models/app_models.py` line 10 |
| Unit tests | `test/test_position_assigner.py` |
| Spec: heuristic requirements | `specs/aia-card-recognition-002/spec.md` — S-3.1 |
| Spec: fallback behavior | `specs/aia-card-recognition-002/spec.md` — S-3.2 |
| Task: implementation | `specs/aia-card-recognition-002/tasks.md` — T-012 |
| Task: street label fix | `specs/aia-card-recognition-002/tasks.md` — T-020 |
| Pipeline orchestration (planned) | `specs/aia-card-recognition-002/spec.md` — S-4.1 |

---

## Pipeline Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Image       │     │  CardDetector     │     │  card_class_map │     │  Position   │
│  Upload      │────▶│  .detect()        │────▶│  class_id →     │────▶│  Assigner   │────▶ Store & Return
│  (route)     │     │  (raw detections) │     │  AIA notation   │     │  .assign()  │
└──────────────┘     └──────────────────┘     └─────────────────┘     └─────────────┘
                      Returns:                  Translates:            Populates:
                      - class_id (YOLO)         - "10C", "AS", …      - card_position
                      - confidence              (detected_value)       - position_confidence
                      - bbox_x/y/w/h
```

> **Note:** In the current implementation (`MockCardDetector`), card notation strings are generated directly by the detector, so the `card_class_map` translation step is not yet wired into the pipeline. When `YOLOCardDetector` (T-011) is implemented, it will call `class_id_to_card()` to convert raw YOLO class indices to AIA notation as part of its `detect()` method. The `CardNormalizer` service (T-010) will consume `card_class_map` as its core dependency.

**Current state:** `CardDetector` uses `MockCardDetector` (random results). `card_class_map` is complete (T-003) and ready for use by `YOLOCardDetector` and `CardNormalizer`. `PositionAssigner` is complete with Texas Hold'em street labels. The YOLO-based `YOLOCardDetector` (T-011), `CardNormalizer` (T-010), and pipeline wiring (T-014) are pending.

---

## Open Questions

**Q1 — `card_class_map` hardcodes class names instead of reading from `data.yaml`**
- **Artifact:** `src/app/services/card_class_map.py` lines 37–88
- **Observation:** The 52 class names are duplicated as a Python list (`_CLASS_NAMES`) rather than loaded from `data/cards/data.yaml` at runtime. If the dataset is updated (e.g., re-exported from Roboflow with different class ordering), the module must be manually updated to match.
- **Why it matters:** Drift between `data.yaml` and `_CLASS_NAMES` would cause silent misclassification — YOLO would assign class indices according to `data.yaml` but the mapping would translate them using the stale list. The alphabetical sort is an implicit convention, not enforced.
- **Suggested resolution:** Acceptable for MVP since the dataset is stable and the hardcoded list matches `data.yaml` exactly. For robustness, a future enhancement could load from `data.yaml` at startup or add a CI check that verifies the two match.

**Q2 — `card_class_map` does not validate input casing**
- **Artifact:** `src/app/services/card_class_map.py` line 93 (`card_to_class_id`)
- **Observation:** `card_to_class_id("as")` raises `ValueError` — AIA notation is case-sensitive (`"AS"` is valid, `"as"` is not). There is no normalization or helpful error message indicating the casing requirement.
- **Why it matters:** Front-end consumers or CSV uploads may send lowercase card strings. The error message `"Unknown card notation: 'as'"` does not hint that `"AS"` would work.
- **Suggested resolution:** Either normalize input with `.upper()` before lookup, or include valid notation examples in the `ValueError` message.

**Q3 — `PositionAssigner` does not use `image_width` / `image_height` parameters**
- **Artifact:** `src/app/services/position_assigner.py` lines 43–46
- **Observation:** The `assign()` method accepts `image_width` and `image_height` parameters but never references them. The heuristic operates on raw bounding box coordinates, implying they must be pre-normalized to 0.0–1.0 range.
- **Why it matters:** If bounding boxes arrive in pixel coordinates (as the `DetectionResult` model's field descriptions suggest), the heuristic will produce incorrect results. The pipeline needs a clear contract on coordinate space.
- **Suggested resolution:** Either (a) document that callers must normalize coordinates before calling `assign()`, or (b) add normalization inside `assign()` using the image dimensions, e.g., `cy = (det.bbox_y + det.bbox_height / 2) / image_height`.

**Q4 — Confidence heuristic only considers Y-distance, not X-spread**
- **Artifact:** `src/app/services/position_assigner.py` lines 99–103
- **Observation:** `_confidence()` computes distance from `community_y_max` only. It does not consider whether community cards have a consistent X-spacing (gap between `flop_3` and `turn` is typically larger than between flop cards), which could further validate correct street assignment.
- **Why it matters:** A card that is clearly in the Y community zone but anomalously positioned in X (e.g., far-right outlier that should be `river` but is mislabeled as `flop_3` due to fewer detections) gets `"high"` confidence despite potential mislabeling.
- **Suggested resolution:** Consider a secondary confidence signal based on X-gap analysis between flop and turn/river cards, or document this as a known limitation acceptable for MVP.

**Q5 — `_BOUNDARY_MARGIN` is hardcoded, not configurable**
- **Artifact:** `src/app/services/position_assigner.py` line 13
- **Observation:** The 0.05 margin for low vs. high confidence is a module-level constant, unlike the community Y bounds which are constructor parameters. Different camera angles or table layouts may need different margin thresholds.
- **Why it matters:** Low impact for MVP, but limits tuning for different setups without code changes.
- **Suggested resolution:** Promote `boundary_margin` to a constructor parameter with a default of `0.05`, matching the pattern of the other configurable thresholds.
