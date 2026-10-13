# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 9
**Target:** Showdown trigger + auto-detection frontend logic
**Reviewer:** Scott (automated)

**Task:** T-024 — Showdown trigger + auto-detection frontend logic
**Beads ID:** aia-core-i57o

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC1 | Showdown button enabled when community cards recorded and 2+ non-folded players have cards | SATISFIED | `showdownHelpers.ts` `isShowdownEnabled()` L19-24; `ActiveHandDashboard.tsx` L136-148; 5 unit tests in `showdownHelpers.test.ts`; 4 component tests in `ActiveHandDashboard.test.tsx` | Button correctly guards on `flopRecorded` + filter for non-folded/non-not_playing with both cards |
| AC2 | Calls equity endpoint; maps equity ~1.0→won, ~0.0→lost, split→won (tied) | SATISFIED | `showdownHelpers.ts` `mapEquityToOutcomes()` L28-56; `DealerApp.tsx` `handleShowdown()` L307-327; 4 integration tests in `DealerApp.test.tsx`; 4 unit tests in `showdownHelpers.test.ts` | Threshold `>0.001` correctly maps 1.0→won, 0.0→lost, 0.5→won for splits |
| AC3 | If only one non-folded player, auto-propose won | SATISFIED | `showdownHelpers.ts` L40-42 (mapEquityToOutcomes single-player path); `DealerApp.tsx` L310-315 (handleShowdown fast path); 1 unit test in `showdownHelpers.test.ts` | Two redundant AC3 paths — unit-level is well-tested; integration gap for handler fast path (see LOW-2) |
| AC4 | Outcome street inferred from community card count | SATISFIED | `showdownHelpers.ts` `inferOutcomeStreet()` L11-16; 4 unit tests; 1 integration test mapping street to flop community | River/turn/flop checked in descending order; preflop fallback |
| AC5 | Navigates to review with proposed results pre-filled | SATISFIED | `DealerApp.tsx` L319-324 (setPlayerResult loop + setStep('review')); integration test "showdown button calls fetchEquity and navigates to review" and "sets outcome street on proposed results" | Local state pre-filled, no premature PATCH to backend — review screen confirms |
| AC6 | Inconclusive cases open review with blank results | SATISFIED | `DealerApp.tsx` L325-327 (catch block → setStep('review')); `mapEquityToOutcomes` returns null on missing equity → proposed not applied; 2 integration tests (error + inconclusive) | Both API error and missing equity data are covered |
| AC7 | Test verifies all detection cases | SATISFIED | 16 unit tests (`showdownHelpers.test.ts`), 4 component tests (`ActiveHandDashboard.test.tsx`), 8 integration tests (`DealerApp.test.tsx`) — total 28 new/modified tests | All AC paths have at least unit-level coverage |

---

## Findings

### [MEDIUM] Filter inconsistency between handleShowdown and helper functions

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 308-309
**Category:** design

**Problem:**
`handleShowdown` filters non-folded players with `p.status !== 'folded' && p.status !== 'not_playing'` but does **not** check for `p.card1 && p.card2`. This differs from `isShowdownEnabled` (L21-23 of showdownHelpers.ts) and `mapEquityToOutcomes` (L34-36), which both require cards. If a player has status 'playing' but no cards, they are still counted in `nonFolded`, potentially taking the single-player AC3 fast path when there are actually 2 non-folded players (one without cards).

In practice, `isShowdownEnabled` guards the button and prevents this scenario. However, if `handleShowdown` is ever invoked from a different code path (e.g., keyboard shortcut, test harness), the inconsistent filter could produce incorrect behavior.

**Code:**
```typescript
const nonFolded = players.filter(
  (p) => p.status !== 'folded' && p.status !== 'not_playing',
);
```

**Suggested Fix:**
Align the filter with the helpers:
```typescript
const nonFolded = players.filter(
  (p) => p.status !== 'folded' && p.status !== 'not_playing' && p.card1 && p.card2,
);
```

**Impact:** Low risk today (guarded by `isShowdownEnabled`), but could cause a subtle bug if the handler is reused.

---

### [LOW] isShowdownEnabled called three times per render

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 136-148
**Category:** design

**Problem:**
`isShowdownEnabled(community, players)` is evaluated three times in the Showdown button JSX: once for the style conditional, once for the onClick guard, and once for the `disabled` prop. The function is pure and fast (~O(n) on player list), so this has negligible performance impact, but it's unnecessary repetition.

**Code:**
```tsx
style={{ ...(isShowdownEnabled(community, players) ? {} : styles.streetTileDisabled) }}
onClick={() => isShowdownEnabled(community, players) && onShowdown?.()}
disabled={!isShowdownEnabled(community, players)}
```

**Suggested Fix:**
Hoist to a variable:
```tsx
const showdownReady = isShowdownEnabled(community, players);
```

**Impact:** Negligible. Style nit only.

---

### [LOW] No integration test for handleShowdown single-player fast path (AC3)

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 1773-1810
**Category:** correctness

**Problem:**
The test titled "auto-proposes won for single non-folded player without calling equity (AC3)" actually sets up 2 playing players with cards and invokes the equity API path. It does not exercise `handleShowdown`'s fast path at lines 310-315 of DealerApp.tsx (which skips `fetchEquity` when `nonFolded.length <= 1`). AC3 is well-covered at the unit level in `showdownHelpers.test.ts`, but the handler-level fast path has no integration coverage.

**Suggested Fix:**
Add a test that sets up 1 non-folded player + others folded, clicks Showdown, and asserts `fetchEquity` was NOT called.

**Impact:** Low — the unit test covers the logic and the guard prevents misuse, but a direct integration test would improve confidence.

---

### [LOW] Magic threshold 0.001 in equity mapping is undocumented

**File:** `frontend/src/dealer/showdownHelpers.ts`
**Line(s):** 50
**Category:** convention

**Problem:**
The equity threshold `0.001` used to distinguish won from lost is a magic number without a comment explaining why it's not `0`. It appears designed to handle floating-point imprecision (e.g., equity of 0.0000001 from rounding), which is reasonable, but future maintainers won't know the intent.

**Code:**
```typescript
if (eq.equity > 0.001) {
```

**Suggested Fix:**
Add a brief comment:
```typescript
// Threshold handles float imprecision; equity > 0 at river means a share of the pot
if (eq.equity > 0.001) {
```

**Impact:** Readability. No functional risk.

---

## Positives

- **Clean separation of concerns**: Pure helper functions in `showdownHelpers.ts` are independently testable and imported by both the component and the handler. This is a textbook extraction.
- **Comprehensive test coverage**: 16 unit tests for helpers, 4 component-level tests for button enable/disable, 8 integration tests for the full handler flow. All 7 ACs are covered at some layer.
- **Defensive inconclusive handling**: Both API errors and missing equity data gracefully fall through to the review screen with blank results, preventing the dealer from getting stuck.
- **No premature persistence**: Proposed results are local-only state until the review screen confirms. This is the correct pattern for a "propose → review → confirm" workflow.
- **TypeScript types are tight**: `ProposedResult` interface constrains status to `'won' | 'lost'`, and `PlayerEquityEntry` is properly typed from the API layer.

---

## Overall Assessment

Implementation is **clean and correct**. All 7 acceptance criteria are satisfied. Zero CRITICAL or HIGH findings. The one MEDIUM finding (filter inconsistency) is defended by the UI guard but worth aligning for robustness. The three LOW findings are style/coverage nits.

The showdown flow correctly handles: outright wins, split pots, single-player auto-wins, street inference, API errors, and inconclusive equity data. Tests cover every documented scenario at unit and/or integration level.

**Recommendation:** Ship as-is. Address MEDIUM-1 filter alignment in a follow-up if `handleShowdown` is expected to be callable from additional entry points.
