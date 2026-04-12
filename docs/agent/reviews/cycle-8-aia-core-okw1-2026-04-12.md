# Code Review Report — aia-core-okw1

**Date:** 2026-04-12
**Target:** `frontend/src/dealer/DealerApp.test.tsx` (incremental community card capture block), `frontend/src/dealer/DealerApp.tsx`, `frontend/src/dealer/ActiveHandDashboard.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 8

**Task:** T-022 — Dealer community card capture (rebuilt, incremental)
**Beads ID:** aia-core-okw1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Take Flop opens capture for 3 cards; on confirm calls updateFlop() | SATISFIED | Existing tests in "DealerApp community card PATCH wiring" block (lines 617–681) verify flop capture → camera → confirm → `updateFlop()` with `{flop_1, flop_2, flop_3}`. New incremental block reuses `captureFlop()` helper that exercises the same path. | Covered by both old and new test blocks |
| 2 | Take Turn (enabled after flop) opens capture for 1 card; calls updateTurn() | SATISFIED | Tests at lines 1429–1469: "Turn tile is disabled before flop capture", "Turn tile becomes enabled after flop capture", "clicking Turn tile opens camera capture with turn target", "after Turn confirm, updateTurn is called with correct payload" — verifies `updateTurn(42, 1, { turn: 'Qd' })` | |
| 3 | Take River (enabled after turn) opens capture for 1 card; calls updateRiver() | SATISFIED | Tests at lines 1484–1541: "River tile is disabled before turn capture", "River tile becomes enabled after turn capture", "clicking River tile opens camera capture with river target", "after River confirm, updateRiver is called with correct payload" — verifies `updateRiver(42, 1, { river: '9c' })` | |
| 4 | Board area updates after each successful capture | SATISFIED | Test at lines 1544–1575: "board slots fill incrementally after each capture" verifies board-slot-0 through board-slot-4 fill progressively with Js/Tc/5h/Qd/9c | |
| 5 | Component test verifies capture → confirm → PATCH flow | SATISFIED | Test at lines 1577–1598: "full incremental flow: flop → turn → river with correct API calls" verifies all three update functions called exactly once with correct payloads | |

---

## Findings

### [MEDIUM] No test for retake flow on Turn/River capture

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 1335–1657
**Category:** correctness

**Problem:**
The 14 new tests cover the happy-path capture → detect → confirm → PATCH flow and error handling for PATCH failures, but none exercise the **retake** button during Turn or River detection review. The `DetectionReview` mock provides a `mock-retake` button that calls `onRetake()`, and the production code in `DealerApp.tsx` (`handleReviewRetake`, line ~268) re-opens the camera for the same target. This path is untested for Turn and River streets.

**Suggested Fix:**
Add tests like "clicking Retake during turn review re-opens camera capture for turn" that click `mock-retake` and verify the camera re-appears with the correct target.

**Impact:** A regression in retake logic for Turn/River would go undetected. Low probability since the code path is shared with flop, but worth covering for completeness.

---

### [MEDIUM] No test for cancel during Turn/River camera capture

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 1335–1657
**Category:** correctness

**Problem:**
The `CameraCapture` mock provides a `mock-cancel` button (calls `onCancel()`), and the production code clears `captureTarget` on cancel. No test verifies that cancelling during Turn or River capture returns the user to the `ActiveHandDashboard` without making any API calls. 

**Suggested Fix:**
Add a test: "cancelling Turn capture returns to dashboard without API call" that clicks the flop tile, completes flop, clicks the turn tile, then clicks `mock-cancel`, and asserts that `updateTurn` was not called and the player-list is visible again.

**Impact:** A broken cancel path would strand the user on the capture overlay. Low risk since `handleCaptureCancel` is trivial, but the edge case is worth covering.

---

### [LOW] `act()` warnings in stderr for every incremental capture test

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 1335–1657
**Category:** convention

**Problem:**
Every test in the incremental block produces multiple `"The current testing environment is not configured to support act(...)"` warnings on stderr. This is a known happy-dom limitation with React 18+ `act()`, but the volume of warnings (dozens per test) clutters CI output and may mask genuine warnings.

**Suggested Fix:**
This is a pre-existing issue across the entire test file, not introduced by this task. Can be addressed separately by either:
- Switching to jsdom environment for this file
- Suppressing the specific console.error in beforeAll

**Impact:** No functional impact. Cosmetic noise in CI logs.

---

### [LOW] Duplicated helper functions between describe blocks

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 588–610 vs 1355–1426
**Category:** convention

**Problem:**
`clickStartHand()` and the community-card capture helpers (`captureCommunityCards` / `captureFlop`) are duplicated between the "community card PATCH wiring" block (line ~588) and the "incremental community card capture" block (line ~1355). The new block adds `captureTurn()` and `captureRiver()` but re-implements `clickStartHand()` and `captureFlop()` identically.

**Suggested Fix:**
Hoist shared helpers to file scope or a shared `describe` block. Not urgent — the duplication is localized and both copies are consistent.

**Impact:** Maintenance burden only. If the Start Hand flow changes, two copies must be updated.

---

## Positives

- **Thorough AC coverage:** All 5 acceptance criteria are directly verified by tests, with strong evidence chains.
- **Correct incremental gating:** Turn disabled → enabled after flop, River disabled → enabled after turn — matching the `ActiveHandDashboard.tsx` production logic exactly (`disabled={!community.flopRecorded}` / `disabled={!community.turnRecorded}`).
- **API payload verification:** Tests assert not just that API functions were called, but with exact payload shapes matching `TurnUpdate` (`{ turn: 'Qd' }`) and `RiverUpdate` (`{ river: '9c' }`).
- **Error handling coverage:** Both Turn and River PATCH failure paths are tested, verifying error messages propagate to the toast.
- **Integration test:** The "full incremental flow" test exercises the entire flop → turn → river sequence in one test and asserts call counts (exactly 1 each), catching potential double-fire bugs.
- **Board slot verification:** The incremental board fill test checks all 5 slots at each stage, including verifying later slots remain empty.
- **Clean mock isolation:** `vi.clearAllMocks()` in `beforeEach` and `sessionStorage.clear()` + `cleanup()` in global `afterEach` prevents state leakage.
- **Mock correctness:** The `DetectionReview` mock correctly returns different card arrays based on `mode` (flop→3 cards, turn→1 card, river→1 card), matching real component behavior.

---

## Overall Assessment

The 14 new tests in the "incremental community card capture" block provide solid coverage of the Turn and River capture flow. All 5 acceptance criteria for task aia-core-okw1 are satisfied with clear evidence. The tests correctly verify the incremental unlock sequence (flop → turn → river), API payloads, UI state updates (checkmarks and board slots), and error propagation.

No CRITICAL or HIGH findings. The two MEDIUM findings (missing retake and cancel tests for Turn/River) represent edge cases that share code paths with existing flop tests, reducing their risk. The two LOW findings are pre-existing convention issues.

**Verdict: PASS** — Task aia-core-okw1 is verified complete.
