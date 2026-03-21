# Code Review Report — aia-card-recognition-002 / aia-core-a0w

**Date:** 2026-03-20
**Ticket:** aia-core-a0w
**Target:** `test/test_yolo_card_detector.py`
**Reviewer:** Scott (automated)

**Task:** T-018 — Unit tests for YOLOCardDetector
**Beads ID:** aia-core-a0w

---

## Code Description

This file contains 21 unit tests for the `YOLOCardDetector` service defined in `src/app/services/card_detector.py`. The tests are organized into three classes — `TestYOLOCardDetectorProtocol` (protocol conformance), `TestYOLOCardDetectorConstructor` (init behavior and error paths), and `TestYOLOCardDetectorDetect` (inference, field mapping, confidence filtering, and error wrapping). All tests mock `ultralytics.YOLO` at the module level and build synthetic YOLO result objects using real `torch` tensors, enabling the suite to run without a `.pt` model file.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Tests in test/test_yolo_card_detector.py | SATISFIED | `test/test_yolo_card_detector.py` — 21 tests across 3 classes | — |
| 2 | Mock ultralytics.YOLO and predict() | SATISFIED | Every test uses `patch('app.services.card_detector.YOLO')`, predict() mocked via `mock_model.predict` | Consistent module-level patching; no real YOLO object instantiated |
| 3 | detect() returns list[DetectionResult] with correct field mapping | SATISFIED | `test_detect_returns_list_of_detection_results` (L85–96), `test_detect_extracts_bbox_as_x_y_width_height` (L98–115), `test_detect_converts_class_id_to_aia_notation` (L117–130), `test_detect_extracts_confidence` (L132–143) | xyxy→xywh conversion, class_id→AIA notation, confidence extraction all verified |
| 4 | FileNotFoundError for missing model path | SATISFIED | `test_file_not_found_error_when_model_missing` (L48–52) | Mocks YOLO constructor to raise FileNotFoundError; asserts it propagates |
| 5 | ValueError for unreadable images | SATISFIED | `test_detect_raises_value_error_for_unreadable_image` (L186–193), `test_detect_value_error_includes_image_path` (L324–333) | Two tests: one verifies the raise + match on 'unreadable', the other confirms the image path appears in the message |
| 6 | Detections below confidence threshold filtered out | SATISFIED | `test_detect_filters_by_confidence_threshold` (L145–161), `test_detect_includes_detection_at_exact_confidence_threshold` (L236–251), `test_detect_filters_all_below_threshold_returns_empty` (L253–270), `test_detect_with_custom_threshold_filters_correctly` (L272–292) | Boundary condition (conf == threshold included) and custom threshold both covered |
| 7 | All tests pass without real .pt model | SATISFIED | `pytest` run: 21 passed, 0 failed, 0.07s | No `.pt` file accessed; all YOLO interactions mocked |

---

## Findings

### [LOW] Incomplete assertion in `test_detect_multiple_cards`

**File:** `test/test_yolo_card_detector.py`
**Line(s):** 163–180
**Category:** correctness

**Problem:**
The test verifies `len(results) == 2` and checks `'10C' in values`, but does not assert the second detected card value (class_id 21, expected AIA notation for ace of diamonds). If `CardNormalizer` returned an incorrect value for class_id 21, this test would still pass.

**Code:**
```python
values = {r.detected_value for r in results}
assert '10C' in values
```

**Suggested Fix:**
Also assert the second expected card value:
```python
values = {r.detected_value for r in results}
assert values == {'10C', 'AD'}
```

**Impact:** Minor — the test covers multiplicity but relies on a single card value assertion. A regression in class_id-to-notation mapping for a second card could go undetected here (though `CardNormalizer` has its own dedicated tests).

---

### [LOW] Inline `import torch` inside test helper

**File:** `test/test_yolo_card_detector.py`
**Line(s):** 64
**Category:** convention

**Problem:**
`_make_mock_result` imports `torch` inside the method body on every call. While this avoids a top-level import and is functionally correct (torch is a transitive dependency of ultralytics), it is unconventional for a test helper that is called by every test in the class.

**Code:**
```python
@staticmethod
def _make_mock_result(boxes_data):
    import torch
    ...
```

**Suggested Fix:**
Move the import to the top of the file alongside the other imports:
```python
import torch
```

**Impact:** Negligible — no behavioral difference. A top-level import would make the dependency explicit and avoid repeated import overhead (though Python caches modules after the first import).

---

## Positives

- **Thorough coverage of the confidence filtering boundary**: Four dedicated tests cover above-threshold, below-threshold, at-exact-threshold, and custom-threshold scenarios — well beyond the minimum.
- **Clean mock architecture**: The `_make_mock_result` helper creates real `torch` tensors for bbox/conf/cls, ensuring tests exercise the actual tensor indexing paths in production code rather than relying on MagicMock attribute access.
- **Error-path depth**: Two separate tests for `ValueError` — one checking the exception type and match string, another confirming the image path is included in the message.
- **Multi-batch prediction test**: `test_detect_aggregates_multiple_prediction_batches` verifies the loop over multiple prediction result objects, which is an edge case many test suites miss.
- **Downstream field nullability**: Explicit tests for `card_position is None` and `position_confidence is None` confirm the detector does not overstep its responsibility boundary.

---

## Overall Assessment

This is a well-structured, comprehensive test suite. All 7 acceptance criteria are satisfied. The 21 tests cover protocol conformance, constructor behavior, field mapping, confidence filtering (including boundary conditions), error handling, and downstream field nullability. No critical, high, or medium issues found. The two low-severity findings are minor improvements to assertion completeness and import convention. The test file is ready for merge.
