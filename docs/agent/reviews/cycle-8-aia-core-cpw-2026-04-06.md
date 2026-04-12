# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/router.js`, `frontend/src/main.js`, `frontend/index.html`
**Reviewer:** Scott (automated)
**Cycle:** 8

**Task:** Hash-based SPA router and nav bar
**Beads ID:** aia-core-cpw

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `router.js` exports `initRouter(routes)` (map of hash → render function) | SATISFIED | `frontend/src/router.js` L1 — `export function initRouter(routes)` | Correctly exported; accepts routes map |
| 2 | `#/playback` renders Three.js canvas container; `#/data` renders data container | SATISFIED | `main.js` L6–13 — `renderPlayback` creates `<canvas id="three-canvas">`, `renderData` renders `<h1>Data</h1>` container | Canvas element created dynamically as specified; Three.js scene not yet wired |
| 3 | Persistent `<nav>` with "Playback" and "Data" links updating hash | SATISFIED | `router.js` L3, L23–30 — nav created via `createNav()`, inserted as `document.body.firstChild`, persists because it is outside `#app` | Duplication guard via `querySelector('nav')` present |
| 4 | Active link visually highlighted | NOT SATISFIED | `router.js` L10–12 — `.active` class is toggled correctly in JS, but no `nav a.active` CSS rule is defined in `style.css`; further, `style.css` is not imported at all | See H1, H2 |
| 5 | Direct address bar navigation to `/#/data` loads correct view | SATISFIED | `router.js` L17 — `navigate()` called immediately on init, reads `window.location.hash` | Falls back to `#/playback` when hash is empty or unrecognised |

---

## Findings

### [HIGH] `style.css` not imported — entire stylesheet unused

**File:** `frontend/src/main.js`
**Line(s):** 1–3 (missing import)
**Category:** correctness

**Problem:**
The original Vite scaffold included `import './style.css'` at the top of `main.js`. That import was removed when the file was rewritten for the router. Without it, Vite never bundles the stylesheet. The page receives zero CSS styling — typography, colour variables (`--accent`, `--bg`, etc.), and layout rules are all absent.

**Code:**
```js
// current top of main.js — no style import
import * as THREE from 'three';
import { initRouter } from './router.js';
```

**Suggested Fix:**
```js
import './style.css';
import * as THREE from 'three';
import { initRouter } from './router.js';
```

**Impact:** Page is completely unstyled. All CSS custom properties (`--text`, `--accent`, etc.) are undefined at runtime, which will break any component that references them. This is a prerequisite for AC4 being visible even after a CSS rule is added.

---

### [HIGH] No `nav a.active` CSS rule — active link has no visual highlight

**File:** `frontend/src/style.css`
**Line(s):** entire file
**Category:** correctness

**Problem:**
`router.js` correctly toggles the `.active` class on the active nav link on every navigation event. However, no CSS rule in `style.css` (or anywhere else) targets `nav a.active`. The class is applied to the DOM but produces no visual change. AC4 — "Active link visually highlighted" — is not satisfied regardless of whether `style.css` is imported.

**Suggested Fix:**
Add to `style.css` (below the `body` rule or in a `nav` block):
```css
nav {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

nav a {
  color: var(--text);
  text-decoration: none;
}

nav a.active {
  color: var(--accent);
  font-weight: 600;
  border-bottom: 2px solid var(--accent);
}
```

**Impact:** AC4 is not met. The nav renders as unstyled browser-default anchor tags with no active indicator. Users cannot tell which view is currently selected.

---

### [MEDIUM] `dispose()` returned from `initRouter` but not captured — listener leak on re-init

**File:** `frontend/src/main.js`
**Line(s):** 16
**Category:** design

**Problem:**
`initRouter` returns `{ dispose }` so callers can remove the `hashchange` listener. `main.js` discards the return value. For a single-boot app this is harmless, but if the module is ever hot-reloaded (Vite HMR) or `initRouter` is called a second time, the previous listener is orphaned and both old and new listeners fire on every hash change, causing double-render.

**Code:**
```js
initRouter({          // return value discarded
  '#/playback': renderPlayback,
  '#/data': renderData,
});
```

**Suggested Fix:**
```js
const router = initRouter({
  '#/playback': renderPlayback,
  '#/data': renderData,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => router.dispose());
}
```

**Impact:** Double-render on Vite HMR. No impact in production builds where the module is loaded once.

---

### [LOW] `renderData` uses `innerHTML` string; `renderPlayback` uses DOM API — inconsistent pattern

**File:** `frontend/src/main.js`
**Line(s):** 13
**Category:** convention

**Problem:**
`renderPlayback` creates elements with `document.createElement` (correct DOM API pattern). `renderData` uses `container.innerHTML = '<h1>Data</h1>'`. The content here is hardcoded and not user-supplied, so there is no XSS risk. The inconsistency makes the codebase harder to follow when the data view is later expanded.

**Code:**
```js
function renderData(container) {
  container.innerHTML = '<h1>Data</h1>';  // string-based
}

function renderPlayback(container) {
  const canvas = document.createElement('canvas');  // DOM API
  canvas.id = 'three-canvas';
  container.appendChild(canvas);
}
```

**Suggested Fix:**
```js
function renderData(container) {
  const h1 = document.createElement('h1');
  h1.textContent = 'Data';
  container.appendChild(h1);
}
```

**Impact:** No runtime impact; cosmetic inconsistency only. Establish DOM API as the consistent pattern before the data view grows.

---

## Positives

- **Clean router abstraction** — `initRouter(routes)` is minimal, readable, and correctly separated from `main.js`. The routes map is an idiomatic pattern for a hash router of this size.
- **Nav duplication guard** — `document.querySelector('nav') || createNav()` prevents a second nav element if `initRouter` is accidentally called twice.
- **XSS posture is clean** — `nav.innerHTML` uses a hardcoded template literal with no user input. `app.innerHTML = ''` is a safe reset. No user-controlled strings are injected into the DOM.
- **`dispose()` is correctly implemented** — The function removes the exact listener reference, not a generic `hashchange` removal. Pattern is correct.
- **Fallback routing works** — `routes[hash] || routes['#/playback']` gracefully handles unknown or empty hashes without crashing.
- **Canvas created dynamically** — Removing `id="three-canvas"` from `index.html` and creating it in `renderPlayback` is the right approach for a single-page app; the canvas only exists when its route is active.

---

## Overall Assessment

The router logic is sound and correctly implements all structural requirements. Two of the five acceptance criteria are fully satisfied (AC1, AC3, AC5); one is partially satisfied with a caveat (AC2 — canvas exists but is inert); and one is not satisfied at all (AC4 — active link has no visual style). The root cause of AC4 is twofold: the stylesheet was dropped from `main.js` during the rewrite (HIGH), and no `nav a.active` rule was ever defined (HIGH). Both are straightforward to fix. No security issues were found.

**Recommended next actions (in order):**
1. Add `import './style.css'` to `main.js` (fixes unstyled page)
2. Add `nav a.active` CSS rule to `style.css` (satisfies AC4)
3. Capture the `dispose()` return value and register it with `import.meta.hot` (prevents HMR double-render)
4. Standardise `renderData` to use DOM API instead of `innerHTML` (optional, low priority)
