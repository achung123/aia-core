# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Target:** T-002 — Register `#/dealer` route
**Reviewer:** Scott (automated)
**Cycle:** 2
**Epic:** dealer-interface-003 (aia-core-8w0)

**Task:** T-002 — Register `#/dealer` route
**Beads ID:** aia-core-6w0

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
| 1 | Navigating to `#/dealer` renders the Preact `DealerApp` component | SATISFIED | `frontend/src/main.js` L15-18: `'#/dealer'` route calls `render(h(DealerApp), container)` | DealerApp.jsx renders a `<div id="dealer-root"><h1>Dealer Interface</h1></div>` placeholder |
| 2 | A "Dealer" nav link appears alongside "Playback" and "Data" | SATISFIED | `frontend/src/router.js` L35-37: `createNav()` includes `<a href="#/dealer">Dealer</a>` | All three links present in the nav template |
| 3 | Navigating from `#/dealer` to `#/playback` unmounts Preact cleanly | SATISFIED | `frontend/src/main.js` L18: cleanup returns `() => render(null, container)`; `frontend/src/router.js` L8-11: `navigate()` calls `cleanup()` before clearing innerHTML | Correct Preact unmount pattern |
| 4 | No console errors on route transitions | SATISFIED | Build passes; cleanup/innerHTML ordering prevents orphaned Preact trees; `|| null` guards non-returning views | Cannot verify runtime without browser, but code paths are sound |

---

## Findings

### [MEDIUM] M-1 — `@preact/preset-vite` listed under `dependencies` instead of `devDependencies`

**File:** `frontend/package.json`
**Line(s):** 13
**Category:** convention

**Problem:**
`@preact/preset-vite` is a build-time Vite plugin. It is listed under `dependencies` rather than `devDependencies`. This means it will be bundled/installed in production Docker images, adding unnecessary weight. The prior task T-001 AC specified "vite.config.js includes esbuild JSX config targeting Preact" — the switch to @preact/preset-vite is a reasonable improvement, but the placement is wrong.

**Code:**
```json
"dependencies": {
    "@preact/preset-vite": "^2.10.5",
    "preact": "^10.29.1",
    "three": "^0.183.2"
}
```

**Suggested Fix:**
Move `@preact/preset-vite` to `devDependencies` alongside `vite`:
```json
"devDependencies": {
    "@preact/preset-vite": "^2.10.5",
    "vite": "^8.0.4"
}
```

**Impact:** Larger production image; no functional impact on build.

---

### [MEDIUM] M-2 — `app.innerHTML = ''` after Preact unmount is redundant but not harmful

**File:** `frontend/src/router.js`
**Line(s):** 8-12
**Category:** design

**Problem:**
The router calls `cleanup()` (which for the dealer route does `render(null, container)` — unmounting Preact and clearing the container), then immediately sets `app.innerHTML = ''`. The innerHTML clear is redundant after Preact unmount since `render(null, container)` already empties the container. However, the innerHTML clear is still necessary for vanilla views (playback/data) that don't return cleanup functions, so this is correct by necessity. The concern is the reverse direction: when navigating **to** `#/dealer` **from** a vanilla view, `cleanup` is `null`, so only `innerHTML = ''` runs — this is correct because no Preact tree exists yet.

The ordering is correct: unmount Preact first (to run effects/cleanup), then clear DOM. No action required, but documenting for clarity.

**Code:**
```javascript
if (cleanup) {
    cleanup();
    cleanup = null;
}
app.innerHTML = '';
cleanup = render(app) || null;
```

**Suggested Fix:**
No fix needed. This is the correct approach given mixed vanilla/Preact views. Consider adding a brief comment explaining the dual-cleanup pattern for future maintainers.

**Impact:** None — pattern is correct. Noted for documentation purposes only.

---

### [LOW] L-1 — `createNav()` uses template literal innerHTML with static content

**File:** `frontend/src/router.js`
**Line(s):** 33-37
**Category:** security

**Problem:**
The nav is built using `innerHTML` with a template literal. Currently all values are static strings (no user input), so there is no XSS risk. However, if this pattern is extended in the future with dynamic values, it could become a vector. The existing data view already uses a `el()` DOM builder helper for safe element creation.

**Code:**
```javascript
nav.innerHTML = `
    <a href="#/playback">Playback</a>
    <a href="#/data">Data</a>
    <a href="#/dealer">Dealer</a>
`;
```

**Suggested Fix:**
No immediate fix required — all content is static. If nav links become dynamic in the future, switch to `document.createElement` or the `el()` helper from dataView.js.

**Impact:** No current risk. Future-proofing note only.

---

### [LOW] L-2 — Chunk size warning from Vite build

**File:** `frontend/vite.config.js`
**Line(s):** N/A (build output)
**Category:** convention

**Problem:**
The production build emits a warning that the JS chunk exceeds 500 kB (558.63 kB). This predates T-002 (Three.js is the main contributor), but the @preact/preset-vite change is a good opportunity to note that code-splitting should be considered as the dealer interface grows.

**Suggested Fix:**
Consider lazy-loading the Three.js playback view or the Preact dealer view via dynamic `import()` in a future task. Not blocking for T-002.

**Impact:** Slightly larger initial download; no functional impact.

---

## Positives

- **Clean Preact lifecycle management**: The mount/unmount pattern via `render(h(DealerApp), container)` and `render(null, container)` is the idiomatic Preact approach and correctly prevents orphaned component trees.
- **Backward-compatible router enhancement**: The cleanup callback tracking (`let cleanup = null`) is additive — existing vanilla views that return `undefined` are handled gracefully via `|| null`.
- **Correct separation of concerns**: The route definition in `main.js` keeps the router generic while `DealerApp.jsx` is a clean, minimal component ready for expansion.
- **@preact/preset-vite upgrade**: Replacing manual esbuild JSX config with the official Preact Vite plugin is the right call — it handles JSX transform, Fast Refresh, and Preact aliasing automatically.
- **Build passes**: `npm run build` completes successfully with 24 modules transformed.

---

## Overall Assessment

T-002 is well-implemented. All four acceptance criteria are satisfied. The Preact mount/unmount lifecycle is correct and idiomatic. The router enhancement is backward-compatible with existing vanilla views. No CRITICAL or HIGH issues found.

The two MEDIUM findings are minor: `@preact/preset-vite` should move to `devDependencies` (convention issue, no functional impact), and the dual-cleanup pattern in the router is correct but worth a comment. The two LOW findings are informational.

**Verdict:** Clean. Ready to proceed to T-003/T-004.
