# Services — `src/app/services/`

**Generated:** 2026-03-13
**Artifacts found:** 3 · **Documents generated:** 1

---

## Module Overview

This directory contains the **service layer** for AIA Core's card detection pipeline. Services encapsulate domain logic that sits between the HTTP route handlers (`src/app/routes/`) and the data layer (`src/app/database/`). The pipeline flows:

1. An image is uploaded via the API
2. **`CardDetector`** runs inference on the image, returning raw detection results (card value, confidence, bounding box)
3. **`PositionAssigner`** maps those bounding boxes to Texas Hold'em position labels (`flop_1`, `turn`, `hole_1`, etc.) using spatial heuristics
4. Results are stored in the database and returned for user confirmation

All services operate on the shared `DetectionResult` Pydantic model defined in `src/pydantic_models/app_models.py`.

---

## Discovery Manifest

| File | Classification | Template Used | Artifacts Found |
|---|---|---|---|
| `__init__.py` | Skipped | — | — |
| `card_detector.py` | Protocol + Stub | Concept Explainer | `CardDetector` protocol, `MockCardDetector` class |
| `position_assigner.py` | Service Class | Concept Explainer | `PositionAssigner` class |

---

## `CardDetector` Protocol

**Module:** `src/app/services/card_detector.py` (line 11)
**Type:** `typing.Protocol` (runtime-checkable)

Defines the interface for card detection from poker table images. Any implementation must provide a `detect(image_path: str) -> list[dict]` method.

### Method: `detect(image_path: str) -> list[dict]`

Detects cards in the given image and returns a list of dicts with keys:

| Key | Type | Description |
|---|---|---|
| `card_position` | `str` | Position label (e.g., `"community_1"`, `"hole_1"`) |
| `detected_value` | `str` | Card notation string (e.g., `"AS"`, `"10H"`) |
| `confidence` | `float` | Detection confidence score (0.0–1.0) |

> **Note:** The current protocol returns `list[dict]`. Per spec task T-009 (`specs/aia-card-recognition-002/tasks.md`), this will be updated to return `list[DetectionResult]` and the `card_position` key will be removed from detector output — position assignment is handled by `PositionAssigner` downstream.

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

Stub implementation that returns 7 randomly-selected cards with plausible confidence values. Used for development and testing when no trained YOLO model is available.

**Behavior:**
- Samples 7 unique cards from a standard 52-card deck
- Assigns fixed position labels: `community_1`–`community_5`, `hole_1`, `hole_2`
- Generates random confidence scores in the range [0.75, 0.99]

> **Note:** `MockCardDetector` still uses the legacy `community_N` position labels. When T-009 is completed, position labels will be removed from detector output entirely — the `PositionAssigner` handles position assignment using bounding box geometry.

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
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Image       │     │  CardDetector     │     │  Position   │
│  Upload      │────▶│  .detect()        │────▶│  Assigner   │────▶ Store & Return
│  (route)     │     │  (raw detections) │     │  .assign()  │
└──────────────┘     └──────────────────┘     └─────────────┘
                      Returns:                  Populates:
                      - detected_value          - card_position
                      - confidence              - position_confidence
                      - bbox_x/y/w/h
```

**Current state:** `CardDetector` uses `MockCardDetector` (random results). `PositionAssigner` is complete with Texas Hold'em street labels. The YOLO-based `YOLOCardDetector` (T-011) and pipeline wiring (T-014) are pending.

---

## Open Questions

**Q1 — `CardDetector` protocol returns `list[dict]` instead of `list[DetectionResult]`**
- **Artifact:** `src/app/services/card_detector.py` line 13
- **Observation:** The `CardDetector.detect()` protocol signature returns `list[dict]`, but `PositionAssigner.assign()` expects `list[DetectionResult]`. These two services cannot be chained directly without constructing `DetectionResult` objects in between.
- **Why it matters:** The pipeline orchestration (S-4.1) requires `detect() → assign()` to compose cleanly. Currently the route handler in `images.py` would need to manually convert dicts to `DetectionResult` objects.
- **Suggested resolution:** Complete T-009 — update the `CardDetector` protocol to return `list[DetectionResult]` and update `MockCardDetector` accordingly.

**Q2 — `MockCardDetector` still uses legacy `community_N` position labels**
- **Artifact:** `src/app/services/card_detector.py` lines 36–42
- **Observation:** `MockCardDetector` hardcodes position labels `community_1`–`community_5`, which conflict with the now-implemented Texas Hold'em labels (`flop_1`, `flop_2`, `flop_3`, `turn`, `river`).
- **Why it matters:** Once position assignment moves to `PositionAssigner` (T-009), the mock detector should not assign positions at all. In the interim, the inconsistent labels could confuse tests or front-end code that expects the new naming.
- **Suggested resolution:** Remove `card_position` from `MockCardDetector` output as part of T-009, or update the labels to match the new naming convention as a stopgap.

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
