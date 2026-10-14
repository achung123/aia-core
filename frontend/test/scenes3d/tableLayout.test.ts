import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeSeatAngle,
  computeSeatPosition,
  computeSeatRotationY,
  seatAnchorLocalToWorld,
  seatCommitChipWorldPosition,
  SEAT_COMMIT_CHIP_LOCAL_Z,
  seatOpacity,
  SEAT_PAD_THICKNESS,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  SEAT_RING_OFFSET,
  INACTIVE_SEAT_OPACITY,
  ACTIVE_SEAT_OPACITY,
} from '../../src/scenes3d/components/tableLayout';

describe('tableLayout.computeSeatAngle', () => {
  it('evenly distributes 9 seats across 2π with 40° spacing', () => {
    const n = 9;
    const angles = Array.from({ length: n }, (_, i) => computeSeatAngle(i, n));
    for (let i = 1; i < n; i++) {
      const delta = angles[i] - angles[i - 1];
      expect(delta).toBeCloseTo((2 * Math.PI) / n, 10);
      // 360 / 9 = 40 degrees
      expect((delta * 180) / Math.PI).toBeCloseTo(40, 10);
    }
  });

  it('wraps seatIndex modulo seatCount', () => {
    expect(computeSeatAngle(9, 9)).toBeCloseTo(computeSeatAngle(0, 9), 10);
    expect(computeSeatAngle(10, 9)).toBeCloseTo(computeSeatAngle(1, 9), 10);
  });

  it('throws on non-positive seatCount', () => {
    expect(() => computeSeatAngle(0, 0)).toThrow();
    expect(() => computeSeatAngle(0, -3)).toThrow();
  });
});

describe('tableLayout.computeSeatPosition', () => {
  it('places seats on the ellipse at radius (Rx + offset, Rz + offset)', () => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = computeSeatPosition(i, n);
      const angle = computeSeatAngle(i, n);
      expect(x).toBeCloseTo(Math.cos(angle) * (TABLE_RADIUS_X + SEAT_RING_OFFSET), 10);
      expect(z).toBeCloseTo(Math.sin(angle) * (TABLE_RADIUS_Z + SEAT_RING_OFFSET), 10);
      expect(y).toBe(0);
    }
  });

  it('matches the canonical <PokerTable> seat layout for a 10-seat table', () => {
    // Canonical seat-positioning math shared by <PokerTable> layout and animation drivers
    const n = 10;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const [x, , z] = computeSeatPosition(i, n);
      expect(x).toBeCloseTo(Math.cos(angle) * (TABLE_RADIUS_X + 0.8), 10);
      expect(z).toBeCloseTo(Math.sin(angle) * (TABLE_RADIUS_Z + 0.8), 10);
    }
  });

  it('seat 0 sits on the +X axis (z ≈ 0)', () => {
    const [x, , z] = computeSeatPosition(0, 9);
    expect(x).toBeGreaterThan(0);
    expect(z).toBeCloseTo(0, 10);
  });
});

describe('tableLayout.seatOpacity', () => {
  it('returns the active opacity when isActive is true', () => {
    expect(seatOpacity(true)).toBe(ACTIVE_SEAT_OPACITY);
  });

  it('returns a reduced opacity when isActive is false', () => {
    expect(seatOpacity(false)).toBe(INACTIVE_SEAT_OPACITY);
    expect(seatOpacity(false)).toBeLessThan(seatOpacity(true));
  });
});

describe('tableLayout.computeSeatRotationY', () => {
  // Apply a Y-axis rotation by phi to the local +Z axis (0, 0, 1).
  // Three.js / R3F rotate (0,0,1) -> (sin phi, 0, cos phi).
  function rotateLocalZByY(phi: number): [number, number, number] {
    return [Math.sin(phi), 0, Math.cos(phi)];
  }

  it.each([2, 6, 9, 10])(
    'orients seat local +Z along the inward radial for seatCount=%i',
    (n) => {
      const TOL = 1e-10;
      for (let i = 0; i < n; i++) {
        const theta = computeSeatAngle(i, n);
        const phi = computeSeatRotationY(i, n);
        const [fx, fy, fz] = rotateLocalZByY(phi);

        // Inward radial unit direction: from seat toward table center.
        const ix = -Math.cos(theta);
        const iz = -Math.sin(theta);

        expect(fx).toBeCloseTo(ix, 10);
        expect(fy).toBeCloseTo(0, 10);
        expect(fz).toBeCloseTo(iz, 10);

        // Explicit tolerance check on vector magnitude difference.
        const dx = fx - ix;
        const dz = fz - iz;
        expect(Math.hypot(dx, fy, dz)).toBeLessThan(TOL);
      }
    },
  );

  it('matches the closed-form phi = -theta - pi/2', () => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const theta = computeSeatAngle(i, n);
      expect(computeSeatRotationY(i, n)).toBeCloseTo(-theta - Math.PI / 2, 12);
    }
  });
});

describe('tableLayout.seatAnchorLocalToWorld', () => {
  it('reduces to seat position + pad thickness for a zero local offset', () => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const [sx, sy, sz] = computeSeatPosition(i, n);
      const [wx, wy, wz] = seatAnchorLocalToWorld(i, n, [0, 0, 0]);
      expect(wx).toBeCloseTo(sx, 10);
      expect(wy).toBeCloseTo(sy + SEAT_PAD_THICKNESS, 10);
      expect(wz).toBeCloseTo(sz, 10);
    }
  });

  it('adds Y offsets additively on top of SEAT_PAD_THICKNESS', () => {
    const [, wy] = seatAnchorLocalToWorld(0, 6, [0, 0.5, 0]);
    expect(wy).toBeCloseTo(SEAT_PAD_THICKNESS + 0.5, 12);
  });

  it('matches a scene-graph Object3D hierarchy mirroring <Seat>', () => {
    // Parity sentinel for Cycle 13 H-1: for every seat index, the render-
    // time world pose of a descendant of <Seat>'s seat-anchor group must
    // equal seatAnchorLocalToWorld of the same local offset, exactly (up
    // to float tolerance). If this test ever diverges from
    // seatAnchorLocalToWorld, the helper and the scene graph are out of
    // sync and tween targets will miss their render pose.
    const seatCount = 9;
    const locals: Array<readonly [number, number, number]> = [
      [0, 0, 0],
      [-0.25, 0.02, 0.45], // left hole card
      [0.25, 0.02, 0.45], // right hole card
      [0.1, 0.37, -0.2], // arbitrary probe
    ];
    for (let i = 0; i < seatCount; i++) {
      const seat = new THREE.Group();
      const [sx, sy, sz] = computeSeatPosition(i, seatCount);
      seat.position.set(sx, sy, sz);
      seat.rotation.y = computeSeatRotationY(i, seatCount);
      const anchor = new THREE.Group();
      anchor.position.set(0, SEAT_PAD_THICKNESS, 0);
      seat.add(anchor);
      seat.updateMatrixWorld(true);
      for (const local of locals) {
        const child = new THREE.Group();
        child.position.set(local[0], local[1], local[2]);
        anchor.add(child);
        child.updateMatrixWorld(true);
        const wp = new THREE.Vector3();
        child.getWorldPosition(wp);
        const [hx, hy, hz] = seatAnchorLocalToWorld(i, seatCount, local);
        expect(wp.x).toBeCloseTo(hx, 10);
        expect(wp.y).toBeCloseTo(hy, 10);
        expect(wp.z).toBeCloseTo(hz, 10);
        anchor.remove(child);
      }
    }
  });
});

describe('tableLayout.seatCommitChipWorldPosition', () => {
  it('matches the legacy PokerTable ad-hoc formula (resolves Cycle 13 L-1)', () => {
    // Prior to this refactor, <PokerTable> implemented the seat commit-chip
    // origin inline as:
    //   [sx + sin(phi) * z, sy, sz + cos(phi) * z]
    // with z = SEAT_COMMIT_CHIP_LOCAL_Z. The new helper must agree bit-for-bit.
    const seatCount = 9;
    for (let i = 0; i < seatCount; i++) {
      const [sx, sy, sz] = computeSeatPosition(i, seatCount);
      const phi = computeSeatRotationY(i, seatCount);
      const z = SEAT_COMMIT_CHIP_LOCAL_Z;
      const expected: [number, number, number] = [
        sx + Math.sin(phi) * z,
        sy,
        sz + Math.cos(phi) * z,
      ];
      const actual = seatCommitChipWorldPosition(i, seatCount);
      expect(actual[0]).toBeCloseTo(expected[0], 10);
      expect(actual[1]).toBeCloseTo(expected[1], 10);
      expect(actual[2]).toBeCloseTo(expected[2], 10);
    }
  });

  it('sits on the felt (y === TABLE_TOP_Y) rather than on top of the seat pad', () => {
    for (let i = 0; i < 6; i++) {
      const [, y] = seatCommitChipWorldPosition(i, 6);
      expect(y).toBe(0);
    }
  });
});
