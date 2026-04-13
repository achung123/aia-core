# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 5
**Target:** `src/app/routes/hands.py` (line 219–239), `test/test_side_pot_empty_ids_fallback.py`
**Reviewer:** Scott (automated)

**Task:** aia-core-1q8v — Bug: side pot fallback leaks raw eligible_player_ids
**Beads ID:** aia-core-1q8v
**Epic:** alpha-patch-009
**Parent:** aia-core-7l16 (discovered-from)

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
| 1 | Empty-IDs fallback returns `eligible_players: []` instead of raw dicts | SATISFIED | `_resolve_side_pot_names` lines 225–228; test `test_empty_eligible_player_ids_returns_eligible_players_key` | Transform builds new dict with only `amount` + `eligible_players` keys — no leak possible |
| 2 | Missing `eligible_player_ids` key handled gracefully | SATISFIED | `.get('eligible_player_ids', [])` on line 223; test `test_missing_eligible_player_ids_key_returns_eligible_players` | `.get()` with default prevents KeyError |
| 3 | Multiple side pots all transformed in fallback | SATISFIED | List comprehension on lines 225–228; test `test_multiple_side_pots_all_empty_ids` | Comprehension iterates all pots |
| 4 | Amount preserved through fallback | SATISFIED | `sp['amount']` on line 226; test `test_amount_preserved_in_fallback` | Direct key access preserves value |

---

## Findings

### [MEDIUM] Mixed side pots (some with IDs, some without) not tested

**File:** `test/test_side_pot_empty_ids_fallback.py`
**Line(s):** entire file
**Category:** correctness

**Problem:**
All 4 tests cover the fallback path where `all_ids` is empty (no pots have any IDs). There is no test for a mixed input — e.g., `[{'amount': 10, 'eligible_player_ids': [1]}, {'amount': 5, 'eligible_player_ids': []}]` — which takes the main path (DB query), not the fallback. This is outside the scope of this bug fix (it's covered by the parent task aia-core-7l16), but worth noting for completeness.

**Impact:** Low risk — the main path already constructs `eligible_players` correctly via `id_to_name.get()`, but an explicit test for mixed pots would increase confidence.

---

### [LOW] `sp['amount']` in fallback will raise KeyError if `amount` is missing

**File:** `src/app/routes/hands.py`
**Line(s):** 226
**Category:** correctness

**Problem:**
The fallback comprehension accesses `sp['amount']` without a `.get()` default. If a malformed side pot dict lacks an `amount` key, this raises `KeyError`. However, the `side_pots` JSON is written by `compute_side_pots` which always includes `amount`, so this would require corrupted DB data.

**Code:**
```python
{'amount': sp['amount'], 'eligible_players': []} for sp in side_pots_raw
```

**Suggested Fix:**
Not actionable — the upstream writer guarantees `amount` is present. Adding a `.get()` fallback would mask data corruption bugs, which is worse. Noted for awareness only.

**Impact:** Negligible — only triggers with corrupted data.

---

## Positives

- **Minimal, surgical fix** — the fallback path builds a new dict with only the two expected keys (`amount`, `eligible_players`), completely preventing any leak of `eligible_player_ids` or other raw keys
- **Good test structure** — 4 focused tests each assert both the presence of `eligible_players` and the absence of `eligible_player_ids`, providing a double safety net
- **Tests import the function directly** — fast, isolated unit tests with `MagicMock` for db; no unnecessary integration overhead

---

## Overall Assessment

The fix fully closes the reported leak. The `if not all_ids` fallback now constructs clean response dicts instead of returning raw input. The 4 tests directly cover the reported bug scenario. No critical or high-severity issues found.

**Verdict: CLEAN** — no critical findings. Ready for commit.
