# Tasks — AIA Card Recognition System

**Project ID:** aia-card-recognition-002
**Date:** 2026-03-13
**Total Tasks:** 20
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Add ML dependencies to project | setup | none | — |
| T-002 | Source and prepare card detection dataset | setup | none | S-1.1 |
| T-003 | Create class label → AIA notation mapping | feature | T-002 | S-1.1, S-2.3 |
| T-004 | Create YOLO training script | feature | T-001, T-002 | S-1.2 |
| T-005 | Train YOLOv8 model on card dataset | feature | T-004 | S-1.2 |
| T-006 | Create model evaluation script | feature | T-005 | S-1.3 |
| T-007 | Export model and write model card | docs | T-005, T-006 | S-1.3 |
| T-008 | Define DetectionResult Pydantic model | feature | none | S-2.1 |
| T-009 | Evolve CardDetector protocol and update MockCardDetector | refactor | T-008 | S-2.1 |
| T-010 | Implement CardNormalizer service | feature | T-003 | S-2.3 |
| T-011 | Implement YOLOCardDetector service | feature | T-001, T-009, T-010 | S-2.2 |
| T-012 | Implement PositionAssigner service | feature | T-008 | S-3.1, S-3.2 |
| T-013 | Add detector configuration and dependency injection | feature | T-011 | S-4.4 |
| T-014 | Update detection results endpoint response | feature | T-011, T-012, T-013 | S-4.1, S-4.2 |
| T-015 | Update confirm detection endpoint for dynamic card count | feature | T-009 | S-4.3 |
| T-016 | Unit tests for CardNormalizer | test | T-010 | S-5.1 |
| T-017 | Unit tests for PositionAssigner | test | T-012 | S-5.1 |
| T-018 | Unit tests for YOLOCardDetector | test | T-011 | S-5.1 |
| T-019 | Integration + E2E pipeline tests | test | T-014, T-015 | S-5.2, S-5.3 |
| T-020 | Fix PositionAssigner to use Texas Hold'em street labels | bug | T-012 | S-3.1 |

---

## Task Details

### T-001 — Add ML dependencies to project

**Category:** setup
**Dependencies:** none
**Story Ref:** —

Add `ultralytics`, `torch`, `torchvision`, and `Pillow` to `pyproject.toml` as dependencies. Verify they install cleanly in the existing virtualenv. Add a `ml` dependency group so ML deps can be installed separately from the core backend if needed.

**Acceptance Criteria:**
1. `pyproject.toml` includes `ultralytics` and `Pillow` in a `[dependency-groups] ml` group
2. `uv sync --group ml` (or equivalent) installs all ML dependencies without conflicts
3. `python -c "from ultralytics import YOLO; print('OK')"` succeeds in the virtualenv
4. Existing tests still pass (ML deps don't break anything)

---

### T-002 — Source and prepare card detection dataset

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Download the "Playing Cards" dataset by Augmented Startups from Roboflow Universe (https://universe.roboflow.com/augmented-startups/playing-cards-ow27d). Use the Roboflow Python SDK to download in YOLOv8 format since the user is already authenticated. Store it under `data/cards/` (gitignored). Document the source, license, and statistics.

**Acceptance Criteria:**
1. A dataset exists at `data/cards/` with `train/`, `val/`, and `test/` subdirectories, each containing `images/` and `labels/` folders
2. The dataset has 52 classes (one per card in a standard deck)
3. A `data/cards/data.yaml` file exists with `path`, `train`, `val`, `test`, `nc` (52), and `names` keys
4. A `data/cards/README.md` documents: source URL (https://universe.roboflow.com/augmented-startups/playing-cards-ow27d), license, number of images, number of annotations, class distribution notes
5. `data/` is added to `.gitignore`

---

### T-003 — Create class label → AIA notation mapping

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.1, S-2.3

Examine the Roboflow Playing Cards dataset's class names (from `data.yaml`) and create a bidirectional mapping between dataset labels and AIA card notation. This mapping will be used by both the training pipeline (to verify label correctness) and the `CardNormalizer` service (to translate inference output).

**Acceptance Criteria:**
1. A Python module or JSON file at `src/app/services/card_class_map.py` (or `.json`) maps dataset class indices → AIA notation strings and vice versa
2. All 52 cards are mapped: `"AS"` through `"KC"` using ranks `A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K` and suits `S, H, D, C`
3. A helper function `class_id_to_card(class_id: int) -> str` returns the AIA notation for a YOLO class index
4. A helper function `card_to_class_id(card: str) -> int` returns the YOLO class index for an AIA notation string
5. A simple smoke test verifies all 52 cards round-trip correctly

---

### T-004 — Create YOLO training script

**Category:** feature
**Dependencies:** T-001, T-002
**Story Ref:** S-1.2

Write `scripts/train_model.py` that fine-tunes a YOLOv8 model on the Roboflow Playing Cards dataset. The script should accept CLI arguments for key hyperparameters and save results to `runs/`.

**Acceptance Criteria:**
1. `scripts/train_model.py` exists and is runnable with `python scripts/train_model.py`
2. Accepts CLI arguments: `--epochs` (default 50), `--batch` (default 16), `--imgsz` (default 640), `--model` (default `yolov8n.pt` — nano variant), `--data` (default `data/cards/data.yaml`)
3. Calls `ultralytics.YOLO(model).train(data=..., epochs=..., batch=..., imgsz=..., project='runs', name='card_detector')` or equivalent
4. Training outputs (weights, metrics plots, sample predictions) are saved under `runs/card_detector/`
5. The script prints validation mAP@50 and mAP@50-95 after training completes
6. `runs/` is added to `.gitignore`

---

### T-005 — Train YOLOv8 model on card dataset

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-1.2

Execute the training script and produce a trained model. Iterate on hyperparameters if initial metrics are below threshold. This is a manual/interactive task — the agent runs the training script and evaluates results.

**Acceptance Criteria:**
1. Training completes without errors
2. Best weights are saved at `runs/card_detector/weights/best.pt`
3. Validation mAP@50 ≥ 0.80 (iterate on hyperparameters if needed)
4. Training loss curves show convergence (no divergence or NaN)

---

### T-006 — Create model evaluation script

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-1.3

Write `scripts/evaluate_model.py` that runs the trained model on the test split and reports detailed metrics.

**Acceptance Criteria:**
1. `scripts/evaluate_model.py` exists and accepts `--model` (path to `.pt` weights) and `--data` (path to `data.yaml`)
2. Runs `model.val(data=..., split='test')` and prints overall mAP@50, mAP@50-95, precision, recall
3. Prints per-class precision and recall for all 52 card classes
4. Identifies any classes with recall < 0.50 as "weak classes" needing attention
5. Outputs results to both stdout and a JSON file at `runs/evaluation_results.json`

---

### T-007 — Export model and write model card

**Category:** docs
**Dependencies:** T-005, T-006
**Story Ref:** S-1.3

Copy the best trained weights to `models/card_detector_v1.pt` and write a model card documenting the training run.

**Acceptance Criteria:**
1. `models/card_detector_v1.pt` exists and is loadable by `ultralytics.YOLO('models/card_detector_v1.pt')`
2. `models/README.md` documents: base architecture (e.g., YOLOv8n), training dataset source, number of training images, final mAP@50 and mAP@50-95, known weak classes, export date, and file size
3. `models/` directory is gitignored (model files are too large for git) except for the README
4. The README includes instructions for downloading or reproducing the model

---

### T-008 — Define DetectionResult Pydantic model

**Category:** feature
**Dependencies:** none
**Story Ref:** S-2.1

Create a Pydantic model representing a single card detection result. This is the shared data type used across the detection pipeline.

**Acceptance Criteria:**
1. `DetectionResult` is defined in `src/pydantic_models/app_models.py` (or a new dedicated file if `app_models.py` is too large)
2. Fields: `detected_value: str`, `confidence: float`, `bbox_x: float`, `bbox_y: float`, `bbox_width: float`, `bbox_height: float`
3. Optional fields: `card_position: str | None = None`, `position_confidence: str | None = None`
4. Confidence has a `ge=0.0, le=1.0` constraint
5. Bbox width and height have `gt=0` constraints
6. The model is importable and usable from services and routes

---

### T-009 — Evolve CardDetector protocol and update MockCardDetector

**Category:** refactor
**Dependencies:** T-008
**Story Ref:** S-2.1

Update the `CardDetector` protocol in `src/app/services/card_detector.py` to return `list[DetectionResult]` instead of `list[dict]`. Update `MockCardDetector` to match. Remove `card_position` from the protocol's detect output — position assignment is now handled by `PositionAssigner` downstream.

**Acceptance Criteria:**
1. `CardDetector.detect(image_path: str) -> list[DetectionResult]` — returns a list of `DetectionResult` objects with `detected_value`, `confidence`, and bounding box fields populated
2. `MockCardDetector.detect()` returns `DetectionResult` instances with randomized but valid card values, confidence in `[0.75, 0.99]`, and plausible bounding box coordinates
3. `MockCardDetector` generates a random number of cards (5–9) per call, not a fixed 7, to reflect arbitrary card counts
4. `card_position` is **not** set by the detector — it remains `None` in the detect output
5. Existing tests that reference `MockCardDetector` are updated to work with the new return type
6. The `@runtime_checkable` decorator is preserved on the protocol

---

### T-010 — Implement CardNormalizer service

**Category:** feature
**Dependencies:** T-003
**Story Ref:** S-2.3

Create `src/app/services/card_normalizer.py` with a function that translates YOLO class IDs to AIA card notation strings.

**Acceptance Criteria:**
1. `CardNormalizer` class (or module-level functions) exists in `src/app/services/card_normalizer.py`
2. `normalize(class_id: int) -> str` returns the AIA card notation string for a given YOLO class index
3. `normalize_results(detections: list[DetectionResult]) -> list[DetectionResult]` converts the `detected_value` field from a YOLO class index to an AIA card string for each detection
4. Raises `ValueError` for out-of-range class IDs with a message like `"Unknown YOLO class ID: {id}"`
5. Pure functions (no side effects, no model loading, no file I/O)

---

### T-011 — Implement YOLOCardDetector service

**Category:** feature
**Dependencies:** T-001, T-009, T-010
**Story Ref:** S-2.2

Create the real `YOLOCardDetector` class in `src/app/services/card_detector.py` that loads a trained YOLOv8 model and runs inference.

**Acceptance Criteria:**
1. `YOLOCardDetector` class exists in `src/app/services/card_detector.py` and implements the `CardDetector` protocol
2. Constructor accepts `model_path: str` and `confidence_threshold: float = 0.5`
3. Constructor loads the model via `ultralytics.YOLO(model_path)` and stores it as an instance attribute
4. `detect(image_path: str) -> list[DetectionResult]` runs `model.predict(image_path, conf=confidence_threshold)`, extracts bounding boxes, class IDs, and confidence scores from the YOLO results objects
5. Class IDs are converted to AIA card notation via `CardNormalizer`
6. Bounding box coordinates are returned in pixel units (xyxy format converted to x, y, width, height)
7. If `model_path` does not exist, the constructor raises `FileNotFoundError` with a clear message
8. If the image file is unreadable, `detect()` raises a descriptive `ValueError`

---

### T-012 — Implement PositionAssigner service

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-3.1, S-3.2

Create `src/app/services/position_assigner.py` with the spatial heuristic that assigns `card_position` labels to detected cards based on bounding box coordinates. Labels must follow Texas Hold'em dealing structure: community cards are the **Flop** (3 cards: `flop_1`, `flop_2`, `flop_3`), the **Turn** (1 card: `turn`), and the **River** (1 card: `river`) — maximum 5 community cards. Hole cards are 2 per player (`hole_1`, `hole_2`, …), with player-pairing resolved at the confirm step.

**Acceptance Criteria:**
1. `PositionAssigner` class exists in `src/app/services/position_assigner.py`
2. Constructor accepts configurable parameters: `community_y_min` (default 0.0), `community_y_max` (default 0.4), `min_community_cards` (default 3) — all as fractions of image height
3. `assign(detections: list[DetectionResult], image_width: float, image_height: float) -> list[DetectionResult]` returns a new list with `card_position` and `position_confidence` fields populated
4. Community cards are identified as detections whose `bbox_y` center falls within the community y-range, labeled using Texas Hold'em street names left-to-right: `flop_1`, `flop_2`, `flop_3`, `turn`, `river` — capped at 5 (if >5 detections fall in the community zone, only the first 5 left-to-right are labeled as community; extras overflow to hole cards)
5. Remaining detections are labeled `hole_1`, `hole_2`, ... left-to-right (each player has exactly 2 hole cards in Texas Hold'em; pairing is resolved during the user confirm step)
6. If fewer than `min_community_cards` (default 3, i.e. a flop) detections fall in the community region, the heuristic falls back: all cards get generic labels `card_1`, `card_2`, ... left-to-right, with `position_confidence = "unassigned"`
7. When confident, `position_confidence` is set to `"high"`; when the community cluster exists but is borderline, set to `"low"`

#### Bugs / Findings (T-012)

> Reviewed by Scott. Documentation only — no beads issues filed (MEDIUM and LOW severity).

| Severity | ID | Description |
|---|---|---|
| MEDIUM | MEDIUM-1 | `is_community` parameter in `_confidence()` is unused (`position_assigner.py` L87). Dead parameter misleads readers — should be removed or utilized. |
| MEDIUM | MEDIUM-2 | No cap on community card count. >5 cards in community zone get labeled beyond `river`. Texas Hold'em has exactly 5 community cards (3 flop + 1 turn + 1 river) — must cap at 5 and overflow extras to hole cards. |
| MEDIUM | MEDIUM-3 | `_confidence()` only checks `community_y_max` boundary, ignoring `community_y_min` (`position_assigner.py` L89). Benign with default `y_min=0.0` but incorrect for non-zero `y_min` — should check min distance to both boundaries. |
| LOW | LOW-1 | `image_width` and `image_height` accepted but unused. Placeholders per AC signature — acceptable. |
| LOW | LOW-2 | Missing test — hole card near boundary gets "low" confidence. |
| LOW | LOW-3 | Missing test — more than 5 community cards. |
| LOW | LOW-4 | Missing test — identical x-positions (sort stability). |

---

### T-020 — Fix PositionAssigner to use Texas Hold'em street labels

**Category:** bug
**Priority:** HIGH
**Dependencies:** T-012
**Story Ref:** S-3.1

The current `PositionAssigner` implementation uses generic `community_1` through `community_N` labels for community card positions. This is incorrect for Texas Hold'em. Community cards must be labeled using the game's dealing structure:

- **Flop** (first 3 community cards): `flop_1`, `flop_2`, `flop_3`
- **Turn** (4th community card): `turn`
- **River** (5th community card): `river`

These labels must match the existing database schema (`Hand` table columns: `flop_1`, `flop_2`, `flop_3`, `turn`, `river`) so that position assigner output maps directly to DB storage without a translation step.

Additionally, the implementation has no cap on community card count — if >5 detections fall in the community zone, they all get labeled sequentially (`community_6`, etc.), which is impossible in Texas Hold'em. Community cards must be capped at 5; overflow detections should be reclassified as hole cards.

**Acceptance Criteria:**
1. Community card labels are changed from `community_1`–`community_5` to `flop_1`, `flop_2`, `flop_3`, `turn`, `river`
2. Community cards are capped at 5 (max for Texas Hold'em); if >5 detections fall in the community zone, only the first 5 (left-to-right) receive street labels — extras overflow to hole cards
3. 3 community cards → `flop_1`, `flop_2`, `flop_3` (flop only)
4. 4 community cards → `flop_1`, `flop_2`, `flop_3`, `turn`
5. 5 community cards → `flop_1`, `flop_2`, `flop_3`, `turn`, `river`
6. Existing tests updated to assert the new label names
7. New tests added for: 4-community-card case (flop + turn), >5 overflow case
8. All existing PositionAssigner tests pass after changes

---

### T-013 — Add detector configuration and dependency injection

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-4.4

Update the `get_card_detector()` dependency in `src/app/routes/images.py` to read environment variables and instantiate the correct detector backend.

**Acceptance Criteria:**
1. `get_card_detector()` reads `CARD_DETECTOR_BACKEND` (default `"yolo"`), `CARD_DETECTOR_MODEL_PATH` (default `"models/card_detector_v1.pt"`), and `CARD_DETECTOR_CONFIDENCE` (default `"0.5"`)
2. If `CARD_DETECTOR_BACKEND == "yolo"`, returns a `YOLOCardDetector` instance initialized with the model path and confidence threshold
3. If `CARD_DETECTOR_BACKEND == "mock"`, returns a `MockCardDetector` instance
4. If the model file doesn't exist when `backend == "yolo"`, raises a startup-visible error (logged clearly)
5. The detector instance is created once and cached (not re-created per request) — use `@lru_cache` or module-level singleton
6. Existing test overrides of `get_card_detector` continue to work

---

### T-014 — Update detection results endpoint response

**Category:** feature
**Dependencies:** T-011, T-012, T-013
**Story Ref:** S-4.1, S-4.2

Update `GET /games/{game_id}/hands/image/{upload_id}` to run the full YOLO → normalize → assign pipeline and return enriched response data including bounding boxes, position confidence, and image dimensions.

**Acceptance Criteria:**
1. When detection is triggered, the handler calls `detector.detect()` followed by `PositionAssigner.assign()` before storing results
2. `CardDetection` rows are stored with populated `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`, `card_position` fields
3. The JSON response includes `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` per detection (these fields already exist but were previously null)
4. Response includes `position_confidence` per detection (`"high"`, `"low"`, or `"unassigned"`)
5. Response includes top-level `card_count` (int), `image_width` (int), `image_height` (int)
6. Bounding box coordinates are in pixel units relative to the original image

---

### T-015 — Update confirm detection endpoint for dynamic card count

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-4.3

Review and update `POST /games/{game_id}/hands/image/{upload_id}/confirm` to handle a variable number of detected cards. The confirm request body should remain backwards-compatible (community cards + player hands) and card validation should run on the full set.

**Acceptance Criteria:**
1. The confirm endpoint accepts any number of player_hands entries (0 or more), each with 2 hole cards
2. Community cards remain structured as before: `flop_1`, `flop_2`, `flop_3` (required), `turn` and `river` (optional)
3. If more cards were detected than what fits into community + player hands, the unmapped detections are not carried into the Hand record (user must explicitly assign them during confirm)
4. Card duplicate validation runs on the full confirmed set (all community + all hole cards)
5. Correction records are created for any detections that were changed during confirm, using the evolved `DetectionResult` format
6. Existing confirm endpoint tests continue to pass

---

### T-016 — Unit tests for CardNormalizer

**Category:** test
**Dependencies:** T-010
**Story Ref:** S-5.1

Write unit tests for the `CardNormalizer` service covering all 52 card mappings, error cases, and edge cases.

**Acceptance Criteria:**
1. Tests exist in `test/test_card_normalizer.py`
2. Tests verify correct mapping for all 52 cards (parametrized test recommended)
3. Tests verify `ValueError` is raised for out-of-range class IDs (e.g., -1, 52, 999)
4. Tests verify `normalize_results()` correctly transforms a list of `DetectionResult` objects
5. All tests pass with `pytest test/test_card_normalizer.py`

---

### T-017 — Unit tests for PositionAssigner

**Category:** test
**Dependencies:** T-012
**Story Ref:** S-5.1

Write unit tests for the `PositionAssigner` service covering Texas Hold'em card layout scenarios: flop-only (3 community), flop + turn (4), full board (5), overflow (>5 in community zone), and various hole card arrangements.

**Acceptance Criteria:**
1. Tests exist in `test/test_position_assigner.py`
2. Tests verify: 5 cards in a row at the top of the image → `flop_1`, `flop_2`, `flop_3`, `turn`, `river` left-to-right
3. Tests verify: 3 cards in community row → `flop_1`, `flop_2`, `flop_3`; 4 cards → adds `turn`; 5 cards → adds `river`
4. Tests verify: cards below the community row → `hole_1`, `hole_2`, etc.
5. Tests verify: fewer than 3 cards in the community region → fallback to `card_1`, `card_2`, ... with `position_confidence = "unassigned"`
6. Tests verify: >5 cards in community zone → first 5 get street labels, extras overflow to hole cards
7. Tests verify: empty detection list → empty output
8. Tests verify: single card → `card_1` with `position_confidence = "unassigned"`
7. All tests use synthetic `DetectionResult` fixtures — no real images or model inference

---

### T-018 — Unit tests for YOLOCardDetector

**Category:** test
**Dependencies:** T-011
**Story Ref:** S-5.1

Write unit tests for the `YOLOCardDetector` class, mocking the YOLO model to avoid requiring real weights in the test suite.

**Acceptance Criteria:**
1. Tests exist in `test/test_yolo_card_detector.py`
2. Tests mock `ultralytics.YOLO` and its `predict()` method to return fake YOLO results objects
3. Tests verify: `detect()` returns `list[DetectionResult]` with correct field mapping from YOLO output
4. Tests verify: `FileNotFoundError` raised when model path doesn't exist
5. Tests verify: `ValueError` raised for unreadable image paths
6. Tests verify: detections below the confidence threshold are filtered out
7. All tests pass without a real `.pt` model file present

---

### T-019 — Integration + E2E pipeline tests

**Category:** test
**Dependencies:** T-014, T-015
**Story Ref:** S-5.2, S-5.3

Write integration tests using `test/data/hand.jpg` and end-to-end API tests covering the upload → detect → confirm workflow.

**Acceptance Criteria:**
1. Integration test in `test/test_card_detection_integration.py` loads `test/data/hand.jpg`, runs `YOLOCardDetector.detect()`, and verifies output structure (valid card strings, positive bboxes, confidence in range). Marked with `@pytest.mark.integration` and skipped when no model file is present.
2. E2E test in `test/test_detection_pipeline_e2e.py` uses `MockCardDetector` (for CI reliability) and exercises: upload image via API → get detection results → confirm detections → verify Hand and PlayerHand records exist in DB
3. E2E test verifies `CardDetection` rows have populated `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` (even with mock data)
4. E2E test verifies correction records are created when confirmed values differ from detected values
5. All non-integration tests pass without a model file or GPU
