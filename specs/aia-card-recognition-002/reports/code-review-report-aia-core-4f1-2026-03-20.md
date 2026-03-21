# Code Review Report — aia-card-recognition-002 / aia-core-4f1

**Date:** 2026-03-20
**Ticket:** aia-core-4f1
**Target:** `src/app/routes/images.py`, `src/pydantic_models/app_models.py`, `test/test_confirm_detection_api.py`, `test/test_detection_correction_api.py`
**Reviewer:** Scott (automated)

**Task:** T-015 — Update confirm detection endpoint for dynamic card count
**Beads ID:** aia-core-4f1

---

## Code Description

This implementation updates the `POST /games/{game_id}/hands/image/{upload_id}/confirm` endpoint to accept a variable number of player hole card entries (0 or more) alongside required community cards (flop) and optional turn/river. The changes touch the `ConfirmDetectionRequest` Pydantic model (new `ConfirmCommunityCards`, `ConfirmPlayerEntry`, restructured request schema), the `confirm_detection` route handler in `images.py` (duplicate validation across full card set, dynamic hole card position mapping for correction records), and comprehensive tests across two test files. The feature exists to support the new card recognition pipeline where the number of detected cards is variable rather than fixed at 7.

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
| 1 | Accepts any number of player_hands entries (0+), each with 2 hole cards | SATISFIED | `ConfirmDetectionRequest.player_hands: list[ConfirmPlayerEntry] = Field(default_factory=list)` in `app_models.py` L432; `ConfirmPlayerEntry` requires `card_1: Card` and `card_2: Card`. Tests: `test_confirm_with_zero_player_hands`, `test_confirm_three_players`, `test_empty_player_hands_accepted` all pass. | Clean default to empty list; Card model enforces exactly 2 cards per entry via required fields. |
| 2 | Community cards: flop_1/2/3 required, turn/river optional | SATISFIED | `ConfirmCommunityCards` in `app_models.py` L420-L427 has `flop_1/2/3: Card` (required) and `turn/river: Card \| None = None` (optional). Tests: `test_confirm_community_only_flop`, `test_confirm_without_turn_river`, `test_missing_community_cards_returns_422` all pass. | Pydantic validation rejects missing flop fields with 422. |
| 3 | Unmapped detections not carried into Hand record | SATISFIED | `confirm_detection` in `images.py` L234-L261 builds the Hand record solely from the user-provided `community_cards` and `player_hands` in the payload. Detections not referenced in the payload are never inserted into Hand or PlayerHand. Test: `test_unmapped_detections_not_in_hand` confirms only explicitly confirmed cards appear. | By-design: the Hand is constructed from the payload, not from detections. |
| 4 | Duplicate validation on full confirmed set (all community + all hole cards) | SATISFIED | `images.py` L236-L249 collects all community + all player hole cards into `all_cards` list, then calls `validate_no_duplicate_cards()`. Tests: `test_duplicate_community_cards_rejected`, `test_duplicate_across_community_and_player`, `test_duplicate_player_hole_cards`, `test_confirm_duplicate_across_all_players` all pass. | Also validates duplicate `player_name` entries separately. |
| 5 | Correction records created for changed detections using DetectionResult format | SATISFIED | `images.py` L329-L356 builds `confirmed_map` keyed by DetectionResult-compatible position labels (`flop_1`, `turn`, `hole_1`, etc.), compares against `detection_map` (from CardDetection rows which mirror DetectionResult fields), and creates `DetectionCorrection` rows for mismatches using `detected_value` and `card_position` from detections. Tests: `test_correction_created_when_confirmed_differs`, `test_corrections_for_hole_cards`, `test_correction_uses_detection_position_keys`, plus 5 correction-specific tests in `test_detection_correction_api.py`. | Position naming convention for hole cards: `hole_{i*2+1}`, `hole_{i*2+2}` per player — consistent with position assigner's sequential numbering. |
| 6 | Existing confirm tests still pass | SATISFIED | Full test run: 29 tests in `test_confirm_detection_api.py` + 23 tests in `test_detection_correction_api.py` = 52/52 passing. Pre-existing tests (`TestHandModelSourceUploadId`, `TestConfirmEndpointHappyPath`, `TestConfirmEndpointValidation`, `TestConfirmEndpointErrors`) all unmodified and green. | Verified via `pytest -v` — zero failures or errors. |

---

## Findings

### [MEDIUM] Implicit transaction rollback in confirm_detection endpoint

**File:** `src/app/routes/images.py`
**Line(s):** 227–375
**Category:** design

**Problem:**
The `confirm_detection` endpoint performs multiple `db.add()` and `db.flush()` calls (Hand creation at L268, PlayerHand creation at L311) before the final `db.commit()` at L362, but has no explicit `try/except` with rollback around the transactional block. By contrast, the `upload_image` endpoint in the same file uses explicit `try/except/rollback` blocks around every flush and commit operation.

Rollback is handled implicitly: if an unhandled exception propagates, FastAPI's dependency injection calls `db.close()` via `get_db()` which rolls back uncommitted work. This is functionally correct but creates an inconsistency in error-handling patterns within the same file.

**Code:**
```python
hand = Hand(...)
db.add(hand)
db.flush()  # No try/except here, unlike upload_image

# ... multiple operations ...

db.commit()  # Only commit at the end
```

**Suggested Fix:**
No immediate fix needed — the implicit rollback via session close is correct. Consider wrapping the transactional block in a try/except with explicit `db.rollback()` for consistency with `upload_image` if the codebase convention is established. This is a maintainability concern, not a correctness issue.

**Impact:** If a future change adds code between flush and commit that swallows exceptions, partial data could leak. Current code is safe.

---

### [LOW] Inconsistent session management patterns across test files

**File:** `test/test_confirm_detection_api.py`
**Line(s):** 607–700 (TestConfirmCorrectionRecords methods)
**Category:** convention

**Problem:**
`TestConfirmCorrectionRecords` in `test_confirm_detection_api.py` uses manual session management with `try/finally` blocks:
```python
db = SessionLocal()
try:
    # ... operations ...
finally:
    db.close()
```
While `test_detection_correction_api.py` uses the cleaner context manager pattern:
```python
with SessionLocal() as db:
    # ... operations ...
```

Both patterns work correctly, but the inconsistency across test files reviewing the same feature area is a minor style concern.

**Suggested Fix:**
Standardize on context managers (`with SessionLocal() as db:`) in both files for consistency.

**Impact:** Readability only. No functional difference.

---

### [LOW] Seed data completeness inconsistency between test files

**File:** `test/test_detection_correction_api.py`
**Line(s):** 82–103 (`_seed_detections`)
**Category:** convention

**Problem:**
`_seed_detections` in `test_detection_correction_api.py` creates `CardDetection` rows without bounding box values (`bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` default to NULL), while the equivalent seeding in `TestConfirmCorrectionRecords` within `test_confirm_detection_api.py` includes full bbox data. Both are valid since bbox fields are nullable, but the inconsistency means the two test files exercise slightly different data shapes.

**Suggested Fix:**
Add bbox values to `_seed_detections` in `test_detection_correction_api.py` for parity, or document the intentional difference. Not urgent.

**Impact:** Tests still pass and cover the correction logic correctly. The bbox fields are not used by the correction comparison logic.

---

## Positives

- **Clean Pydantic model design**: `ConfirmCommunityCards`, `ConfirmPlayerEntry`, and `ConfirmDetectionRequest` are well-structured with appropriate defaults (`default_factory=list`), enum-based validation, and clear separation of concerns.
- **Thorough duplicate validation**: The endpoint validates the full cross-product of community + hole cards, not just within each group. Separate duplicate player name validation adds another safety layer.
- **Comprehensive test coverage**: 52 tests across two files cover happy paths, validation errors, edge cases (0 players, 3 players), correction creation, correction absence, and full pipeline flow. The `TestConfirmDynamicCardCount` and `TestConfirmCorrectionRecords` classes systematically address every T-015 AC.
- **Backwards-compatible schema**: The `player_hands` field defaults to an empty list, preserving compatibility with callers that don't provide player entries.
- **Position key consistency**: The `hole_{i*2+1}` / `hole_{i*2+2}` naming convention for correction mapping is consistent with the sequential position assigner output.

---

## Overall Assessment

The implementation is **clean and complete**. All 6 acceptance criteria are fully satisfied with strong test evidence. The confirm endpoint correctly handles dynamic player counts (0+), enforces community card requirements (flop required, turn/river optional), performs full-set duplicate validation, stores correction records for detection mismatches, and leaves unmapped detections out of the Hand record.

The only findings are a minor design consistency note (MEDIUM) about implicit vs. explicit transaction rollback and two LOW-severity test convention inconsistencies. No correctness, security, or logic issues were identified. The code is ready and all 52 tests pass.

**Next step:** Close aia-core-4f1 when the broader task checklist is satisfied.
