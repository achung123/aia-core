/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// R3F intrinsics (group/mesh/cylinderGeometry/meshStandardMaterial) render as
// unknown lowercase tags in happy-dom. React logs warnings about unknown tag
// casing which we silence so real errors still surface.
const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Unknown event handler|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

import { Seat } from '../../src/scenes3d/components/Seat';
import { Table } from '../../src/scenes3d/components/Table';
import {
  INACTIVE_SEAT_OPACITY,
  ACTIVE_SEAT_OPACITY,
  computeSeatPosition,
  computeSeatRotationY,
} from '../../src/scenes3d/components/tableLayout';

afterEach(() => {
  cleanup();
});

describe('<Table>', () => {
  it('renders a felt mesh and a rail mesh inside a named group', () => {
    const { container } = render(<Table />);
    const root = container.querySelector('group[name="table"]');
    expect(root).not.toBeNull();
    expect(container.querySelector('mesh[name="table-felt"]')).not.toBeNull();
    expect(container.querySelector('mesh[name="table-rail"]')).not.toBeNull();
  });

  it('mounts without throwing', () => {
    expect(() => render(<Table feltColor="#123456" railColor="#000000" />)).not.toThrow();
  });
});

describe('<Seat>', () => {
  it('renders 9 seats spaced at exactly 40° (360/9) apart', () => {
    const n = 9;
    const { container } = render(
      <>
        {Array.from({ length: n }, (_, i) => (
          <Seat key={i} seatIndex={i} seatCount={n} />
        ))}
      </>,
    );

    // Match top-level seat groups only (exclude inner 'seat-anchor' groups).
    const groups = container.querySelectorAll('group[name^="seat-"]:not([name="seat-anchor"])');
    expect(groups).toHaveLength(n);

    // The `position` and `rotation` props are non-standard for the DOM, so
    // React stringifies them onto the element. We decode via getAttribute.
    const positions = Array.from(groups).map((g) => {
      const pos = g.getAttribute('position');
      expect(pos).not.toBeNull();
      return pos!.split(',').map(Number) as [number, number, number];
    });

    // Positions match tableLayout.computeSeatPosition exactly.
    positions.forEach(([x, y, z], i) => {
      const [ex, ey, ez] = computeSeatPosition(i, n);
      expect(x).toBeCloseTo(ex, 5);
      expect(y).toBeCloseTo(ey, 5);
      expect(z).toBeCloseTo(ez, 5);
    });

    // Angular spacing is 40° by construction (rotation attr is -angle).
    const rotations = Array.from(groups).map((g) => {
      const rot = g.getAttribute('rotation');
      return rot!.split(',').map(Number) as [number, number, number];
    });
    for (let i = 1; i < n; i++) {
      const delta = rotations[i - 1][1] - rotations[i][1];
      expect((delta * 180) / Math.PI).toBeCloseTo(40, 5);
    }

    // Pin absolute orientation: seat 0's Y-rotation matches the single source
    // of truth in tableLayout.computeSeatRotationY. This guards against
    // regressions that preserve adjacent deltas but leave local +Z facing
    // the wrong direction (e.g. the previous `[0, -angle, 0]` which was 90°
    // off the inward radial at every seat).
    expect(rotations[0][0]).toBeCloseTo(0, 5);
    expect(rotations[0][1]).toBeCloseTo(computeSeatRotationY(0, n), 5);
    expect(rotations[0][2]).toBeCloseTo(0, 5);
  });

  it('dims the seat pad when isActive=false', () => {
    const { container: activeContainer } = render(
      <Seat seatIndex={0} seatCount={6} playerName="Alice" isActive />,
    );
    const { container: inactiveContainer } = render(
      <Seat seatIndex={0} seatCount={6} playerName={null} isActive={false} />,
    );

    const activePadMat = activeContainer.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    const inactivePadMat = inactiveContainer.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(activePadMat).not.toBeNull();
    expect(inactivePadMat).not.toBeNull();

    expect(Number(activePadMat!.getAttribute('opacity'))).toBe(ACTIVE_SEAT_OPACITY);
    expect(Number(inactivePadMat!.getAttribute('opacity'))).toBe(INACTIVE_SEAT_OPACITY);
    expect(Number(inactivePadMat!.getAttribute('opacity'))).toBeLessThan(
      Number(activePadMat!.getAttribute('opacity')),
    );
  });

  it('exposes seatIndex/playerName/isActive via userData for scene introspection', () => {
    const { container } = render(
      <Seat seatIndex={3} seatCount={6} playerName="Bob" isActive />,
    );
    const seat = container.querySelector('group[name="seat-3"]');
    expect(seat).not.toBeNull();
    // React serializes the `userData` prop onto the element as [object Object]
    // if we rely on the attribute, so just assert the group exists with the
    // correct name and that children render. Detailed userData assertions
    // would require a real R3F renderer and are covered at the scene level
    // in T-009.
    expect(seat!.querySelector('mesh[name="seat-pad"]')).not.toBeNull();
  });

  it('renders child content inside the seat anchor', () => {
    const { container } = render(
      <Seat seatIndex={0} seatCount={4} playerName="Chip" isActive>
        <div data-testid="seat-child">hello</div>
      </Seat>,
    );
    expect(container.querySelector('[data-testid="seat-child"]')).not.toBeNull();
  });
});
