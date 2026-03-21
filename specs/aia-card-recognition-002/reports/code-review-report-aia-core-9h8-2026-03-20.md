# Code Review Report — aia-card-recognition-002 / aia-core-9h8

**Date:** 2026-03-20
**Ticket:** aia-core-9h8
**Target:** `src/app/services/card_detector.py` (YOLOCardDetector class), `test/test_yolo_card_detector.py`
**Reviewer:** Scott (automated)

**Task:** T-011 — Implement YOLOCardDetector service
**Beads ID:** aia-core-9h8

---

## Code Description

The `YOLOCardDetector` class is a concrete implementation of the `CardDetector` protocol that loads a trained YOLOv8 model via the `ultralytics` library and runs real inference on poker table images. It lives in `src/app/services/card_detector.py` alongside the protocol definition and the existing `MockCardDetector`. The `detect()` method invokes `model.predict()`, extracts bounding boxes, class IDs, and confidence scores from YOLO results objects, converts class IDs to AIA card notation via `CardNormalizer`, and returns a list of `DetectionResult` Pydantic objects with bounding boxes converted from YOLO's xyxy format to x/y/width/height.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `YOLOCardDetector` implements `CardDetector` protocol | SATISFIED | `card_detector.py` L57: `class YOLOCardDetector`; test `test_implements_card_detector_protocol` asserts `isinstance(detector, CardDetector)` | Both structural and runtime protocol checks pass |
| 2 | Constructor: `model_path: str`, `confidence_threshold: float = 0.5` | SATISFIED | `card_detector.py` L59: `def __init__(self, model_path: str, confidence_threshold: float = 0.5)`; tests verify default (0.5) and custom (0.8) thresholds | Signature matches AC exactly |
| 3 | Loads model via `ultralytics.YOLO(model_path)` | SATISFIED | `card_detector.py` L63: `self._model = YOLO(model_path)`; test `test_loads_model_via_ultralytics` asserts `mock_yolo_cls.assert_called_once_with("/fake/model.pt")` | YOLO import guarded with `try/except ImportError` for environments without ultralytics |
| 4 | `detect()` runs `model.predict()`, extracts bboxes, class IDs, confidences | PARTIAL | `card_detector.py` L69: `self._model.predict(image_path, verbose=False)` — does **not** pass `conf=confidence_threshold` to `predict()` as specified in AC; instead manually filters post-prediction at L81 | See finding [MEDIUM-1]. Functionally equivalent in most cases, but YOLO's native `conf` param filters before NMS, which could produce subtly different results |
| 5 | Class IDs converted to AIA notation via `CardNormalizer` | SATISFIED | `card_detector.py` L64: `self._normalizer = CardNormalizer()`, L90: `self._normalizer.normalize(class_id)`; test `test_detect_converts_class_id_to_aia_notation` verifies class_id 0 → `"10C"` | Delegation to `CardNormalizer.normalize()` aligns with T-010 |
| 6 | Bboxes in pixel units (xyxy → x, y, width, height) | SATISFIED | `card_detector.py` L83–97: extracts xyxy coordinates and computes `bbox_width = x2 - x1`, `bbox_height = y2 - y1`; test `test_detect_extracts_bbox_as_x_y_width_height` verifies (10,20,110,160) → x=10, y=20, w=100, h=140 | Conversion logic is correct and pixel-unit preserving |
| 7 | `FileNotFoundError` if `model_path` missing | SATISFIED | `card_detector.py` L63: `YOLO(model_path)` — ultralytics raises `FileNotFoundError` for missing paths; test `test_file_not_found_error_when_model_missing` patches YOLO to raise `FileNotFoundError` and confirms propagation | Relies on ultralytics behavior rather than explicit pre-check; see finding [LOW-1] |
| 8 | `ValueError` for unreadable images | SATISFIED | `card_detector.py` L68–72: catches `Exception` from `predict()` and re-raises as `ValueError`; test `test_detect_raises_value_error_for_unreadable_image` verifies with `match="unreadable"` | Original exception is chained via `from exc` for debuggability |

---

## Findings

### [MEDIUM-1] `conf` parameter not passed to `model.predict()` — deviates from AC #4

**File:** `src/app/services/card_detector.py`
**Line(s):** 69
**Category:** correctness

**Problem:**
AC #4 specifies that `detect()` should call `model.predict(image_path, conf=confidence_threshold)`, passing the confidence threshold directly to YOLO's inference engine. The implementation instead calls `model.predict(image_path, verbose=False)` and performs manual post-filtering at line 81 (`if conf < self.confidence_threshold: continue`).

This is functionally similar but not identical. When `conf` is passed to YOLO, it filters detections *before* Non-Maximum Suppression (NMS). Manual post-filtering applies *after* NMS. In crowded scenes (multiple overlapping cards), this can produce different results — a low-confidence detection that would have been removed before NMS might suppress a nearby higher-confidence detection during NMS.

**Code:**
```python
predictions = self._model.predict(image_path, verbose=False)
```

**Suggested Fix:**
Pass the confidence threshold to `predict()` alongside `verbose=False`:
```python
predictions = self._model.predict(
    image_path, conf=self.confidence_threshold, verbose=False
)
```
The manual post-filtering loop can optionally remain as a redundant safeguard, or be removed since YOLO handles it natively.

**Impact:** Functionally equivalent in most single-card or well-separated detection scenarios. Could produce different results in dense/overlapping card layouts due to NMS interaction. Also a spec deviation from the explicit AC wording.

---

### [MEDIUM-2] Broad `except Exception` catch wraps all `predict()` failures as `ValueError`

**File:** `src/app/services/card_detector.py`
**Line(s):** 68–72
**Category:** correctness

**Problem:**
The `detect()` method catches `Exception` (the broadest reasonable catch) and wraps any failure as `ValueError("Image unreadable or prediction failed: {path}")`. This includes errors unrelated to image readability — e.g., `RuntimeError` from CUDA/GPU failures, `MemoryError` from large batch processing, `PermissionError` from filesystem access, or `torch.cuda.OutOfMemoryError`. Wrapping these as `ValueError` with an "image unreadable" message is misleading and could hamper debugging in production.

The `from exc` chaining preserves the original traceback, which mitigates the issue for developers who inspect the chain. However, callers catching `ValueError` to handle bad images would incorrectly swallow GPU and memory errors.

**Code:**
```python
try:
    predictions = self._model.predict(image_path, verbose=False)
except Exception as exc:
    raise ValueError(
        f'Image unreadable or prediction failed: {image_path}'
    ) from exc
```

**Suggested Fix:**
Catch a narrower set of exceptions that plausibly indicate image issues, and let infrastructure errors propagate naturally:
```python
try:
    predictions = self._model.predict(image_path, verbose=False)
except (ValueError, OSError, TypeError) as exc:
    raise ValueError(
        f'Image unreadable or prediction failed: {image_path}'
    ) from exc
```
Alternatively, re-raise known non-image errors before the `ValueError` wrap:
```python
except Exception as exc:
    if isinstance(exc, (MemoryError, KeyboardInterrupt)):
        raise
    raise ValueError(...) from exc
```

**Impact:** In the current test/dev environment, minimal. In production with GPU inference, wrapping CUDA errors as `ValueError("Image unreadable")` could cause silent mishandling by callers. The `from exc` chain helps but relies on callers inspecting the chain.

---

### [LOW-1] No explicit model path validation — `FileNotFoundError` relies on ultralytics behavior

**File:** `src/app/services/card_detector.py`
**Line(s):** 63
**Category:** design

**Problem:**
AC #7 requires `FileNotFoundError` "with a clear message" when `model_path` does not exist. The constructor delegates this entirely to `ultralytics.YOLO(model_path)`, which happens to raise `FileNotFoundError` today. The error message comes from ultralytics, not from the application, and the behavior is framework-dependent. If a future ultralytics version changes behavior (e.g., attempting to download a missing model, or raising a different exception type), the AC guarantee could silently break.

**Code:**
```python
self._model = YOLO(model_path)
```

**Suggested Fix:**
Add an explicit existence check before loading, providing a clear domain-specific message:
```python
from pathlib import Path

if not Path(model_path).exists():
    raise FileNotFoundError(f"YOLO model file not found: {model_path}")
self._model = YOLO(model_path)
```

**Impact:** Low — ultralytics has consistently raised `FileNotFoundError` across versions. The explicit check adds robustness and a clearer message with negligible cost.

---

### [LOW-2] `verbose=False` hardcoded with no override

**File:** `src/app/services/card_detector.py`
**Line(s):** 69
**Category:** design

**Problem:**
The `verbose=False` parameter in `model.predict()` is hardcoded. During development or debugging, YOLO's verbose output (inference time, detection count, etc.) can be useful for diagnosing model performance issues. There is no way to enable it without modifying source code.

**Code:**
```python
predictions = self._model.predict(image_path, verbose=False)
```

**Suggested Fix:**
Accept an optional `verbose` parameter in the constructor (defaulting to `False`) and pass it through:
```python
def __init__(self, model_path: str, confidence_threshold: float = 0.5, verbose: bool = False) -> None:
    ...
    self._verbose = verbose

def detect(self, image_path: str) -> list[DetectionResult]:
    predictions = self._model.predict(image_path, verbose=self._verbose)
```

**Impact:** Minimal — this is a convenience improvement for debugging, not a correctness issue. Not required by any AC.

---

## Positives

1. **Clean protocol conformance** — `YOLOCardDetector` satisfies the `CardDetector` `@runtime_checkable` protocol with a single `detect()` method returning `list[DetectionResult]`. The test explicitly verifies `isinstance(detector, CardDetector)`.
2. **Correct xyxy → xywh conversion** — The bounding box transformation is implemented correctly with clear variable names (`x1, y1, x2, y2`) and arithmetic (`x2 - x1` for width, `y2 - y1` for height). Edge cases like zero-width boxes are handled by the Pydantic `gt=0` constraint on `DetectionResult`.
3. **Exception chaining** — The `raise ValueError(...) from exc` pattern preserves the original traceback chain, aiding debugging even when the exception type is broadened.
4. **Thorough test suite** — 15 tests organized into 3 logical classes covering protocol compliance (1 test), constructor behavior (4 tests), and detect behavior (10 tests). Tests verify return types, bbox conversion, confidence extraction, threshold filtering, multiple cards, empty results, card_position=None, error handling, and argument passthrough.
5. **Good mock design** — The `_make_mock_result` helper constructs realistic YOLO result objects with PyTorch tensors, avoiding brittle mock setups. Empty-result handling is tested separately.
6. **Lazy ultralytics import** — The `try/except ImportError` guard on `from ultralytics import YOLO` allows the module to be imported in environments without ML dependencies (test environments, linting), preventing import-time crashes.
7. **Separation of concerns** — Class ID → notation conversion is cleanly delegated to `CardNormalizer` rather than duplicated inline, honoring the dependency chain (T-010 → T-011).

---

## Overall Assessment

The `YOLOCardDetector` implementation is solid, well-tested, and correctly integrates the ultralytics YOLO library with the AIA detection pipeline. All 8 acceptance criteria are met (7 fully, 1 partially). The partial AC (#4) is a spec deviation where `conf=confidence_threshold` is not passed to YOLO's `predict()` — the manual post-filtering is functionally equivalent in most scenarios but differs in NMS behavior for dense scenes. This is the most actionable finding.

There are **zero CRITICAL** and **zero HIGH** findings. The 2 MEDIUM findings (missing `conf` parameter, broad exception catch) are worth addressing before the downstream integration task (T-013) wires this into production. The 2 LOW findings are minor robustness improvements.

**Recommendation:** Address MEDIUM-1 (pass `conf` to `predict()`) to align with the AC specification, then this task is ready for closure. MEDIUM-2 and the LOW findings can be deferred to a follow-up hardening pass.
