# Plan — AIA Card Recognition System

**Project ID:** aia-card-recognition-002
**Date:** 2026-03-13
**Status:** Draft
**Scope:** Phase 2 — real card detection pipeline replacing the mock detector

---

## Overview

Replace the existing `MockCardDetector` stub with a real YOLOv8-based card detection and classification pipeline for **Texas Hold'em** poker.

In Texas Hold'em, each hand involves two categories of cards:

- **Community cards** (shared by all players) — dealt face-up in three stages:
  - **Flop**: 3 cards dealt together
  - **Turn**: 1 card dealt after the flop
  - **River**: 1 card dealt after the turn
  - Maximum of 5 community cards per hand; a hand may end before all community cards are dealt.
- **Hole cards** (private per player) — exactly **2 cards** dealt face-down to each player at the start of the hand.

The system accepts an image containing an arbitrary number of playing cards, detects each card's bounding box and identity (rank + suit), assigns logical positions using spatial heuristics that map to the Texas Hold'em dealing structure (`flop_1`, `flop_2`, `flop_3`, `turn`, `river` for community cards; `hole_1`, `hole_2` per player for hole cards), and returns results through the existing FastAPI endpoints. Everything runs in-process for local deployment; the architecture is designed for extraction to a separate inference service in Phase 3.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python 3.12 | Runtime — already in use |
| FastAPI | API framework — already in use |
| SQLAlchemy 2.x | ORM — already in use |
| Ultralytics (`ultralytics`) | YOLOv8 training, inference, and model export. **Note:** YOLO is not in torchvision — Ultralytics is the canonical library. It depends on PyTorch internally. |
| PyTorch (`torch`) | Pulled in as a transitive dependency of Ultralytics; available for any custom preprocessing if needed |
| Roboflow Universe | Source dataset: "Playing Cards" by Augmented Startups (https://universe.roboflow.com/augmented-startups/playing-cards-ow27d) — downloaded via Roboflow Python SDK in YOLOv8 format |
| Pillow (`Pillow`) | Image loading, validation, and dimension extraction — already listed in Phase 1 plan |
| Pydantic v2 | Request/response models and detection result typing — already in use |
| Pytest | Testing — already in use |
| Ruff | Linting — already in use |

---

## Architecture Components

### YOLO Detection Engine (`src/app/services/card_detector.py`)

The core inference component. Loads a trained YOLOv8 `.pt` weights file via `ultralytics.YOLO` and runs detection on an input image. Returns raw detections: bounding boxes, class IDs, and confidence scores. The `CardDetector` protocol is evolved to drop `card_position` from its output — position assignment is now a separate concern.

**Key classes:**
- `CardDetector` (Protocol) — updated interface returning `list[DetectionResult]`
- `YOLOCardDetector` — real implementation loading and running the YOLO model
- `MockCardDetector` — updated stub matching the new protocol, used in tests and as a fallback

### Card Notation Normalizer (`src/app/services/card_normalizer.py`)

A pure-function mapping layer that translates YOLO class names (which come from the training dataset's label vocabulary) into AIA's canonical card notation (`"AS"`, `"10H"`, `"KD"`, etc.). This is isolated so that switching datasets only requires updating the mapping table, not the detector or any downstream code.

### Spatial Position Assigner (`src/app/services/position_assigner.py`)

Takes a list of detected cards with bounding boxes and assigns logical `card_position` labels based on spatial layout, mapping to the Texas Hold'em dealing structure. In a standard poker table photograph, community cards appear as a horizontal row in the upper-center of the image, while each player's 2 hole cards are positioned below or around the edges. The assigner uses these spatial cues to classify detections into community vs. hole card groups and label them with the appropriate street names.

The heuristic:
1. Sort all detections left-to-right by `bbox_x`
2. Identify a "community row" — cards clustered in the upper-center region of the image within configurable y-bounds
3. Within the community row, assign positions using Texas Hold'em street names left-to-right: `flop_1`, `flop_2`, `flop_3`, `turn`, `river` (max 5 community cards; any overflow is reclassified as hole cards)
4. Remaining cards are assigned `hole_1`, `hole_2`, etc. left-to-right (each player has exactly 2 hole cards in Texas Hold'em; pairing is resolved during the user confirm step)
5. If fewer than 3 cards are found in the community region (i.e., not enough for a flop), all cards get generic labels (`card_1`, `card_2`, ...) and the user assigns positions during the confirm step

### Detection Pipeline Orchestrator

The glue code in the route handler that runs the three components in sequence:
1. `YOLOCardDetector.detect(image_path)` → raw detections
2. `CardNormalizer.normalize(detections)` → AIA-notation detections
3. `PositionAssigner.assign(detections)` → position-labeled detections
4. Store results as `CardDetection` rows

### Configuration Layer

Environment-variable-driven configuration:
- `CARD_DETECTOR_BACKEND` — `"yolo"` (default) or `"mock"`
- `CARD_DETECTOR_MODEL_PATH` — path to `.pt` file (default: `models/card_detector_v1.pt`)
- `CARD_DETECTOR_CONFIDENCE` — minimum confidence threshold (default: `0.5`)

### Training Pipeline (`scripts/`)

Offline scripts (not part of the runtime service) for dataset preparation, model training, evaluation, and export. Outputs a `.pt` weights file consumed by the detection engine.

---

## Data Flow

```
                                         ┌──────────────┐
  Upload Image ──► Store File ──────────►│ YOLO Detect  │
  POST .../image   uploads/{game_id}/    │  (N cards)   │
                                         └──────┬───────┘
                                                │
                                    list[DetectionResult]
                                    (value, confidence, bbox)
                                                │
                                         ┌──────┴───────┐
                                         │  Normalize   │
                                         │  Card Names  │
                                         └──────┬───────┘
                                                │
                                         ┌──────┴───────┐
                                         │  Assign      │
                                         │  Positions   │
                                         └──────┬───────┘
                                                │
                                    list[DetectionResult]
                                    (+ card_position, position_confidence)
                                                │
                                         ┌──────┴───────┐
                                         │  Store as    │
                                         │  CardDetection│
                                         │  rows in DB  │
                                         └──────┬───────┘
                                                │
                            GET .../image/{id} ◄┘
                            (user reviews detections)
                                                │
                            POST .../confirm ───┘
                            (user confirms / corrects → Hand + PlayerHand created)
```

---

## Project Phases

### Phase A: Training Infrastructure

Set up the dataset, training script, and evaluation pipeline. This phase produces the `.pt` model file consumed by Phase B.

**Deliverables:**
- Roboflow "Playing Cards" dataset (Augmented Startups) downloaded and prepared in YOLOv8 format with 52 card classes
- `data.yaml` dataset configuration
- `scripts/train_model.py` — configurable training script
- `scripts/evaluate_model.py` — test-set evaluation with per-class metrics
- Trained model weights at `models/card_detector_v1.pt`
- Model card documenting dataset, metrics, and known limitations

### Phase B: Detection Service

Build the three core service components and wire them together.

**Deliverables:**
- Evolved `CardDetector` protocol and `DetectionResult` Pydantic model
- `YOLOCardDetector` implementation
- `CardNormalizer` mapping layer
- `PositionAssigner` spatial heuristic
- Updated `MockCardDetector` matching new protocol
- Unit tests for all components

### Phase C: Backend Integration

Update the existing FastAPI endpoints and dependency injection to use the real detection pipeline.

**Deliverables:**
- Updated `get_card_detector()` dependency with environment variable configuration
- Updated detection results endpoint response (bbox data, position confidence, image dimensions)
- Updated confirm endpoint for dynamic card counts
- Integration test with `test/data/hand.jpg`
- End-to-end API pipeline test

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YOLO model too large for in-process inference on local machines | Start with YOLOv8n (nano) or YOLOv8s (small) — smallest variants. Upgrade model size in Phase 3 when separate compute is available. |
| Pre-existing dataset doesn't match real poker table photos | Use dataset as a starting point; the correction feedback loop (already implemented in Phase 1) collects retraining data from real usage |
| Dataset class labels don't map cleanly to AIA notation | The `CardNormalizer` is an isolated mapping layer — dataset-specific label quirks are handled there without touching the detector or downstream code |
| Spatial position heuristic fails on non-standard card layouts | The heuristic falls back to generic positions (`card_1`, `card_2`, ...) and the user assigns positions during the confirm step; no data is lost |
| `ultralytics` + `torch` add significant dependency weight | Acceptable for local deployment. In Phase 3, these dependencies move to the inference service container and the FastAPI backend stays lightweight |
| Model inference blocks the FastAPI event loop | Run inference in a thread pool executor (`asyncio.to_thread`) or use FastAPI's `BackgroundTasks` — the endpoint can return immediately and poll for results |
| Test image `test/data/hand.jpg` may not be representative | Use it as a smoke test; add more test images over time. Integration tests are gated behind `@pytest.mark.integration` so they don't slow CI. |

---

## External Dependencies

- **Ultralytics** (`ultralytics` PyPI package) — YOLOv8 training and inference runtime
- **PyTorch** (`torch`, `torchvision`) — transitive dependency of Ultralytics
- **Playing card dataset** — "Playing Cards" by Augmented Startups from Roboflow Universe (https://universe.roboflow.com/augmented-startups/playing-cards-ow27d), downloaded via Roboflow Python SDK in YOLOv8 format
- **Pillow** (`Pillow`) — image loading and dimension extraction (already a transitive dep of several existing packages)
