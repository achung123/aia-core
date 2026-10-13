# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Target:** Bug fix for side pot eligible_player_ids exposing internal DB IDs
**Reviewer:** Scott (automated)
**Cycle:** 4 (orchestration loop)
**Epic:** alpha-patch-009

**Task:** H-3 — Side pot eligible_player_ids exposes internal DB IDs
**Beads ID:** aia-core-7l16

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

The bug task `aia-core-7l16` was discovered from `aia-core-ndtd` (T-002) and addresses the fact that `side_pots` API responses exposed raw integer `eligible_player_ids` instead of human-readable player names.

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Side pots in HandResponse contain `eligible_players` (names) not `eligible_player_ids` (ints) | SATISFIED | `src/app/routes/hands.py` L219-235 (`_resolve_side_pot_names`), applied in `_build_hand_response` L783 | Tests confirm string names are returned and `eligible_player_ids` key is absent |
| 2 | Side pots in HandStatusResponse contain `eligible_players` (names) not `eligible_player_ids` (ints) | SATISFIED | `src/app/routes/hands.py` L308-317 (`get_hand_status` endpoint) | Test `test_status_response_side_pots_contain_player_names` verifies |
| 3 | All API response paths that return side pots are covered | SATISFIED | Both `_build_hand_response` (used by GET hand, list hands, start hand, PATCH flop/turn/river/community, record hand, results) and `get_hand_status` call `_resolve_side_pot_names` | No other route returns side pots directly |
| 4 | Regression tests exist | SATISFIED | `test/test_side_pot_player_names.py` — 3 tests; `test/test_betting_state_machine.py` L370 updated assertion | All 3 new tests pass |

---

## Findings

### [HIGH-1] Fallback returns raw side pots (with IDs) when `all_ids` is empty

**File:** `src/app/routes/hands.py`
**Line(s):** 224-225
**Category:** correctness

**Problem:**
When `all_ids` is empty (no player IDs found in any side pot's `eligible_player_ids`), the function returns `side_pots_raw` unchanged. This could happen if the JSON data were somehow malformed (e.g., empty `eligible_player_ids` lists or missing keys), in which case the raw dicts — potentially still containing `eligible_player_ids` keys — would leak through to the API response unmodified.

**Code:**
```python
all_ids = {pid for sp in side_pots_raw for pid in sp.get('eligible_player_ids', [])}
if not all_ids:
    return side_pots_raw  # ← returns raw dicts without transformation
```

**Suggestion:**
Instead of short-circuiting with the raw data, still transform the structure to ensure the output contract is consistent (always `eligible_players`, never `eligible_player_ids`):

```python
if not all_ids:
    return [
        {'amount': sp['amount'], 'eligible_players': []}
        for sp in side_pots_raw
    ]
```

**Impact:** If `Hand.side_pots` JSON somehow contains side pot entries with empty `eligible_player_ids`, the raw structure leaks through. In current practice `compute_side_pots` never produces this, but the defensive fallback is incorrect.

---

### [MEDIUM-1] `compute_side_pots` still returns `eligible_player_ids` — internal API contract mismatch

**File:** `src/app/services/betting.py`
**Line(s):** 84-86
**Category:** design

**Problem:**
The service-layer function `compute_side_pots` still returns dicts with `eligible_player_ids` (int lists). The route layer translates these to `eligible_players` (name strings) before serialization. This means the internal contract between `betting.py` and `hands.py` uses raw IDs, and any future consumer of `compute_side_pots` must remember to resolve names separately. This is a design concern, not a bug — the fix is correctly applied at the route layer.

**Suggestion:**
Consider documenting this in the docstring of `compute_side_pots`, or in a future task, refactoring so the service layer accepts a name-resolver callback. Low urgency — the current approach works and avoids coupling the service to the DB session.

---

### [MEDIUM-2] Unit test for `compute_side_pots` still asserts `eligible_player_ids`

**File:** `test/test_betting_state_machine.py`
**Line(s):** 539
**Category:** correctness

**Problem:**
The `TestComputeSidePots.test_two_way_all_in` test asserts `1 not in result[0]['eligible_player_ids']`. This is technically correct — `compute_side_pots` is a pure function that returns `eligible_player_ids` — but it creates a confusing asymmetry: the integration test at line 370 asserts `eligible_players`, while this unit test asserts `eligible_player_ids`. A reader might think the fix is incomplete.

**Code:**
```python
assert 1 not in result[0]['eligible_player_ids']  # L539 — still uses old key name
```

**Suggestion:**
Add a comment clarifying that `compute_side_pots` intentionally returns raw IDs that are resolved at the route layer, so the test is correct as-is. Alternatively, consider adding a test that calls `_resolve_side_pot_names` directly to prove the transformation.

---

### [LOW-1] Pydantic `side_pots` field is untyped `list`

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 250, 440
**Category:** convention

**Problem:**
Both `HandResponse.side_pots` and `HandStatusResponse.side_pots` are declared as `list = []` with no element type. After this fix, side pots always have the shape `{'amount': float, 'eligible_players': list[str]}`, but this is not enforced by the schema. An explicit Pydantic model (e.g., `SidePotResponse`) would provide validation and self-documenting OpenAPI schema.

**Suggestion:**
Define a `SidePotResponse` model:
```python
class SidePotResponse(BaseModel):
    amount: float
    eligible_players: list[str]
```
Then: `side_pots: list[SidePotResponse] = []`

This is a pre-existing gap, not introduced by this fix, but worth addressing for API documentation clarity.

---

## Positives

- **Single-query batch resolution:** `_resolve_side_pot_names` collects all player IDs across all side pots into a single `SELECT ... WHERE player_id IN (...)` query, avoiding N+1. Well done.
- **Consistent application:** The helper is applied in both `_build_hand_response` (covers 8+ endpoints) and `get_hand_status`, ensuring all API paths are covered.
- **Graceful fallback:** `id_to_name.get(pid, str(pid))` ensures that even if a player record were deleted, the response degrades to a string representation rather than crashing.
- **Tests are thorough:** Three regression tests cover both response shapes (hand response and status response) and verify both the presence of `eligible_players` and the absence of `eligible_player_ids`.
- **Test structure matches project conventions:** Fixture setup, naming, and assertion patterns are consistent with the rest of the test suite.

---

## Overall Assessment

The fix correctly addresses the reported bug. All API response paths that return side pots now resolve player IDs to names via a single batched query. The one HIGH finding (fallback path returning raw data) is an edge case that cannot occur with the current `compute_side_pots` implementation, but represents a defensive coding gap. The MEDIUM and LOW findings are design/convention improvements, not correctness issues.

**Recommendation:** Fix HIGH-1 to harden the defensive fallback, then close. No blockers for shipping.
