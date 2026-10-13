# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `GET /stats/players/{player_name}/trends` endpoint
**Reviewer:** Scott (automated)
**Cycle:** 3

**Task:** Player career trend endpoint
**Beads ID:** aia-core-n6u

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Endpoint queries all PlayerHand records for the player, grouped by game_id | SATISFIED | `stats.py` L37-47 queries PlayerHand joined with Hand/GameSession filtered by player_id; L50-62 groups by `game_id` in Python | |
| 2 | Returns a list of PlayerSessionTrend objects sorted by game_date ascending | SATISFIED | `stats.py` L76 sorts by `game_date`; `test_returns_multiple_sessions_sorted_by_date` confirms ordering | |
| 3 | Returns 404 if the player does not exist | SATISFIED | `stats.py` L35 calls `get_player_by_name_or_404`; `test_returns_404_for_nonexistent_player` asserts 404 | |
| 4 | Returns an empty list (200) if the player exists but has no game data | SATISFIED | Empty `player_hands` → empty `sessions` → empty `trends` list; `test_returns_empty_list_for_player_with_no_hands` confirms | |
| 5 | Win rate is calculated as hands_won / total_hands * 100 per session | SATISFIED | `stats.py` L65 computes `round(s['hands_won'] / total * 100, 2)`; `test_win_rate_calculation_hands_won_over_total` verifies | |

---

## Findings

### [MEDIUM] N+1 lazy-load queries on PlayerHand.hand and Hand.game_session

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 37-47, 51-53
**Category:** performance

**Problem:**
The query uses `.join(Hand, ...)` and `.join(GameSession, ...)` for filtering, but SQLAlchemy joins in `db.query().join()` do not eagerly load relationship attributes. When the loop at L51 accesses `ph.hand.game_id` and `ph.hand.game_session.game_date`, SQLAlchemy issues individual lazy-load SELECT statements per row — resulting in 2N additional queries for N player-hand records.

The sibling endpoint `get_player_stats` (L93) already uses `.options(joinedload(PlayerHand.hand))` to avoid this exact issue.

**Code:**
```python
player_hands = (
    db.query(PlayerHand)
    .join(Hand, PlayerHand.hand_id == Hand.hand_id)
    .join(GameSession, Hand.game_id == GameSession.game_id)
    .filter(...)
    .all()  # ← no eager loading options
)

for ph in player_hands:
    gid = ph.hand.game_id              # lazy load: SELECT hands WHERE ...
    ...
    'game_date': ph.hand.game_session.game_date,  # lazy load: SELECT game_sessions WHERE ...
```

**Suggested Fix:**
Add `joinedload` options to eagerly fetch the related Hand and GameSession in the same query:
```python
from sqlalchemy.orm import joinedload

player_hands = (
    db.query(PlayerHand)
    .options(joinedload(PlayerHand.hand).joinedload(Hand.game_session))
    .join(Hand, PlayerHand.hand_id == Hand.hand_id)
    .join(GameSession, Hand.game_id == GameSession.game_id)
    .filter(...)
    .all()
)
```

**Impact:** At typical poker-app scale (tens to low hundreds of hands per player) this won't cause visible latency, but it violates the pattern established by the adjacent endpoint and would degrade if a player accumulates thousands of records.

---

## Positives

- **All 5 ACs fully satisfied** — the implementation cleanly addresses every acceptance criterion.
- **Good filter hygiene** — correctly excludes `None` results and `HANDED_BACK`, consistent with every other stats endpoint in the file.
- **Robust test coverage** — 7 tests cover the happy path, edge cases (empty data, case-insensitive name), calculation correctness, sort order, and result filtering. All pass.
- **Zero-division guard** — `if total > 0` check prevents division-by-zero on win rate calculation.
- **Schema reuse** — the `PlayerSessionTrend` Pydantic model sits cleanly in `stats_schemas.py` alongside other analytics models.
- **Route ordering** — `/players/{player_name}/trends` is defined before `/players/{player_name}`, preventing FastAPI from matching the catch-all first.

---

## Overall Assessment

Solid implementation. All acceptance criteria are met, tests are thorough, and the code follows existing conventions. The single MEDIUM finding (N+1 lazy loads) is a performance concern worth addressing in a follow-up but does not affect correctness. No critical or high-severity issues.

**(C: 0, H: 0, M: 1, L: 0)**
