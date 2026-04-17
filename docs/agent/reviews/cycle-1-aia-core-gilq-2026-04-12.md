# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 1
**Target:** `src/app/routes/hands.py`, `test/test_hand_sb_bb_response.py`
**Reviewer:** Scott (automated)

**Task:** aia-core-gilq — Bug: GET hand endpoints omit sb_player_name/bb_player_name from HandResponse
**Beads ID:** aia-core-gilq

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

The bug description specifies that `list_hands`, `get_hand`, `edit_community_cards`, `record_hand` (POST /hands), and `record_hand_results` all built `HandResponse` inline without `sb_player_name`/`bb_player_name`. The fix was to replace all inline constructions with `_build_hand_response(hand, db)`.

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `list_hands` uses `_build_hand_response` | SATISFIED | `src/app/routes/hands.py` L112 | List comprehension: `[_build_hand_response(hand, db) for hand in hands]` |
| 2 | `get_hand` uses `_build_hand_response` | SATISFIED | `src/app/routes/hands.py` L230 | `return _build_hand_response(hand, db)` |
| 3 | `edit_community_cards` uses `_build_hand_response` | SATISFIED | `src/app/routes/hands.py` L334 | `return _build_hand_response(hand, db)` |
| 4 | `record_hand` uses `_build_hand_response` | SATISFIED | `src/app/routes/hands.py` L850 | `return _build_hand_response(hand, db)` |
| 5 | `record_hand_results` uses `_build_hand_response` | SATISFIED | `src/app/routes/hands.py` L1058 | `return _build_hand_response(hand, db)` |
| 6 | No remaining inline `HandResponse(` in endpoint functions | SATISFIED | grep confirms only L367 inside `_build_hand_response` | All 9 `response_model=HandResponse` endpoints + the list endpoint use `_build_hand_response` |
| 7 | `_build_hand_response` resolves sb/bb player names | SATISFIED | `src/app/routes/hands.py` L356-366 | Queries Player table for sb_player_id/bb_player_id with None guards |
| 8 | Tests cover all 5 fixed endpoints | SATISFIED | `test/test_hand_sb_bb_response.py` — 5 tests | TestGetHandSbBb, TestListHandsSbBb, TestEditCommunityCardsSbBb, TestRecordHandSbBb, TestRecordHandResultsSbBb |
| 9 | All tests pass | SATISFIED | `uv run pytest test/test_hand_sb_bb_response.py` — 5 passed | 0.29s |

---

## Findings

### [MEDIUM] F-001: Test file duplicates conftest fixtures instead of reusing them

**File:** `test/test_hand_sb_bb_response.py`
**Line(s):** 1-48
**Category:** convention

**Problem:**
The test file creates its own `engine`, `SessionLocal`, `override_get_db`, `setup_db`, and `client` fixtures that are identical to those in `test/conftest.py`. The `db` fixture is the only addition not in conftest.

**Justification:**
This is a pre-existing pattern in the codebase (e.g., `test_dealer_flow_smoke.py` does the same). The `db` fixture is necessary because conftest does not expose a raw DB session fixture. This test needs direct DB access to set `seat_number` on `GamePlayer` rows.

**Suggested Fix:**
Add a `db` fixture to `test/conftest.py` and remove the duplicated setup from this file (and others). This is a broader refactor outside the scope of this bug fix.

**Impact:** Maintenance burden — if conftest changes, these isolated fixtures drift.

---

### [MEDIUM] F-002: SB/BB player name lookup queries Player table redundantly

**File:** `src/app/routes/hands.py`
**Line(s):** 340-366
**Category:** design

**Problem:**
`_build_hand_response` queries `Player` once per `PlayerHand` (N+1 pattern), then queries `Player` again for `sb_player_id` and `bb_player_id`. If the SB or BB player already appeared in `hand.player_hands`, the name was already fetched but is looked up again.

**Code:**
```python
for ph in hand.player_hands:
    player = db.query(Player).filter(Player.player_id == ph.player_id).first()
    # ...
sb_player = db.query(Player).filter(Player.player_id == hand.sb_player_id).first()
bb_player = db.query(Player).filter(Player.player_id == hand.bb_player_id).first()
```

**Suggested Fix:**
Build a `player_id → name` lookup dict in one pass to avoid redundant queries. This is a performance optimization outside the scope of this bug fix.

**Impact:** Minor — SQLite is fast and hands have few players, but the pattern will scale poorly.

---

### [LOW] F-003: test_record_hand_returns_sb_bb_fields uses weak assertion

**File:** `test/test_hand_sb_bb_response.py`
**Line(s):** 143-144
**Category:** correctness

**Problem:**
The test for `record_hand` (POST /hands) only asserts `'sb_player_name' in data` and `'bb_player_name' in data` — verifying field presence but not value. Since `record_hand` doesn't set SB/BB, the expected value is `None`, which should be asserted explicitly.

**Code:**
```python
assert 'sb_player_name' in data
assert 'bb_player_name' in data
```

**Suggested Fix:**
```python
assert data['sb_player_name'] is None
assert data['bb_player_name'] is None
```

**Impact:** Low — the test catches the original bug (field missing entirely would cause KeyError), but a value-level assertion is more robust.

---

## Positives

- **Complete fix:** All 5 originally-identified inline `HandResponse` constructions were replaced. Additionally, the 4 newer endpoints (`set_flop`, `set_turn`, `set_river`, `start_hand`) also use `_build_hand_response`, ensuring consistency across all 9 `HandResponse`-returning endpoints.
- **Clean helper function:** `_build_hand_response` properly handles `None` guards for both `sb_player_id` and `bb_player_id`, and handles the case where a player lookup returns `None`.
- **Good test structure:** 5 tests cover all 5 affected endpoints with clear class-based organization and a shared helper for game/hand setup.
- **Tests verify round-trip consistency:** Tests compare SB/BB names from `POST /hands/start` against subsequent GET/PATCH responses, ensuring the fix actually resolves the inconsistency described in the bug.

---

## Overall Assessment

The bug fix is **complete and correct**. All inline `HandResponse` constructions in endpoint functions have been replaced with `_build_hand_response(hand, db)`. The helper function properly resolves `sb_player_name` and `bb_player_name` from the database. Tests are well-structured and cover all affected endpoints. The 3 findings are all pre-existing patterns (MEDIUM) or minor improvement suggestions (LOW) — none are introduced regressions. Zero CRITICAL or HIGH issues.
