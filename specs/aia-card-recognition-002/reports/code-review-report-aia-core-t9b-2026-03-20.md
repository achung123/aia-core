# Code Review Report — aia-card-recognition-002 / aia-core-t9b

**Date:** 2026-03-20
**Ticket:** aia-core-t9b
**Target:** `test/test_card_normalizer.py`
**Reviewer:** Scott (automated)

**Task:** T-016 — Unit tests for CardNormalizer
**Beads ID:** aia-core-t9b

---

## Code Description

This task adds a comprehensive unit test suite for the `CardNormalizer` service in `test/test_card_normalizer.py`. The tests cover the two public methods — `normalize()` and `normalize_results()` — verifying correct YOLO-class-ID-to-AIA-notation mapping for all 52 cards, error handling for invalid class IDs, list transformation of `DetectionResult` objects, immutability of input data, and edge cases like empty lists and boundary values. The tests import from `app.services.card_normalizer` and `pydantic_models.app_models` and exercise the normalizer in isolation with no I/O or model loading.

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
| 1 | Tests exist in `test/test_card_normalizer.py` | SATISFIED | `test/test_card_normalizer.py` exists with 13 test methods across 2 test classes (`TestNormalize`, `TestNormalizeResults`) | — |
| 2 | Tests verify correct mapping for all 52 cards (parametrized) | SATISFIED | `test_normalize_all_52_cards` uses `@pytest.mark.parametrize('class_id', range(52))` — generates 52 individual test cases, each asserting `normalizer.normalize(class_id) == class_id_to_card(class_id)` | Additionally, `test_normalize_results_many_detections` round-trips all 52 via `normalize_results()` |
| 3 | Tests verify `ValueError` for out-of-range class IDs (-1, 52, 999) | SATISFIED | `test_normalize_out_of_range_raises_value_error` parametrizes over `[-1, 52, 999, -100]` and asserts `pytest.raises(ValueError)` for each; `test_normalize_results_propagates_value_error_for_invalid_class_id` verifies propagation through `normalize_results()` | Exceeds spec — also covers -100 and propagation path |
| 4 | Tests verify `normalize_results()` transforms a list of `DetectionResult` | SATISFIED | 7 tests in `TestNormalizeResults`: value conversion, field preservation, empty list, no-mutation, return type check, error propagation, many-detections | Thorough coverage of the `normalize_results()` contract |
| 5 | All tests pass with `pytest test/test_card_normalizer.py` | SATISFIED | 66 passed, 0 failed, 0 errors (pytest 9.0.2, 0.13s) | — |

---

## Findings

### [LOW] Hardcoded expected values couple tests to current class ordering

**File:** `test/test_card_normalizer.py`
**Line(s):** 22–24, 32–33
**Category:** design

**Problem:**
`test_normalize_specific_examples` and `test_normalize_boundary_values` hardcode expected values (`normalize(0) == '10C'`, `normalize(39) == 'AS'`, `normalize(51) == 'QS'`). These are correct given the current alphabetical class ordering from the Roboflow dataset, but if the dataset class order ever changes, these tests would break before the parametrized test reveals the real issue.

**Code:**
```python
assert normalizer.normalize(0) == '10C'
assert normalizer.normalize(39) == 'AS'
```

**Suggested Fix:**
Replace hardcoded expected values with `class_id_to_card()` lookups (same pattern as the parametrized test), or add a comment explaining the values are intentionally pinned to document the current dataset ordering as a regression guard.

**Impact:** Minor maintenance burden. The parametrized test already covers correctness exhaustively, so these tests are redundant from a mapping-verification standpoint but useful as readable smoke tests.

---

### [LOW] No test for non-integer string in `detected_value` during `normalize_results()`

**File:** `test/test_card_normalizer.py`
**Line(s):** (absent)
**Category:** correctness

**Problem:**
`normalize_results()` calls `int(detection.detected_value)` internally. If a `DetectionResult` carries a non-numeric `detected_value` (e.g., `"ace_of_spades"`), a `ValueError` would be raised by `int()`, not by the normalizer's validation. There is no test confirming the behavior for malformed string inputs. This is low-severity because `detected_value` in the YOLO pipeline is always a stringified integer, but a test would document the contract.

**Suggested Fix:**
Add a test like:
```python
def test_normalize_results_non_numeric_value_raises(self):
    normalizer = CardNormalizer()
    detections = [DetectionResult(detected_value='not_a_number', confidence=0.5,
                                  bbox_x=0.0, bbox_y=0.0, bbox_width=10.0, bbox_height=10.0)]
    with pytest.raises(ValueError):
        normalizer.normalize_results(detections)
```

**Impact:** Documentation gap only. The production code path always provides numeric strings; this is a defensive edge case.

---

## Positives

- **Excellent parametrized coverage**: The `range(52)` parametrization ensures every single card mapping is tested individually — any regression in the class map is caught immediately.
- **Thorough `normalize_results()` testing**: Seven distinct test cases cover value conversion, field preservation, empty input, immutability, type checking, error propagation, and bulk processing — a well-structured test suite.
- **Immutability test**: `test_normalize_results_does_not_mutate_input` explicitly verifies that the normalizer returns new objects via `model_copy()` rather than mutating inputs — an important contract for a pure-function service.
- **Clean test organization**: Two focused test classes (`TestNormalize`, `TestNormalizeResults`) mirror the two public methods, making it easy to locate tests for each method.
- **No test infrastructure overhead**: Tests import directly from production modules and use only `pytest` built-ins — no custom fixtures, no mocking needed, fast execution (0.13s for 66 tests).

---

## Overall Assessment

The test suite for `CardNormalizer` is well-written and satisfies all 5 acceptance criteria for T-016. All 66 tests pass. The parametrized approach ensures complete coverage of the 52-card mapping, error cases are properly tested including propagation through `normalize_results()`, and the test structure is clean and maintainable. Only two LOW-severity observations were found — both are documentation/defensive gaps, not correctness issues. No changes are required.
