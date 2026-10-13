# Code Review Report — aia-core-001

**Date:** 2026-04-12
**Cycle:** 11
**Target:** Re-buy/buyback recording & listing endpoints
**Reviewer:** Scott (automated)

**Task:** T-048 — Re-buy/buyback recording & listing endpoints
**Beads ID:** aia-core-bjmw
**Epic:** alpha-feedback-008

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | POST accepts `{"amount": float}` and returns 201 with created rebuy record | SATISFIED | `test_post_rebuy_creates_record_201` — verifies 201 status, all response fields | |
| 2 | Recording a re-buy reactivates player if `is_active = false` | SATISFIED | `test_post_rebuy_reactivates_inactive_player` — deactivates then rebuys, confirms reactivation | |
| 3 | GET returns list of rebuy records ordered by `created_at` | SATISFIED | `test_get_rebuys_returns_ordered_list` — creates 3 rebuys, verifies order | |
| 4 | Returns 404 for missing game or player | SATISFIED | `test_post_rebuy_404_missing_game`, `test_post_rebuy_404_missing_player`, `test_get_rebuys_404_missing_game`, `test_get_rebuys_404_missing_player` | |
| 5 | GameSessionResponse includes `rebuy_count` and `total_rebuys` per player | SATISFIED | `test_player_info_includes_rebuy_stats`, `test_player_info_zero_rebuys` | |
| 6 | `uv run pytest test/` passes | SATISFIED | 10/10 tests passing in `test_rebuy_api.py`; full suite confirmed at task close (1197 passing) | |

---

## Findings

### [HIGH] RebuyCreate.amount accepts zero and negative values

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 149
**Category:** correctness

**Problem:**
`RebuyCreate.amount` is declared as a bare `float` with no minimum-value constraint. A rebuy of `0.0` or `-50.0` is semantically invalid — you can't buy back into a game for nothing or a negative amount. Verified empirically: `RebuyCreate(amount=-50)` succeeds.

**Code:**
```python
class RebuyCreate(BaseModel):
    amount: float
```

**Suggested Fix:**
```python
class RebuyCreate(BaseModel):
    amount: float = Field(..., gt=0)
```
Add a corresponding test: `test_post_rebuy_422_non_positive_amount`.

**Impact:** Allows recording nonsensical rebuys that corrupt downstream stats (`total_rebuys`, `rebuy_count`). A zero-dollar rebuy would still reactivate a player without any financial commitment.

---

### [MEDIUM] Rebuy table uses player_name string instead of player_id FK

**File:** `src/app/database/models.py`
**Line(s):** 192
**Category:** design

**Problem:**
The `rebuys` table stores `player_name` as a plain `String` column rather than a `player_id` FK referencing the `players` table. The endpoint already looks up the `Player` object (via `_get_game_player`) and uses `player.name` to populate it, so correctness is preserved at runtime. However, if a player's name were ever updated, rebuy records would become orphaned. The `game_players` table correctly uses `player_id` FK.

**Code:**
```python
class Rebuy(Base):
    __tablename__ = 'rebuys'
    # ...
    player_name = Column(String, nullable=False)  # denormalized
```

**Suggested Fix:**
This is a design trade-off likely made intentionally for simplicity (matching the T-047 schema spec). No immediate change required, but note for future: if player rename functionality is added, rebuys will need a migration to use `player_id` FK or a cascade update.

**Impact:** Low risk currently — player names are effectively immutable in the system. Worth tracking as tech debt.

---

### [MEDIUM] _get_game_player helper not used by toggle_player_status (duplication)

**File:** `src/app/routes/games.py`
**Line(s):** 488–527 vs 531–559
**Category:** design

**Problem:**
The new `_get_game_player` helper extracts the exact game→player→game_player lookup pattern that `toggle_player_status` (line 488) already performs inline. The two implementations are functionally identical but `toggle_player_status` was not refactored to use the helper, leaving code duplication.

**Suggested Fix:**
This is pre-existing code — not introduced by this task. A follow-up task could refactor `toggle_player_status` (and potentially `get_player_game_info` if it has the same pattern) to use `_get_game_player`. Not blocking.

**Impact:** Maintenance cost — bug fixes to the lookup pattern must be applied in multiple places.

---

### [LOW] No test for rebuy on a completed game session

**File:** `test/test_rebuy_api.py`
**Line(s):** (missing test)
**Category:** correctness

**Problem:**
There is no test verifying behavior when a rebuy is attempted on a game with `status='completed'`. The current implementation does not reject this — it will happily create a rebuy record for a finished game. Whether this should be allowed is a product decision, but the behavior is untested either way.

**Suggested Fix:**
Add a test that creates a game, completes it, then attempts a rebuy. Either assert 400 (if rebuys should be blocked on completed games) or assert 201 (if it's intentionally allowed) to document the intended behavior.

**Impact:** Unclear product behavior — could allow accidental data corruption on closed game sessions.

---

## Positives

- **Clean helper extraction:** `_get_game_player` consolidates a three-step lookup (game, player, game_player) with clear 404 errors. Good reuse in both rebuy endpoints.
- **Efficient rebuy stats:** `_build_players` computes rebuy stats in a single aggregated query (`GROUP BY` with `func.count`/`func.sum`), avoiding N+1 queries. The `rebuy_map` dict lookup is O(1) per player.
- **Thorough test coverage:** 10 tests cover all ACs including reactivation, empty lists, and 404 for both endpoints. Tests use minimal helpers and are easy to read.
- **Case-insensitive player lookup:** Uses `func.lower()` for player name matching, consistent with existing patterns.
- **Canonical name storage:** Stores `player.name` (from DB) rather than the raw URL parameter, preventing case-variant duplicates in the rebuys table.
- **URL-encoded player names:** FastAPI/Starlette automatically URL-decodes path parameters, so names with spaces work correctly without special handling.

---

## Overall Assessment

The implementation is solid and satisfies all 6 acceptance criteria. The single HIGH finding — missing `gt=0` validation on `RebuyCreate.amount` — is an input validation gap that should be fixed before this feature is exposed to end users. The MEDIUM findings are design observations (denormalized player_name, code duplication) that don't affect correctness today but should be tracked as tech debt. All 10 tests pass and cover the core behaviors well.

**Recommendation:** Fix the `amount` validation (HIGH) in a follow-up task; remaining findings are non-blocking.
