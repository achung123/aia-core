# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `src/app/services/equity.py`, `test/test_equity.py`
**Reviewer:** Scott (automated)
**Cycle:** 6
**Epic:** dealer-viz-004

**Task:** T-006 — Port equity evaluator to Python
**Beads ID:** aia-core-h7fm

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `calculate_equity` for AA vs KK returns equity within ±1% of ~81%/19% | PARTIAL | `test/test_equity.py::TestKnownEquityScenarios::test_aa_vs_kk_preflop` | Test uses ±4% tolerance, not ±1% as AC states. Practical for unseeded Monte Carlo at 5,000 iterations; see finding M-2 |
| 2 | Exhaustive enumeration used when ≤2 community cards remain | SATISFIED | `src/app/services/equity.py` L125–132; `test/test_equity.py::TestExhaustiveVsMonteCarlo` (3 tests) | Turn (1 remaining) and flop (2 remaining) confirmed deterministic via repeated calls |
| 3 | Monte Carlo (5,000 iterations) used otherwise | SATISFIED | `src/app/services/equity.py` L135 (`iters = 5000`) | Preflop tests exercise this path and produce expected results |
| 4 | Unit tests in `test/test_equity.py` with ≥5 known-equity scenarios | SATISFIED | 5 scenarios in `TestKnownEquityScenarios`: AA vs KK, AKs vs QQ, AA vs 72o, AA vs KK on flop, same-hand split | 5 scenarios + 3 hand-eval + 3 exhaustive/MC + 3 return-type = 14 tests total |
| 5 | Function returns `list[float]` — one equity per player | SATISFIED | `test/test_equity.py::TestCalculateEquityReturnType` (3 tests) | Verified type, length, and sum-to-one |

---

## Findings

### [HIGH] H-1: Empty player list causes unhandled ValueError

**File:** `src/app/services/equity.py`
**Line(s):** 104
**Category:** correctness

**Problem:**
`_eval_board()` calls `max(scores)` where `scores` is derived from `players`. If `players` is an empty list (0 players passed), `max([])` raises `ValueError: max() arg is an empty sequence`. A single-player call would not crash but returns `[1.0]`, which may be misleading.

**Code:**
```python
def _eval_board(players, board):
    scores = [_best_score(p + board) for p in players]
    mx = max(scores)  # ValueError if scores is empty
```

**Suggested Fix:**
The downstream endpoint (T-007, aia-core-u727) **must** validate `len(players) >= 2` before calling `calculate_equity()`. Alternatively, add a guard at the top of `calculate_equity()`:
```python
if len(player_hole_cards) < 2:
    raise ValueError("At least 2 players required for equity calculation")
```

**Impact:** If the T-007 endpoint omits validation, invalid requests would produce a 500 Internal Server Error instead of a 422.

---

### [MEDIUM] M-1: No input validation on card data

**File:** `src/app/services/equity.py`
**Line(s):** 112–121
**Category:** correctness

**Problem:**
`calculate_equity()` performs no validation on its inputs:
- Each player is assumed to have exactly 2 hole cards
- Community cards are assumed to be 0–5
- Rank/suit strings are assumed to be valid keys in `RANK_VAL`/`SUIT_VAL`
- No duplicate-card detection across players and community cards

Invalid rank/suit values cause a `KeyError` in `_to_internal()`. Duplicate cards silently produce incorrect equity results.

**Code:**
```python
players = [[_to_internal(c) for c in hc] for hc in player_hole_cards]
board = [_to_internal(c) for c in community_cards]
```

**Suggested Fix:**
This is acceptable if the API boundary (T-007 endpoint) validates all inputs before calling this function. Document the preconditions in the docstring. If this function is ever exposed directly, add guards.

**Impact:** Low risk if T-007 validates properly; confusing error messages (KeyError, wrong results) if not.

---

### [MEDIUM] M-2: AC #1 tolerance deviation — test uses ±4% vs AC's ±1%

**File:** `test/test_equity.py`
**Line(s):** 24–27
**Category:** correctness

**Problem:**
AC #1 states "returns equity within ±1% of known AA vs KK equity (~81% vs 19%)". The test asserts `±0.04` (4%). With unseeded Monte Carlo at 5,000 iterations, the standard error is ~0.55%, so ±1% would fail approximately 7% of the time. The ±4% tolerance is the practical choice, but it deviates from the literal AC text.

**Code:**
```python
assert abs(result[0] - 0.81) < 0.04
assert abs(result[1] - 0.19) < 0.04
```

**Suggested Fix:**
Either (a) update AC #1 to say "within ±4%" to match reality, or (b) add an optional `seed` parameter to `calculate_equity()` for deterministic testing and tighten the tolerance.

**Impact:** Cosmetic AC mismatch. Tests are not flaky at ±4% and correctly validate the evaluator.

---

### [LOW] L-1: No seeding mechanism for Monte Carlo reproducibility

**File:** `src/app/services/equity.py`
**Line(s):** 135–140
**Category:** design

**Problem:**
The Monte Carlo path uses `random.shuffle(deck)` without any seeding option. This means preflop equity results vary across runs, tests must use wide tolerances, and debugging non-deterministic failures is difficult.

**Code:**
```python
for _ in range(iters):
    random.shuffle(deck)
    b = board + deck[:remaining]
```

**Suggested Fix:**
Accept an optional `rng: random.Random | None = None` parameter. Default to `random.Random()` (non-seeded) in production; tests pass `random.Random(42)` for determinism. This is a nice-to-have for future improvement.

**Impact:** No functional bug. Slight testing ergonomics cost.

---

### [LOW] L-2: Unused module-level constant `B5`

**File:** `src/app/services/equity.py`
**Line(s):** 13
**Category:** convention

**Problem:**
`B5 = B ** 5` is defined but never referenced in the module. The original JS uses it in `handCategory()`, which was not ported.

**Code:**
```python
B5 = B ** 5
```

**Suggested Fix:**
Remove `B5 = B ** 5` or port `handCategory()` if it will be needed by the equity endpoint (T-007).

**Impact:** Dead code; minor clutter.

---

## Positives

1. **Faithful port** — The Python implementation precisely mirrors the JS evaluator's logic (rank values, score encoding, hand categories, evaluation approach). Side-by-side comparison confirms structural equivalence.

2. **Clean use of itertools** — The exhaustive branch uses `itertools.combinations` instead of nested loops, which is both more Pythonic and less error-prone than the JS original.

3. **Good test coverage** — 14 tests across 4 logical groups (return type, known scenarios, algorithm selection, hand ranking) with well-chosen scenarios. Both deterministic and Monte Carlo paths are exercised.

4. **Correct hand evaluation** — All poker hand categories (high card through straight flush) are properly identified and ranked. Edge cases (ace-low straight/wheel, straight flush wheel) are correctly handled. Kicker ordering is correct for all hand types.

5. **Split-pot handling** — Ties are correctly detected and equity is divided evenly among winners.

6. **Standard library only** — No external dependencies as required by the AC.

---

## Overall Assessment

The equity evaluator is a clean, correct port of the JS original. The hand ranking logic is sound — all 9 hand categories are properly evaluated with correct kicker ordering. The exhaustive/Monte Carlo threshold works correctly at the ≤2 boundary. All 14 tests pass.

**One HIGH finding**: the function crashes on empty player input. This **must** be guarded in the T-007 endpoint (aia-core-u727) that will call this function. Two MEDIUM findings (missing input validation and AC tolerance deviation) are manageable — the API boundary is the right place for validation, and the tolerance gap should be documented.

**Recommendation:** Proceed to T-007 implementation. Ensure the endpoint validates `len(players) >= 2` and that all card inputs are valid before calling `calculate_equity()`. Consider removing `B5` and documenting preconditions in the function docstring.
