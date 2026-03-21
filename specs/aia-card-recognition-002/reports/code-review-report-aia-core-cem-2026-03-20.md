# Code Review Report — aia-card-recognition-002 / aia-core-cem

**Date:** 2026-03-20
**Ticket:** aia-core-cem
**Target:** `src/app/services/card_class_map.py`, `test/test_card_class_map.py`
**Reviewer:** Scott (automated)

**Task:** T-003 — Create class label → AIA notation mapping
**Beads ID:** aia-core-cem

---

## Code Description

This module provides a bidirectional mapping between YOLO class indices (0–51, from the Roboflow Playing Cards dataset) and AIA card notation strings (e.g. `"AS"`, `"10C"`, `"KD"`). It builds two O(1) lookup dictionaries at import time from a hardcoded list of 52 class names that mirrors `data/cards/data.yaml`. The module exposes two public functions — `class_id_to_card` and `card_to_class_id` — used downstream by the `CardNormalizer` service (T-010) and the training pipeline.

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
| 1 | Module at `src/app/services/card_class_map.py` maps dataset class indices → AIA notation and vice versa | SATISFIED | [card_class_map.py](../../../src/app/services/card_class_map.py) — `_ID_TO_CARD` (line 95) and `_CARD_TO_ID` (line 96) dicts | Bidirectional mapping is correct |
| 2 | All 52 cards mapped: AS through KC using ranks A,2-10,J,Q,K and suits S,H,D,C | SATISFIED | `test_every_rank_suit_combo_present` asserts the full 52-card set matches `{r}{s}` for all 13 ranks × 4 suits | All rank/suit combos verified exhaustively |
| 3 | `class_id_to_card(class_id: int) -> str` | SATISFIED | [card_class_map.py#L99](../../../src/app/services/card_class_map.py) — function with correct signature and ValueError on invalid input | 8 tests cover spot checks + boundary errors |
| 4 | `card_to_class_id(card: str) -> int` | SATISFIED | [card_class_map.py#L108](../../../src/app/services/card_class_map.py) — function with correct signature and ValueError on unknown card | 7 tests cover spot checks + error cases |
| 5 | Smoke test verifies all 52 cards round-trip correctly | SATISFIED | `test_all_52_round_trip_id_to_card_to_id` loops 0–51, converts to card and back, asserts identity | Additionally `test_all_52_cards_are_unique` confirms no collisions |

---

## Findings

### [MEDIUM] Hardcoded class names have no sync test against data.yaml

**File:** `src/app/services/card_class_map.py`
**Line(s):** 37–89
**Category:** design

**Problem:**
The `_CLASS_NAMES` list is a hardcoded copy of the 52 names from `data/cards/data.yaml`. If the dataset is re-downloaded with a different Roboflow version (reordered classes, renamed labels), the hardcoded list will silently diverge from the actual data.yaml, causing incorrect class-to-card mappings at inference time.

The decision to hardcode rather than load from YAML at import time is sound — it avoids file I/O and keeps the module pure, which is required by the downstream `CardNormalizer` (T-010 AC-5: "no file I/O"). However, there is no test that validates the hardcoded list against `data.yaml`.

**Code:**
```python
_CLASS_NAMES: list[str] = [
    "10 of clubs",
    "10 of diamonds",
    # ... 50 more entries
    "queen of spades",
]
```

**Suggested Fix:**
Add a test in `test_card_class_map.py` that loads `data/cards/data.yaml` (if present, skipped otherwise) and asserts `_CLASS_NAMES` matches the YAML names list:
```python
@pytest.mark.skipif(not Path("data/cards/data.yaml").exists(), reason="dataset not downloaded")
def test_class_names_match_data_yaml():
    import yaml
    with open("data/cards/data.yaml") as f:
        data = yaml.safe_load(f)
    from app.services.card_class_map import _CLASS_NAMES
    assert list(data["names"]) == _CLASS_NAMES
```

**Impact:** If `data.yaml` is regenerated with different ordering or naming, the mapping will silently produce wrong card notation for detections. The sync test catches this at CI time.

---

### [LOW] Error message for `card_to_class_id` does not hint at expected format

**File:** `src/app/services/card_class_map.py`
**Line(s):** 108–115
**Category:** convention

**Problem:**
When `card_to_class_id` receives an invalid card string, the error message is `"Unknown card notation: 'XX'"`. This does not tell the caller what a valid notation looks like. In contrast, `class_id_to_card` helpfully says `"Must be 0–51"`.

**Code:**
```python
raise ValueError(f"Unknown card notation: {card!r}")
```

**Suggested Fix:**
Include valid format hint:
```python
raise ValueError(
    f"Unknown card notation: {card!r}. "
    "Expected format: rank + suit, e.g. 'AS', '10C', 'KD'."
)
```

**Impact:** Minor developer experience improvement. Callers debugging bad input get faster feedback.

---

## Positives

1. **Clean, dependency-free design** — The module has zero external imports, no file I/O, and no side effects. Lookup tables are built once at import time with O(1) access thereafter. This aligns perfectly with the downstream `CardNormalizer` requirements (T-010 AC-5).

2. **Thorough test coverage** — 18 tests for a small mapping module is excellent. Tests are well-structured into three logical groups: forward lookups, reverse lookups, and exhaustive round-trip verification. The `test_every_rank_suit_combo_present` test is particularly valuable — it independently constructs the expected 52-card set and compares, catching any mapping errors.

3. **Correct error handling** — Both public functions raise `ValueError` with descriptive messages. The `from None` pattern suppresses the confusing `KeyError` chain that would otherwise appear in tracebacks.

4. **Accurate data.yaml alignment** — The hardcoded `_CLASS_NAMES` list was manually verified to match all 52 entries in `data/cards/data.yaml` in exact order.

5. **Consistent project conventions** — Module structure, docstrings, and naming align with the existing `card_detector.py` service pattern.

---

## Overall Assessment

This is a clean, well-tested implementation that satisfies all 5 acceptance criteria. The module is minimal, correct, and follows project conventions. The only substantive finding is the absence of a sync test between the hardcoded class names and the source `data.yaml` — a drift-detection safety net that would be easy to add. No critical or high-severity issues were found.

**Verdict:** PASS — ready for merge.
**Recommended follow-up:** Add the `data.yaml` sync test (MEDIUM finding) as part of the T-010 CardNormalizer work or as a standalone quick fix.
