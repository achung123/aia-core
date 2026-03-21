# Code Review Report — aia-card-recognition-002 / aia-core-cx1

**Date:** 2026-03-20
**Ticket:** aia-core-cx1
**Target:** `src/app/services/card_detector.py`, `src/pydantic_models/app_models.py`, `test/test_card_detection_api.py`, `src/app/routes/images.py`
**Reviewer:** Scott (automated)

**Task:** T-009 — Evolve CardDetector protocol and update MockCardDetector
**Beads ID:** aia-core-cx1

---

## Code Description

This task evolves the `CardDetector` protocol and `MockCardDetector` implementation to return `list[DetectionResult]` (a Pydantic model) instead of `list[dict]`, aligning the detection interface with the strongly-typed pipeline design introduced in aia-card-recognition-002. The change touches the protocol definition and mock in `src/app/services/card_detector.py`, the `DetectionResult` model in `src/pydantic_models/app_models.py`, the consuming route in `src/app/routes/images.py`, and the test suite in `test/test_card_detection_api.py`. It also removes `card_position` from the detector's output (position assignment is now a downstream responsibility of `PositionAssigner`), and randomizes the mock's card count to 5–9 per call to reflect arbitrary detection counts.

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
| 1 | `CardDetector.detect(image_path: str) -> list[DetectionResult]` — returns list of DetectionResult with detected_value, confidence, and bbox fields | SATISFIED | `src/app/services/card_detector.py` L14-22: protocol declares `def detect(self, image_path: str) -> list[DetectionResult]` with proper return type annotation; imports `DetectionResult` from `pydantic_models.app_models` | — |
| 2 | `MockCardDetector.detect()` returns DetectionResult instances with randomized card values, confidence in [0.75, 0.99], and plausible bounding box coordinates | SATISFIED | `src/app/services/card_detector.py` L32-42: constructs `DetectionResult(...)` with `random.uniform(0.75, 0.99)` for confidence, bbox_x in [50, 800], bbox_y in [50, 600], bbox_width in [40, 100], bbox_height in [60, 140]; tests `test_mock_has_confidence_scores`, `test_mock_has_bounding_boxes`, `test_mock_returns_detection_result_instances` all pass | — |
| 3 | `MockCardDetector` generates 5–9 cards per call (not fixed 7) | SATISFIED | `src/app/services/card_detector.py` L30: `num_cards = random.randint(5, 9)`; test `test_mock_returns_variable_card_count` asserts `5 <= len(results) <= 9`; integration test `test_get_detection_results_has_variable_detections` also validates the range at the API level | — |
| 4 | `card_position` is **not** set by the detector — remains `None` | SATISFIED | `src/app/services/card_detector.py` L34-42: `DetectionResult(...)` constructor does not pass `card_position`, so it defaults to `None` per the model definition (`card_position: str \| None = None`); test `test_mock_card_position_is_none` explicitly asserts `r.card_position is None` for every result | — |
| 5 | Existing tests updated for new return type | SATISFIED | `test/test_card_detection_api.py`: imports `DetectionResult` (L14), `TestMockCardDetector` class has 10 tests validating DetectionResult instances, DI override test at L355 constructs `DetectionResult` objects directly, error handling tests use the new type annotations — all 50 tests pass | — |
| 6 | `@runtime_checkable` preserved on protocol | SATISFIED | `src/app/services/card_detector.py` L10: `@runtime_checkable` decorator on `CardDetector`; DI test at L341 uses `isinstance(detector, CardDetector)` which would fail without `@runtime_checkable` — test passes | — |

---

## Findings

### [MEDIUM] Position key mismatch between detection storage and confirm correction comparison

**File:** `src/app/routes/images.py`
**Line(s):** 156-163 (detection storage) and 332-345 (correction mapping)
**Category:** correctness

**Problem:**
When detection results are stored, positions are assigned as `card_1`, `card_2`, etc. (L156: `f'card_{i}'` with 1-based index). However, when the confirm endpoint builds `confirmed_map` to compare against detection positions and record corrections, it uses `community_1`, `community_2`, ... and `hole_1`, `hole_2`, ... — a completely different key namespace. This means the correction comparison (`detection_map.get(position)`) will never match detection positions, and no `DetectionCorrection` rows will ever be recorded for pre-PositionAssigner detections.

This is not a regression introduced by T-009 — the mismatch pre-dates this task and only becomes visible now that the detector explicitly leaves `card_position=None` and the fallback to `card_{i}` is the only path. However, it is worth flagging because it means detection corrections are silently broken until `PositionAssigner` (T-012) populates community/hole positions that align with the confirm endpoint's key scheme.

**Code:**
```python
# Detection storage (L156):
position = r.card_position if r.card_position else f'card_{i}'

# Confirm endpoint correction mapping (L332-345):
cc_positions = [
    ('community_1', str(cc.flop_1)),
    ('community_2', str(cc.flop_2)),
    ...
]
```

**Suggested Fix:**
No action required in this task scope. This will resolve naturally when T-012 (PositionAssigner) provides community/hole position labels that match the confirm endpoint's expectations. Consider adding a future task to unify the position naming scheme and add a test that verifies at least one correction is recorded when a detection differs from the confirmed value.

**Impact:** Detection corrections for model retraining are silently not recorded. Low immediate impact since the real detector (T-011) and position assigner (T-012) are not yet integrated, but should be tracked.

---

### [LOW] `test_mock_implements_protocol` uses `hasattr` instead of `isinstance`

**File:** `test/test_card_detection_api.py`
**Line(s):** 169-171
**Category:** convention

**Problem:**
The test `test_mock_implements_protocol` checks `hasattr(detector, 'detect')`, which is a weaker assertion than `isinstance(detector, CardDetector)`. Since the protocol has `@runtime_checkable`, the `isinstance` check is the idiomatic and more thorough way to verify protocol compliance — it validates the full structural subtype, not just a single attribute.

**Code:**
```python
def test_mock_implements_protocol(self):
    """MockCardDetector should be structurally compatible with CardDetector."""
    detector = MockCardDetector()
    assert hasattr(detector, 'detect')
```

**Suggested Fix:**
```python
def test_mock_implements_protocol(self):
    """MockCardDetector should be structurally compatible with CardDetector."""
    detector = MockCardDetector()
    assert isinstance(detector, CardDetector)
```

**Impact:** Minimal — the DI test at L341 already uses `isinstance(detector, CardDetector)`, so the protocol conformance is covered elsewhere. This is a clarity/convention improvement.

---

### [LOW] Single-invocation test for variable card count may not catch a fixed-count regression

**File:** `test/test_card_detection_api.py`
**Line(s):** 130-133
**Category:** correctness

**Problem:**
`test_mock_returns_variable_card_count` calls `detect()` once and asserts `5 <= len(results) <= 9`. A regression that returns a fixed count (e.g., always 7) would still pass this test in every run, since 7 is within [5, 9]. The test name implies it verifies variability, but it actually only verifies the range.

**Code:**
```python
def test_mock_returns_variable_card_count(self):
    """Mock generates 5-9 cards per call, not a fixed 7."""
    detector = MockCardDetector()
    results = detector.detect('fake/path.jpg')
    assert 5 <= len(results) <= 9
```

**Suggested Fix:**
Run multiple invocations and verify that at least two distinct counts appear:
```python
def test_mock_returns_variable_card_count(self):
    detector = MockCardDetector()
    counts = {len(detector.detect('fake/path.jpg')) for _ in range(20)}
    assert all(5 <= c <= 9 for c in counts)
    assert len(counts) > 1, "Expected variable card count across invocations"
```

**Impact:** Low — the implementation is correct (`random.randint(5, 9)`), so this is about test robustness rather than a real defect.

---

## Positives

- **Clean protocol design**: The `CardDetector` protocol is minimal, well-documented, and properly decorated with `@runtime_checkable`. The docstring explicitly states that `card_position` is not set by the detector, documenting the separation of concerns.
- **Strong Pydantic model constraints**: `DetectionResult` uses `ge=0.0, le=1.0` on confidence and `gt=0` on bbox dimensions, providing runtime validation at the model boundary.
- **Comprehensive mock implementation**: `MockCardDetector` generates plausible, non-duplicate card values from the full 52-card deck using `random.sample`, with realistic bbox ranges. The randomized count (5–9) correctly models variable detection output.
- **Thorough test coverage**: The test suite covers the mock's return type, value validity, confidence range, bbox positivity, card_position nullity, no-duplicate invariant, variable count, DI override, error handling, race conditions, and idempotency — 50 tests, all passing.
- **Route integration is sound**: `images.py` correctly reads `DetectionResult` fields and falls back to generic `card_{i}` positions when the detector leaves `card_position` as `None`, which is exactly the expected behavior before `PositionAssigner` is wired in.

---

## Overall Assessment

The T-009 implementation is **clean and complete**. All six acceptance criteria are satisfied. The `CardDetector` protocol correctly returns `list[DetectionResult]`, the `MockCardDetector` produces well-formed instances with randomized counts and plausible values, `card_position` is appropriately left as `None`, tests are updated and comprehensive (50/50 passing), and `@runtime_checkable` is preserved.

The one MEDIUM finding (position key mismatch in the correction flow) pre-dates this task and will resolve when T-012 (PositionAssigner) is integrated. The two LOW findings are minor test-quality observations. No critical or high-severity issues were found.

**Verdict:** No blockers. This task is ready for close.
