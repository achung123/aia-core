# Code Review Report — aia-core (Cycle 8)

**Date:** 2026-04-15
**Target:** `backend/test/test_player_trends_api.py`
**Reviewer:** Scott (automated)
**Cycle:** 8
**Beads ID:** aia-core-1cu
**Task:** Backend test suite for trend endpoint

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
| 1 | Test: player with multiple sessions returns correct per-session stats | SATISFIED | `test_returns_multiple_sessions_sorted_by_date` seeds two sessions for 'bob' and asserts per-session `hands_played`, `hands_won`, `win_rate`, `profit_loss` | Also verified ordering |
| 2 | Test: player with no games returns empty list | SATISFIED | `test_returns_empty_list_for_player_with_no_hands` creates a player with no hands, asserts `resp.json() == []` | |
| 3 | Test: nonexistent player returns 404 | SATISFIED | `test_returns_404_for_nonexistent_player` hits `/stats/players/ghost_player/trends`, asserts 404 | |
| 4 | Test: win rate calculation is correct (e.g. 2 wins out of 5 = 40.0) | SATISFIED | `test_win_rate_two_out_of_five` seeds 5 hands (2 won), asserts `win_rate == 40.0` | Additional coverage in `test_win_rate_calculation_hands_won_over_total` (1/4 = 25%) |
| 5 | Tests use the in-memory SQLite fixture from conftest.py | SATISFIED | All tests accept `client` and `db_session` fixtures from conftest.py, which use `sqlite:///:memory:` with `StaticPool` | |

---

## Findings

### [MEDIUM] Unused `client` parameter in `_seed_game_with_hands` helper

**File:** `backend/test/test_player_trends_api.py`
**Line(s):** 7
**Category:** convention

**Problem:**
The `_seed_game_with_hands` helper accepts `client` as its first parameter but never uses it. All 7 call-sites pass `client`, but the function only operates on `db_session` to insert ORM objects directly. This is misleading — a reader might expect the helper to make HTTP calls through the test client.

**Code:**
```python
def _seed_game_with_hands(client, db_session, game_date, player_name, results):
```

**Suggested Fix:**
Remove the `client` parameter from the function signature and all call-sites.

**Impact:** No runtime impact, but hurts readability and could confuse future contributors.

---

### [LOW] Docstring lists `client` as a real parameter

**File:** `backend/test/test_player_trends_api.py`
**Line(s):** 14
**Category:** convention

**Problem:**
The docstring for `_seed_game_with_hands` documents `client` as "TestClient instance", reinforcing the impression that the parameter is used.

**Code:**
```python
    Args:
        client: TestClient instance.
```

**Suggested Fix:**
Remove the `client` line from the Args docstring once the parameter is removed.

**Impact:** Minor documentation inaccuracy.

---

## Positives

- **Thorough AC coverage** — all five acceptance criteria are directly and unambiguously satisfied by named tests.
- **Extra coverage beyond ACs** — `test_case_insensitive_player_name` and `test_excludes_handed_back_results` go beyond the stated requirements, catching real edge cases (case sensitivity matches the `func.lower` query logic; `handed_back` exclusion matches the `ResultEnum.HANDED_BACK` filter).
- **Well-structured helper** — `_seed_game_with_hands` keeps test bodies focused on assertions rather than setup boilerplate.
- **Assertion quality** — tests assert on multiple response fields (`hands_played`, `hands_won`, `win_rate`, `profit_loss`, `game_date`) rather than just status codes.
- **Correct win-rate math** — uses `round(2/3 * 100, 2)` and `round(1/3 * 100, 2)` to match the production rounding exactly, avoiding brittle float comparisons.

---

## Overall Assessment

The test file is well-written and provides complete coverage of all acceptance criteria. The two findings are minor convention issues (an unused parameter and its stale docstring), neither of which affect correctness or test reliability. No critical or high-severity issues found.
