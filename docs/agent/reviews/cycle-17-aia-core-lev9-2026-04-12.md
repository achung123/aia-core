# Code Review Report — aia-core-001

**Date:** 2026-04-12
**Cycle:** 17
**Target:** T-017 — Convert LandingPage to TSX
**Beads ID:** aia-core-lev9
**Reviewer:** Scott (automated)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | LandingPage.tsx exists and compiles with strict TypeScript | SATISFIED | `frontend/src/views/LandingPage.tsx` — `npx tsc --noEmit` reports zero errors for this file | tsconfig strict: true confirmed |
| 2 | All handlers, state, and event listeners properly typed | SATISFIED | `LandingPage.tsx` L1 — imports `CSSProperties`, `MouseEvent` from React; L9 handler typed as `MouseEvent<HTMLAnchorElement>`; styles typed as `Record<string, CSSProperties>` | Clean, explicit types throughout |
| 3 | Raw DOM manipulation replaced with React patterns (refs/state) | SATISFIED | Old JSX used `sessionStorage.getItem` + `useEffect` with storage/visibility listeners; new TSX uses `useDealerStore` Zustand selector for `gameId` and `currentStep` — no raw DOM | Zustand integration replaces all sessionStorage reads |
| 4 | Test file converted to .test.tsx and all tests pass | SATISFIED | `frontend/src/views/LandingPage.test.tsx` — 11 tests, all passing; mock of `dealerStore` is well-structured | Old `.test.jsx` removed |
| 5 | No regressions | PARTIAL | App.test.tsx (5 tests) all pass; LandingPage.test.tsx (11 tests) all pass | **But** old `.jsx` file not deleted — see CRITICAL finding |

---

## Findings

### [CRITICAL] Old LandingPage.jsx not deleted — shadows TSX at Vite runtime

**File:** `frontend/src/views/LandingPage.jsx`
**Line(s):** entire file (118 lines)
**Category:** correctness

**Problem:**
The old `LandingPage.jsx` (Preact-based, sessionStorage-reading) was not deleted. Vite's default `resolve.extensions` order is `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']` — meaning `.jsx` resolves **before** `.tsx`. When `App.tsx` imports `'./views/LandingPage'` (no extension), Vite will load the old `.jsx` file at dev/build time, not the new `.tsx`.

TypeScript (tsc) resolves `.tsx` before `.jsx`, so compilation appears clean. The test file imports `'./LandingPage.tsx'` with an explicit extension, so tests pass against the new code. But the running application would use the old Preact-based component, which imports `{ h } from 'preact'` — likely causing a runtime crash or rendering the wrong version.

**Suggested Fix:**
Delete `frontend/src/views/LandingPage.jsx`. This is the only required action.

**Impact:** The production build ships the old Preact component instead of the new React/Zustand component. This defeats the entire purpose of the conversion.

---

### [MEDIUM] Test mock manually reimplements Zustand store API

**File:** `frontend/src/views/LandingPage.test.tsx`
**Line(s):** 6-23
**Category:** design

**Problem:**
The test creates a manual mock of `useDealerStore` that reimplements `getState`, `setState`, `subscribe`, and a custom `__reset` helper. This works but is fragile — if the Zustand API changes or if the store shape grows, this mock must be manually kept in sync. The component only uses a single selector pattern `useDealerStore((s) => s.gameId)`, so the mock is adequate for now, but it's worth noting.

**Suggested Fix:**
Consider using `zustand/testing` utilities or a shared test helper if more components adopt the same store mock pattern. Not blocking for this task.

**Impact:** Low risk of drift; maintenance cost if many test files copy this pattern.

---

### [LOW] `pointerEvents: 'auto' as const` in disabled card style

**File:** `frontend/src/views/LandingPage.tsx`
**Line(s):** 94
**Category:** convention

**Problem:**
The `as const` assertion on `pointerEvents: 'auto'` is unnecessary — `'auto'` is already a valid `CSSProperties['pointerEvents']` literal. The assertion doesn't cause harm but adds noise.

**Suggested Fix:**
Remove `as const`: `pointerEvents: 'auto'`.

**Impact:** Cosmetic only.

---

## Positives

- **Clean Zustand integration** — The conversion from sessionStorage reads + event listeners to a single Zustand selector is well-executed. The component is now purely reactive with no side-effect-based state sync.
- **Comprehensive test coverage** — 11 tests cover all navigation cards, the disabled/enabled playback lock, click prevention, and the re-enable flow. Good edge case coverage.
- **Proper TypeScript typing** — `CSSProperties`, `MouseEvent<HTMLAnchorElement>`, and `Record<string, CSSProperties>` are used correctly. No `any` types.
- **App.tsx integration is clean** — Import and route are straightforward with no unnecessary changes.

---

## Overall Assessment

The LandingPage TSX conversion is well-implemented with proper typing, Zustand integration, and thorough tests. However, **the old `.jsx` file was not deleted**, which is a critical issue: Vite's module resolution would load the old Preact component instead of the new React one at runtime. This must be fixed before the task can be considered complete.

**Verdict:** 1 CRITICAL finding — do not commit until resolved.
