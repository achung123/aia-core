# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `aia-core-9gaj — Auto-seat assignment on game creation`
**Reviewer:** Scott (automated)
**Cycle:** 8

**Task:** T-044 — Auto-seat assignment on game creation
**Beads ID:** aia-core-9gaj

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
| 1 | POST /games assigns sequential seat_number (1,2,3...) in player order | SATISFIED | `src/app/routes/games.py` L114-120; `test_post_games_assigns_sequential_seat_numbers` | `seat = len(seen_player_ids)` after set-add gives 1-based sequential ordering |
| 2 | POST /games/{id}/players assigns max(existing seat_numbers) + 1 | SATISFIED | `src/app/routes/games.py` L437-442; `test_add_player_assigns_max_plus_one` | `(max_seat or 0) + 1` correctly handles empty-table edge case |
| 3 | Toggling player active/inactive does NOT change seat number | SATISFIED | `src/app/routes/games.py` L461-510; `test_toggle_active_preserves_seat_number` | `toggle_player_status` only sets `gp.is_active`, never touches `seat_number` |
| 4 | GameSessionResponse includes seat_number per player | SATISFIED | `src/pydantic_models/app_models.py` L143 `PlayerInfo.seat_number`; `test_game_session_response_includes_seat_number` | `_build_players()` queries and maps `seat_number` from `GamePlayer` |
| 5 | Tests cover creation ordering, mid-game addition, stability after toggle | SATISFIED | `test/test_seat_number_assignment.py` — 4 tests covering all three scenarios | All 4 tests passing |
| 6 | uv run pytest test/ passes | SATISFIED | Task close reason: 1161 tests passing; seat tests: 4/4 passed | Confirmed via `uv run pytest test/test_seat_number_assignment.py -v` |

---

## Findings

### [MEDIUM] F-020: No unique constraint on (game_id, seat_number) — concurrent add-player race

**File:** `src/app/database/models.py`
**Line(s):** 60-64
**Category:** design

**Problem:**
The `game_players` table has no `UniqueConstraint('game_id', 'seat_number')`. The add-player endpoint reads `max(seat_number)` and writes `max + 1` in separate SQL statements without any locking. Two concurrent `POST /games/{id}/players` requests could read the same max and insert duplicate seat numbers.

This is a known gap (previously flagged as F-017 during earlier reviews). SQLite serializes writes so the risk is low in the current deployment, but the code has no defense-in-depth at the database level.

**Code:**
```python
# games.py L437-442
max_seat = (
    db.query(func.max(GamePlayer.seat_number))
    .filter(GamePlayer.game_id == game_id)
    .scalar()
)
next_seat = (max_seat or 0) + 1
```

**Suggested Fix:**
Add a `UniqueConstraint('game_id', 'seat_number', name='uq_game_seat')` to `GamePlayer.__table_args__` and an Alembic migration to enforce it. Optionally, wrap the read-assign-insert in a `SELECT ... FOR UPDATE` or use `INSERT ... ON CONFLICT` retry logic for PostgreSQL compatibility.

**Impact:** Duplicate seat numbers could occur under concurrent load if the database engine is upgraded beyond SQLite. Low risk today, but a latent defect.

---

### [LOW] F-021: Missing edge-case test — add player to a game with zero existing players

**File:** `test/test_seat_number_assignment.py`
**Line(s):** 19-38
**Category:** correctness

**Problem:**
The `test_add_player_assigns_max_plus_one` test creates a game with 2 players, then adds a third. There is no test exercising the add-player endpoint on a game with 0 existing players. The code handles this correctly via `(max_seat or 0) + 1`, but the path is untested.

In practice, `GameSessionCreate` enforces `min_length=1` for `player_names`, so a game always starts with at least one player. The zero-player scenario would only arise via direct DB manipulation or future API changes.

**Suggested Fix:**
Consider adding a test that creates a game, removes all players via direct DB setup, then adds one via the API — or accept the risk given the `min_length=1` constraint.

**Impact:** Minimal. The code path is correct; this is a coverage completeness note.

---

## Positives

- **Clean seat assignment logic**: Using `len(seen_player_ids)` in create-game elegantly handles deduplication and produces correct 1-based sequential seats in a single pass.
- **Proper empty-table guard**: `(max_seat or 0) + 1` in add-player gracefully handles the edge case where no players exist.
- **_build_players ordering**: Querying with `.order_by(GamePlayer.seat_number)` ensures players are returned in seat order, which is useful for the frontend.
- **Toggle isolation**: The toggle endpoint cleanly only touches `is_active`, preventing accidental seat mutation.
- **Good test coverage**: 4 focused tests map directly to the 5 acceptance criteria (creation, addition, toggle stability, and response shape).
- **Existing patterns followed**: The implementation is consistent with the existing route/model/test patterns in the codebase.

---

## Overall Assessment

The implementation is solid and correctly satisfies all 6 acceptance criteria. The seat assignment logic is straightforward, edge cases are handled, and the toggle endpoint is properly isolated from seat data. The only design gap is the lack of a DB-level uniqueness constraint on `(game_id, seat_number)`, which is a pre-existing known issue (F-017/F-020) with low risk under the current SQLite deployment. Zero CRITICAL or HIGH findings.
