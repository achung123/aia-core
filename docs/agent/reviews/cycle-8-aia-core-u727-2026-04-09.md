# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** T-007 — Add equity computation endpoint
**Reviewer:** Scott (automated)
**Cycle:** 8

**Task:** T-007 — Add equity computation endpoint
**Beads ID:** aia-core-u727
**Epic:** dealer-viz-004

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
| 1 | Returns equity for each player with non-null hole cards | SATISFIED | `test_equity_api.py::TestEquityEndpointHappyPath::test_two_players_preflop_returns_equities`, endpoint filters `ph.card_1 is None or ph.card_2 is None` at `hands.py` L137–L138 | Players with null holes correctly excluded |
| 2 | Returns empty equities list if <2 players have cards | SATISFIED | `test_equity_api.py::TestEquityEndpointTooFewPlayers` (2 tests), guard at `hands.py` L143–L144 | Both zero-card and one-card scenarios tested |
| 3 | Returns 404 if game or hand doesn't exist | SATISFIED | `test_equity_api.py::TestEquityEndpoint404` (2 tests), HTTPException at `hands.py` L128 and L136 | Consistent with existing 404 pattern |
| 4 | Response matches expected equity values for a test fixture | SATISFIED | `test_equity_api.py::TestEquityEndpointHappyPath::test_aa_vs_kk_equity_values` asserts AA ~81% vs KK ~19% ±5% | Values verified within tolerance |
| 5 | API client function added to `frontend/src/api/client.js` | SATISFIED | `fetchEquity(gameId, handNumber)` at `client.js` L114–L116 | Follows existing `request()` helper pattern |

---

## Findings

### [MEDIUM] Response constructed with dict literals instead of Pydantic model instances

**File:** `src/app/routes/hands.py`
**Line(s):** 156–159
**Category:** convention

**Problem:**
The `EquityResponse` is constructed using inline dict literals in the list comprehension:
```python
return EquityResponse(
    equities=[
        {'player_name': name, 'equity': round(eq, 4)}
        for (name, _), eq in zip(players_with_cards, equities)
    ]
)
```
While Pydantic v2 coerces dicts to `PlayerEquityEntry` during validation, other endpoints in this codebase construct response models using explicit model instances (e.g., `PlayerHandResponse(player_hand_id=..., ...)`). Using `PlayerEquityEntry(player_name=name, equity=round(eq, 4))` would be more consistent and provide immediate IDE type-checking.

**Suggested Fix:**
```python
return EquityResponse(
    equities=[
        PlayerEquityEntry(player_name=name, equity=round(eq, 4))
        for (name, _), eq in zip(players_with_cards, equities)
    ]
)
```
Also add `PlayerEquityEntry` to the import block.

**Impact:** Minor consistency issue. No runtime behavior difference.

---

### [LOW] N+1 query on Player table for each player_hand

**File:** `src/app/routes/hands.py`
**Line(s):** 139
**Category:** design

**Problem:**
Inside the loop over `hand.player_hands`, a separate `db.query(Player)` is issued for each player hand to resolve the player name. This is an N+1 query pattern.

```python
for ph in hand.player_hands:
    if ph.card_1 is None or ph.card_2 is None:
        continue
    player = db.query(Player).filter(Player.player_id == ph.player_id).first()
```

**Suggested Fix:**
Pre-fetch players in a single query before the loop:
```python
player_ids = [ph.player_id for ph in hand.player_hands]
players_map = {p.player_id: p for p in db.query(Player).filter(Player.player_id.in_(player_ids)).all()}
```

**Impact:** Minimal for typical poker table sizes (2–10 players). This is consistent with the existing N+1 pattern in `list_hands` and `get_hand` — flagging for awareness, not a regression.

---

### [LOW] `_db_card_to_tuple` lacks direct unit test coverage

**File:** `src/app/routes/hands.py`
**Line(s):** 118–120
**Category:** correctness

**Problem:**
The `_db_card_to_tuple` helper function is only tested indirectly through the API endpoint tests. While the current implementation correctly handles standard cases ("AS" → `("A", "s")`, "10H" → `("10", "h")`), a direct unit test would guard against regressions if the card format ever changes.

**Suggested Fix:**
Add a small unit test in `test_equity_api.py`:
```python
from app.routes.hands import _db_card_to_tuple

def test_db_card_to_tuple_standard():
    assert _db_card_to_tuple("AS") == ("A", "s")
    assert _db_card_to_tuple("10H") == ("10", "h")
    assert _db_card_to_tuple("2C") == ("2", "c")
```

**Impact:** Low risk — current API tests exercise the function through the full stack. Direct tests would be a nice-to-have.

---

## Positives

- **Clean TDD discipline**: 9 well-structured API tests organized by acceptance criterion, with clear class names (`TestEquityEndpointHappyPath`, `TestEquityEndpointTooFewPlayers`, `TestEquityEndpoint404`, `TestEquityEndpointNullCardsExcluded`)
- **Consistent error handling**: 404 checks for both game and hand follow the exact same pattern as every other endpoint in `hands.py`
- **`_db_card_to_tuple` handles multi-char ranks correctly**: The slice `card_str[:-1]` correctly handles "10S" → ("10", "s"), which is the only multi-character rank
- **Equity service is well-separated**: `calculate_equity()` is a pure function in its own service module with 18 dedicated unit tests — clean separation of concerns
- **Frontend client follows existing pattern**: `fetchEquity()` uses the shared `request()` helper, consistent with all other API functions
- **Full test suite passes**: 836 tests, 0 failures, no regressions

---

## Overall Assessment

**CLEAN** — The equity endpoint implementation is well-structured, correctly tested, and follows established project conventions. All 5 acceptance criteria are fully satisfied. The 3 findings are minor (0 CRITICAL, 0 HIGH) and do not block acceptance. The endpoint correctly converts DB card format to equity-calculator tuples, handles edge cases (missing game/hand, insufficient players), and returns properly validated responses. The equity calculator itself (T-006) is thoroughly tested with 18 unit tests covering known equity scenarios, algorithm selection, hand evaluation, and edge cases.

**Test results:** 836 passed, 0 failures (full suite) | 27 passed (equity-specific)
