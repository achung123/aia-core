# Spec — AIA Card Recognition System

**Project ID:** aia-card-recognition-002
**Date:** 2026-03-13
**Status:** Draft
**Scope:** Phase 2 — real card detection pipeline replacing the mock detector, integrated into the existing AIA Core backend

---

## Table of Contents

1. [Epic 1: Model Training Infrastructure](#epic-1-model-training-infrastructure)
2. [Epic 2: Card Detection Service](#epic-2-card-detection-service)
3. [Epic 3: Spatial Position Assignment](#epic-3-spatial-position-assignment)
4. [Epic 4: Backend Integration](#epic-4-backend-integration)
5. [Epic 5: Testing & Validation](#epic-5-testing--validation)

---

## Epic 1: Model Training Infrastructure

Set up the dataset, training pipeline, and evaluation tooling to produce a YOLOv8 model that can detect and classify standard playing cards in poker table images.

### S-1.1 — Dataset Acquisition & Preparation

**As a** developer, **I want** a labeled playing card detection dataset in YOLO format, **so that** I can train a model to detect and classify all 52 standard cards.

**Acceptance Criteria:**
1. The "Playing Cards" dataset by Augmented Startups is downloaded from Roboflow Universe (https://universe.roboflow.com/augmented-startups/playing-cards-ow27d) using the Roboflow Python SDK in YOLOv8 format
2. The dataset has at least 52 classes (one per card: `AS`, `2H`, `KD`, etc.) using the project's rank+suit notation
3. Class labels are mapped to AIA's card notation format (rank + suit, e.g. `AH`, `10S`, `KD`)
4. The dataset is split into train/val/test partitions (minimum 70/20/10)
5. A `data.yaml` configuration file is created pointing to the dataset paths and class names
6. A README documents the dataset source, license, size, and any preprocessing applied

### S-1.2 — YOLO Training Pipeline

**As a** developer, **I want** a reproducible training script that fine-tunes YOLOv8 on the card dataset, **so that** I can iterate on model quality.

**Acceptance Criteria:**
1. A training script exists in `scripts/` that loads the dataset config and trains a YOLOv8 model
2. Training hyperparameters (epochs, batch size, image size, learning rate) are configurable via CLI arguments or a config file
3. Training outputs (weights, metrics, sample predictions) are saved to a `runs/` directory
4. The script can resume from a checkpoint
5. The script prints final mAP@50 and mAP@50-95 metrics on the validation set

### S-1.3 — Model Evaluation & Export

**As a** developer, **I want** to evaluate the trained model and export it for production inference, **so that** I can verify quality before deployment.

**Acceptance Criteria:**
1. An evaluation script runs the model on the test split and reports per-class precision, recall, and mAP
2. The model achieves a minimum mAP@50 of 0.80 on the test set (adjustable threshold)
3. The trained model is exported to a format loadable by Ultralytics at inference time (`.pt` weights file)
4. The exported model file is stored in a `models/` directory with a versioned filename (e.g., `card_detector_v1.pt`)
5. A model card (README) documents: training dataset, architecture, metrics, export format, and known limitations

---

## Epic 2: Card Detection Service

Replace the mock card detector with a real YOLO-based detection service that finds and classifies an arbitrary number of playing cards in an image.

### S-2.1 — Evolve CardDetector Protocol

**As a** developer, **I want** the `CardDetector` protocol to support arbitrary-count detection with bounding boxes, **so that** the interface accommodates real detection results.

**Acceptance Criteria:**
1. The `CardDetector` protocol's `detect` method returns a list of detection results, where each result includes: `detected_value` (card string), `confidence` (float 0.0–1.0), `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`
2. The result list length is variable — the detector returns however many cards it finds (0 to N)
3. Results no longer include `card_position` — position assignment is a separate downstream step
4. The protocol is backwards-compatible: `MockCardDetector` is updated to match the new signature
5. A Pydantic model (e.g., `DetectionResult`) defines the shape of each detection result for type safety

### S-2.2 — YOLO Card Detector Implementation

**As a** developer, **I want** a `YOLOCardDetector` class that loads a trained YOLOv8 model and detects cards in images, **so that** real inference replaces the mock stub.

**Acceptance Criteria:**
1. `YOLOCardDetector` implements the `CardDetector` protocol
2. It loads a `.pt` model file from a configurable path (default: `models/card_detector_v1.pt`)
3. It accepts an image file path, runs YOLO inference, and returns a list of `DetectionResult` objects
4. Each result maps a YOLO class ID to the AIA card notation string (e.g., class `0` → `"AS"`)
5. A confidence threshold parameter filters out low-confidence detections (default: 0.5, configurable)
6. The detector handles missing model file gracefully with a clear error message
7. The detector handles corrupt or unreadable images gracefully without crashing

### S-2.3 — Card Notation Normalizer

**As a** developer, **I want** detected card values to be normalized to AIA's canonical notation, **so that** detection output is consistent with the rest of the system.

**Acceptance Criteria:**
1. YOLO class names are mapped to AIA notation: rank (`A`, `2`–`10`, `J`, `Q`, `K`) + suit (`S`, `H`, `D`, `C`)
2. The mapping handles any reasonable dataset label format (e.g., `"ace_of_spades"` → `"AS"`, `"10h"` → `"10H"`)
3. Invalid or unmappable class names raise a clear error rather than silently producing bad data
4. The normalizer is a pure function with no side effects, easily testable in isolation

---

## Epic 3: Spatial Position Assignment

Use bounding box coordinates to assign logical card positions based on spatial layout heuristics, mapping to Texas Hold'em dealing structure.

In Texas Hold'em, cards on the table fall into two categories:

- **Community cards** — dealt face-up in the center of the table in three stages: the **Flop** (3 cards), the **Turn** (1 card), and the **River** (1 card), for a maximum of 5 community cards. A hand may end before all streets are dealt (e.g., only the flop may be present).
- **Hole cards** — exactly **2 private cards** dealt to each player, typically positioned near that player's seat.

The position assigner maps detected card bounding boxes to these game-specific slots: `flop_1`, `flop_2`, `flop_3`, `turn`, `river` for community cards, and `hole_1`, `hole_2`, … for player hole cards.

### S-3.1 — Position Assignment Heuristic

**As a** developer, **I want** detected cards to be assigned logical positions based on their spatial location in the image, **so that** the system can distinguish community board cards (flop, turn, river) from each player's 2 private hole cards.

**Acceptance Criteria:**
1. A `PositionAssigner` service takes a list of detection results (with bounding boxes) and returns the same list annotated with `card_position` labels using Texas Hold'em street names
2. Cards are sorted left-to-right by `bbox_x` coordinate
3. Community cards are identified as a spatial cluster (cards in a row near the center/top of the image) and labeled using Texas Hold'em street names left-to-right: `flop_1`, `flop_2`, `flop_3`, `turn`, `river` — capped at 5 (any extras in the community zone overflow to hole cards)
4. Remaining cards are labeled as hole cards (`hole_1`, `hole_2`, etc.) in left-to-right order. In Texas Hold'em each player has exactly 2 hole cards; pairing is resolved during the user confirm step.
5. The heuristic is configurable: parameters for community card region bounds (y-range, x-range) and clustering thresholds can be tuned
6. When fewer than 3 community cards are detected (i.e., not enough for a flop), the assigner does not force a community/hole split — all cards are returned as unassigned with positions like `card_1`, `card_2`, etc., and the user assigns positions during the confirm step

### S-3.2 — Position Assignment Fallback

**As a** developer, **I want** the system to handle ambiguous layouts gracefully, **so that** detection still works when the spatial heuristic can't determine positions confidently.

**Acceptance Criteria:**
1. When the heuristic cannot confidently assign community vs. hole card positions, all cards are returned with generic positional labels (`card_1`, `card_2`, ...) sorted left-to-right
2. The detection results endpoint response includes a `position_confidence` field (`"high"`, `"low"`, or `"unassigned"`) indicating whether the spatial assignment is confident
3. The confirm endpoint accepts user-provided position overrides regardless of auto-assigned positions

---

## Epic 4: Backend Integration

Wire the real detection pipeline into the existing FastAPI endpoints, updating the image upload and detection flow to use YOLO inference and spatial assignment.

### S-4.1 — Detection Pipeline Orchestration

**As a** developer, **I want** the image upload flow to run YOLO detection followed by position assignment, **so that** detection results are ready for user review immediately after upload.

**Acceptance Criteria:**
1. When `GET /games/{game_id}/hands/image/{upload_id}` triggers detection, it calls `YOLOCardDetector.detect()` followed by `PositionAssigner.assign()`
2. Detection results are stored as `CardDetection` rows with populated `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` fields
3. The `card_position` field is populated by the position assigner (or `"unassigned"` for ambiguous cases)
4. The upload status transitions: `"processing"` → `"detected"` (success) or `"failed"` (error)
5. Detection errors are caught and logged; the upload status is set to `"failed"` with an error detail

### S-4.2 — Updated Detection Results Response

**As a** developer, **I want** the detection results endpoint to return bounding boxes and position confidence, **so that** the front-end can render detection overlays.

**Acceptance Criteria:**
1. `GET /games/{game_id}/hands/image/{upload_id}` response includes `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` for each detection (already in schema but now populated with real values)
2. Response includes a `position_confidence` field per detection
3. Response includes a top-level `card_count` field with the total number of detected cards
4. Bounding box coordinates are in pixel units relative to the original uploaded image dimensions
5. Response includes `image_width` and `image_height` fields so the front-end can scale bounding boxes

### S-4.3 — Dynamic Card Count in Confirm Endpoint

**As a** developer, **I want** the confirm endpoint to accept a variable number of cards, **so that** it works with any number of detected cards rather than a fixed 7.

**Acceptance Criteria:**
1. `POST /games/{game_id}/hands/image/{upload_id}/confirm` accepts community cards and player hands as before, but the total card count is not fixed
2. Community cards: `flop_1`, `flop_2`, `flop_3` are required; `turn` and `river` remain optional (this is unchanged)
3. Player hands: 0 or more player entries are accepted, each with exactly 2 hole cards
4. If detected cards don't cleanly map to community + hole cards, the user's confirmed values take precedence
5. Card duplicate validation runs on the full confirmed set as before

### S-4.4 — Detector Dependency Injection & Configuration

**As a** developer, **I want** the card detector to be configured via environment variables and injected via FastAPI's dependency system, **so that** the mock and real detectors are swappable.

**Acceptance Criteria:**
1. An environment variable `CARD_DETECTOR_BACKEND` controls which detector is used: `"yolo"` (default) or `"mock"`
2. An environment variable `CARD_DETECTOR_MODEL_PATH` sets the model file path (default: `models/card_detector_v1.pt`)
3. An environment variable `CARD_DETECTOR_CONFIDENCE` sets the minimum confidence threshold (default: `0.5`)
4. The `get_card_detector()` FastAPI dependency reads these variables and returns the appropriate detector instance
5. If `CARD_DETECTOR_BACKEND=yolo` but the model file is missing, the app fails fast at startup with a clear error message

---

## Epic 5: Testing & Validation

Verify the full pipeline end-to-end using the test image and mock/real detectors, ensuring correctness and regression safety.

### S-5.1 — Unit Tests for Detection Service

**As a** developer, **I want** unit tests for the YOLO detector, notation normalizer, and position assigner, **so that** each component is verified in isolation.

**Acceptance Criteria:**
1. Tests for `YOLOCardDetector`: verify it returns a list of `DetectionResult` objects, handles missing model file, handles corrupt image
2. Tests for card notation normalizer: verify correct mapping for all 52 cards, error on invalid input
3. Tests for `PositionAssigner`: verify left-to-right sorting, community vs. hole card assignment, fallback to generic positions
4. All tests use fixtures or mocks — no real model inference required in unit tests
5. Tests pass with `pytest` from the project root

### S-5.2 — Integration Test with Test Image

**As a** developer, **I want** an integration test that runs the full detection pipeline on `test/data/hand.jpg`, **so that** the end-to-end flow is validated against a real image.

**Acceptance Criteria:**
1. A test loads `test/data/hand.jpg` and runs it through `YOLOCardDetector` (with a real or fixture model)
2. The test verifies that detected cards are valid AIA card notation strings
3. The test verifies that bounding boxes have positive width/height and are within image bounds
4. The test verifies that confidence scores are in `[0.0, 1.0]`
5. The test is marked with a `@pytest.mark.integration` marker so it can be skipped when no model is available

### S-5.3 — End-to-End API Pipeline Test

**As a** developer, **I want** an end-to-end test covering upload → detect → confirm, **so that** the complete API workflow is verified.

**Acceptance Criteria:**
1. Test uploads `test/data/hand.jpg` via `POST /games/{game_id}/hands/image`
2. Test retrieves detection results via `GET /games/{game_id}/hands/image/{upload_id}` and verifies detections are returned
3. Test confirms detections via `POST /games/{game_id}/hands/image/{upload_id}/confirm` and verifies a Hand record is created
4. Test uses the `MockCardDetector` (or a fixture detector) for CI reliability — real model tests are integration-only
5. Test verifies the full database state: `ImageUpload`, `CardDetection`, `Hand`, `PlayerHand` records all exist with correct relationships
