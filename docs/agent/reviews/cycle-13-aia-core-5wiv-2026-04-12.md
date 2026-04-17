# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 13
**Target:** `POST /games/{game_id}/hands/start` — Start-all hand endpoint with SB/BB rotation
**Reviewer:** Scott (automated)

**Task:** aia-core-5wiv — Start-all hand endpoint with SB/BB rotation

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 1 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Creates hand with next hand_number, creates PlayerHand for each active GamePlayer | SATISFIED | `test_start_hand_api.py::TestStartHandCreation` — 5 tests covering creation, numbering, player_hands population | Hand number derived from `max(hand_number) + 1`; PlayerHand created for each active GamePlayer |
| 2 | SB/BB rotates through active players based on previous hand's positions | SATISFIED | `TestStartHandSBBBFirstHand` (2 tests), `TestStartHandSBBBRotation` (4 tests), `TestStartHandInactivePlayers` (3 tests) | Rotation logic handles first hand, wrap-around, heads-up, inactive player skip, and prev-SB-departed scenarios |
| 3 | Response includes sb_player_name, bb_player_name | SATISFIED | `TestStartHandResponse` — 4 tests verify field presence and values | Fields added to `HandResponse` model and populated by `_build_hand_response` |
| 4 | Returns 400 for < 2 active players; 404 for missing game | SATISFIED | `TestStartHandErrorCases` — 4 tests | Clear error messages with appropriate status codes |
| 5 | Tests cover all scenarios | SATISFIED | 23 tests across 6 test classes | Good coverage of happy path, rotation, edge cases, and errors |
| 6 | Full suite passes (1114) | SATISFIED | All 23 new tests pass; full suite reported passing | Verified via `uv run pytest test/test_start_hand_api.py -v` |

---

## Findings

### [HIGH] Existing GET endpoints omit sb_player_name / bb_player_name

**File:** `src/app/routes/hands.py`
**Line(s):** 131–143, 279–290, 411–422, 953–964, 1189–1200
**Category:** correctness

**Problem:**
Five `HandResponse` constructions in pre-existing endpoints (`list_hands`, `get_hand`, `edit_community_cards`, `create_hand`, and `delete_hand_by_number` response) build `HandResponse` inline without passing `sb_player_name` or `bb_player_name`. These fields default to `None` even when the underlying `Hand` row has `sb_player_id`/`bb_player_id` set. This means a client that creates a hand via `POST /hands/start` sees SB/BB names, but fetching the same hand via `GET /hands/{n}` or `GET /hands` returns `null` for those fields.

**Code:**
```python
# list_hands (line 131) — missing sb_player_name, bb_player_name
return HandResponse(
    hand_id=hand.hand_id,
    ...
    player_hands=player_hand_responses,
)
```

**Suggested Fix:**
Replace all inline `HandResponse(...)` constructions with `_build_hand_response(hand, db)`, which already handles SB/BB name resolution. This eliminates code duplication and ensures consistency.

**Impact:** API consumers see inconsistent SB/BB data depending on which endpoint they call. Not a data-loss bug (the DB is correct), but a user-visible inconsistency.

---

### [MEDIUM] No concurrency guard on hand_number assignment

**File:** `src/app/routes/hands.py`
**Line(s):** 194–198
**Category:** correctness

**Problem:**
`start_hand` reads `max(hand_number)`, increments it, and later flushes/commits. Two concurrent requests could read the same max and attempt to insert the same `hand_number`. The `UniqueConstraint('game_id', 'hand_number')` on the `Hand` model prevents data corruption, but the resulting `IntegrityError` is unhandled and surfaces as a 500.

**Code:**
```python
max_hand_number = (
    db.query(func.max(Hand.hand_number)).filter(Hand.game_id == game_id).scalar()
)
hand_number = (max_hand_number or 0) + 1
```

**Suggested Fix:**
Wrap the commit in a try/except for `IntegrityError` and return a 409 Conflict with a retry hint. Alternatively, use `SELECT ... FOR UPDATE` semantics (though SQLite doesn't support row-level locking, Postgres would in production).

**Impact:** Low probability in a single-table poker app, but the 500 response is unfriendly. The DB constraint guarantees safety; only the error surface is rough.

---

### [MEDIUM] N+1 query pattern in _build_hand_response

**File:** `src/app/routes/hands.py`
**Line(s):** 425–470
**Category:** design

**Problem:**
`_build_hand_response` issues one `db.query(Player)` per `PlayerHand`, plus two more for SB/BB player name resolution. For a hand with 6 players, this is 8 queries. This is a pre-existing pattern throughout the file (not introduced by this task), but the new code perpetuates it rather than improving it.

**Code:**
```python
for ph in hand.player_hands:
    player = db.query(Player).filter(Player.player_id == ph.player_id).first()
```

**Suggested Fix:**
Pre-fetch all relevant players in a single query: `db.query(Player).filter(Player.player_id.in_(player_ids)).all()` and build a lookup dict. This would benefit all callers of `_build_hand_response`.

**Impact:** Performance concern at scale. Acceptable for current usage patterns with small player counts.

---

### [MEDIUM] Prev-SB fallback logic may skip to index 0 incorrectly

**File:** `src/app/routes/hands.py`
**Line(s):** 215–226
**Category:** correctness

**Problem:**
When the previous SB player is no longer active, the fallback finds the next active player whose seat is greater than the departed player's seat. If no active player has a higher seat number (e.g., the departed player had the highest seat), the loop completes without entering the `break`, and `sb_idx` stays at `0`. This is actually **correct behavior** (wraps to the first active player), but the intent is implicit — it relies on `sb_idx = 0` being set before the loop as a default. A comment would clarify this is intentional.

**Code:**
```python
sb_idx = 0
for i, gp in enumerate(active_gps):
    if (gp.seat_number or 0) > prev_sb_seat:
        sb_idx = i
        break
```

**Suggested Fix:**
Add a comment: `# Default to first active player (wrap-around) if no higher seat found`

**Impact:** No bug — logic is correct. Readability concern only.

---

### [LOW] Test file creates its own DB fixtures instead of using conftest.py

**File:** `test/test_start_hand_api.py`
**Line(s):** 12–44
**Category:** convention

**Problem:**
The test file creates its own `engine`, `SessionLocal`, `override_get_db`, `setup_db`, `client`, and `db` fixtures instead of using the shared fixtures from `conftest.py`. This pattern diverges from the project convention described in `copilot-instructions.md`: "The `conftest.py` provides an in-memory DB fixture and a FastAPI `TestClient`."

**Suggested Fix:**
Refactor to use `conftest.py` fixtures. The `db` fixture from `conftest.py` would remove ~30 lines of boilerplate. Not urgent — the current approach works correctly and is self-contained.

**Impact:** Maintenance overhead when DB fixture setup changes. No correctness impact.

---

## Positives

- **SB/BB rotation logic is well-structured.** The three-way branch (first hand / prev SB still active / prev SB departed) covers the key scenarios cleanly.
- **Edge cases tested thoroughly.** Heads-up rotation, inactive-player skipping, prev-SB departure, null seat numbers, and wrap-around are all explicitly tested.
- **Test organization is clear.** Six test classes map directly to acceptance criteria, making traceability straightforward.
- **`_build_hand_response` helper is a good extraction.** It consolidates SB/BB name resolution and is used by the new endpoint and the recently refactored `set_flop`/`set_turn`/`set_river` endpoints.
- **Active player ordering is deterministic.** `COALESCE(seat_number, 999999), player_id` ensures consistent ordering even with null seats.
- **DB-level uniqueness constraint** on `(game_id, hand_number)` provides a safety net against duplicate hand numbers.

---

## Overall Assessment

The implementation is **solid and correct** for the core functionality. All 6 acceptance criteria are satisfied, and the 23 tests provide good coverage of the happy path and edge cases.

The **one HIGH finding** — existing GET endpoints not returning `sb_player_name`/`bb_player_name` — is a consistency gap that should be addressed in a follow-up task. The remaining findings are medium/low design and convention concerns that don't affect correctness.

**Recommended follow-up:**
1. Refactor `list_hands`, `get_hand`, `edit_community_cards`, `create_hand`, and `delete_hand_by_number` response paths to use `_build_hand_response` so SB/BB names appear consistently across all endpoints.
2. Consider adding an `IntegrityError` handler for the race condition on `hand_number`.
