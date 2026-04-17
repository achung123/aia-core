# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `PATCH /games/{game_id}/players/{player_name}/status`
**Reviewer:** Scott (automated)
**Cycle:** 11

**Task:** Toggle player active status endpoint
**Beads ID:** aia-core-1w2b

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
| 1 | Accepts `{ "is_active": bool }` body | SATISFIED | `PlayerStatusUpdate` model at `src/pydantic_models/app_models.py` L420-421; endpoint parameter `payload: PlayerStatusUpdate` at `src/app/routes/games.py` L340 | Pydantic validates the boolean field automatically |
| 2 | Returns 200 with `{ "player_name": str, "is_active": bool }` | SATISFIED | `PlayerStatusResponse` model at `src/pydantic_models/app_models.py` L424-426; `test_activate_player` and `test_deactivate_player` both assert 200 + body shape | |
| 3 | Returns 404 if player not in game | SATISFIED | Three-stage guard in `src/app/routes/games.py` L343-365 (game not found, player not found, GamePlayer not found); `test_player_not_in_game_returns_404` and `test_game_not_found_returns_404` | |
| 4 | Does NOT delete PlayerHand rows — only flips flag | SATISFIED | `test_deactivate_does_not_delete_player_hands` creates a hand, deactivates the player, then verifies the hand entry still exists | Endpoint only sets `gp.is_active`; no delete queries present |
| 5 | Tests cover activate, deactivate, not-found, idempotent toggle | SATISFIED | 8 tests across 4 test classes cover all scenarios including toggle back-and-forth | |
| 6 | `uv run pytest test/` passes | SATISFIED | Full suite: 1084 passed, 0 failed | |

---

## Findings

### [MEDIUM] player_name path parameter is not URL-decoded for names with spaces or special characters

**File:** `src/app/routes/games.py`
**Line(s):** 337-339
**Category:** correctness

**Problem:**
The `player_name` path parameter is compared via `func.lower(Player.name) == player_name.lower()`. If a player name contains spaces (e.g., "Bob Smith"), the URL path segment would be `Bob%20Smith`. FastAPI automatically URL-decodes path parameters, so this works correctly in practice. However, there is no test exercising a player name with spaces or special characters for this specific endpoint. This is not a bug today, but is a gap in test coverage for an edge case.

**Suggested Fix:**
Add a test with a space-containing player name (e.g., `"Alice Smith"`) to confirm URL decoding works end-to-end. This is a test gap, not a code fix.

**Impact:** Low risk — FastAPI handles decoding, but untested edge case.

---

### [LOW] Unused `date` import in test file

**File:** `test/test_toggle_player_status_api.py`
**Line(s):** 3
**Category:** convention

**Problem:**
`from datetime import date` is imported but never used in the test file. The game date is passed as a string literal `'2026-04-12'`.

**Code:**
```python
from datetime import date
```

**Suggested Fix:**
Remove the unused import to keep the file clean and pass ruff's F401 check.

**Impact:** No functional impact; minor lint cleanliness.

---

## Positives

- **Clean separation of concerns**: Pydantic models (`PlayerStatusUpdate`, `PlayerStatusResponse`) are minimal single-purpose schemas — no bloat.
- **Three-stage 404 guard**: The endpoint checks game existence, player existence, then GamePlayer association — each with a clear error message. This prevents information leakage about whether the game vs player is the missing resource.
- **Thorough test coverage**: 8 tests covering activate, deactivate, not-found (both game and player), idempotent operations, and data preservation (PlayerHand rows not deleted). The `test_deactivate_does_not_delete_player_hands` test is particularly well-designed — it creates real data and verifies it survives deactivation.
- **Consistent patterns**: The endpoint follows the same structure as other PATCH endpoints in the games router (query game → validate → mutate → commit → refresh → return).
- **Case-insensitive lookup**: Player name matching uses `func.lower()`, consistent with `create_game_session` and other endpoints.

---

## Overall Assessment

The implementation is clean, well-tested, and follows established project conventions. All 6 acceptance criteria are **SATISFIED**. The endpoint correctly flips the `is_active` flag on the `GamePlayer` association without touching `PlayerHand` rows. No critical or high-severity issues found. The two findings are minor: an untested edge case (space in player name) and an unused import.

**Verdict: PASS** — no blocking issues.
