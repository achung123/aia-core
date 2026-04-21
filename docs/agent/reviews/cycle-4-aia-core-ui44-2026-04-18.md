# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/components/{Table.tsx, Seat.tsx, tableLayout.ts}` + `frontend/test/scenes3d/{tableLayout.test.ts, TableSeat.test.tsx}`
**Reviewer:** Scott (automated)
**Cycle:** 4
**Epic:** table-3d-revamp-010

**Task:** T-004 — Build `<Table>` and `<Seat>` components with circular layout
**Beads ID:** aia-core-ui44

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `<Table>` renders a felt disc + rail ring | SATISFIED | [frontend/src/scenes3d/components/Table.tsx](frontend/src/scenes3d/components/Table.tsx#L40-L59); test [frontend/test/scenes3d/TableSeat.test.tsx](frontend/test/scenes3d/TableSeat.test.tsx#L40-L46) | Rail implemented as solid larger cylinder (not a true ring) — see [LOW] Table rail geometry finding. |
| 2 | `<Seat>` accepts `seatIndex`, `seatCount`, `playerName`, `isActive` and positions itself on a circle | SATISFIED | [frontend/src/scenes3d/components/Seat.tsx](frontend/src/scenes3d/components/Seat.tsx#L4-L15) — props; [tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L48-L56) — positioning | Elliptical layout (Rx=3.5, Rz=2.0) matches legacy exactly. |
| 3 | Tests assert 9 seats spaced at 360/9° and `isActive=false` reduces opacity | SATISFIED | [frontend/test/scenes3d/tableLayout.test.ts](frontend/test/scenes3d/tableLayout.test.ts#L15-L23); [frontend/test/scenes3d/TableSeat.test.tsx](frontend/test/scenes3d/TableSeat.test.tsx#L52-L93); opacity: [TableSeat.test.tsx L95-L117](frontend/test/scenes3d/TableSeat.test.tsx#L95-L117) | — |
| 4 | Component output matches (within tolerance) the current seat layout from `pokerScene.ts` | SATISFIED | [frontend/test/scenes3d/tableLayout.test.ts](frontend/test/scenes3d/tableLayout.test.ts#L49-L59) — explicit legacy parity test | Position parity verified. Legacy had no seat-local orientation, so parity AC is not compromised by the rotation bug below — but consumers (T-009) will be. |

---

## Findings

### [HIGH] `<Seat>` local +Z does not face the table center

**File:** `frontend/src/scenes3d/components/Seat.tsx`
**Line(s):** 45
**Category:** correctness

**Problem:**
The file-level comment (L24) and the task's stated invariant say "the seat group is rotated so its local +Z points toward the table center," which gives T-009/T-010 consumers a seat-local frame they can use to place cards, nameplates, and chip stacks "in front of" each seat. The implementation uses `rotation={[0, -angle, 0]}`, which does not satisfy that contract.

For a Y-rotation by φ, three.js maps local `+Z=(0,0,1)` to world `(sin φ, 0, cos φ)`. With φ = −angle:

- Seat 0 (angle=0): position `(4.3, 0, 0)`, local +Z world = `(0, 0, 1)`. Expected (toward origin): `(−1, 0, 0)`. Off by 90°.
- Seat at angle=π/2: position `(0, 0, 2.8)`, local +Z world = `(−1, 0, 0)`. Expected: `(0, 0, −1)`. Off by 90°.

Every seat is 90° off. Children placed at seat-local `[0, y, +z]` (the natural idiom for "in front of the seat") will render to the side of the seat, not toward the table center.

**Code:**
```tsx
// Seat.tsx L38-L47
const position = computeSeatPosition(seatIndex, seatCount);
const angle = computeSeatAngle(seatIndex, seatCount);
...
<group
  name={`seat-${seatIndex}`}
  position={position}
  rotation={[0, -angle, 0]}
  ...
```

**Suggested Fix:**
Rotate an extra −π/2 around Y so that local +Z aligns with the inward radial direction:

```tsx
rotation={[0, -angle - Math.PI / 2, 0]}
```

Verify: φ = −θ − π/2 → local +Z world = `(sin φ, 0, cos φ) = (−cos θ, 0, −sin θ)`, which is the inward radial direction at every seat. Add a helper + test in `tableLayout.ts`:

```ts
export function computeSeatRotationY(seatIndex: number, seatCount: number): number {
  return -computeSeatAngle(seatIndex, seatCount) - Math.PI / 2;
}
```

with a test asserting `[sin(φ), 0, cos(φ)]` ≈ normalized inward direction for each seat.

Note: because seats sit on an ellipse (not a circle), the mathematical "normal to the ellipse" differs slightly from the radial direction except at cardinal points. For seat-facing purposes the radial approximation is correct and consistent with how players visually face the table; the current ellipse deformation is small (≤ ~30° deviation) and acceptable. The 90° offset is the real bug.

**Impact:** T-009 (`<PokerTable>` composition), T-010 (card deal slots), T-016 (`<Nameplate>` billboarding origin), and T-018 (seat pulse ring) all expect to place content in a seat-local frame where +Z points inward. Without this fix, every downstream component will need a compensating `Math.PI / 2` sprinkled into its rotation — or land visually rotated 90° away from the felt. Catching this now avoids thrashing several later tasks.

---

### [MEDIUM] No test pins seat-local orientation

**File:** `frontend/test/scenes3d/TableSeat.test.tsx`, `frontend/test/scenes3d/tableLayout.test.ts`
**Line(s):** whole files
**Category:** correctness / test coverage

**Problem:**
Tests cover seat **positions** exhaustively (legacy parity, angular spacing, ellipse radii) but never assert the seat's **orientation** — neither the numeric `rotation.y` value nor the resulting world-space direction of local +Z. That is exactly the invariant T-009/T-010 will depend on, and the HIGH finding above would have been caught by a single test like:

```ts
it('rotates seat so local +Z faces table center (inward radial)', () => {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const theta = computeSeatAngle(i, n);
    const phi = computeSeatRotationY(i, n); // or derived from the group
    expect(Math.sin(phi)).toBeCloseTo(-Math.cos(theta), 6);
    expect(Math.cos(phi)).toBeCloseTo(-Math.sin(theta), 6);
  }
});
```

The existing "Angular spacing is 40°" block (TableSeat.test.tsx L83–L92) only asserts the *delta* between adjacent rotations, which is `2π/n` regardless of any constant offset — so it happily passes with any incorrect absolute orientation.

**Suggested Fix:**
1. Export `computeSeatRotationY` (or equivalent) from `tableLayout.ts`.
2. Add a unit test asserting `[sin(φ), 0, cos(φ)]` matches the unit inward radial direction for several seats on 6-, 9-, and 10-seat tables.
3. Add a component-level assertion in `TableSeat.test.tsx` reading `group[name="seat-0"]`'s `rotation` attribute and confirming the numeric value matches.

**Impact:** Prevents silent regressions and removes a hidden dependency that T-009 will trip over. This is the test-gap corollary of the HIGH finding — they should land together.

---

### [LOW] `<Table>` rail is a solid cylinder, not a ring

**File:** `frontend/src/scenes3d/components/Table.tsx`
**Line(s):** 41–50
**Category:** design / convention

**Problem:**
AC #1 says "felt disc + **rail ring**." The implementation stacks a larger solid `cylinderGeometry` under the felt and lets the ~0.35 world-unit lip poke out around the perimeter. Visually this reads as a rail, but the geometry is a capped cylinder with the center region entirely hidden by the felt — not a true ring.

```tsx
<mesh name="table-rail" scale={[RX + RAIL, 1, RZ + RAIL]}>
  <cylinderGeometry args={[1, 1, railHeight, 64]} />
  ...
</mesh>
<mesh name="table-felt" scale={[RX, 1, RZ]}>
  <cylinderGeometry args={[1, 1, TABLE_THICKNESS, 64]} />
  ...
</mesh>
```

**Suggested Fix:**
Either (a) accept the current approach and update the file comment to note the simplification until T-014 replaces this with a real extruded rail + PBR materials, or (b) swap the rail to `ringGeometry` / `torusGeometry` / `extrudeGeometry` with a hole for the felt. Option (a) is fine for this task — just remove the mismatch between the AC wording and the implementation comment so T-014 planning stays honest.

**Impact:** None visually. Only matters for the paper trail before T-014 lands PBR.

---

### [LOW] Seat pad sets `transparent={true}` unconditionally

**File:** `frontend/src/scenes3d/components/Seat.tsx`
**Line(s):** 58–66
**Category:** design

**Problem:**
The seat-pad `meshStandardMaterial` is always transparent. Three.js routes transparent materials through the alpha-sorted pass, which causes z-fighting / render-order artifacts against opaque meshes when `opacity === 1.0`. The current `depthWrite={opacity >= 1}` mitigates part of the issue, but the pad still takes the transparent-sorting path.

**Suggested Fix:**
```tsx
const isTransparent = opacity < 1;
<meshStandardMaterial
  color="#2a2a2a"
  transparent={isTransparent}
  opacity={opacity}
  depthWrite={!isTransparent}
  roughness={0.9}
  metalness={0}
/>
```

**Impact:** Minor visual artifacts (sorting flicker) when all seats are active. Not a functional regression.

---

### [LOW] `computeSeatAngle` does not guard negative `seatIndex`

**File:** `frontend/src/scenes3d/components/tableLayout.ts`
**Line(s):** 35–40
**Category:** correctness

**Problem:**
JavaScript's `%` operator returns a negative result for negative operands, so `computeSeatAngle(-1, 9)` returns `(-1/9) * 2π ≈ -0.698` rather than the expected `(8/9) * 2π`. The function guards `seatCount <= 0` but not a negative `seatIndex`. Unlikely to occur in practice (seat indices come from backend `seat_number` fields validated ≥ 0), but it's a cheap fix.

**Suggested Fix:**
```ts
const normalized = ((seatIndex % seatCount) + seatCount) % seatCount;
return (normalized / seatCount) * Math.PI * 2;
```

**Impact:** Robustness for future consumers. No test impact today.

---

## Positives

- **Clean layout-helper separation.** `tableLayout.ts` is framework-free and fully unit-tested without R3F — a strong foundation for T-008 (camera presets), T-019 (dealer button anchoring), and T-030 migration.
- **Exported constants** (`TABLE_RADIUS_X`, `SEAT_RING_OFFSET`, `ACTIVE_SEAT_OPACITY`, …) give downstream components a single source of truth. Nice call extracting them up front.
- **Legacy parity test is explicit**, not hand-waved — [tableLayout.test.ts L49-L59](frontend/test/scenes3d/tableLayout.test.ts#L49-L59) independently re-derives the legacy formula and asserts byte-level equivalence.
- **`<Seat>` exposes `children` through a dedicated `seat-anchor` group** offset by `SEAT_PAD_THICKNESS`, which is exactly the hook T-006/T-007/T-016 will need to mount hole cards, chip stacks, and nameplates without fighting the pad geometry.
- **`userData` populated on the seat group** (`seatIndex`, `seatCount`, `playerName`, `isActive`, `occupied`) sets up the T-009 parity test well — Hank's note that the happy-dom environment can't assert this is fine; the deferral to T-009 is the correct call.
- **Careful console.error suppression** in `TableSeat.test.tsx` filters only R3F intrinsic-tag warnings and forwards anything else as `console.warn`, so real errors still surface.

---

## Overall Assessment

Solid structural work — geometry helpers, constants, and the `<Table>` / `<Seat>` split are all cleanly separated, well-tested for positional parity, and give downstream tasks the hooks they need. The one substantive issue is a **90° seat-local orientation bug** (HIGH): the code comment and intended contract say "+Z faces center," but the rotation math is short by `π/2`. Because no test asserts the orientation invariant (MEDIUM), the bug slipped through a 1290/1290 green run. Both findings should be fixed in the same follow-up — the test makes the fix self-verifying and locks in the contract for T-009, T-010, T-016, and T-018 consumers.

The three LOW findings (rail geometry simplification, unconditional `transparent`, negative-modulo edge case) are paper-trail and robustness items. They do not block task closure.

**Recommendation:** Open a follow-up (or reopen this cycle) to land the `computeSeatRotationY` helper + rotation fix + orientation test before T-009 begins composing seats into `<PokerTable>`. The LOW items can be batched into T-014 or a small polish pass.

Cycle 4 status: **Not approved** — HIGH finding must be addressed before T-004 is closed and dependents start.
