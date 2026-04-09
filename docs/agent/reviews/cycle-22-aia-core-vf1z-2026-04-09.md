# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/DealerApp.test.jsx`
**Reviewer:** Scott (automated)

**Task:** T-016 bug fix — handleFinishHand partial-failure recovery
**Beads ID:** aia-core-vf1z
**Cycle:** 22

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
| 1 | Already-persisted players are not re-POSTed on retry | SATISFIED | `doFinishHand()` filters via `persistedPlayers.has(p.name)` at DealerApp.jsx L181; test validates retry call count (3 total, last call Charlie-only) at DealerApp.test.jsx L769-L779 | |
| 2 | Set is cleared on successful completion | SATISFIED | `setPersistedPlayers(new Set())` at DealerApp.jsx L193 after `FINISH_HAND` dispatch | |
| 3 | Error state surfaces to UI on partial failure | SATISFIED | `catch` block sets `finishError` at L195; test asserts error text visible at DealerApp.test.jsx L756-L758 | |

---

## Findings

### [MEDIUM] `persistedPlayers` not cleared in `handleStartHand`

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 29-36
**Category:** correctness

**Problem:**
`persistedPlayers` is cleared on successful finish (L193) but not in the `handleStartHand` function. If a user abandons a partially-failed finish (cancels the dialog) and starts a new hand, stale player names remain in the Set. On the new hand's finish, those players would be incorrectly filtered out if they happen to be uncaptured again.

In practice the risk is low — the dialog `Cancel` button just hides the overlay (`setShowFinishConfirm(false)`) without clearing `persistedPlayers`, and the user would need to start a brand-new hand where the same player names are uncaptured. But it's a latent correctness bug.

**Suggested Fix:**
Add `setPersistedPlayers(new Set())` inside `handleStartHand` after the successful `createHand` call, or inside the cancel handler.

**Impact:** Stale Set could silently skip POSTing a player on a subsequent hand after a cancelled partial-failure scenario.

---

### [LOW] New `Set` allocation on every successful player POST

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 189
**Category:** design

**Problem:**
`setPersistedPlayers((prev) => new Set(prev).add(p.name))` creates a new Set on every iteration. For a typical 3-9 player table this is negligible, but it's worth noting the pattern. React/Preact state immutability requires this, so it's correct — just a design observation, not actionable.

**Impact:** None in practice. Set size is bounded by player count per hand (typically ≤ 9).

---

## Positives

- **Clean idempotency pattern**: Using a `Set` of player names to track persisted state is simple and effective. The filter-before-POST approach avoids both duplicate errors and complex rollback logic
- **Proper immutable state updates**: `new Set(prev).add(p.name)` correctly follows React/Preact immutability rules for state
- **Thorough test**: The partial-failure test covers all three phases — initial failure, error display, and retry with correct call counts and argument verification
- **Set is cleared on success path**: `setPersistedPlayers(new Set())` after `FINISH_HAND` dispatch prevents cross-hand leakage in the happy path

---

## Overall Assessment

The fix is **sound and well-tested**. The `persistedPlayers` Set correctly prevents duplicate POSTs during retry, is bounded by player count (no memory leak risk), and is cleared on successful completion. The test comprehensively validates the retry scenario with exact call counts and argument checks.

**One MEDIUM finding**: `persistedPlayers` should also be cleared when starting a new hand or cancelling the finish dialog, to prevent stale state from leaking across hand boundaries in edge-case abandon-and-restart flows.

No race condition risk: `doFinishHand` is guarded by the `finishing` flag which disables the Confirm button during execution, preventing concurrent invocations.

**No CRITICAL findings — code is safe to ship with the MEDIUM addressed as a follow-up.**
