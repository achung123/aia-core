# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 35
**Target:** `frontend/src/dealer/BlindTimer.tsx`, `frontend/src/dealer/BlindTimer.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-023 — Blind display & timer UI component
**Beads ID:** aia-core-v6yx

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
| 1 | Displays Blinds: $X.XX / $Y.YY from fetchBlinds() data | SATISFIED | `BlindTimer.tsx` L68-70; test "displays blind level as $X.XX / $Y.YY" | Correct `toFixed(2)` formatting |
| 2 | Countdown timer from blind_timer_started_at + blind_timer_minutes | SATISFIED | `BlindTimer.tsx` L28-31 reads `blind_timer_remaining_seconds`; tests "shows countdown timer", "counts down every second", "does not count below 0" | Server provides remaining seconds; client counts down |
| 3 | Pause/resume button calls updateBlinds() | SATISFIED | `BlindTimer.tsx` L51-59 `handlePauseResume`; tests "calls updateBlinds to pause/resume" | State synced from server response |
| 4 | When timer hits 0, prompts dealer to advance blinds | SATISFIED | `BlindTimer.tsx` L82-92 advance prompt; tests "shows advance prompt when timer reaches 0", "calls onAdvanceBlinds callback" | Advance button + callback both verified |
| 5 | Component test verifies timer, pause, and advance flows | SATISFIED | `BlindTimer.test.tsx` — 15 tests | Covers all ACs plus cleanup and edge cases |

---

## Findings

### [MEDIUM] Silent error swallowing in catch blocks

**File:** `frontend/src/dealer/BlindTimer.tsx`
**Line(s):** 34, 60
**Category:** correctness

**Problem:**
Both `fetchBlinds` and `updateBlinds` catch blocks discard the error with no logging. If the API returns an error during pause/resume, the user receives no feedback — the button appears to do nothing. The fetch-on-mount catch is more tolerable (component shows placeholder), but the interaction catch on L60 hides failures from the user.

**Code:**
```tsx
.catch(() => { /* ignore fetch errors */ });     // L34
} catch {                                         // L60
  /* ignore errors */
}
```

**Suggested Fix:**
Log to `console.warn` at minimum. For `handlePauseResume`, consider surfacing a brief error state so the dealer knows the pause/resume didn't stick.

**Impact:** Dealer could believe they paused the timer when the API call failed; timer continues to tick serverside. Low probability in practice, but the fix is trivial.

---

### [LOW] No periodic re-sync with server — timer may drift on backgrounded tabs

**File:** `frontend/src/dealer/BlindTimer.tsx`
**Line(s):** 37-47
**Category:** design

**Problem:**
The component fetches `blind_timer_remaining_seconds` once on mount and then decrements locally via `setInterval`. Browsers throttle `setInterval` in background tabs (often to one tick per minute), so a tab left in the background will show a stale/incorrect countdown when re-focused.

**Suggested Fix:**
Add a `visibilitychange` listener that re-fetches blinds when the tab becomes visible, or use a `requestAnimationFrame`-based approach that compares against wall-clock time. Not critical for alpha — note for future improvement.

**Impact:** Minor. Blind timers are typically 10–20 minutes; the drift is only visible if the tab was backgrounded for an extended period.

---

## Positives

- **Clean separation of concerns** — component is purely presentational + one API layer; no business logic leakage
- **Correct interval lifecycle** — `shouldTick` derived boolean controls both interval creation and cleanup; the `useEffect` dependency array is minimal and correct
- **Server-authoritative remaining time** — component delegates time calculation to the server and uses `blind_timer_remaining_seconds`, avoiding client-side clock math
- **Robust floor-to-zero** — the `setRemaining` callback handles `prev <= 0` explicitly, and `Math.max(0, ...)` is applied on data load
- **Good test coverage** — 15 tests with fake timers, covering tick, pause, resume, expiry, null-timer, cleanup, and callback invocation
- **`useCallback` on handler** — `handlePauseResume` is memoised with correct deps, preventing unnecessary child re-renders

---

## Overall Assessment

Solid implementation. All five acceptance criteria are satisfied and backed by tests. The two findings are minor — one MEDIUM (silent catch blocks on the pause/resume path) and one LOW (background-tab drift). Neither warrants blocking. No critical or high-severity issues found.
