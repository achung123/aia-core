# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/` (package.json, index.html, src/main.js, vite.config.js)
**Reviewer:** Scott (automated)

**Task:** Scaffold Vite + Three.js frontend project
**Beads ID:** aia-core-3zn

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `frontend/package.json` exists with `"three"` in dependencies and `"vite"` in devDependencies | SATISFIED | `frontend/package.json` L13: `"three": "^0.183.2"`; L10: `"vite": "^8.0.4"` | — |
| 2 | `frontend/index.html` contains a `<canvas id="three-canvas">` and a `<div id="app">` | SATISFIED | `frontend/index.html` L10: `<div id="app">`, L11: `<canvas id="three-canvas">` | — |
| 3 | `npm run dev` configured for `localhost:5173` | SATISFIED | `frontend/vite.config.js` L4: `server: { port: 5173 }` | Script `"dev": "vite"` in package.json delegates port to config |
| 4 | `npm run build` produces `frontend/dist/` without errors | SATISFIED | `frontend/dist/` exists with `index.html`, `assets/`, `favicon.svg`, `icons.svg` | dist/ is correctly excluded from git via frontend/.gitignore |
| 5 | `main.js` imports Three.js and logs `THREE.REVISION` to the console | NOT SATISFIED | `frontend/src/main.js` — no `import ... from 'three'` and no `console.log(THREE.REVISION)` anywhere in the file | File is the default Vite vanilla scaffold boilerplate; Three.js is never referenced |

---

## Findings

### [HIGH] main.js missing Three.js import and revision log

**File:** `frontend/src/main.js`
**Line(s):** 1–62 (entire file)
**Category:** correctness

**Problem:**
`main.js` is the unmodified default Vite vanilla scaffold. It imports `style.css`, `javascript.svg`, `vite.svg`, `hero.png`, and a `counter.js` helper — but it never imports `three` and never calls `console.log(THREE.REVISION)`. AC#5 explicitly requires a smoke test that imports Three.js and logs the library version. Without this, there is no validation that Three.js is wired into the entry point correctly.

**Code:**
```javascript
import './style.css'
import javascriptLogo from './assets/javascript.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { setupCounter } from './counter.js'
// Three.js is never imported here
```

**Suggested Fix:**
Add a Three.js import and revision log at the top of `main.js`:
```javascript
import * as THREE from 'three';
console.log('Three.js r' + THREE.REVISION);
```

**Impact:** AC#5 is unmet. The declared deliverable of the smoke test does not exist. The `three` package is installed but is completely unused by the entry point.

---

### [LOW] Unquoted asset references in template literal HTML

**File:** `frontend/src/main.js`
**Line(s):** 12, 40
**Category:** convention

**Problem:**
Two `src` attributes in the template literal are missing quotes around the interpolated expression:
```javascript
<img src=${viteLogo} class="vite" alt="Vite logo" />   // line ~12
<img src=${viteLogo} class="framework" .../>            // line ~40
```
All other asset references in the same block use quoted interpolation (`src="${javascriptLogo}"`). While Vite asset URLs are hash-based and unlikely to contain spaces, inconsistent quoting is an HTML correctness issue and could cause unexpected behaviour in edge cases.

**Suggested Fix:**
```javascript
<img src="${viteLogo}" class="vite" alt="Vite logo" />
```

**Impact:** Low. Asset URLs produced by Vite contain no spaces, so this is unlikely to cause a runtime failure. It is a convention inconsistency within the same file.

---

## Positives

- `package.json` is well-structured: `"private": true` is set (prevents accidental npm publish), `"type": "module"` is correct for a Vite ESM project, and dependency versions are pinned to a recent stable range.
- `vite.config.js` is minimal and correct — no unnecessary plugins or overrides.
- `frontend/.gitignore` correctly excludes `node_modules`, `dist`, and `dist-ssr`, so build artefacts will not be committed.
- `index.html` includes both required elements (`<div id="app">` and `<canvas id="three-canvas">`) and sets `lang="en"`, charset, and viewport meta correctly.

---

## Overall Assessment

4 of 5 acceptance criteria are satisfied. AC#5 (smoke-test Three.js import + revision log) is the sole unmet deliverable: the entry point `main.js` was never updated from the default scaffold and contains no reference to Three.js. This is a straightforward one-line fix. No security issues were identified. The scaffold structure, configuration, and dependency declaration are all correct.

**Next step:** Update `frontend/src/main.js` to add `import * as THREE from 'three'; console.log('Three.js r' + THREE.REVISION);` and re-verify AC#5 before closing the task.
