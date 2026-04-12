# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 27
**Target:** `frontend/src/views/MobilePlaybackView.jsx`, `frontend/src/views/MobilePlaybackView.test.jsx`, `frontend/src/main.js`
**Reviewer:** Scott (automated)

**Task:** T-020 — Mobile playback route and layout
**Beads ID:** aia-core-30gu

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
| 1 | Route registered (`#/playback-mobile`) | SATISFIED | `main.js` L16-19 — route key `#/playback-mobile` renders `MobilePlaybackView` and returns Preact cleanup | Cleanup function `render(null, container)` correctly unmounts tree |
| 2 | Canvas fills viewport | SATISFIED | `MobilePlaybackView.jsx` L101 — wrapper `100vw × 100vh`, canvas `100% × 100%` | Test asserts `wrapper.style.width === '100vw'` |
| 3 | Session picker is bottom-drawer | SATISFIED | `MobilePlaybackView.jsx` L113-160 — `position: absolute; bottom: 0` drawer with toggle button | Test verifies drawer presence, position, and toggle behavior |
| 4 | Game list sorted by date desc | SATISFIED | `MobilePlaybackView.jsx` L42-44 — `b.game_date.localeCompare(a.game_date)` | Test verifies `2026-04-05` appears before `2026-03-01` before `2026-02-15` |
| 5 | Selecting game loads hands and renders first hand | SATISFIED | `MobilePlaybackView.jsx` L78-98 — `selectGame` calls `fetchHands`, maps to `handToCardData(hands[0])`, calls `sceneRef.current.update()` | Test verifies `fetchHands` called with correct game ID |

---

## Findings

### [MEDIUM] M-1: Uncancelled `requestAnimationFrame` on early unmount

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 55-63
**Category:** correctness

**Problem:**
The `init()` function polls via `requestAnimationFrame(init)` until the canvas has non-zero dimensions. The returned `requestAnimationFrame` ID is never stored, so the cleanup function in the `useEffect` return cannot cancel it. If the component unmounts before the canvas is sized (e.g., rapid route navigation), the pending rAF callback fires after unmount and calls `createPokerScene` on a detached canvas, leaking a renderer and animation loop.

**Code:**
```jsx
function init() {
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    sceneRef.current = createPokerScene(canvas, { ... });
  } else {
    requestAnimationFrame(init);  // ID not stored — cannot cancel
  }
}
init();
```

**Suggested Fix:**
Store the rAF ID and cancel it in the cleanup:
```jsx
let rafId;
function init() {
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    sceneRef.current = createPokerScene(canvas, { ... });
  } else {
    rafId = requestAnimationFrame(init);
  }
}
init();

return () => {
  if (rafId) cancelAnimationFrame(rafId);
  if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
};
```

**Impact:** Potential memory leak and orphaned animation loop on fast route transitions. Low probability in typical usage but a correctness gap.

---

### [MEDIUM] M-2: Drawer toggle button below WCAG minimum touch target

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 127-136
**Category:** design

**Problem:**
The drawer toggle button has `padding: '10px'` vertically. With a 14px font, the rendered height is approximately 34px — below the WCAG 2.5.8 recommended 48×48px minimum for touch targets. On mobile devices, this makes the toggle difficult to tap reliably.

**Code:**
```jsx
<button
  data-testid="drawer-toggle"
  style={{
    width: '100%',
    padding: '10px',  // ~34px total height
    ...
    fontSize: '14px',
  }}
>
```

**Suggested Fix:**
Increase padding to meet the 48px minimum:
```jsx
padding: '14px',   // or use minHeight: '48px'
```

**Impact:** Usability issue on mobile devices; users may mis-tap the toggle, especially one-handed.

---

### [LOW] L-1: `100vh` does not account for mobile browser chrome

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 101
**Category:** design

**Problem:**
`height: '100vh'` on mobile Safari and Chrome includes the area behind the address bar. When the address bar is visible, content overflows the visible viewport. The `dvh` (dynamic viewport height) unit handles this correctly on modern mobile browsers.

**Code:**
```jsx
style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
```

**Suggested Fix:**
```jsx
height: '100dvh'   // falls back gracefully; supported in Safari 15.4+, Chrome 108+
```

**Impact:** On mobile Safari, the canvas may initially extend behind the address bar, causing ~70px of content to be hidden.

---

### [LOW] L-2: No abort/unmount guard on async `selectGame`

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 72-98
**Category:** correctness

**Problem:**
`selectGame` is an async function that calls `fetchHands` and then updates state. If the component unmounts while the fetch is in-flight, `setError` or `sceneRef.current.update()` will be called on stale refs. In Preact this does not throw, but it is a correctness gap that could cause unexpected behavior if the API is slow.

**Code:**
```jsx
async function selectGame(gameId) {
  setActiveGameId(gameId);
  setDrawerOpen(false);
  try {
    const hands = await fetchHands(gameId);  // no abort signal
    if (!hands.length || !sceneRef.current) return;
    // ...
  } catch (err) {
    setError(err.message);  // may fire after unmount
  }
}
```

**Suggested Fix:**
Use an `AbortController` or a mounted ref to guard post-fetch state updates:
```jsx
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
// then in selectGame: if (!mountedRef.current) return;
```

**Impact:** Low — Preact handles this gracefully, but it's a correctness gap that could matter if the API is slow or the user navigates rapidly.

---

## Positives

- **Clean component structure** — `parseCard` and `handToCardData` are well-extracted pure functions with clear intent
- **Proper Three.js lifecycle** — `dispose()` is called on scene cleanup, preventing GPU resource leaks in the normal case
- **Thorough test coverage** — 9 tests covering rendering, loading states, error handling, sorting, selection, drawer toggle, and scrubber mount point
- **Route cleanup** — `main.js` returns `render(null, container)` to properly unmount the Preact tree
- **XSS safe** — All dynamic content is rendered as JSX text children (auto-escaped by Preact)
- **No sidebar** — Explicitly tested as absent, matching the AC

---

## Overall Assessment

All 5 acceptance criteria are **SATISFIED**. The implementation is clean, well-tested, and follows existing codebase patterns. The two MEDIUM findings (uncancelled rAF and small touch target) are not critical but should be addressed before the mobile playback route sees real mobile users. No security issues found — all dynamic content is properly escaped through Preact's JSX rendering.

**Recommendation:** Pass with minor fixes. Address M-1 (rAF leak) and M-2 (touch target) in a follow-up task or the next cycle.
