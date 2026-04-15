# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `GET /stats/awards endpoint + _compute_awards() engine`
**Reviewer:** Scott (automated)
**Cycle:** 5

**Task:** Awards engine endpoint
**Beads ID:** aia-core-wq2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Computes at least 8 awards: Iron Man, Sniper, Paper Hands, Diamond Hands, River Rat, One and Done, Streak King, Showdown Magnet | SATISFIED | `test_all_base_awards_present` verifies all 8 by name; `_compute_awards()` lines 466–571 implement each | |
| 2 | When game_id is provided, awards are scoped to that single session | SATISFIED | `get_awards()` applies `.filter(Hand.game_id == game_id)` at line 627; `test_game_scoped_excludes_other_game_players` confirms isolation | |
| 3 | When game_id is omitted, awards are computed across all games | SATISFIED | Default `game_id=None` skips the filter; `test_returns_at_least_8_awards` and related tests use global mode | |
| 4 | Minimum thresholds applied (e.g. Sniper requires >= 20 hands) | SATISFIED | `_SNIPER_MIN_HANDS = 20`, `_DIAMOND_HANDS_MIN = 10`, `_STREAK_MIN = 2`, `_ONE_AND_DONE_MIN_PLAYERS = 2`; `test_sniper_requires_min_hands` and `test_game2_scoped_awards` verify | |
| 5 | Returns a list of AwardEntry objects; omits awards that cannot be computed | SATISFIED | Return type `list[AwardEntry]`; guards like `if eligible:`, `if best['river_hands'] > 0:`, `if best['winning_streak'] >= _STREAK_MIN:` gate each award; `test_empty_db_returns_empty_list` confirms empty case | |
| 6 | If P&L data is available, includes Big Stack and Degen awards | SATISFIED | `has_any_pl` gate at line 574; `test_pnl_awards_included` confirms both appear | |

---

## Findings

### [MEDIUM] Nonexistent game_id returns 200 + empty list instead of 404

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 615–629
**Category:** design

**Problem:**
When `game_id=9999` (a game that does not exist), the endpoint returns `200 []`. Other game-scoped stats endpoints (e.g. `GET /stats/games/{game_id}`) use `get_game_or_404()` and return 404 for nonexistent games. This inconsistency could confuse API consumers who expect a 404 for an invalid game reference.

**Code:**
```python
if game_id is not None:
    query = query.filter(Hand.game_id == game_id)
player_hands = query.all()
return _compute_awards(player_hands)
```

**Suggested Fix:**
Add a `get_game_or_404(db, game_id)` call before filtering, consistent with other game-scoped endpoints. Alternatively, document this as intentional behavior (awards are a computed view, not a resource lookup).

**Impact:** API consumers may misinterpret an empty awards list as "no awards earned" when the game doesn't exist at all.

---

### [LOW] Paper Hands has no minimum hands threshold

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 491–502
**Category:** correctness

**Problem:**
Sniper requires >= 20 hands and Diamond Hands requires >= 10, but Paper Hands applies no minimum. A player who plays a single hand and folds would earn Paper Hands at 100% fold rate. This could produce misleading awards in sessions with uneven participation.

**Code:**
```python
best = max(plist, key=lambda p: p['folds'] / p['hands_played'])
```

**Suggested Fix:**
Consider adding a minimum hands threshold (e.g. `_PAPER_HANDS_MIN = 10`) similar to Diamond Hands. Not a bug — but a polish item for award quality.

**Impact:** Low — edge case in small datasets or sessions with transient players.

---

### [LOW] Winning streak computation spans game boundaries in global mode

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 453–462
**Category:** design

**Problem:**
The streak is computed by sorting `results_seq` by `(game_id, hand_number)`. In global mode, if a player wins the last hand of game N and the first hand of game N+1, those count as a continuous streak. This is a defensible design choice but worth documenting — poker sessions are typically independent events.

**Suggested Fix:**
If per-session streaks are desired, reset `cur` when `game_id` changes. Otherwise, document the cross-game behavior as intentional.

**Impact:** Low — only affects global mode and is unlikely to cause confusion with current dataset sizes.

---

### [LOW] Several individual awards lack dedicated winner/value assertions in tests

**File:** `backend/test/test_awards_api.py`
**Line(s):** 1–400
**Category:** correctness (test coverage)

**Problem:**
While all 8 base awards are verified to be present, only Paper Hands, Diamond Hands, Streak King, and Iron Man have dedicated tests asserting the correct winner or stat value. River Rat, Showdown Magnet, One and Done, Sniper winner identity, and the P&L award values are not individually asserted.

**Suggested Fix:**
Add targeted tests for each award's winner identity and stat value. For example:
- `test_river_rat_winner` — assert the correct player and river hand count
- `test_showdown_magnet_winner` — assert the correct player and showdown count
- `test_big_stack_value` — assert the profit value matches expected calculation

**Impact:** Low — the awards are structurally tested; this is a coverage depth improvement.

---

### [LOW] Global awards query loads all PlayerHand records into memory

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 618–629
**Category:** design (performance)

**Problem:**
When `game_id` is omitted, the query loads every `PlayerHand` row (with eager-loaded `Hand` and `Player`) into memory. For a production system with thousands of games, this could become a bottleneck. Currently acceptable for the project's scale.

**Suggested Fix:**
No action needed now. If the dataset grows significantly, consider computing aggregates at the SQL level or adding pagination/caching.

**Impact:** Low — no practical concern at current scale.

---

## Positives

- **Clean architecture** — endpoint delegates to `_compute_awards()`, keeping the route handler focused on query construction and the engine focused on computation
- **Eager loading** — `joinedload(PlayerHand.hand)` and `joinedload(PlayerHand.player)` prevent N+1 queries
- **Division-by-zero safety** — early return for empty data, threshold gates on eligible lists, and guaranteed `hands_played >= 1` for any player in `plist`
- **Comprehensive seed helper** — `_seed_awards_data()` creates a rich multi-game, multi-player dataset that exercises diverse award scenarios
- **Good test organization** — tests grouped by concern (global, game-scoped, thresholds, field validation, empty data) with clear docstrings
- **All 10 awards implemented** — 8 base + 2 P&L conditional awards, all gated appropriately

---

## Overall Assessment

The implementation is solid and satisfies all 6 acceptance criteria. No critical or high-severity issues found. The single medium finding (nonexistent game_id returning 200 instead of 404) is a design inconsistency worth addressing but not a blocker. The four low findings are polish items — threshold symmetry, cross-game streaks, test depth, and future scalability. Code is clean, well-structured, and follows project conventions.

**(C: 0, H: 0, M: 1, L: 4)**
