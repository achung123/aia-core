// Pure geometry helpers for the 3D poker table.
//
// Kept framework-free so they can be unit-tested without R3F / WebGL, and
// reused by any scene3d component (Table, Seat, CameraRig presets, etc).
//
// Mirrors the seat layout produced by the legacy `computeSeatPositions` in
// the legacy imperative `tableGeometry` helper (removed in T-033) — an ellipse with X/Z radii plus a
// fixed outward offset for the seat ring.

/** Table felt ellipse radii (world units). */
export const TABLE_RADIUS_X = 3.5;
export const TABLE_RADIUS_Z = 2.0;

/** Height of the felt disc. */
export const TABLE_THICKNESS = 0.1;

/** Outward offset from the felt edge to the seat ring. */
export const SEAT_RING_OFFSET = 0.8;

/** Rail thickness (outer felt rim) in world units. */
export const TABLE_RAIL_WIDTH = 0.35;

/** Y position of the table felt top surface. */
export const TABLE_TOP_Y = 0;

/**
 * Vertical thickness of the seat pad. `<Seat>` lifts its `seat-anchor`
 * child group by exactly this much so hole cards, nameplates, and chip
 * stacks don't z-fight with the pad. Exported so the deal-animation driver
 * and scene-graph consumers can agree on the anchor's world Y offset.
 */
export const SEAT_PAD_THICKNESS = 0.02;

/** Opacity for an inactive / empty seat pad. */
export const INACTIVE_SEAT_OPACITY = 0.3;
export const ACTIVE_SEAT_OPACITY = 1.0;

/**
 * World-space position of the pot chip cluster. Single source of truth
 * shared by:
 *   - `<PokerTable>` (render-time pot `<ChipStack>`),
 *   - `buildPokerTableChipSlideLayout` in `<ChipSlideDriver>` (tween
 *     target for bet/call/raise animations).
 *
 * Resolves Cycle 19 L-1 — previously duplicated as `POT_CHIP_POSITION`
 * in `PokerTable.tsx` and `POT_CHIP_WORLD_POSITION` in
 * `ChipSlideDriver.tsx`, where a future layout change in one place would
 * silently drift from the other.
 */
export const POT_CHIP_WORLD_POSITION: [number, number, number] = [0, 0, -0.9];

/**
 * Compute the angle (radians) at which the seat with the given index sits on
 * the table. Seats are distributed evenly over `2π`, starting at the +X axis
 * (angle 0) and increasing counter-clockwise in the X/Z plane.
 */
export function computeSeatAngle(seatIndex: number, seatCount: number): number {
  if (seatCount <= 0) {
    throw new Error(`seatCount must be > 0, got ${seatCount}`);
  }
  return ((seatIndex % seatCount) / seatCount) * Math.PI * 2;
}

/**
 * Compute the 3D world position `[x, y, z]` of a seat pad on the table ring.
 *
 * Uses the same ellipse as `computeSeatPositions` in the legacy scene, so the
 * visual layout is preserved exactly when we swap consumers over.
 */
export function computeSeatPosition(
  seatIndex: number,
  seatCount: number,
): [number, number, number] {
  const angle = computeSeatAngle(seatIndex, seatCount);
  const x = Math.cos(angle) * (TABLE_RADIUS_X + SEAT_RING_OFFSET);
  const z = Math.sin(angle) * (TABLE_RADIUS_Z + SEAT_RING_OFFSET);
  return [x, TABLE_TOP_Y, z];
}

/** Opacity that should be applied to a seat pad based on activity. */
export function seatOpacity(isActive: boolean): number {
  return isActive ? ACTIVE_SEAT_OPACITY : INACTIVE_SEAT_OPACITY;
}

/**
 * Compute the Y-axis rotation (radians) that orients a seat group so its
 * local +Z axis points toward the table center (the inward radial direction).
 *
 * Given a seat at polar angle θ, its world position is
 * `(cos θ · Rx', 0, sin θ · Rz')` and the inward radial *direction* is
 * `(−cos θ, 0, −sin θ)`. A Y-rotation by φ maps the local `(0, 0, 1)` axis to
 * `(sin φ, 0, cos φ)`, so matching inward radial requires `φ = −θ − π/2`.
 *
 * All downstream consumers (seats, nameplates, cards, chip stacks, camera
 * presets) should use this helper so the seat-local frame is defined in a
 * single place.
 */
export function computeSeatRotationY(seatIndex: number, seatCount: number): number {
  const angle = computeSeatAngle(seatIndex, seatCount);
  return -angle - Math.PI / 2;
}

/**
 * Per-seat committed-chip stack offset along the seat-local +Z axis
 * (inward toward the pot). Consumed by `<PokerTable>` to position the
 * seat's committed-this-street `<ChipStack>` and by T-011's chip-slide
 * layout so the slide origin matches the render-time stack position.
 */
export const SEAT_COMMIT_CHIP_LOCAL_Z = 0.8;

/**
 * World-space position of a seat's committed-chip stack (the origin for
 * T-011's chip-slide animation). Routes through `seatAnchorLocalToWorld`
 * so render-time and tween-time agree on the seat frame (resolves Cycle
 * 13 LOW L-1 — the previous ad-hoc implementation in `PokerTable.tsx`
 * bypassed the shared helper and would have drifted the first time the
 * seat frame picked up an extra offset).
 */
export function seatCommitChipWorldPosition(
  seatIndex: number,
  seatCount: number,
): [number, number, number] {
  // `seatAnchorLocalToWorld` lifts children by SEAT_PAD_THICKNESS; for the
  // chip stack we want `y = TABLE_TOP_Y` (i.e. chips resting on the felt,
  // not on top of the seat pad), so we pass `ly = -SEAT_PAD_THICKNESS` to
  // cancel the lift.
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    0,
    -SEAT_PAD_THICKNESS,
    SEAT_COMMIT_CHIP_LOCAL_Z,
  ]);
}

/**
 * Transform a position expressed in a seat's *anchor-local* frame — i.e.
 * the frame a descendant of `<Seat>`'s `seat-anchor` group sees, where
 * local `+Z` points toward the table center — into world coordinates.
 *
 * Encodes, in order:
 *   1. The seat-anchor's vertical lift by `SEAT_PAD_THICKNESS` (so children
 *      rest on top of the pad).
 *   2. The seat's Y-rotation by `computeSeatRotationY`.
 *   3. The seat's ring-position translation from `computeSeatPosition`.
 *
 * Any component that renders inside `<Seat>` AND any animation driver that
 * computes world-space tween targets for the same offset MUST go through
 * this helper — otherwise render-time pose and tween target drift apart
 * (see Cycle 13 H-1: hole-card tween landed 2cm below the real resting
 * pose because the pad thickness wasn't encoded in the target math).
 */
export function seatAnchorLocalToWorld(
  seatIndex: number,
  seatCount: number,
  local: readonly [number, number, number],
): [number, number, number] {
  const [sx, sy, sz] = computeSeatPosition(seatIndex, seatCount);
  const phi = computeSeatRotationY(seatIndex, seatCount);
  const [lx, ly, lz] = local;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // Rotation about Y by φ maps (x, y, z) → (cos·x + sin·z, y, −sin·x + cos·z).
  const wx = sx + cos * lx + sin * lz;
  const wy = sy + SEAT_PAD_THICKNESS + ly;
  const wz = sz - sin * lx + cos * lz;
  return [wx, wy, wz];
}
