# Code Review Report — cycle-5-aia-core-fl4s

**Date:** 2026-04-18
**Reviewer:** Scott (Cyclops)
**Cycle:** 5
**Target:** aia-core-fl4s — Bug: `<Seat>` local +Z does not face table center
**Parent Epic:** aia-core-6o9t (table-3d-revamp-010)
**Source Task:** aia-core-ui44 (T-004) — discovered-from Cycle 4 review

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 2 |

**Verdict:** No blocking issues. Fix is mathematically correct, well-tested, and routes through a single source of truth (`computeSeatRotationY`). Two LOW items recorded for documentation/test-independence polish; neither blocks downstream work on T-009/T-010/T-016/T-018.

---

## Acceptance Criteria Mapping

AC list extracted from the beads description (`bd show aia-core-fl4s`):

| # | Acceptance Criterion | Status | Evidence |
|---|---|---|---|
| AC1 | Update rotation in `Seat.tsx` to use `-angle - π/2` (no longer `-angle`) | ✅ MET | [frontend/src/scenes3d/components/Seat.tsx](frontend/src/scenes3d/components/Seat.tsx#L42) routes through `computeSeatRotationY`, which returns `−angle − π/2`. |
| AC2 | Export `computeSeatRotationY` from `tableLayout.ts` as a reusable helper | ✅ MET | [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L78-L81) defines and exports the named helper with a closed-form derivation in the docstring. |
| AC3 | Add orientation test asserting inward radial for n ∈ {2, 6, 9, 10} | ✅ MET | [frontend/test/scenes3d/tableLayout.test.ts](frontend/test/scenes3d/tableLayout.test.ts#L86-L108) uses `it.each([2, 6, 9, 10])` to rotate local +Z by φ and compare against `(−cos θ, 0, −sin θ)` at 1e-10 tolerance. |
| AC4 | Full frontend test suite passes | ✅ MET | User-reported 1295/1295 pass, scenes3d lint clean. |

---

## Focus-Area Analysis

### (a) Correctness of `−θ − π/2`

**Verified independently.**

Y-axis rotation by φ is
$$
R_y(\varphi) \begin{pmatrix}0\\0\\1\end{pmatrix} = \begin{pmatrix}\sin\varphi\\0\\\cos\varphi\end{pmatrix}.
$$
Substituting φ = −θ − π/2:
$$
\sin(-\theta - \tfrac{\pi}{2}) = -\cos\theta, \quad \cos(-\theta - \tfrac{\pi}{2}) = -\sin\theta,
$$
which equals the intended (circular) inward radial `(−cos θ, 0, −sin θ)`. ✓

Note: The seat ring is an **ellipse** (Rx' = 4.3, Rz' = 2.8), so the direction from a seat to the geometric table center is `−(Rx' cos θ, 0, Rz' sin θ) / ‖·‖`, which differs from `(−cos θ, 0, −sin θ)` off the cardinal axes. The helper orients seats along the *circular* inward radial (angular-parameter direction), matching legacy behavior. This is an intentional convention, not a bug — but the docstring phrasing "points toward the table center" overstates it off-axis. See LOW-001.

### (b) Does the new test genuinely pin absolute orientation?

**Yes — via the parametrized test in `tableLayout.test.ts`.**

The test rotates local `(0,0,1)` by `computeSeatRotationY(i, n)` using `(sin φ, 0, cos φ)` and compares against an independently computed `(−cos θ, 0, −sin θ)`. This is a true absolute pin (not tautological) and would have failed under the prior `-angle` formula. For example, at seat 0 with n=9:
- Old: φ = 0 → local +Z = `(0, 0, 1)` vs target `(−1, 0, 0)` → fails.
- New: φ = −π/2 → local +Z = `(−1, 0, 0)` = target. ✓

The closed-form check `computeSeatRotationY ≈ -θ - π/2` at line 111-117 is also independent.

**Caveat (LOW-002):** The additional seat-0 orientation pin in [frontend/test/scenes3d/TableSeat.test.tsx](frontend/test/scenes3d/TableSeat.test.tsx#L102-L104) asserts `rotations[0][1] ≈ computeSeatRotationY(0, n)`, which is **tautological against the helper** — if `computeSeatRotationY` silently reverted, this line would still pass. It does catch the specific `[0, -angle, 0]` regression mentioned in the test comment (because for n=9, seat 0 would give 0 vs −π/2), but it is not a true absolute pin. Minor; tableLayout.test.ts already covers the invariant.

### (c) Regression risk to T-004's other behavior

**None observed.**

- `Seat.tsx` only changes the `rotation` prop value; position, opacity, userData, seat-pad geometry, and child anchor are untouched.
- The remaining T-004 tests in `TableSeat.test.tsx` (count, positions, dimming, userData, child rendering) continue to pass (1295/1295 reported).
- `computeSeatAngle`, `computeSeatPosition`, and `seatOpacity` signatures unchanged.
- No API-level changes to `<Seat>` — downstream consumers that read `userData` or wrap children are unaffected.

### (d) Is `computeSeatRotationY` a proper single source of truth?

**Yes.**

- Defined once in `tableLayout.ts` with an explicit closed-form derivation.
- Exported as a named export and consumed by `Seat.tsx`.
- Docstring explicitly directs downstream consumers (nameplates, cards, chip stacks, camera presets) to use the helper rather than duplicating the expression.
- No alternative inline `-angle` / `-angle - π/2` expressions remain in `scenes3d/` (`grep`-equivalent confirmation from reading Seat.tsx + tableLayout.ts; no other callers exist yet because T-009/T-010/T-016/T-018 are pending).

When T-009/T-010/T-016/T-018 land, reviewers should confirm they call `computeSeatRotationY` rather than reintroducing the literal.

---

## Findings

### LOW-001 — Docstring overstates "points toward table center" on the elliptical ring

**File:** [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L64-L77)

The docstring says the rotation "orients a seat group so its local +Z axis points toward the table center (the inward radial direction)." On the ellipse (Rx' = 4.3, Rz' = 2.8) the geometric direction from the seat to the origin is `−(Rx' cos θ, 0, Rz' sin θ) / ‖·‖`, not `(−cos θ, 0, −sin θ)`. The two agree only at the four cardinal angles; at θ = π/4 they differ by ~10°.

This matches the legacy `pokerScene` convention and is the correct choice for uniform angular spacing of seat-local frames, but the docstring language could mislead future readers.

**Suggested fix:** Reword to something like:

> "…so its local +Z axis points along the **circular inward radial** (i.e., `(−cos θ, 0, −sin θ)`). Note that on the elliptical seat ring this approximates — but is not exactly — the direction to the geometric table center; the approximation is intentional and mirrors the legacy `pokerScene` convention so all seat-local frames share a uniform angular step."

No code change needed. Pure documentation.

---

### LOW-002 — TableSeat.test seat-0 orientation pin is tautological against the helper

**File:** [frontend/test/scenes3d/TableSeat.test.tsx](frontend/test/scenes3d/TableSeat.test.tsx#L100-L104)

```tsx
expect(rotations[0][1]).toBeCloseTo(computeSeatRotationY(0, n), 5);
```

This asserts the component's rendered rotation matches what the helper returns — which is the correct wiring check — but if `computeSeatRotationY` silently regressed to `-angle`, this assertion would still pass. The genuine absolute invariant is covered by `tableLayout.test.ts`'s rotated-+Z vs inward-radial check, so this is not a coverage gap.

**Suggested fix (optional):** Add a hard-coded-value assertion alongside the helper-based one, so the component-level test catches a helper regression too:

```tsx
// For n = 9, seat 0 is at θ = 0, so φ must be -π/2.
expect(rotations[0][1]).toBeCloseTo(-Math.PI / 2, 5);
```

Keep the existing `computeSeatRotationY(0, n)` line as the "wired through the helper" check.

---

## Checks Performed

- ✅ Read `tableLayout.ts`, `Seat.tsx`, `tableLayout.test.ts`, `TableSeat.test.tsx` in full.
- ✅ Independently re-derived φ = −θ − π/2 from the Y-rotation of `(0,0,1)`.
- ✅ Verified parametrized test (n ∈ {2, 6, 9, 10}) asserts the invariant at 1e-10 tolerance using an independent vector computation.
- ✅ Confirmed test would have failed under the prior `-angle` formulation at seat 0 for n=9.
- ✅ Confirmed no other scenes3d call sites duplicate the rotation expression.
- ✅ Verified `Seat.tsx` changes are scoped to the rotation prop — no collateral behavior changes.
- ✅ AC1–AC4 all mapped to concrete evidence.
- ✅ Security review: N/A — pure math/geometry, no I/O, no user input, no external state.
- ✅ Convention check: file structure, imports, and test patterns match existing scenes3d conventions.

---

## Recommendation

**APPROVE.** The fix is correct, well-contained, and properly routed through a single exported helper. The two LOW findings are documentation/test-polish items and do not block closing aia-core-fl4s or unblocking downstream T-009/T-010/T-016/T-018. Hank may optionally address LOW-001/LOW-002 in this cycle or fold into a follow-up.
