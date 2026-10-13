# Code Review Report — frontend-react-ts-006

**Date:** 2026-04-12
**Cycle:** 27
**Target:** T-028 — Final cleanup: remove JS/JSX, verify zero Preact refs
**Reviewer:** Scott (automated)

**Task:** T-028 — Final cleanup: remove JS/JSX, verify zero Preact refs
**Beads ID:** aia-core-rz58
**Epic:** aia-core-dthg (Frontend Migration: JavaScript + Preact to TypeScript + React)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `find frontend/src -name '*.js' -o -name '*.jsx'` returns zero results | SATISFIED | `find` returned empty output | Zero .js/.jsx files in `frontend/src/` |
| 2 | `grep -r 'preact' frontend/src/` returns zero matches | SATISFIED | Only hits are negative assertions in `vite-config.test.ts:17,20` (`expect(content).not.toContain("preact")`) | Test verifies preact is absent — not a preact import |
| 3 | `package.json` has no `preact` dependency | SATISFIED | `grep -n 'preact' frontend/package.json` returned zero matches | Clean |
| 4 | `npm run build` succeeds | SATISFIED | Vite build completed: 33 modules, `dist/assets/index-BPlDwPIM.js` (257.60 kB) | Production build clean |
| 5 | `npm run test` passes all tests | SATISFIED | 605 passed (46 files) in 15.43s; backend: 967 passed in 46.05s | All green |
| 6 | Branch is ready for PR review and merge | SATISFIED | All ACs 1–5 pass, no critical/high findings | One medium finding (stale mock paths) is non-blocking |

---

## Findings

### [MEDIUM] Stale `.js`/`.jsx` extensions in `vi.mock()` paths

**Files:**
- `frontend/src/dealer/GameSelectorIntegration.test.tsx` — lines 6, 44, 49
- `frontend/src/dealer/DealerApp.test.tsx` — lines 89, 94
- `frontend/src/dealer/HandDashboard.test.tsx` — line 12

**Category:** convention

**Problem:**
Six `vi.mock()` calls reference modules with `.js` or `.jsx` extensions, but the actual source files have been migrated to `.ts`/`.tsx`. The mocks still resolve correctly due to Vite's extension resolution, so tests pass — but the paths are misleading and inconsistent with the migration's goal of zero JS/JSX references.

Stale mock paths:
| Mock path | Actual file |
|---|---|
| `../api/client.js` | `api/client.ts` |
| `../mobile/StreetScrubber.jsx` | `mobile/StreetScrubber.tsx` |
| `../poker/evaluator.js` | `poker/evaluator.ts` |
| `./QRCodeDisplay.jsx` | `dealer/QRCodeDisplay.tsx` |

Note: `three/examples/jsm/controls/OrbitControls.js` in `pokerScene.test.ts:22` is a legitimate npm package path — not a stale reference.

**Code:**
```typescript
// GameSelectorIntegration.test.tsx:6
vi.mock('../api/client.js', () => ({  // should be '../api/client.ts'

// GameSelectorIntegration.test.tsx:44
vi.mock('../mobile/StreetScrubber.jsx', () => ({  // should be .tsx

// GameSelectorIntegration.test.tsx:49
vi.mock('../poker/evaluator.js', () => ({  // should be .ts

// DealerApp.test.tsx:89
vi.mock('../mobile/StreetScrubber.jsx', () => ({  // should be .tsx

// DealerApp.test.tsx:94
vi.mock('../poker/evaluator.js', () => ({  // should be .ts

// HandDashboard.test.tsx:12
vi.mock('./QRCodeDisplay.jsx', () => ({  // should be .tsx
```

**Suggested Fix:**
Update each `vi.mock()` path to use the correct `.ts`/`.tsx` extension. For example:
```typescript
vi.mock('../api/client.ts', () => ({
vi.mock('../mobile/StreetScrubber.tsx', () => ({
vi.mock('../poker/evaluator.ts', () => ({
vi.mock('./QRCodeDisplay.tsx', () => ({
```

**Impact:** No functional impact (tests pass as-is), but stale extensions undermine the migration's completeness claim and could confuse future maintainers.

---

## Positives

- **Clean deletion**: All 10 dead `.js` files and `counter.js` removed with zero orphaned imports or broken references
- **Zero preact footprint**: No preact packages in `node_modules`, no dependencies in `package.json`, no imports in source
- **Regression-safe**: 605 frontend tests + 967 backend tests all pass — no regressions from deletion
- **Build verified**: Production build completes with 33 modules, confirming no missing module errors
- **Good guardrail test**: `vite-config.test.ts` includes a negative assertion ensuring preact stays out of the config

---

## Overall Assessment

T-028 is **substantially complete**. All six acceptance criteria are satisfied. The single MEDIUM finding (stale `.js`/`.jsx` extensions in 6 `vi.mock()` calls across 3 test files) is a cosmetic inconsistency — tests pass and no `.js`/`.jsx` source files remain. This is non-blocking for PR merge but should be cleaned up in a follow-up pass for full consistency.

**Verdict:** PASS — ready for merge with optional mock-path cleanup.
