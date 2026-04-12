# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Target:** `frontend/src/dealer/handPayload.js`, `frontend/src/dealer/handPayload.test.js`, `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/PlayerGrid.jsx`
**Reviewer:** Scott (automated)

**Task:** T-013 — Assemble hand payload & submit
**Beads ID:** aia-core-uqp

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
| 1 | "Submit Hand" button is disabled until all tiles are checked | SATISFIED | `DealerApp.jsx` L103-104 computes `allRecorded`; `PlayerGrid.jsx` L33 sets `disabled={!allRecorded \|\| submitting}` | Also disabled during submission |
| 2 | Payload assembles community cards into flop_1, flop_2, flop_3, turn, river | SATISFIED | `handPayload.js` L3-8; test "maps community cards and players to the expected API shape" | Field names match backend `HandCreate` model exactly |
| 3 | Payload assembles player cards into player_entries with player_name, card_1, card_2 | SATISFIED | `handPayload.js` L9-13; test confirms exact shape | Field names match backend `PlayerHandEntry` model |
| 4 | Client-side validation rejects duplicate cards with an error message | SATISFIED | `validateNoDuplicates` in `handPayload.js` L18-36; 3 dedicated tests; `DealerApp.jsx` L87-90 sets `submitError` | Correctly filters nulls before checking |
| 5 | Successful submission resets hand state and returns to dashboard | SATISFIED | `DealerApp.jsx` L93-95 dispatches `RESET_HAND`; `dealerState.js` L48-56 clears cards, preserves gameId/players, increments handCount, sets currentStep='dashboard' | `dealerState.test.js` covers RESET_HAND |
| 6 | Failed submission shows error and allows retry | SATISFIED | `DealerApp.jsx` L96-98 catches error; `PlayerGrid.jsx` L27 renders error div; button stays visible | Error cleared at start of each attempt (L85) |

---

## Findings

### [MEDIUM] No component/integration tests for submit flow

**File:** `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** N/A (missing tests)
**Category:** correctness

**Problem:**
The unit tests cover `assembleHandPayload`, `validateNoDuplicates`, and `RESET_HAND` reducer logic, but there are no component-level tests verifying the wiring: that the Submit Hand button renders, disables based on `allRecorded`, calls `handleSubmitHand`, displays errors, or mocks the `createHand` API call. All six ACs are satisfied through code inspection, but only 4 of 6 have automated test evidence.

**Suggested Fix:**
Add component tests (e.g., using `@testing-library/preact`) for PlayerGrid and DealerApp that:
- Verify Submit Hand button is disabled when not all tiles are recorded
- Verify Submit Hand button is enabled when all tiles are recorded
- Mock `createHand` and verify RESET_HAND dispatch on success
- Mock `createHand` rejection and verify error display

**Impact:** Moderate — regression risk on the submit flow is covered only by unit tests on sub-functions, not the integrated behavior.

---

### [LOW] `|| null` coercion for turn/river is slightly imprecise

**File:** `frontend/src/dealer/handPayload.js`
**Line(s):** 7-8
**Category:** correctness

**Problem:**
`community.turn || null` coerces any falsy value (including `""`, `0`, `false`) to `null`. While card values should never be `""` or `0` in practice, using `?? null` (nullish coalescing) would be more semantically correct and defensive, only converting `null`/`undefined` to `null`.

**Code:**
```javascript
turn: community.turn || null,
river: community.river || null,
```

**Suggested Fix:**
```javascript
turn: community.turn ?? null,
river: community.river ?? null,
```

**Impact:** Negligible in practice — card values are always strings like `"Ah"` or `null`. Purely a semantic precision improvement.

---

### [LOW] Player tiles remain interactive during async submission

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 8-24
**Category:** design

**Problem:**
While the Submit Hand button correctly disables during submission (`submitting` prop), the player/community tile buttons remain clickable. If a user taps a tile while `createHand` is in-flight, `CameraCapture` opens. If submission then completes and dispatches `RESET_HAND` (switching to `dashboard`), the camera overlay persists because it is rendered outside the step conditional in `DealerApp.jsx` (L123-129).

**Suggested Fix:**
Pass `submitting` to tile buttons and disable them, or gate `CameraCapture` rendering on `currentStep === 'playerGrid'`.

**Impact:** Very low — this is an edge case requiring precise timing during manual dealer use. Pre-existing architectural pattern, not introduced by this task.

---

## Positives

- **Clean separation of concerns** — `assembleHandPayload` and `validateNoDuplicates` are pure functions in their own module, making them trivially testable and reusable.
- **Exact field-name alignment with backend** — `flop_1`, `flop_2`, `flop_3`, `turn`, `river`, `player_name`, `card_1`, `card_2` match the Pydantic `HandCreate` / `PlayerHandEntry` models exactly. No mapping bugs.
- **Thorough duplicate detection** — Validates across community and player cards, correctly filters null turn/river, and deduplicates the error message output.
- **Proper error lifecycle** — `submitError` is cleared at the start of each attempt (L85), cleared on success (L95), and set on both validation failure and API error. No stale error states.
- **No XSS risk** — Error messages are rendered via JSX text interpolation (`{submitError}`), which Preact auto-escapes. No `dangerouslySetInnerHTML` usage.
- **Good test coverage for utilities** — 6 tests covering happy path, null turn/river, community-player dupes, player-player dupes, and null filtering.

---

## Overall Assessment

The implementation is solid and all six acceptance criteria are satisfied. The payload structure aligns exactly with the backend API. Duplicate card validation is thorough and well-tested. Error handling follows correct patterns with proper state cleanup. The only meaningful gap is the lack of component-level integration tests for the submit flow wiring — the logic is tested at the unit level but the button behavior and API call integration are verified only by code inspection. No critical or high-severity issues found.
