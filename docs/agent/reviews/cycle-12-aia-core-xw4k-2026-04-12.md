# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 12
**Target:** Bug fix for dual resize listeners (window + ResizeObserver) in TableView3D
**Reviewer:** Scott (automated)

**Task:** aia-core-xw4k — Bug: dual resize listeners (window + ResizeObserver) in TableView3D
**Beads ID:** aia-core-xw4k
**Parent:** aia-core-6vai (3D table toggle in dealer HandDashboard)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

The task description defines the fix contract: *"Add externalResize option to createPokerScene to disable its internal listener when component manages resizing."*

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `externalResize` option added to `PokerSceneOptions` | SATISFIED | `pokerScene.ts` L14 — `externalResize?: boolean` | Default `false` preserves backward compat |
| 2 | Internal window resize listener skipped when `externalResize: true` | SATISFIED | `pokerScene.ts` L137–139 — conditional `window.addEventListener` | Guard also covers initial `onResize()` call (L147) |
| 3 | `dispose()` correctly skips `removeEventListener` when `externalResize: true` | SATISFIED | `pokerScene.ts` L199–201 — symmetric guard in dispose | No orphaned listeners |
| 4 | `TableView3D` passes `externalResize: true` | SATISFIED | `TableView3D.tsx` L80 — `externalResize: true` in options | ResizeObserver handles sizing |
| 5 | Other consumers unaffected (backward compat) | SATISFIED | `TableView.tsx` L149–152 — does not pass `externalResize`, gets default `false` | Window listener still active |
| 6 | Tests cover the new behavior | SATISFIED | `pokerScene.test.ts` — 5 new tests in `externalResize option` describe block; `TableView3D.test.tsx` — 1 new test | See test inventory below |

---

## Findings

### [MEDIUM] TableView.tsx may also benefit from externalResize migration

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 149–152
**Category:** design

**Problem:**
`TableView.tsx` creates a `createPokerScene` with default resize behavior (internal window listener) but does not itself add a ResizeObserver. If the page/container resizes without a window resize event (e.g., sidebar toggle, split-pane), the canvas won't update. This is a pre-existing issue not introduced by this fix, but worth tracking since the `externalResize` pattern now exists.

**Suggested Fix:**
Consider a follow-up task to add ResizeObserver to `TableView.tsx` and pass `externalResize: true`, matching the pattern established in `TableView3D`. Not blocking — the current behavior is unchanged from before.

**Impact:** Minor UX — canvas may not resize in non-window-resize container changes. Pre-existing.

---

### [LOW] Self-heal initial size skip when externalResize is true

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 146–148
**Category:** correctness

**Problem:**
When `externalResize: true`, the "self-heal initial size" `onResize()` call is skipped. This relies on the external consumer (e.g., ResizeObserver) firing on mount to set the correct initial size. In `TableView3D`, the ResizeObserver does fire immediately upon `.observe()`, so this works. However, if a future consumer passes `externalResize: true` without an immediate resize callback, the initial canvas size may be stale (falling back to `canvas.clientWidth` at construction time).

**Code:**
```ts
if (!opts.externalResize) {
    onResize();
}
```

**Suggested Fix:**
This is acceptable as-is — the option name clearly communicates caller responsibility. A JSDoc comment on `externalResize` documenting this contract would be a nice addition but is not required.

**Impact:** Negligible — current consumers handle this correctly.

---

### [LOW] Animation loop starts before initial resize completes

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 141–148
**Category:** design

**Problem:**
The animation loop (`animate()`) starts at L141 before the self-heal `onResize()` at L147. The first frame may render with stale dimensions. This is a pre-existing pattern not introduced by this fix and is largely imperceptible (the next frame picks up the corrected size).

**Suggested Fix:**
No action needed. Mentioning for completeness — the visual impact is a single frame.

**Impact:** Cosmetic only. Pre-existing.

---

## Test Inventory (New Tests)

| # | File | Test Name | Verifies |
|---|---|---|---|
| 1 | `pokerScene.test.ts` | `attaches window resize listener by default` | Default behavior preserved |
| 2 | `pokerScene.test.ts` | `attaches window resize listener when externalResize is false` | Explicit false same as default |
| 3 | `pokerScene.test.ts` | `does NOT attach window resize listener when externalResize is true` | Core fix behavior |
| 4 | `pokerScene.test.ts` | `dispose does not call removeEventListener for resize when externalResize is true` | Dispose symmetry |
| 5 | `pokerScene.test.ts` | `dispose removes window resize listener when externalResize is false` | Dispose cleanup |
| 6 | `TableView3D.test.tsx` | `passes externalResize: true to createPokerScene` | Integration correctness |

---

## Positives

- **Clean, minimal fix** — the change is tightly scoped to a single boolean option with a safe default. No unrelated refactors.
- **Symmetric guards** — the `if (!opts.externalResize)` check appears in both the listener attachment and `dispose()`, preventing leaked listeners.
- **Backward compatible** — default `false` means all existing consumers (TableView.tsx, test mocks) continue working without changes.
- **Thorough test coverage** — 6 new tests cover both the positive and negative cases, including dispose behavior. Tests use `window.addEventListener` spies rather than implementation-detail checks.
- **Good option naming** — `externalResize` clearly conveys intent: "the caller will handle resize externally."

---

## Overall Assessment

This is a clean, well-tested bug fix. The dual-resize issue is resolved by giving `createPokerScene` the ability to defer resize responsibility to its caller. Backward compatibility is preserved via the `false` default. No critical or high-severity issues found. The one MEDIUM finding is a pre-existing design opportunity (not a regression) that could be tracked as a future task.

**Verdict:** PASS — no blocking issues.
