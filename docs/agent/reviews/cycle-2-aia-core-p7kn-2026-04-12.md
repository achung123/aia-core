# Code Review Report — aia-core (Cycle 2)

**Date:** 2026-04-12
**Cycle:** 2
**Target:** Live hand updates without refresh (useHandPolling + TableView integration)
**Reviewer:** Scott (automated)

**Task:** T-038 — Live hand updates without refresh
**Beads ID:** aia-core-p7kn

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
| AC1 | Every 10s, fetch hand list for current game | SATISFIED | `useHandPolling.ts` L57 → `intervalMs: 10000`; test: "passes gameId and 10000ms interval to usePolling" | `usePolling` handles the interval; `fetchFn` calls `fetchHands(gameId, { signal })` |
| AC2 | If new hand detected and user on latest, auto-advance and update scene | SATISFIED | `useHandPolling.ts` L44-47; test: "auto-advances when new hand appears and user IS on latest" (hook) + "auto-advances to new hand when viewing latest (AC2)" (integration) | Ref-based stale closure prevention for `currentHandIndex` and `onAutoAdvance` is correct |
| AC3 | If scrubbing older hands, show "New hand available" indicator | SATISFIED | `useHandPolling.ts` L48-49; `TableView.tsx` L472-481 banner; test: "sets newHandAvailable when new hand appears and user is NOT on latest" + integration "shows New hand available banner" | Banner is clickable and jumps to latest; `dismissNewHand()` called on scrubber change |
| AC4 | Community card changes update scene seamlessly | SATISFIED | `TableView.tsx` L381-391 subsequent-poll branch calls `updateSceneForHand(hand)`; test: "community card changes update scene seamlessly (AC4)" | Scene updates correctly; equity not re-fetched (see finding M-1) |
| AC5 | AbortController ensures clean unmount | SATISFIED | `usePolling.ts` L25-38 creates AbortController, aborts on cleanup; `useHandPolling.ts` L37 passes signal to `fetchHands`; test: "passes signal to fetchHands" | Clean lifecycle: abort + clearInterval on unmount |
| AC6 | No scroll reset or page refresh on update | SATISFIED | Viewport is `position: fixed` with `overflow: hidden`; polling updates state reactively without navigation; test: "does not reset scroll or navigate on polling update (AC6)" | No scroll state to lose |

---

## Findings

### [MEDIUM] M-1: Equity not re-fetched after auto-advance or community card update

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 373-391
**Category:** correctness

**Problem:**
The subsequent-poll branch of the `useEffect` calls `updateSceneForHand(hand)` but does NOT call `fetchEquityForHand()`. After auto-advance to a new hand or when community cards change on the current hand, the equity overlay displays stale data. The new hand may have different equity, and community card reveals fundamentally change equity calculations.

**Code:**
```typescript
} else {
  // Subsequent poll — update scene for current hand
  const idx = currentHandIndex >= 0 && currentHandIndex < hands.length
    ? currentHandIndex : hands.length - 1;
  const hand = hands[idx];
  if (hand) {
    setCurrentHandNumber(hand.hand_number);
    setSbPlayerName(hand.sb_player_name ?? null);
    setBbPlayerName(hand.bb_player_name ?? null);
    buildSeatMaps(hands);
    updateSceneForHand(hand);
    // Missing: fetchEquityForHand(hand.hand_number);
  }
}
```

**Suggested Fix:**
Add `fetchEquityForHand(hand.hand_number)` to the subsequent-poll branch. Consider a guard to only re-fetch if the hand data actually changed (compare a digest of community cards or hand_id).

**Impact:** User sees stale win probability after new community cards are dealt or when auto-advanced to a new hand.

---

### [MEDIUM] M-2: Equity overlay and new-hand banner overlap when both visible

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 579-600
**Category:** design

**Problem:**
The equity overlay is positioned at `bottom: 80px` (z-index 10), and the new-hand banner is at `bottom: 70px` (z-index 11). Both are horizontally centered via `left: 50%; transform: translateX(-50%)`. When the user is scrubbing an older hand and a new hand arrives, both elements render simultaneously and overlap by ~10px vertically, with the banner covering part of the equity text.

**Suggested Fix:**
Shift the banner further down (e.g., `bottom: 40px`) or conditionally adjust the equity overlay position when the banner is visible. Alternatively, hide equity when the banner is showing since the user is on an older hand and the banner is the primary CTA.

**Impact:** Minor visual overlap; both elements remain readable due to distinct background colors (green vs blue), but it looks unpolished.

---

### [LOW] L-1: `fetchEquityForHand` lacks cancellation — fire-and-forget promises

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 324-335
**Category:** design

**Problem:**
`fetchEquityForHand` fires a fetch with `.then()/.catch()` but has no AbortController. If the user rapidly scrubs hands, multiple equity requests can be in-flight simultaneously and resolve out of order, briefly showing incorrect equity for the wrong hand. On unmount, pending promises may call `setEquityPct()` on an unmounted component (a React warning in dev).

**Suggested Fix:**
Pre-existing pattern — not introduced by this task, so low priority. Could be addressed later by adding an abort ref or a request-id guard.

**Impact:** Rare visual flicker during rapid scrubbing; no crash or data corruption.

---

### [LOW] L-2: Suppressed exhaustive-deps lint rule lacks explanatory comment

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 395
**Category:** convention

**Problem:**
The `eslint-disable-next-line react-hooks/exhaustive-deps` suppresses the warning for `currentHandIndex` being used in the effect body but excluded from the dependency array. The exclusion is intentional (including it would cause infinite loops since the effect sets it), but the comment doesn't explain *why* the suppression is safe.

**Suggested Fix:**
Add an explanatory comment:
```typescript
// currentHandIndex is read but intentionally excluded — this effect sets it,
// and hands changes are the trigger for re-evaluation.
// eslint-disable-next-line react-hooks/exhaustive-deps
```

**Impact:** Future maintainers may incorrectly "fix" the deps array and introduce an infinite loop.

---

## Positives

- **Ref-based stale closure prevention** — `currentHandIndexRef` and `onAutoAdvanceRef` are updated every render, ensuring the polling callback always reads fresh values without recreating the `fetchFn` (which would reset `usePolling`). This is a textbook React pattern and executed correctly.
- **Clean separation of concerns** — `useHandPolling` encapsulates all polling + new-hand detection logic; `TableView` consumes it declaratively. The hook is independently testable.
- **Comprehensive test coverage** — 11 hook tests cover all branches (auto-advance, banner, dismiss, sorting, signal pass-through, disabled polling, community card updates, reconnecting state). 5 integration tests verify end-to-end behavior with fake timers.
- **AbortController threaded correctly** — Signal flows from `usePolling` → `useHandPolling.fetchFn` → `fetchHands` → `fetch()`. Cleanup aborts in-flight requests and clears the interval. No leak paths.
- **Banner interaction design** — Clicking the banner jumps to latest and dismisses it; scrubbing also dismisses. This prevents a sticky banner that confuses the user.
- **Guard against false positive on initial load** — `prevCount > 0` prevents the first fetch from triggering auto-advance or the banner.

---

## Overall Assessment

The implementation is solid and well-tested. All 6 acceptance criteria are satisfied. The auto-advance logic handles edge cases correctly (rapid hand creation, empty initial list, gameId null). AbortController lifecycle is clean with no leak paths. The `usePolling` base hook is reusable and properly separated.

The two MEDIUM findings are minor UX polish issues — stale equity after poll-driven updates (M-1) and banner/equity z-overlap (M-2). Neither affects correctness of the core polling feature. The LOW findings are pre-existing patterns (L-1) and documentation nits (L-2).

**Verdict: PASS** — No CRITICAL or HIGH findings. Ready for merge after addressing M-1 (stale equity) in a follow-up task.
