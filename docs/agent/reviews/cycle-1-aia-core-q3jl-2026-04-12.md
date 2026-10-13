# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 1
**Target:** T-001 — Seat assignment API + conflict checking
**Reviewer:** Scott (automated)

**Task:** T-001 — Seat assignment API + conflict checking
**Beads ID:** aia-core-q3jl
**Epic:** alpha-patch-009

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | `PATCH .../seat` with `{ "seat_number": 3 }` returns 200 and the player's seat is updated | SATISFIED | `test_assign_seat_success` in `test/test_seat_assignment_api.py` | Endpoint at `src/app/routes/games.py` L533–604 |
| AC-2 | Returns 409 when the seat is occupied by another active player | SATISFIED | `test_assign_seat_conflict_returns_409` | Conflict check correctly filters by `is_active.is_(True)` and excludes requesting player |
| AC-3 | Returns 400 when `seat_number` is outside 1–10 | SATISFIED | `test_seat_out_of_range_low_returns_422`, `test_seat_out_of_range_high_returns_422` | Pydantic `Field(ge=1, le=10)` returns 422, not 400 — standard FastAPI behavior; spec AC text is slightly misleading |
| AC-4 | Returns 404 when the player is not in the game | SATISFIED | `test_player_not_in_game_returns_404`, `test_game_not_found_returns_404` | Both missing-player and missing-game cases tested |
| AC-5 | `add_player_to_game` with `seat_number` returns 409 if seat taken | SATISFIED | `test_add_player_with_occupied_seat_returns_409`, `test_add_player_with_seat_success` | Conflict check in `add_player_to_game` at L492–510 |
| AC-6 | Player can reassign to a different open seat (old seat freed) | SATISFIED | `test_reassign_to_different_open_seat` | Test verifies old seat becomes available to another player |
| AC-7 | Pytest tests cover all success and error paths, including concurrent-seat edge case | PARTIAL | 12 tests cover all primary paths | No true concurrency test; conflict-check logic is tested but not under concurrent access |

---

## Findings

### [MEDIUM] M-1: `assign_player_seat` duplicates `_get_game_player()` helper

**File:** `src/app/routes/games.py`
**Line(s):** 540–565 vs 654–680
**Category:** design

**Problem:**
The new `assign_player_seat` endpoint implements its own game → player → game_player lookup chain (3 queries, 3 conditional 404 raises), but there is already a `_get_game_player(db, game_id, player_name)` helper at line 654 that performs the identical lookup pattern. Other endpoints in the same file use this helper.

**Code:**
```python
# assign_player_seat (lines 540-565) — inline lookup
game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
if game is None:
    raise HTTPException(status_code=404, detail='Game session not found')

player = db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
if player is None:
    raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found in this game')

gp = db.query(GamePlayer).filter(...).first()
if gp is None:
    raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found in this game')
```

**Suggested Fix:**
Replace the inline lookup with `game, player, gp = _get_game_player(db, game_id, player_name)`.

**Impact:** Code duplication increases maintenance burden. If the lookup pattern changes (e.g., adding authorization checks), two places need updating.

---

### [MEDIUM] M-2: Auto-assigned seats in `add_player_to_game` can exceed the 1–10 range

**File:** `src/app/routes/games.py`
**Line(s):** 482–489
**Category:** correctness

**Problem:**
When no `seat_number` is provided, the auto-assignment logic computes `next_seat = (max_seat or 0) + 1`. If there are already 10 players, `next_seat` becomes 11, which violates the 1–10 seat constraint enforced by `SeatAssignmentRequest` and `AddPlayerToGameRequest`. The auto-assigned value bypasses Pydantic validation since it's computed server-side.

**Code:**
```python
max_seat = (
    db.query(func.max(GamePlayer.seat_number))
    .filter(GamePlayer.game_id == game_id)
    .scalar()
)
next_seat = (max_seat or 0) + 1
```

**Suggested Fix:**
This is a pre-existing issue that predates T-001, but T-001 formalizes the 1–10 seat range. Consider either: (a) validating `next_seat <= 10` and returning a 409 or assigning `None`, or (b) finding the lowest unoccupied seat in the 1–10 range. File a follow-up task.

**Impact:** Adding an 11th player (or manual seat reassignments that create gaps) can produce seats > 10, inconsistent with the validation constraint on user-provided values.

---

### [LOW] L-1: Error message inconsistency between `assign_player_seat` and existing helpers

**File:** `src/app/routes/games.py`
**Line(s):** 550, 563 vs 626, 639, 663, 676
**Category:** convention

**Problem:**
`assign_player_seat` uses `"Player {player_name!r} not found in this game"` while the existing `_get_game_player` helper and `toggle_player_status` use `"Player {player_name!r} not in this game"`. Minor wording inconsistency.

**Suggested Fix:**
Adopt the existing convention: `"not in this game"`. Would be resolved automatically by using `_get_game_player()` (see M-1).

**Impact:** Cosmetic; slightly inconsistent API error messages.

---

### [LOW] L-2: AC-3 spec says "400" but implementation returns 422

**File:** `specs/alpha-patch-009/tasks.md`
**Line(s):** AC-3
**Category:** convention

**Problem:**
AC-3 states "Returns 400 when seat_number is outside 1–10" but FastAPI + Pydantic validation returns 422 (Unprocessable Entity), which is the framework's standard behavior. The implementation and tests are correct; the spec AC text is imprecise.

**Suggested Fix:**
Update spec AC-3 to say "Returns 422" or "Returns a validation error". No code change needed.

**Impact:** Documentation clarity only.

---

### [LOW] L-3: No concurrency test for AC-7 "concurrent-seat edge case"

**File:** `test/test_seat_assignment_api.py`
**Category:** test gap

**Problem:**
AC-7 explicitly calls for a "concurrent-seat edge case" test, but the test suite only includes serial conflict-checking tests. True concurrent access testing is inherently difficult with SQLite's serialized writes, but a test demonstrating the TOCTOU-safe pattern (e.g., two threads racing to claim the same seat) would satisfy the AC more fully.

**Suggested Fix:**
Consider adding a test that uses threading to simulate two simultaneous seat claims, verifying exactly one succeeds and the other gets 409. Alternatively, document in the test file why true concurrency testing is deferred (SQLite limitation in test env).

**Impact:** Minor test coverage gap. The conflict logic itself is tested; only the concurrency dimension is missing.

---

## Positives

- **Clean validation model**: `SeatAssignmentRequest` with `Field(ge=1, le=10)` is concise and leverages Pydantic's built-in validation correctly.
- **Proper conflict filtering**: Both the PATCH endpoint and the `add_player_to_game` modification correctly filter by `is_active.is_(True)` and (for PATCH) exclude the requesting player, enabling idempotent self-reassignment.
- **Comprehensive test suite**: 12 tests across 2 test classes cover all primary success and error paths — including edge cases like inactive player seats, same-seat idempotency, and auto-assignment backward compatibility.
- **Consistent response model**: The PATCH endpoint returns `PlayerInfo` (including rebuy data), which is richer than a minimal response and consistent with how other endpoints expose player data.
- **Case-insensitive player lookup**: Correctly uses `func.lower()` matching, consistent with the rest of the codebase.

---

## Overall Assessment

The implementation is solid and well-tested. Zero CRITICAL or HIGH findings. The two MEDIUM findings are:
1. A code duplication issue that could be resolved by reusing the existing `_get_game_player()` helper.
2. An auto-seat-assignment edge case at the boundary of 10 seats (pre-existing but now more visible).

All 7 acceptance criteria are **SATISFIED** or **PARTIAL** (AC-7 only due to the concurrency test gap, which is a test environment limitation). The 12 tests pass cleanly. The implementation follows existing codebase patterns for route structure, ORM queries, and error handling.

**Recommendation:** Address M-1 (use `_get_game_player` helper) in a quick follow-up. File a separate task for M-2 (auto-seat overflow). No blockers for merging.
