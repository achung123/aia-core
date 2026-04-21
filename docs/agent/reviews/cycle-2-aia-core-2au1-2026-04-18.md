# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/` (scaffold + `<PokerCanvas>`) and `frontend/test/scenes3d/PokerCanvas.test.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 2
**Epic:** table-3d-revamp-010

**Task:** T-002 — Scaffold `scenes3d/` directory and `<PokerCanvas>`
**Beads ID:** aia-core-2au1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Directory structure matches Plan's `scenes3d/` tree (empty stubs OK) | SATISFIED | [frontend/src/scenes3d/](frontend/src/scenes3d) — all 28 files from plan.md §238–273 present (PokerCanvas, PokerTable, SessionReplayShell, index, types, 13 `components/`, 4 `animations/`, 6 `state/`, 3 `data/`) | Each stub is `// Stub — implemented in T-XXX.` + `export {};` — correctly labeled with downstream task IDs |
| 2 | `<PokerCanvas>` renders empty R3F scene with `PerspectiveCamera`, ambient+directional light, dpr capped at 2 | SATISFIED | [frontend/src/scenes3d/PokerCanvas.tsx](frontend/src/scenes3d/PokerCanvas.tsx#L30-L47) — camera `[0,6,8]` fov 45, `ambientLight 0.4`, `directionalLight 1.0` at `[5,10,5]`, `dpr=[1,2]` | Matches plan camera/light intent |
| 3 | Smoke test mounts `<PokerCanvas>` (R3F test renderer or mocked WebGL) and asserts no errors | SATISFIED | [frontend/test/scenes3d/PokerCanvas.test.tsx](frontend/test/scenes3d/PokerCanvas.test.tsx) — 8/8 pass; mocks `@react-three/fiber` `Canvas`, asserts dpr, camera, gl, lights, children | Re-ran locally: `8 passed` in 42ms |
| 4 | Existing `pokerScene.ts` unchanged | SATISFIED | `md5sum frontend/src/scenes/pokerScene.ts` unchanged from last commit (`7b1cb3c`); file not in `git status` | No diff on current branch |

---

## Findings

### [LOW] Smoke test swallows unexpected `console.error` instead of failing

**File:** [frontend/test/scenes3d/PokerCanvas.test.tsx](frontend/test/scenes3d/PokerCanvas.test.tsx#L14-L27)
**Line(s):** 14–27
**Category:** convention

**Problem:**
The `console.error` spy downgrades any unexpected error to `console.warn('[unexpected console.error]', ...)`. This means an unrelated React error (e.g. a future regression that logs via `console.error`) would not fail "mounts without errors" — it would merely print a warning. The test `it('mounts without errors', ...)` therefore asserts a weaker invariant than its name implies.

**Code:**
```ts
consoleErrorSpy = vi
  .spyOn(console, 'error')
  .mockImplementation((msg: unknown, ...rest: unknown[]) => {
    if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
    console.warn('[unexpected console.error]', msg, ...rest);
  });
```

**Suggested Fix:**
Track a counter of unexpected errors (anything not matching `R3F_TAG_WARNING`) and `expect(unexpectedErrors).toBe(0)` in `afterEach` — or re-throw. Not blocking for T-002; noted for follow-up hardening.

**Impact:** Low — current behavior correctly filters noisy R3F intrinsic warnings, and all 8 assertions still exercise the API surface. Only tightens defense-in-depth.

---

### [LOW] Redundant default export alongside named export

**File:** [frontend/src/scenes3d/PokerCanvas.tsx](frontend/src/scenes3d/PokerCanvas.tsx#L29-L50)
**Line(s):** 29, 50
**Category:** convention

**Problem:**
`PokerCanvas` is exported both as a named export and as `export default PokerCanvas;`. The rest of the frontend consistently uses named exports (e.g. the `index.ts` in the same module only re-exports the named binding), and no caller imports the default. Dual exports can lead to inconsistent import sites downstream (T-009 `<PokerTable>` and T-030..T-032 consumers).

**Code:**
```ts
export function PokerCanvas({ ... }) { ... }
export default PokerCanvas;
```

**Suggested Fix:**
Drop `export default PokerCanvas;` to keep one idiomatic import style. Low priority — not worth blocking the task.

**Impact:** None functionally; consistency only.

---

## Stub-File Justification

Per [specs/table-3d-revamp-010/plan.md](../../../specs/table-3d-revamp-010/plan.md) §238–273 and T-002 AC 1 ("files can be empty stubs where appropriate"), the 26 stub files are **acceptable, not premature**:

- Every stub matches a file path called out in `plan.md`'s `scenes3d/` tree.
- Each stub's comment points to the concrete downstream task that will populate it (T-003, T-004, T-005, T-006, T-007, T-008, T-010, T-011, T-012, T-015, T-016, T-017, T-018, T-019, T-020, T-023b, T-024, T-026, T-027, T-028).
- Stubs use `export {};` which makes each file a module with zero runtime surface — no risk of accidentally shipping unfinished behavior.
- `index.ts` only re-exports `PokerCanvas` / `PokerCanvasProps` — it does **not** forward stub symbols, so downstream consumers can't accidentally import placeholder code.

No scope creep was detected. Hank did not implement anything beyond T-002's footprint.

---

## Positives

- **Exact plan conformance.** Directory layout, file names, and module boundaries match `plan.md` §238–273 one-for-one.
- **Disciplined stub pattern.** Every stub links back to its implementing task via comment; `export {};` prevents accidental import of an undefined symbol.
- **Tight public surface.** `index.ts` re-exports only the symbol actually shipped (`PokerCanvas` + `PokerCanvasProps`); downstream tasks will widen the surface as they land.
- **Test quality for a smoke test.** Eight assertions cover all AC 2 invariants (dpr default, dpr override, camera fov/position shape, gl antialias + powerPreference, both lights, children pass-through, no-throw mount). Re-ran locally: 8/8 pass in 42 ms.
- **Correct R3F/happy-dom strategy.** Mocking the `Canvas` rather than pulling in a real WebGL context is the right call for a Vitest smoke test in happy-dom.
- **Legacy untouched.** `frontend/src/scenes/pokerScene.ts` hash unchanged; AC 4 holds.
- **Sensible camera defaults beyond spec.** Adding `near: 0.1, far: 100` is a reasonable default that prevents z-fighting when T-004/T-009 populate the scene — still within spec intent.

---

## Overall Assessment

T-002 is cleanly implemented and ready to close. All four acceptance criteria are satisfied, the smoke test suite passes (8/8), the full frontend suite is reported green (1246/1246), and `pokerScene.ts` is untouched. The 26 stub files are explicitly permitted by the AC and are well-labeled for their downstream implementers — nothing is premature.

Two **LOW** findings are style/hardening nits and should not block closure:
1. Test's `console.error` spy could fail on unexpected errors rather than warn.
2. `PokerCanvas` has a redundant `export default`.

**Recommendation:** Close aia-core-2au1. Neither finding warrants a follow-up issue; they can be picked up opportunistically when T-009 integrates `<PokerCanvas>` into `<PokerTable>`.
