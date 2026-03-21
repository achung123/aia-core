# Code Review Report — aia-card-recognition-002 / aia-core-6c8

**Date:** 2026-03-20
**Ticket:** aia-core-6c8
**Target:** `src/app/routes/images.py`, `src/app/database/models.py`, `alembic/versions/aeb59dd31b92_add_position_confidence_and_image_dims.py`, `test/test_card_detection_api.py`
**Reviewer:** Scott (automated)

**Task:** T-014 — Update detection results endpoint response
**Beads ID:** aia-core-6c8

---

## Code Description

This task updates the `GET /games/{game_id}/hands/image/{upload_id}` endpoint to run the full YOLO → normalize → position-assign pipeline. The handler in `src/app/routes/images.py` now calls `detector.detect()` followed by `PositionAssigner.assign()`, stores enriched `CardDetection` rows (with bounding box coordinates and position confidence), reads image dimensions via PIL, and returns an enriched response containing per-detection bbox/position_confidence fields plus top-level card_count, image_width, and image_height. A new Alembic migration adds the `position_confidence` column to `card_detections` and `image_width`/`image_height` columns to `image_uploads`.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Handler calls detector.detect() then PositionAssigner.assign() | SATISFIED | `src/app/routes/images.py` L196-199: `results = detector.detect(upload.file_path)` followed by `assigned = assigner.assign(results, img_w, img_h)` | Pipeline order is correct; `test_position_assigner_called_card_positions_assigned` confirms positions are assigned |
| 2 | CardDetection rows stored with bbox and card_position fields | SATISFIED | `src/app/routes/images.py` L201-211: CardDetection constructed with `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`, `card_position`, `position_confidence`; `src/app/database/models.py` L117-122: columns defined as Float nullable | `test_db_stores_bbox_fields` and `test_db_stores_position_confidence` verify DB persistence |
| 3 | Response includes bbox_x, bbox_y, bbox_width, bbox_height per detection | SATISFIED | `src/app/routes/images.py` L238-241: response dict includes all four bbox fields per detection | `test_response_detections_have_bbox_fields` verifies presence |
| 4 | Response includes position_confidence per detection | SATISFIED | `src/app/routes/images.py` L242: `'position_confidence': d.position_confidence` in response | `test_response_detections_have_position_confidence` verifies presence and valid values |
| 5 | Response includes card_count, image_width, image_height at top level | SATISFIED | `src/app/routes/images.py` L228-230: `card_count`, `image_width`, `image_height` in top-level response dict; `image_width`/`image_height` stored on ImageUpload model | `test_response_includes_card_count`, `test_response_includes_image_width`, `test_response_includes_image_height` verify correct values |
| 6 | Bbox coordinates in pixel units relative to original image | SATISFIED | Bbox values pass through from `DetectionResult` (pixel units from detector) to `CardDetection` to response without transformation; `test_bbox_values_match_detector_output` verifies exact pixel values (100.0, 50.0, 60.0, 80.0) round-trip correctly | No normalization applied — coordinates remain in detector's native pixel space |

---

## Findings

### [MEDIUM] PositionAssigner unit mismatch with pixel-coordinate bounding boxes (pre-existing)

**File:** `src/app/services/position_assigner.py`
**Line(s):** 34-35, 58
**Category:** design

**Problem:**
The `PositionAssigner` constructor defaults `community_y_max=0.4`, intended as a fraction of image height (per T-012 spec: "as fractions of image height"). However, the detector returns bounding box coordinates in **pixel units** (e.g., `bbox_y=50.0` for a 480px image). The `assign()` method compares raw pixel `cy` values against the fractional threshold (`cy <= 0.4`) without normalizing, so for any realistic image all cards have `cy >> 0.4` pixels and are classified as hole cards. With 0 community cards < `min_community_cards` (3), the fallback path always triggers, assigning generic `card_1`, `card_2`, … labels with `position_confidence="unassigned"`.

Note: `image_width` and `image_height` are accepted as parameters but never used in the classification logic.

**Code:**
```python
if self.community_y_min <= cy <= self.community_y_max:
    community.append((cx, det))
```

**Suggested Fix:**
Normalize `cy` by `image_height` before comparing: `cy_norm = cy / image_height` (guarding against `image_height == 0`). This is an upstream issue from T-012 — not introduced by T-014.

**Impact:** Position assignment is effectively disabled for real images; all detections get fallback labels. Does not affect T-014 correctness (the pipeline is wired correctly), but downstream tasks relying on proper community/hole classification will be affected.

---

### [LOW] No Pydantic response model on detection results endpoint

**File:** `src/app/routes/images.py`
**Line(s):** 173
**Category:** convention

**Problem:**
The `get_detection_results` handler returns a raw dict without a `response_model` declaration. Other endpoints in the same module (e.g., `confirm_detection` at L261 uses `response_model=HandResponse`) follow the convention of declaring Pydantic response models, which provides schema validation and auto-generated OpenAPI docs.

**Suggested Fix:**
Define a `DetectionResultsResponse` Pydantic model and add `response_model=DetectionResultsResponse` to the `@router.get` decorator. Low priority — functional correctness is unaffected.

**Impact:** Missing auto-validation of response shape; API docs show generic JSON instead of typed schema.

---

### [LOW] `_get_image_dimensions` silently returns (0, 0) on failure

**File:** `src/app/routes/images.py`
**Line(s):** 71-76
**Category:** correctness

**Problem:**
If `Image.open()` fails (e.g., truncated file that passed magic-byte check), the function returns `(0, 0)` silently. These zeros are stored in `image_uploads.image_width` / `image_uploads.image_height` and returned in the API response, which could confuse consumers expecting real dimensions.

**Code:**
```python
def _get_image_dimensions(file_path: str) -> tuple[int, int]:
    try:
        with Image.open(file_path) as img:
            return img.size
    except Exception:
        return (0, 0)
```

**Suggested Fix:**
Consider logging a warning when dimensions can't be read, or returning `None` values instead of zeros to distinguish "unknown" from "zero-dimension image". Low priority — the magic byte validation makes this path unlikely in practice.

**Impact:** Minimal — edge case only reachable with corrupted files that pass initial validation.

---

## Positives

- **Clean pipeline wiring**: The detect → get_dimensions → assign → store → respond flow in `get_detection_results` is well-structured and easy to follow.
- **Comprehensive test coverage**: The `TestEnrichedDetectionResponse` class covers all 6 ACs with dedicated tests, including a round-trip pixel-value assertion (`test_bbox_values_match_detector_output`) and idempotency check (`test_second_get_still_returns_enriched_fields`).
- **Correct use of valid JPEG test fixtures**: The T-014 tests use `_make_valid_jpeg()` (PIL-generated) so that `_get_image_dimensions` returns real dimensions, unlike earlier tests using raw byte stubs.
- **Migration is reversible**: The Alembic migration cleanly adds nullable columns with a matching downgrade.
- **Failed-status guard**: The handler correctly returns an empty-detections response for failed uploads, preventing re-processing of broken uploads.
- **60/60 tests pass** in `test_card_detection_api.py` with 0 failures.

---

## Overall Assessment

T-014 is **well-implemented**. All 6 acceptance criteria are satisfied. The handler correctly wires the detect → position-assign pipeline, stores enriched CardDetection rows with bbox/position fields, and returns the required enriched response shape including top-level card_count and image dimensions. The migration is clean and reversible.

The one MEDIUM finding (PositionAssigner unit mismatch) is a **pre-existing design issue from T-012** — the assigner compares pixel-coordinate bbox values against fractional thresholds, causing all cards to hit the fallback path. This does not affect T-014's correctness (the pipeline is wired as specified), but should be addressed before T-019 (integration/E2E tests) or any downstream task that depends on accurate community/hole card classification.

**Recommendation:** Close aia-core-6c8. File a follow-up issue for the PositionAssigner coordinate normalization fix.
