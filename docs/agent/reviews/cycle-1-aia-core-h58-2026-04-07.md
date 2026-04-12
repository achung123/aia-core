# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 1
**Target:** `frontend/package.json`, `frontend/vite.config.js`, `frontend/src/dealer/DealerApp.jsx`
**Reviewer:** Scott (automated)

**Task:** T-001 — Install Preact & configure Vite JSX
**Beads ID:** aia-core-h58

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
| 1 | `preact` appears in `package.json` dependencies | SATISFIED | `frontend/package.json` line 15: `"preact": "^10.29.1"` | Listed under `dependencies` (not devDependencies) — correct |
| 2 | `vite.config.js` includes esbuild JSX config targeting Preact | SATISFIED | `frontend/vite.config.js` lines 4-8: `jsxFactory: 'h'`, `jsxFragment: 'Fragment'`, `jsxInject` auto-imports from preact | Correct factory/fragment/inject triple |
| 3 | A test `.jsx` file in `src/dealer/` compiles without errors | SATISFIED | `frontend/src/dealer/DealerApp.jsx` exists; `npm run build` succeeds (21 modules transformed, 0 errors) | File is tree-shaken from bundle since nothing imports it yet — expected for T-001 |
| 4 | `#/playback` and `#/data` views remain functional | SATISFIED | Build output includes router with `playback`/`hashchange`/`dataView` references in the production bundle; no changes to `main.js`, `router.js`, or view files | No regressions introduced |

---

## Findings

### [MEDIUM] Global jsxInject applies Preact import to all JS files

**File:** `frontend/vite.config.js`
**Line(s):** 7
**Category:** design

**Problem:**
The `esbuild.jsxInject` setting prepends `import { h, Fragment } from 'preact'` to **every** file esbuild processes, not just `.jsx` files. While esbuild will tree-shake the unused import in production builds, this adds unnecessary overhead during development for vanilla `.js` files that don't use JSX. As the codebase grows, this could produce confusing behavior if a `.js` file accidentally includes angle-bracket syntax.

**Code:**
```javascript
esbuild: {
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  jsxInject: `import { h, Fragment } from 'preact'`,
},
```

**Suggested Fix:**
Consider scoping JSX handling to `.jsx` files only by using the Vite `@preact/preset-vite` plugin (which handles this automatically), or document that `.jsx` extension is required for Preact components so the team understands the boundary. This is not a blocker for T-001 but should be addressed when the dealer interface grows.

**Impact:** Minor dev-time overhead; potential for confusion if JSX syntax leaks into `.js` files.

---

### [LOW] DealerApp does not export a default — inconsistent with common Preact patterns

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 1
**Category:** convention

**Problem:**
The component uses a named export (`export function DealerApp`). This is perfectly valid JavaScript, but many Preact/React ecosystem tools and lazy-loading patterns (`import()`) expect a default export for page-level components. Since T-002 will mount this as the root dealer component, a default export would be more conventional.

**Code:**
```jsx
export function DealerApp() {
```

**Suggested Fix:**
Add `export default DealerApp;` at the bottom, or convert to `export default function DealerApp()`. Alternatively, establish a project convention for named-only exports and document it. This is stylistic and non-blocking.

**Impact:** None currently; could require adjustment in T-002 import patterns.

---

## Positives

- **Minimal, focused change** — only three files touched, all directly related to the task scope
- **Correct Preact factory triple** — `h` / `Fragment` / auto-inject is the canonical esbuild approach for Preact without a dedicated plugin
- **No impact on existing code** — `main.js`, `router.js`, and both views are completely untouched; build produces a working bundle with all existing functionality intact
- **Clean component** — `DealerApp.jsx` is a proper minimal verification component with no unnecessary dependencies or side effects

---

## Overall Assessment

T-001 is **complete and clean**. All four acceptance criteria are satisfied. The Vite esbuild JSX configuration is correct for Preact and the build passes without errors. The two findings are MEDIUM and LOW severity — neither blocks this task or downstream work. The MEDIUM finding about global `jsxInject` scope is worth revisiting when the dealer interface grows or if the team adopts `@preact/preset-vite`.

No CRITICAL or HIGH issues found. Ready for next cycle.
