# Code Review Report — aia-core / table-3d-revamp-010

**Date:** 2026-04-18
**Cycle:** 11
**Epic:** aia-core-6o9t (table-3d-revamp-010)
**Target:** `frontend/src/scenes3d/PokerTable.tsx` (onReady sentinel), `frontend/test/scenes3d/PokerTable.test.tsx` (StrictMode regression)
**Reviewer:** Scott (automated, loop-review)

**Task:** aia-core-jbyh — Bug — PokerTable onReady fires twice under StrictMode
**Beads ID:** aia-core-jbyh
**Parent epic:** aia-core-6o9t

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 3 |
| **Total Findings** | **3** |

No critical, high, or medium issues. The fix is textbook-correct; findings are forward-looking polish only.

---

## Acceptance Criteria Verification

The beads task has no explicit AC block; the implicit acceptance criteria are derived from the task description + the Cycle 10 review finding that motivated the bug.

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `onReady` fires exactly once under React `<StrictMode>` (dev double-invoke) | SATISFIED | [PokerTable.test.tsx#L355-L366](frontend/test/scenes3d/PokerTable.test.tsx#L355-L366) asserts `toHaveBeenCalledTimes(1)` when wrapped in `<StrictMode>`. Hank verified by reverting the production change and watching the test fail with "got 2 times". | — |
| 2 | Fix uses `useRef<boolean>(false)` sentinel in the mount effect | SATISFIED | [PokerTable.tsx#L146-L151](frontend/src/scenes3d/PokerTable.tsx#L146-L151) — `readyFiredRef` guard matches the prescription in the Cycle 10 report. | — |
| 3 | Existing "fires onReady exactly once on mount" coverage preserved | SATISFIED | [PokerTable.test.tsx#L345-L353](frontend/test/scenes3d/PokerTable.test.tsx#L345-L353) still passes, plus the re-render case. | — |
| 4 | Full frontend suite green, scoped lint clean | SATISFIED | 1404/1404 tests pass (per Hank), scoped `eslint` on the two files is clean (verified via prior session). | — |

---

## Findings

### [LOW] No reusable abstraction for one-shot mount callbacks

**File:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L143-L152)
**Line(s):** 143-152
**Category:** design

**Problem:**
The `readyFiredRef` + empty-deps `useEffect` + `eslint-disable-next-line react-hooks/exhaustive-deps` trio is the correct idiom for a lifetime-scoped one-shot callback, but it is inlined. If a second one-shot prop is ever added to `<PokerTable>` (e.g. `onFirstFrame`, `onSceneInit`, `onAssetsLoaded`) the pattern will be copy-pasted — and each copy is an independent chance to forget the sentinel or the disable comment. That is precisely how the current bug slipped in originally.

**Code:**
```tsx
const readyFiredRef = useRef(false);
useEffect(() => {
  if (readyFiredRef.current) return;
  readyFiredRef.current = true;
  onReady?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
}, []);
```

**Suggested Fix:**
Keep the inline version for now (YAGNI — one call site). When the second one-shot callback lands, extract a tiny helper at `frontend/src/scenes3d/hooks/useOneShotEffect.ts`:

```ts
export function useOneShotEffect(fn: () => void): void {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot
  }, []);
}
```

**Impact:** Preventive. No behavior change today; removes a foot-gun the next time someone adds a mount-only callback.

---

### [LOW] `onReady` identity-stability semantics are undocumented

**File:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L62)
**Line(s):** 62 (prop docstring gap), 146-151 (effect)
**Category:** convention

**Problem:**
Because the effect has `[]` deps and the sentinel latches on first invocation, the `onReady` closure captured during the very first render is the one that runs — any updated `onReady` function passed on a later render is silently ignored. This is the correct behavior for "fires once per instance," but it is not documented on the prop. A caller who memoizes `onReady` with fresh captures (e.g. a closure over the latest `state`) will be surprised when the callback they actually see called is the stale first one.

**Code:**
```tsx
onReady?: () => void;
```

**Suggested Fix:**
Expand the JSDoc on `PokerTableProps.onReady`:

```tsx
/**
 * Fires exactly once per component instance, after the first mount effect.
 * The first-render identity is captured — updates to this prop on subsequent
 * renders are ignored. Do not close over mutable state inside `onReady`; use
 * refs or pass a stable signal handler instead.
 */
onReady?: () => void;
```

**Impact:** Prevents a confusing class of bugs where a caller expects the latest `onReady` to win.

---

### [LOW] StrictMode regression coverage is local to `<PokerTable>`

**File:** [frontend/test/scenes3d/PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx#L355-L366)
**Line(s):** suite-wide (recommendation)
**Category:** design (test strategy)

**Problem:**
The new `<StrictMode>`-wrapped test catches the exact reported bug, but only for `<PokerTable>`. The underlying hazard — mount-only `useEffect` with non-idempotent side effects — applies to any component in `frontend/src/scenes3d/`. Today only `<PokerTable>` has such an effect, but `<CameraRig>`, `<ChipInstances>`, `<Seat>`, etc., may grow them (e.g. telemetry events, asset-prefetch, one-time listener registration) as T-020/T-021/T-022 land. Leaving the StrictMode assertion scoped to one file will not catch the next occurrence.

**Code:**
_n/a — test-strategy observation_

**Suggested Fix:**
Two options, in priority order (pick one when the next StrictMode-sensitive component lands, not proactively now):

1. **Shared render helper** at `frontend/test/scenes3d/_helpers/renderInStrictMode.tsx` that wraps `@testing-library/react`'s `render` in `<StrictMode>`, plus a convention in `CONTRIBUTING`-style docs that "any scene3d component with a mount-only `useEffect` must have at least one test using `renderInStrictMode`."
2. **App-wide flip** — change the default in scenes3d tests to always render under `<StrictMode>` (matches production intent under React 18+). Higher signal, but risks flushing out latent double-invoke bugs in unrelated components; budget a cycle for the cleanup.

Either should be filed as a new beads follow-up (`discovered-from: aia-core-jbyh`) rather than folded into this bug fix.

**Impact:** Raises the floor on StrictMode safety for the remainder of the table-3d-revamp-010 epic.

---

## Positives

- **Correctness of the sentinel is solid.** `useRef` is tied to the React fiber, not the component body — it survives StrictMode's intentional mount→cleanup→mount sequence (same fiber) and is correctly re-initialized on a true remount (new fiber, e.g. parent mounts `<PokerTable>` behind a different `key` or conditional). Both the "fires once in dev StrictMode" and "fires once per mounted instance" semantics hold without extra code.
- **Regression test is targeted and fast to interpret.** The test name explicitly calls out StrictMode and the dev double-mount, so a future break produces an instantly-diagnosable failure.
- **Failure-first verification.** Hank reverted the production change and confirmed the new test fails with `expected vi.fn() to be called 1 times, but got 2 times` — this is the correct TDD discipline for a bug-fix task and is worth noting.
- **Scope discipline.** The fix touches exactly the two files required (production + test). No drive-by refactors, no churn on the rest of `<PokerTable>`.
- **Traceability.** The inline comment at [PokerTable.tsx#L143-L145](frontend/src/scenes3d/PokerTable.tsx#L143-L145) explains *why* the sentinel exists ("React 18 StrictMode's intentional mount → cleanup → mount double-invoke"), which will save a future reader from assuming the guard is dead code and removing it.

---

## Overall Assessment

Clean bug fix, ship it. The `useRef` sentinel is the idiomatic React 18+ solution and is correct for both StrictMode dev double-invoke and true remount scenarios. The regression test is scoped, named clearly, and was verified to fail before the fix. Zero CRITICAL / HIGH / MEDIUM findings — the three LOW items are all forward-looking polish that should be filed as follow-ups (or deferred until triggered) rather than blocking this cycle:

1. Extract `useOneShotEffect` **when a second one-shot callback appears** (not now).
2. Document `onReady` identity-capture semantics on the prop JSDoc (tiny edit, can fold into the next `<PokerTable>` touch).
3. Decide the project-wide StrictMode test strategy before the next scenes3d component grows a mount-only effect — file as a new beads issue with `discovered-from: aia-core-jbyh`.

Cycle 11 is green for Anna to close.
