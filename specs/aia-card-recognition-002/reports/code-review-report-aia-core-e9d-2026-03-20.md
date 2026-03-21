# Code Review Report — aia-card-recognition-002 / aia-core-e9d

**Date:** 2026-03-20
**Ticket:** aia-core-e9d
**Target:** `src/app/services/card_normalizer.py`, `test/test_card_normalizer.py`
**Reviewer:** Scott (automated)

**Task:** T-010 — Implement CardNormalizer service
**Beads ID:** aia-core-e9d

---

## Code Description

The `CardNormalizer` service translates YOLO model class IDs (integers 0–51) into AIA card notation strings (e.g. `"AS"`, `"10C"`) by delegating to the `class_id_to_card()` function from `card_class_map`. It provides two methods: `normalize()` for single class-ID conversion, and `normalize_results()` which batch-converts a list of `DetectionResult` objects by replacing each `detected_value` field with the corresponding AIA notation. The service is a thin, pure abstraction layer that sits between the YOLO inference output and the rest of the AIA backend pipeline.

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
| 1 | `CardNormalizer` class in `src/app/services/card_normalizer.py` | SATISFIED | `src/app/services/card_normalizer.py` L9: `class CardNormalizer` | Class exists at the specified path |
| 2 | `normalize(class_id: int) -> str` returns AIA notation | SATISFIED | `card_normalizer.py` L12–17; `test_card_normalizer.py` L13–26 — 52 parametrized tests + specific examples (class 0→`10C`, class 39→`AS`) | Delegates to `class_id_to_card()` which performs the O(1) lookup |
| 3 | `normalize_results(detections: list[DetectionResult]) -> list[DetectionResult]` converts `detected_value` fields | SATISFIED | `card_normalizer.py` L19–32; `test_card_normalizer.py` L37–113 — tests verify conversion, field preservation, immutability, return type, and empty-list handling | Returns new list via `model_copy(update=...)`, original detections are not mutated |
| 4 | `ValueError` for out-of-range class IDs | SATISFIED | `card_normalizer.py` L17 delegates to `class_id_to_card()` which raises `ValueError` for keys not in 0–51; `test_card_normalizer.py` L28–31 — parametrized with `[-1, 52, 999, -100]` | Error message reads `"Invalid class_id: {id}. Must be 0–51."` from `card_class_map.py` L97 — differs slightly from T-010's suggested `"Unknown YOLO class ID: {id}"` wording but is functionally equivalent and arguably more informative |
| 5 | Pure functions (no side effects, no model loading, no file I/O) | SATISFIED | `card_normalizer.py` has zero I/O, zero global state mutation, zero model loading; only imports are `card_class_map` (pure lookups) and `DetectionResult` (Pydantic model) | `normalize_results` creates new objects via `model_copy` — verified by `test_normalize_results_does_not_mutate_input` |

---

## Findings

### [MEDIUM] `normalize_results()` does not handle non-integer `detected_value` gracefully

**File:** `src/app/services/card_normalizer.py`
**Line(s):** 30
**Category:** correctness

**Problem:**
`normalize_results()` calls `int(detection.detected_value)` without guarding against values that are not valid integer strings. If a `DetectionResult` arrives with a `detected_value` that is already in AIA notation (e.g. `"AS"`), a non-numeric string, or a float string (e.g. `"3.0"`), the `int()` call raises an unhandled `ValueError` with the generic message `invalid literal for int() with base 10: 'AS'` — which is confusing and does not indicate the real issue.

In the current pipeline this cannot happen because `normalize_results()` is only called on raw YOLO output where `detected_value` is always a stringified integer. However, the method's public signature accepts any `list[DetectionResult]`, and calling it on already-normalized data or malformed data would produce a cryptic traceback rather than a clear domain error.

**Code:**
```python
detection.model_copy(
    update={"detected_value": self.normalize(int(detection.detected_value))}
)
```

**Suggested Fix:**
Wrap the `int()` conversion with a targeted `try/except` that raises a descriptive `ValueError`:
```python
try:
    class_id = int(detection.detected_value)
except (ValueError, TypeError) as exc:
    raise ValueError(
        f"detected_value {detection.detected_value!r} is not a valid integer class ID"
    ) from exc
```

**Impact:** Low in the current pipeline (YOLO always produces integer class IDs), but becomes relevant when `YOLOCardDetector` (T-011) integrates this method and callers may pass pre-processed data. Defensive conversion avoids debugging obscure `int()` tracebacks.

---

### [LOW] Error message wording does not match task specification

**File:** `src/app/services/card_class_map.py` (surfaced via `card_normalizer.py` delegation)
**Line(s):** 97
**Category:** convention

**Problem:**
T-010 AC-4 suggests the error message format `"Unknown YOLO class ID: {id}"`, but the actual message from `card_class_map.class_id_to_card()` is `"Invalid class_id: {id}. Must be 0–51."`. The implementation is functionally correct — `ValueError` is raised — but the wording does not match the spec suggestion.

**Suggested Fix:**
No change required. The current message is arguably more informative (specifies the valid range). This is flagged for traceability only — the spec used "like" to indicate the message was a suggestion, not a requirement.

**Impact:** None. Functional behavior is identical.

---

### [LOW] Test file tests `normalize_results` with only 2 specific class IDs

**File:** `test/test_card_normalizer.py`
**Line(s):** 37–60
**Category:** design

**Problem:**
`test_normalize_results_converts_detected_values` only tests class IDs `"0"` (10C) and `"39"` (AS). While `test_normalize_all_52_cards` covers the single-value `normalize()` path exhaustively, the `normalize_results()` path — which includes the `int()` conversion and `model_copy()` logic — is only exercised with 2 values. The `model_copy()` + `int()` pipeline is not parametrized across all 52 class IDs.

**Suggested Fix:**
Add a parametrized test that exercises `normalize_results()` for a broader sample (e.g., boundary IDs 0, 51, and a mid-range value) to confirm the `int()` + `normalize()` + `model_copy()` pipeline works consistently. This is low priority since the individual `normalize()` method already has full coverage.

**Impact:** Minimal risk — the `model_copy()` path is structurally identical for all class IDs. A broader sample would add confidence but is not blocking.

---

## Positives

1. **Clean, minimal design** — The `CardNormalizer` class is a thin wrapper that does exactly one thing: translate class IDs to AIA notation. It delegates to the already-reviewed `card_class_map` module and adds no unnecessary complexity. This is textbook single-responsibility.
2. **Immutability** — `normalize_results()` returns new `DetectionResult` objects via Pydantic's `model_copy(update=...)` rather than mutating inputs. This is explicitly tested by `test_normalize_results_does_not_mutate_input`.
3. **Comprehensive test coverage** — 62 tests cover all 52 class IDs, out-of-range errors, result conversion, field preservation, empty list handling, and input immutability. The test structure is clear with `TestNormalize` and `TestNormalizeResults` classes.
4. **Pure and dependency-light** — Zero file I/O, zero model loading, zero global state mutation. Only two imports, both from within the project. Meets AC-5 cleanly.
5. **Consistent with project conventions** — Module docstring, class docstring, method docstrings all follow the patterns established in `card_class_map.py` and `position_assigner.py`.

---

## Overall Assessment

The `CardNormalizer` implementation is clean, correct, and well-tested. All 5 acceptance criteria are fully satisfied. The service is a thin, pure abstraction layer that delegates to the proven `card_class_map` module, adding batch-conversion capability via `normalize_results()`.

The single MEDIUM finding (non-integer `detected_value` handling) is a defensive-coding concern that does not affect the current pipeline but is worth addressing before T-011 (`YOLOCardDetector`) integrates this service. The two LOW findings are convention/coverage observations with no functional impact.

**Verdict:** Clean. No CRITICAL or HIGH findings. Ready for downstream integration.
