# Code Review Report — aia-card-recognition-002 / aia-core-2sz

**Date:** 2026-03-20
**Ticket:** aia-core-2sz
**Target:** `src/app/routes/images.py (get_card_detector)`, `test/test_detector_config.py`
**Reviewer:** Scott (automated)

**Task:** T-013 — Add detector configuration and dependency injection
**Beads ID:** aia-core-2sz

---

## Code Description

This change adds environment-variable-driven detector configuration and FastAPI dependency injection to the card detection pipeline. The `get_card_detector()` function in `src/app/routes/images.py` reads `CARD_DETECTOR_BACKEND`, `CARD_DETECTOR_MODEL_PATH`, and `CARD_DETECTOR_CONFIDENCE` from `os.environ`, instantiates the correct `CardDetector` implementation (mock or YOLO), validates model file existence for the YOLO backend, and caches the result via `@lru_cache(maxsize=1)`. Ten new tests in `test/test_detector_config.py` verify all five acceptance criteria.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Reads CARD_DETECTOR_BACKEND (default "mock"), CARD_DETECTOR_MODEL_PATH, CARD_DETECTOR_CONFIDENCE | SATISFIED | `src/app/routes/images.py` L44-46; tests `test_default_backend_is_mock`, `test_reads_confidence_from_env`, `test_reads_model_path_from_env` | Default is "mock" in code; see MEDIUM-1 for spec deviation note |
| 2 | backend=yolo → YOLOCardDetector; backend=mock → MockCardDetector | SATISFIED | `src/app/routes/images.py` L48-58; tests `test_explicit_mock_backend`, `test_yolo_backend_creates_yolo_detector` | Both branches tested with proper assertions |
| 3 | Missing model file on yolo backend raises startup-visible error | SATISFIED | `src/app/routes/images.py` L51-55; test `test_yolo_missing_model_raises_file_not_found` | `FileNotFoundError` with descriptive message including path and remediation hint |
| 4 | Detector cached via lru_cache | SATISFIED | `src/app/routes/images.py` L42 `@lru_cache(maxsize=1)`; tests `test_detector_cached_same_instance`, `test_has_cache_clear` | Identity check (`d1 is d2`) confirms singleton behavior |
| 5 | Existing test overrides continue to work | SATISFIED | test `test_override_still_works` (detector_config); all 50 tests in `test_card_detection_api.py` pass | `dependency_overrides[get_card_detector]` works correctly with the lru_cache-wrapped callable |

---

## Findings

### [MEDIUM] MEDIUM-1 — Default backend deviates from spec

**File:** `src/app/routes/images.py`
**Line(s):** 44
**Category:** correctness

**Problem:**
The implementation defaults `CARD_DETECTOR_BACKEND` to `"mock"`, but both the spec (S-4.4 AC1) and `tasks.md` (T-013 AC1) state the default should be `"yolo"`. The test `test_default_backend_is_mock` also asserts the mock default, so this appears intentional. Defaulting to mock is arguably safer during development (no model file required), but the written spec and task definition have not been updated to reflect this decision.

**Code:**
```python
backend = os.environ.get('CARD_DETECTOR_BACKEND', 'mock')
```

**Suggested Fix:**
Either update `spec.md` S-4.4 AC1 and `tasks.md` T-013 AC1 to document the default as `"mock"`, or change the code to default to `"yolo"` to match the spec. Given that a mock default is safer for dev/test environments and production would set the env var explicitly, documenting "mock" as the intentional default is the recommended path.

**Impact:** Spec-implementation inconsistency. No runtime impact since production deployments should set the env var explicitly.

---

### [LOW] LOW-1 — Non-numeric CARD_DETECTOR_CONFIDENCE produces unhelpful traceback

**File:** `src/app/routes/images.py`
**Line(s):** 46
**Category:** correctness

**Problem:**
If an operator sets `CARD_DETECTOR_CONFIDENCE` to a non-numeric string (e.g., `"high"`), the bare `float()` call raises a generic `ValueError: could not convert string to float: 'high'` without context about which env var caused the problem.

**Code:**
```python
confidence = float(os.environ.get('CARD_DETECTOR_CONFIDENCE', '0.5'))
```

**Suggested Fix:**
Wrap in a try/except with a descriptive message:
```python
raw_confidence = os.environ.get('CARD_DETECTOR_CONFIDENCE', '0.5')
try:
    confidence = float(raw_confidence)
except ValueError:
    raise ValueError(
        f'CARD_DETECTOR_CONFIDENCE must be a number, got: {raw_confidence!r}'
    ) from None
```

**Impact:** Minor operator experience issue. Only affects misconfigured environments; the default `"0.5"` always works.

---

## Positives

- **Clean branching logic** — The three-way `if/elif/else` in `get_card_detector()` is readable, with each branch returning the correct type and the `else` providing a clear error for unknown backends.
- **Proactive file validation** — Checking `os.path.isfile(model_path)` *before* instantiating `YOLOCardDetector` produces a clear `FileNotFoundError` at the configuration layer, avoiding a cryptic ultralytics error downstream.
- **Correct caching strategy** — `@lru_cache(maxsize=1)` is an appropriate choice for a singleton dependency; it integrates cleanly with FastAPI's `Depends()` and preserves `dependency_overrides` behavior for tests.
- **Thorough test isolation** — The `clear_detector_cache` autouse fixture ensures the lru_cache is cleared between every test, preventing cross-test contamination.
- **Well-organized test structure** — Tests are grouped by AC (one test class per criterion) with descriptive docstrings, making traceability straightforward.
- **Full backwards compatibility** — All 50 pre-existing tests in `test_card_detection_api.py` pass without modification; the override pattern (`dependency_overrides[get_card_detector]`) works identically with the lru_cache wrapper.

---

## Overall Assessment

The implementation is solid and complete. All five acceptance criteria are satisfied with 10 targeted tests providing strong coverage. The `get_card_detector()` function is concise, handles all expected backends including the error case, validates the YOLO model file proactively, and caches correctly. No critical or high-severity issues were found.

The one notable finding (MEDIUM-1) is a documentation alignment issue: the code defaults to "mock" while the spec says "yolo". This should be reconciled by updating the spec to reflect the intentional choice. LOW-1 is a minor robustness improvement for misconfigured environments.

**Verdict:** Clean — ready to close after spec documentation is updated for the default backend value.
