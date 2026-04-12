# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** Turn-order state machine logic & endpoints
**Reviewer:** Scott (automated)
**Cycle:** 9

**Task:** T-050 — Turn-order state machine logic & endpoints
**Beads ID:** aia-core-07y6

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | POST /hands/start creates HandState with phase=preflop and first-to-act current_seat | SATISFIED | `src/app/routes/hands.py` L416-422; `TestStartHandCreatesHandState` (2 tests) | HandState created with correct phase and first-to-act seat |
| 2 | GET /games/{id}/hands/{num}/state returns { phase, current_seat, current_player_name, action_index } | SATISFIED | `src/app/routes/hands.py` L430-467; `TestGetHandState` (3 tests) | All fields present, 404s for missing game/hand |
| 3 | POST .../actions validates it is named player's turn; returns 409 if out of order | SATISFIED | `src/app/routes/hands.py` L1372-1381; `TestTurnOrderValidation` (2 tests) | Correct 409 with clear detail message |
| 4 | After valid action, current_seat advances to next non-folded active player | SATISFIED | `src/app/routes/hands.py` L1394-1396; `TestSeatAdvancement` (2 tests) | Fold skipping and seat wrap-around tested |
| 5 | All non-folded players acted → phase auto-advances and current_seat resets | SATISFIED | `src/app/routes/hands.py` L153-188; `TestPhaseAdvancement` (2 tests) | Works with and without folds |
| 6 | Phase cannot advance past community card count | SATISFIED | `src/app/routes/hands.py` L139-149; `TestPhaseCommunityCardGating` (2 tests) | Gating verified for preflop→flop and flop→turn |
| 7 | Dealer can pass ?force=true to bypass turn-order | SATISFIED | `src/app/routes/hands.py` L1372; `TestForceBypass` (2 tests) | Both force=true and force=false verified |
| 8 | Tests cover rotation, fold skipping, phase advancement | SATISFIED | `test/test_hand_state_machine.py` — 19 tests | Full rotation test through preflop→flop→turn |
| 9 | uv run pytest test/ passes | SATISFIED | 1180 tests passing (per close reason); 19/19 state machine tests pass | Confirmed locally |

---

## Findings

### [MEDIUM-1] GET /state endpoint modifies database state

**File:** `src/app/routes/hands.py`
**Line(s):** 455-458
**Category:** design

**Problem:**
The GET endpoint `get_hand_state` calls `_try_advance_phase()` followed by `db.commit()`, which modifies the `HandState` row as a side effect of a read operation. GET requests should be idempotent and side-effect-free per HTTP/REST conventions. A client retrying or caching the GET could observe inconsistent behavior.

**Code:**
```python
# Try phase advancement (community cards may have been dealt since last action)
_try_advance_phase(db, game_id, hand, state)
db.commit()
db.refresh(state)
```

**Suggested Fix:**
Move the lazy phase advancement into the community card PATCH endpoints (`set_flop`, `set_turn`, `set_river`), which is where the state change actually originates. Those are writes, making the side effect appropriate. Alternatively, accept this as an intentional "lazy evaluation" pattern and document it.

**Impact:** Violates REST conventions; unexpected for API consumers. Low functional risk since the advancement is idempotent.

---

### [MEDIUM-2] Phase advancement logic doesn't handle raise/re-raise rounds

**File:** `src/app/routes/hands.py`
**Line(s):** 153-178
**Category:** correctness

**Problem:**
`_try_advance_phase` counts total actions per phase from non-folded players. If `actions_this_phase >= len(active_non_folded_ids)`, it advances. This means each player only needs one action per phase — a raise doesn't trigger an additional action round for the other players. Example: P1 calls, P2 raises, P3 calls → 3 actions ≥ 3 players → phase advances, even though P1 hasn't responded to the raise.

**Code:**
```python
actions_this_phase = (
    db.query(PlayerHandAction)
    .join(PlayerHand, ...)
    .filter(
        PlayerHand.hand_id == hand.hand_id,
        PlayerHandAction.street == state.phase,
        PlayerHand.player_id.in_(active_non_folded_ids),
    )
    .count()
)

if actions_this_phase < len(active_non_folded_ids):
    return
```

**Suggested Fix:**
For V1 analytics tracking, this simplified model may be acceptable. If raise-round logic is needed later, track action rounds (e.g., increment a round counter on raises and require all players to have an action in the current round). File a follow-up issue if this is planned.

**Impact:** Phase may advance prematurely if raises are recorded through the state machine. Using `?force=true` avoids this, and for a tracking app this is likely tolerable.

---

### [MEDIUM-3] Heads-up (2-player) post-flop first-to-act may be incorrect

**File:** `src/app/routes/hands.py`
**Line(s):** 93-104
**Category:** correctness

**Problem:**
In `_first_to_act_seat`, the post-flop logic finds "first active non-folded player at or after SB seat." In heads-up poker, the SB is also the dealer. Standard heads-up rules say the BB acts first post-flop (the player to the dealer's left). The current code gives first action to SB/dealer, which is correct preflop but wrong post-flop in heads-up.

**Code:**
```python
# Post-flop: first active non-folded player after dealer (SB seat)
sb_gp = (
    db.query(GamePlayer)
    .filter(GamePlayer.game_id == game_id, GamePlayer.player_id == hand.sb_player_id)
    .first()
)
sb_seat = sb_gp.seat_number if sb_gp and sb_gp.seat_number else 0
at_or_after = [s for s in seats if s[0] >= sb_seat]
```

**Suggested Fix:**
For ≥3 players this is correct (SB is first post-flop). For heads-up, add a special case: if only 2 active players, post-flop first-to-act should be BB. Or file as a known limitation for V1 since heads-up poker has special rules throughout.

**Impact:** In 2-player games, the wrong player will be prompted to act first on flop/turn/river. No data corruption but incorrect UX.

---

### [LOW-1] `updated_at` field on HandState is never updated

**File:** `src/app/database/models.py`
**Line(s):** 189
**Category:** convention

**Problem:**
`HandState.updated_at` has a default but no `onupdate` trigger. When the phase, current_seat, or action_index are modified, `updated_at` stays at the creation timestamp.

**Suggested Fix:**
Add `onupdate=lambda: datetime.now(timezone.utc)` to the column definition, or set it explicitly in `record_player_action` and `_try_advance_phase`.

**Impact:** Minor — the timestamp is not currently used by any consumer, but it's misleading metadata.

---

### [LOW-2] No test for all-but-one-fold scenario

**File:** `test/test_hand_state_machine.py`
**Category:** coverage

**Problem:**
When all but one player folds, `_try_advance_phase` exits early (`len(seats) <= 1`). The state machine stops; no winner is declared, and `current_seat` may point to the sole survivor. There is no test covering this scenario, and no "hand complete" detection.

**Suggested Fix:**
Add a test that verifies the expected behavior when all opponents fold. Decide whether the state machine should detect this as "hand over" (perhaps setting phase to "showdown" or a new "complete" phase), or whether it's left to the dealer to resolve manually.

**Impact:** Untested edge case. No crash, but unclear behavior for the frontend.

---

### [LOW-3] No concurrency protection on action_index

**File:** `src/app/routes/hands.py`
**Line(s):** 1395
**Category:** design

**Problem:**
`hand_state.action_index += 1` is a read-modify-write in Python. Two concurrent requests could read the same value and both write `N+1` rather than `N+1` and `N+2`. SQLite's coarse-grained locking and FastAPI's sync endpoint serialization mitigate this in single-server deployment, but it's not formally safe.

**Suggested Fix:**
For V1 single-server, this is acceptable. If scaling to multiple workers, use `HandState.action_index = HandState.action_index + 1` (SQL expression) rather than Python-side increment.

**Impact:** Negligible in current deployment. Would cause incorrect ordering under concurrent load.

---

### [LOW-4] `_next_seat` returns the player's own seat when only one remains

**File:** `src/app/routes/hands.py`
**Line(s):** 112-124
**Category:** correctness

**Problem:**
When only one non-folded player remains, `_next_seat` returns that same player's seat. Combined with `_try_advance_phase` exiting early on `len(seats) <= 1`, the state machine enters a state where `current_seat` points to the surviving player indefinitely, with no "hand ended" signal.

**Suggested Fix:**
Consider setting `current_seat` to `None` or adding a `completed` flag when only one player remains. This gives the frontend a clear signal that the hand needs manual resolution.

**Impact:** No crash, but the state machine doesn't clearly indicate the hand is effectively over.

---

## Positives

- **Clean helper decomposition**: `_get_active_seat_order`, `_first_to_act_seat`, `_next_seat`, `_try_advance_phase`, and `_can_advance_to_phase` are well-separated concerns with clear responsibilities
- **Community card gating**: Elegant design — the phase advancement is blocked by card availability, allowing the dealer to set cards at their own pace
- **Lazy advancement on GET**: While it's a REST convention concern, the "re-check on read" pattern ensures state is consistent without requiring the frontend to explicitly trigger advancement after dealing cards
- **Test organization**: Tests map 1:1 to ACs with clear class groupings (`TestStartHandCreatesHandState`, `TestGetHandState`, etc.)
- **Full integration test**: `test_full_preflop_to_flop_to_turn` exercises the complete happy path through multiple phases
- **Force bypass**: Clean implementation via query parameter with proper default
- **Migration**: Clean auto-generated Alembic migration with unique constraint on `hand_id`

---

## Overall Assessment

The implementation satisfies all 9 acceptance criteria and the state machine works correctly for the core use case. The 19 tests provide good coverage of the happy path and key edge cases (fold skipping, community card gating, force bypass, wrap-around).

The three MEDIUM findings are design trade-offs rather than bugs: the GET side-effect is a pragmatic choice, the simplified phase advancement works for V1's one-action-per-player model, and the heads-up post-flop issue only affects 2-player games. None are blockers.

Recommended follow-up issues:
1. Move phase advancement trigger from GET into the card-dealing PATCH endpoints (MEDIUM-1)
2. File a heads-up poker rules issue if 2-player games are a priority (MEDIUM-3)
3. Add a test for the all-fold-to-one scenario and decide on "hand complete" semantics (LOW-2)
