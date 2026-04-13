# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 1
**Target:** Polling optimization (conditional requests, intervals)
**Reviewer:** Scott (automated)

**Task:** T-039 — Polling optimization (conditional requests, intervals)
**Beads ID:** aia-core-x0ie

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
| 1 | Dealer polling: 3s | SATISFIED | `DealerApp.tsx` L57: `intervalMs: 3000` | Correct interval, properly gated by `currentStep === 'activeHand'` |
| 2 | Player status polling: 5s | SATISFIED | `PlayerApp.tsx` L308: `intervalMs: 5000` | Correct interval, gated by `step === 'playing'` |
| 3 | Visualization polling: 10s | SATISFIED | `BlindPositionDisplay.tsx` L14: `POLL_INTERVAL_MS = 10_000` | Test confirms 10s interval in `BlindPositionDisplay.test.tsx` "AC4: polls for blind level changes" |
| 4 | PlayerApp polling passes If-None-Match header; skips state update on 304 | SATISFIED | `PlayerApp.tsx` L330: calls `fetchHandStatusConditional` with `etagRef.current`; `client.ts` L243: sets `If-None-Match` header; L253: returns early on 304 without JSON parse | ETag cleared on hand change (L321) preventing stale matches |
| 5 | All polling loops use AbortController | SATISFIED | `usePolling.ts` L22–42: AbortController created per effect lifecycle, signal passed to fetchFn, abort on cleanup | BlindPositionDisplay doesn't pass signal through to `fetchBlinds` (see finding M-1) but the hook itself uses AbortController correctly |
| 6 | Transient errors show subtle reconnection indicator | SATISFIED | `DealerApp.tsx` L381: `dealerReconnecting` → "Reconnecting…"; `PlayerApp.tsx` L355: `playerReconnecting` → "Reconnecting…" | Hook sets `isReconnecting` on non-abort errors and clears on success |

---

## Findings

### [MEDIUM] M-1: BlindPositionDisplay does not forward AbortSignal to fetchBlinds

**File:** `frontend/src/components/BlindPositionDisplay.tsx`
**Line(s):** 28–33
**Category:** correctness

**Problem:**
The `fetchFn` callback receives `signal` from the hook but does not pass it to `fetchBlinds(gameId)`. The underlying `fetchBlinds` function doesn't accept a signal parameter either. On unmount, the `usePolling` hook aborts the controller, but the HTTP request itself continues to completion. The `!signal.aborted` guard prevents stale state updates, so this won't cause a React error, but it means network requests are not truly cancelled on teardown — wasting bandwidth on mobile devices.

**Code:**
```typescript
fetchFn: (signal) =>
  fetchBlinds(gameId)  // signal not forwarded
    .then(data => {
      if (!signal.aborted) {
        setBlinds({ small_blind: data.small_blind, big_blind: data.big_blind });
      }
    }),
```

**Suggested Fix:**
Update `fetchBlinds` in `client.ts` to accept `{ signal }` (consistent with `fetchHands`, `fetchHandStatus`), then pass it:
```typescript
fetchFn: (signal) =>
  fetchBlinds(gameId, { signal })
    .then(data => { ... })
```

**Impact:** Unnecessary network requests on fast navigation; minor bandwidth waste. No stale state risk.

---

### [LOW] L-1: DealerApp nested fetchHand call not cancellable

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 73–84
**Category:** correctness

**Problem:**
Inside the dealer's polling callback, a secondary `fetchHand(gameId!, currentHandId!)` is called without passing the abort `signal`. The `.then()` guard (`if (signal.aborted) return`) prevents state updates but the request itself runs to completion after unmount.

**Code:**
```typescript
fetchHand(gameId!, currentHandId!)
  .then((handData) => {
    if (signal.aborted) return;
    // ... state updates
  })
  .catch(() => { /* ignore card fetch errors */ });
```

**Suggested Fix:**
Update `fetchHand` to accept `{ signal }` and propagate it here. Low priority since this secondary fetch is conditional and the state guard is correct.

**Impact:** Minimal — secondary fetch is occasional and guarded.

---

### [LOW] L-2: No concurrent-tick protection in usePolling

**File:** `frontend/src/hooks/usePolling.ts`
**Line(s):** 24–37
**Category:** design

**Problem:**
`setInterval` fires regardless of whether the previous poll has completed. If a fetch takes longer than `intervalMs`, multiple requests can be in-flight simultaneously. For a 3s–10s polling interval this is unlikely to be a problem in practice, but high-latency environments could see overlapping requests with out-of-order state updates.

**Suggested Fix:**
If this becomes a concern, replace `setInterval` with a `setTimeout` chain that schedules the next tick only after the previous resolves. Not actionable now — standard setInterval polling is acceptable at these intervals.

**Impact:** Theoretical; unlikely at current intervals.

---

### [LOW] L-3: Missing test for 304/notModified path in PlayerApp polling

**File:** `frontend/src/player/PlayerApp.test.tsx`
**Category:** test adequacy

**Problem:**
The test suite has a `wrapConditional` helper that always returns `{ notModified: false }`. There is no test that verifies the 304 path — i.e., returning `{ data: null, etag: '"same"', notModified: true }` and confirming that `fetchHandStatusConditional` does NOT trigger a state update. This is the primary purpose of AC4 but it's only tested at the API layer (`fetchHandStatusConditional` unit), not at the component integration level.

**Suggested Fix:**
Add a test case that mocks `fetchHandStatusConditional` to return `{ notModified: true, ... }` and asserts that player status does not change.

**Impact:** Reduced confidence in the 304 path at the integration level. The code path is correct by inspection but not regression-tested at the component level.

---

## Positives

- **Clean abstraction**: `usePolling` is well-designed — the `fetchFnRef` pattern avoids stale closures without requiring `fetchFn` in the deps array, and the hook's API is minimal and composable.
- **Thorough AbortController lifecycle**: Signal is created per effect instance, checked in both `.then()` and `.catch()`, and both `DOMException` and generic `AbortError` are handled. Cleanup aborts then clears interval — correct order.
- **ETag/304 implementation**: `fetchHandStatusConditional` correctly avoids JSON parsing on 304, preserves the existing ETag, and the caller resets ETag on hand change to avoid stale matches.
- **Good test coverage for the hook**: 9 tests covering mount, interval, abort, error/recovery, enable/disable, unmount, and restart scenarios.
- **Reconnection indicator**: Clean integration — the hook exposes `isReconnecting` and consumers render it conditionally without coupling.

---

## Overall Assessment

The implementation is solid. All 6 acceptance criteria are satisfied. The `usePolling` hook is well-structured, the AbortController lifecycle is correct (no leaks on unmount), and the ETag/304 handling properly avoids JSON parse on 304 and prevents stale state updates. The reconnection indicator works as expected.

The one MEDIUM finding (signal not forwarded to `fetchBlinds`) is a minor gap in the AbortController contract — the state guard makes it safe, but proper signal forwarding would be more complete. The three LOW findings are minor design and test adequacy notes, none of which indicate bugs.

**Verdict:** No critical or high issues. Ready for merge after optionally addressing M-1.
