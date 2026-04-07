# Code Review Report — cycle-22c · aia-core-mfd · 2026-04-07

**Reviewer:** Scott
**Target:** `frontend/src/views/playbackView.js` — `window.__onSessionLoaded` handler
**Cycle:** 22c (spot-check after dispose-before-guard fix)
**Date:** 2026-04-07

---

## Primary Verification

**Question:** Does the handler execute dispose+clear BEFORE the `if (!hands.length) return;` guard?

**Answer: YES — confirmed correct.**

Execution order inside `window.__onSessionLoaded` (lines 48–67):

| Step | Line | Action |
|---|---|---|
| 1 | 49 | `loadSession(labels, playerNames)` — update seat labels |
| 2 | 50 | `updateSeatLabelPositions(...)` — reposition labels |
| 3 | 51–53 | `activeScrubber.dispose()` + `activeScrubber = null` — **dispose** |
| 4 | 55 | `scrubberContainer.innerHTML = ''` — **clear DOM** |
| 5 | 57 | `if (!hands.length) return;` — **guard (after cleanup)** |
| 6 | 59–65 | Build seatPlayerMap, update chip stacks, create new scrubber |

Dispose and DOM clear both occur unconditionally before the early-return guard. A zero-hands session load will clean up any prior scrubber before returning, preventing stale state.

---

## Findings

### MEDIUM — Global `window` communication channel

**File:** `frontend/src/views/playbackView.js`
**Lines:** 48, 135–136

`renderPlaybackView` writes to `window.__onSessionLoaded` and `loadSession_` reads from it. This couples two independent module scopes through the global namespace rather than through a closure, callback argument, or event bus. If `renderPlaybackView` is ever called for two different containers (e.g., split-view or tab-based navigation), the second call silently overwrites the handler from the first, and the first container becomes unresponsive to session selection without any error.

**Suggested fix:** Pass the handler callback directly into `loadSession_`, or return a teardown object from `renderPlaybackView` that re-exposes the callback without touching `window`.

---

### MEDIUM — Handler not cleared on view teardown

**File:** `frontend/src/views/playbackView.js`
**Line:** 48

`window.__onSessionLoaded` is assigned inside the `requestAnimationFrame` callback but is never set to `null` when the view is unmounted or replaced. The closure captures `labels`, `activeScrubber`, `chipStacksCtrl`, `renderer`, `scene`, and `container` — all scene resources that are presumably disposed when the view is destroyed. If the view is torn down and a new view is rendered in the same container, a stale `window.__onSessionLoaded` pointing at the old scene's closure remains alive until the next RAF overwrites it. During that window, a click on a session row would invoke the dead closure.

**Suggested fix:** After `initScene` returns a `dispose` function, expose a `teardown` path from `renderPlaybackView` that calls `renderer.dispose()` and sets `window.__onSessionLoaded = null`.

---

### LOW — Theoretical RAF timing gap

**File:** `frontend/src/views/playbackView.js`
**Lines:** 26, 134–136

`window.__onSessionLoaded` is set inside `requestAnimationFrame`, which fires ~16 ms after `renderPlaybackView` returns. `loadSessionList()` is called immediately after `renderPlaybackView` returns (line 68). If the session list API responded instantly (e.g., from cache) and the user had a pre-selected session, `loadSession_` could theoretically call `window.__onSessionLoaded` before the RAF fires — the guard `if (window.__onSessionLoaded)` in `loadSession_` would silently skip the handler with no visual feedback. In practice network latency makes this unreachable, but it is a latent race.

**Suggested fix:** Initialize `window.__onSessionLoaded = null` synchronously at the top of `renderPlaybackView`, before calling `loadSessionList()`, so the guard in `loadSession_` is always defined and the RAF sets the live implementation.

---

### LOW — `session` property passed but ignored

**File:** `frontend/src/views/playbackView.js`
**Lines:** 48, 135–136

`loadSession_` calls `window.__onSessionLoaded({ session, hands, playerNames })`, but the handler destructures only `{ hands, playerNames }`. The `session` object (game_id, game_date, etc.) is silently dropped. This is harmless today but creates a misleading contract — callers may assume session metadata is consumed.

**Suggested fix:** Either remove `session` from the call site destructuring or add it to the handler signature with a comment indicating it is reserved for future use.

---

## AC Mapping

This spot-check targets the fix from commit `fix: dispose before zero-hands guard in onSessionLoaded (aia-core-mfd)`. No formal ACs exist for the fix itself; the verification criterion is:

| Criterion | Status |
|---|---|
| `dispose()` called before `if (!hands.length) return` | ✅ PASS |
| `scrubberContainer.innerHTML = ''` cleared before guard | ✅ PASS |
| No new CRITICAL findings | ✅ PASS |
| No new HIGH findings | ✅ PASS |

---

## Summary

The dispose-before-guard fix is correctly implemented. No critical or high issues were introduced. Two medium design concerns exist around the global window channel pattern; both are pre-existing architectural choices rather than regressions from this commit.

```
FINDINGS SUMMARY: C:0 H:0 M:2 L:2
```
