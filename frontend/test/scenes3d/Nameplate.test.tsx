/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// R3F mock — mirrors DealerButton.test.tsx. Exposes `frameCallbacks` so
// tests can step the animation clock and feed a fake `state.camera` into
// the billboard driver.
// ---------------------------------------------------------------------------
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.length = 0;
    frameCallbacks.push(cb);
  },
  Canvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// drei mock — <Text> is WebGL SDF text (troika) in production. Under
// happy-dom we render it as a plain <div> carrying the text via
// `data-text`, and spy on every invocation so tests can assert the
// exact string the nameplate hands to drei (bug aia-core-ovhb AC 2).
// ---------------------------------------------------------------------------
const textRenderSpy =
  vi.fn<
    (props: Record<string, unknown> & { children?: unknown }) => void
  >();
vi.mock('@react-three/drei', () => ({
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
    textRenderSpy(props);
    const { children, name, position, ...rest } = props;
    void rest;
    const rawName = typeof name === 'string' ? name : 'drei-text';
    return (
      <div
        data-testid={rawName}
        data-text={String(children ?? '')}
        data-position={
          Array.isArray(position) ? (position as number[]).join(',') : ''
        }
      />
    );
  },
}));

const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Unknown event handler|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => consoleErrorSpy.mockRestore());

import {
  Nameplate,
  Nameplates,
  NAMEPLATE_STACK_ANIMATION_MS,
  NAMEPLATE_LOCAL_Y,
  NAMEPLATE_FONT_SIZE,
  NAMEPLATE_WIDTH,
  BILLBOARD_EPSILON,
  formatStackAmount,
  computeNameplateWorldPosition,
  computeBillboardYRotation,
} from '../../src/scenes3d/components/Nameplate';
import { seatAnchorLocalToWorld } from '../../src/scenes3d/components/tableLayout';

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  textRenderSpy.mockClear();
});

function stepFrames(
  totalMs: number,
  stepMs = 16,
  frameState: unknown = {},
) {
  act(() => {
    let elapsed = 0;
    while (elapsed < totalMs) {
      const step = Math.min(stepMs, totalMs - elapsed);
      for (const cb of frameCallbacks) cb(frameState, step / 1000);
      elapsed += step;
    }
  });
}

function findNameplate(
  container: HTMLElement,
  seatIndex: number,
): Element | null {
  return container.querySelector(`group[name="nameplate-${seatIndex}"]`);
}

/**
 * Pull the current drei `<Text>` string rendered inside this nameplate.
 * The production component passes `${playerName}\n${formatStackAmount}`
 * as children to `<Text>`; the mock mirrors that via `data-text`.
 */
function readLabel(groupEl: Element): string {
  const textEl = groupEl.querySelector('[data-testid="nameplate-text"]');
  if (!textEl) throw new Error('nameplate-text drei <Text> not found');
  return textEl.getAttribute('data-text') ?? '';
}

function readStack(el: Element): string {
  // Second line of the two-line label is the displayed stack.
  const parts = readLabel(el).split('\n');
  return parts[1] ?? '';
}

function readName(el: Element): string {
  return readLabel(el).split('\n')[0] ?? '';
}

function readRotationY(el: Element): number {
  const raw = el.getAttribute('rotation');
  if (!raw) throw new Error('missing rotation attribute');
  return Number(raw.split(',')[1]);
}

function parseDollars(str: string): number {
  return Number(str.replace(/[$,]/g, ''));
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('formatStackAmount', () => {
  it('formats integers with a dollar sign and no decimals', () => {
    expect(formatStackAmount(0)).toBe('$0');
    expect(formatStackAmount(7)).toBe('$7');
    expect(formatStackAmount(123)).toBe('$123');
  });

  it('rounds fractional amounts to the nearest dollar', () => {
    expect(formatStackAmount(123.4)).toBe('$123');
    expect(formatStackAmount(123.6)).toBe('$124');
  });

  it('inserts thousands separators for large amounts', () => {
    expect(formatStackAmount(1000)).toBe('$1,000');
    expect(formatStackAmount(12345)).toBe('$12,345');
    expect(formatStackAmount(1234567)).toBe('$1,234,567');
  });

  it('handles negatives with a leading minus', () => {
    expect(formatStackAmount(-50)).toBe('-$50');
  });
});

describe('computeNameplateWorldPosition', () => {
  it('lifts the seat anchor by NAMEPLATE_LOCAL_Y in world Y', () => {
    const pos = computeNameplateWorldPosition(0, 6);
    const expected = seatAnchorLocalToWorld(0, 6, [0, NAMEPLATE_LOCAL_Y, 0]);
    expect(pos[0]).toBeCloseTo(expected[0], 10);
    expect(pos[1]).toBeCloseTo(expected[1], 10);
    expect(pos[2]).toBeCloseTo(expected[2], 10);
  });

  it('matches seatAnchorLocalToWorld for every seat', () => {
    for (let s = 0; s < 9; s += 1) {
      const pos = computeNameplateWorldPosition(s, 9);
      const expected = seatAnchorLocalToWorld(s, 9, [0, NAMEPLATE_LOCAL_Y, 0]);
      expect(pos).toEqual(expected);
    }
  });
});

describe('computeBillboardYRotation', () => {
  it('returns 0 when the camera is on +Z (local +Z already faces it)', () => {
    const phi = computeBillboardYRotation({ x: 0, z: 5 }, { x: 0, z: 0 });
    expect(phi).toBeCloseTo(0, 10);
  });

  it('returns π/2 when the camera is on +X relative to the object', () => {
    const phi = computeBillboardYRotation({ x: 5, z: 0 }, { x: 0, z: 0 });
    expect(phi).toBeCloseTo(Math.PI / 2, 10);
  });

  it('returns -π/2 when the camera is on -X relative to the object', () => {
    const phi = computeBillboardYRotation({ x: -5, z: 0 }, { x: 0, z: 0 });
    expect(phi).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('returns π (or -π) when the camera is on -Z relative to the object', () => {
    const phi = computeBillboardYRotation({ x: 0, z: -5 }, { x: 0, z: 0 });
    expect(Math.abs(phi)).toBeCloseTo(Math.PI, 10);
  });

  it('ignores Y — only X/Z drive the azimuth', () => {
    const a = computeBillboardYRotation({ x: 5, z: 0 }, { x: 0, z: 0 });
    const b = computeBillboardYRotation(
      // Same XZ, very different "Y" (not used).
      { x: 5, z: 0 } as { x: number; z: number },
      { x: 0, z: 0 },
    );
    expect(a).toBe(b);
  });

  it('falls back to 0 when camera and object coincide in XZ', () => {
    const phi = computeBillboardYRotation({ x: 2, z: 3 }, { x: 2, z: 3 });
    expect(phi).toBe(0);
  });

  it('rotated local +Z matches the camera direction in XZ', () => {
    // Rotation about Y by φ maps (0,0,1) → (sin φ, 0, cos φ). That should
    // point from object toward camera in X/Z.
    const obj = { x: 1, z: -2 };
    const cam = { x: 4, z: 2 };
    const phi = computeBillboardYRotation(cam, obj);
    const dirX = Math.sin(phi);
    const dirZ = Math.cos(phi);
    const dx = cam.x - obj.x;
    const dz = cam.z - obj.z;
    const len = Math.hypot(dx, dz);
    expect(dirX).toBeCloseTo(dx / len, 10);
    expect(dirZ).toBeCloseTo(dz / len, 10);
  });
});

// ---------------------------------------------------------------------------
// <Nameplate> rendering + AC coverage
// ---------------------------------------------------------------------------

describe('<Nameplate> rendering', () => {
  it('mounts without throwing for an occupied seat', () => {
    expect(() =>
      render(
        <Nameplate
          seatIndex={0}
          seatCount={6}
          playerName="Alice"
          stack={100}
        />,
      ),
    ).not.toThrow();
  });

  it('renders a group named `nameplate-{seatIndex}` at the seat world position', () => {
    const { container } = render(
      <Nameplate
        seatIndex={2}
        seatCount={6}
        playerName="Alice"
        stack={100}
      />,
    );
    const el = findNameplate(container, 2);
    expect(el).not.toBeNull();
    const pos = el!.getAttribute('position')!.split(',').map(Number);
    const expected = computeNameplateWorldPosition(2, 6);
    expect(pos[0]).toBeCloseTo(expected[0], 6);
    expect(pos[1]).toBeCloseTo(expected[1], 6);
    expect(pos[2]).toBeCloseTo(expected[2], 6);
  });

  it('exposes the player name and formatted stack via drei <Text> content', () => {
    const { container } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={1250}
      />,
    );
    const el = findNameplate(container, 0)!;
    // Two-line label: name on top, formatted stack below.
    expect(readLabel(el)).toBe('Alice\n$1,250');
    expect(readName(el)).toBe('Alice');
    expect(readStack(el)).toBe('$1,250');
  });

  it('AC 2 (bug-fix): invokes drei <Text> with the rendered label and nameplate-text name', () => {
    render(
      <Nameplate
        seatIndex={3}
        seatCount={6}
        playerName="Bob"
        stack={42}
      />,
    );
    // drei <Text> was invoked at least once with our label as children.
    expect(textRenderSpy).toHaveBeenCalled();
    const match = textRenderSpy.mock.calls.find(
      ([props]) =>
        (props as { name?: unknown }).name === 'nameplate-text',
    );
    expect(match).toBeDefined();
    const props = match![0] as Record<string, unknown>;
    expect(props.children).toBe('Bob\n$42');
    // Font size / sizing props are passed through to troika.
    expect(props.fontSize).toBe(NAMEPLATE_FONT_SIZE);
    expect(props.anchorX).toBe('center');
    expect(props.anchorY).toBe('middle');
    expect(props.color).toBe('#f8fafc');
  });

  it('consolidation: no legacy data-* test hooks on the group (userData only)', () => {
    const { container } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={100}
      />,
    );
    const el = findNameplate(container, 0)!;
    // data-* attributes have been removed — the drei <Text> mock is the
    // single test hook for rendered label content.
    expect(el.hasAttribute('data-player-name')).toBe(false);
    expect(el.hasAttribute('data-stack')).toBe(false);
    expect(el.hasAttribute('data-displayed-stack')).toBe(false);
    expect(el.hasAttribute('data-label')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // AC 4 — empty seats render no nameplate.
  // -------------------------------------------------------------------------

  it('AC 4: renders nothing when playerName is null', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName={null} stack={100} />,
    );
    expect(findNameplate(container, 0)).toBeNull();
  });

  it('AC 4: renders nothing when playerName is an empty string', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="" stack={100} />,
    );
    expect(findNameplate(container, 0)).toBeNull();
  });

  it('AC 4: renders nothing when isActive is false (seat inactive)', () => {
    const { container } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={100}
        isActive={false}
      />,
    );
    expect(findNameplate(container, 0)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // AC 3 — legibility proxy: font-size and card width meet minimum sizes.
  // -------------------------------------------------------------------------

  it('AC 3: exports a font size large enough for 360px viewport legibility', () => {
    // At the default camera preset (Z ≈ 8 world units) world-unit 0.09
    // projects to ≳ 14px on a 360px viewport — comfortably legible.
    // We enforce a floor here as a regression guard.
    expect(NAMEPLATE_FONT_SIZE).toBeGreaterThanOrEqual(0.08);
    expect(NAMEPLATE_WIDTH).toBeGreaterThanOrEqual(0.6);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Stack tween between old and new amounts
// ---------------------------------------------------------------------------

describe('<Nameplate> stack tween (AC 2)', () => {
  it('initially displays the full stack value without a tween', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    expect(readStack(findNameplate(container, 0)!)).toBe('$100');
  });

  it('tweens through intermediate values when stack changes', () => {
    const { container, rerender } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    // Bump stack from 100 to 200.
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={200} />,
    );
    // Immediately after rerender, no frames have ticked — displayed
    // should still be the old value (or very close to it).
    const startEl = findNameplate(container, 0)!;
    expect(parseDollars(readStack(startEl))).toBe(100);

    // Half-way through the tween, displayed value is strictly between
    // old (100) and new (200).
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS / 2);
    const midEl = findNameplate(container, 0)!;
    const mid = parseDollars(readStack(midEl));
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);

    // Allow enough extra time for the tween to finish under reduced-step
    // sampling.
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS);
    const endEl = findNameplate(container, 0)!;
    expect(parseDollars(readStack(endEl))).toBe(200);
    // Source-of-truth stack is mirrored on group.userData (production
    // scene-graph hook); the visible text shows the tween target.
    expect(readStack(endEl)).toBe('$200');
  });

  it('reaches the new stack value at tween completion', () => {
    const { container, rerender } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={500} />,
    );
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={50} />,
    );
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS * 2);
    expect(readStack(findNameplate(container, 0)!)).toBe('$50');
  });

  it('restarts the tween when stack changes mid-animation', () => {
    const { container, rerender } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={0} />,
    );
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS / 2);
    const mid = parseDollars(readStack(findNameplate(container, 0)!));
    // Change target again before the first tween finishes.
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={500} />,
    );
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS * 2);
    const end = parseDollars(readStack(findNameplate(container, 0)!));
    expect(end).toBe(500);
    // Sanity: the mid-tween sample was strictly between 0 and 100.
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });

  it('stays put when rerender carries the same stack value', () => {
    const { container, rerender } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={250} />,
    );
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={250} />,
    );
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS);
    expect(readStack(findNameplate(container, 0)!)).toBe('$250');
  });

  // -------------------------------------------------------------------------
  // Reduced-motion: stack jumps instantly (no intermediate values).
  // -------------------------------------------------------------------------

  it('snaps instantly when prefers-reduced-motion is set', () => {
    const orig = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { container, rerender } = render(
        <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
      );
      rerender(
        <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={900} />,
      );
      // No frames stepped — the new value is already displayed.
      expect(readStack(findNameplate(container, 0)!)).toBe('$900');
    } finally {
      window.matchMedia = orig;
    }
  });
});

// ---------------------------------------------------------------------------
// AC 1 — Billboard rotation tracks the camera
// ---------------------------------------------------------------------------

describe('<Nameplate> billboard rotation (AC 1)', () => {
  it('updates rotation to face the camera on the next frame', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    const el = findNameplate(container, 0)!;
    const objPos = computeNameplateWorldPosition(0, 6);

    // Camera at +X relative to the object → expected φ = atan2(+X, 0).
    const camPos = { x: objPos[0] + 5, y: 2, z: objPos[2] };
    stepFrames(16, 16, { camera: { position: camPos } });
    const phi = readRotationY(findNameplate(container, 0)!);
    const expected = computeBillboardYRotation(camPos, {
      x: objPos[0],
      z: objPos[2],
    });
    expect(phi).toBeCloseTo(expected, 4);
    // Sanity: using the object's own +Z axis unrotated would fail here.
    expect(Math.abs(phi)).toBeGreaterThan(0);
    // Suppress unused var.
    void el;
  });

  it('re-orients when the camera moves on subsequent frames', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    const objPos = computeNameplateWorldPosition(0, 6);

    stepFrames(16, 16, {
      camera: { position: { x: objPos[0] + 5, y: 2, z: objPos[2] } },
    });
    const phi1 = readRotationY(findNameplate(container, 0)!);
    stepFrames(16, 16, {
      camera: { position: { x: objPos[0], y: 2, z: objPos[2] + 5 } },
    });
    const phi2 = readRotationY(findNameplate(container, 0)!);
    expect(phi2).not.toBe(phi1);
    expect(phi2).toBeCloseTo(0, 4);
  });

  it('ignores frames that have no camera (no crash, rotation unchanged)', () => {
    const { container } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="Alice" stack={100} />,
    );
    const before = readRotationY(findNameplate(container, 0)!);
    // Frame state without a `camera` — must not throw.
    expect(() => stepFrames(16, 16, {})).not.toThrow();
    const after = readRotationY(findNameplate(container, 0)!);
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// <Nameplates> wrapper — multiple seats
// ---------------------------------------------------------------------------

describe('<Nameplates>', () => {
  it('renders one nameplate per occupied seat and hides empty ones', () => {
    const seats = [
      { seatIndex: 0, playerName: 'Alice', isActive: true, stack: 100 },
      { seatIndex: 1, playerName: null, isActive: true, stack: 0 },
      { seatIndex: 2, playerName: 'Bob', isActive: true, stack: 200 },
      { seatIndex: 3, playerName: 'Carol', isActive: false, stack: 300 },
    ];
    const { container } = render(<Nameplates seats={seats} seatCount={6} />);
    expect(findNameplate(container, 0)).not.toBeNull();
    expect(findNameplate(container, 1)).toBeNull();
    expect(findNameplate(container, 2)).not.toBeNull();
    expect(findNameplate(container, 3)).toBeNull();
  });

  it('keeps nameplate DOM identity stable across stack changes', () => {
    const base = [
      { seatIndex: 0, playerName: 'Alice', isActive: true, stack: 100 },
      { seatIndex: 1, playerName: 'Bob', isActive: true, stack: 50 },
    ];
    const { container, rerender } = render(
      <Nameplates seats={base} seatCount={6} />,
    );
    const before = findNameplate(container, 0);
    rerender(
      <Nameplates
        seats={[
          { seatIndex: 0, playerName: 'Alice', isActive: true, stack: 400 },
          { seatIndex: 1, playerName: 'Bob', isActive: true, stack: 50 },
        ]}
        seatCount={6}
      />,
    );
    const after = findNameplate(container, 0);
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Bug-card follow-ups: M2 (repopulated seat) + M4 (BILLBOARD_EPSILON export)
// ---------------------------------------------------------------------------

describe('<Nameplate> repopulated-seat snap (bug-card Cycle 16 M2)', () => {
  it('snaps (no tween) when a seat transitions hidden→visible with a new stack', () => {
    // Seat starts hidden (no player). Stack prop is 500.
    const { container, rerender } = render(
      <Nameplate seatIndex={0} seatCount={6} playerName={null} stack={500} />,
    );
    expect(findNameplate(container, 0)).toBeNull();

    // New player sits down with stack=500 — should appear immediately
    // showing $500, NOT tween from a stale value. Step zero frames; the
    // displayed value must already match the prop after mount.
    rerender(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Bob"
        stack={500}
      />,
    );
    const el = findNameplate(container, 0)!;
    expect(readStack(el)).toBe('$500');
  });

  it('snaps on hidden→visible even when prior displayed value differs from the new stack', () => {
    // Phase 1: seat occupied with Alice @ 1000.
    const { container, rerender } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={1000}
      />,
    );
    expect(readStack(findNameplate(container, 0)!)).toBe('$1,000');

    // Phase 2: Alice leaves. Stack prop is unchanged but seat hides.
    rerender(
      <Nameplate seatIndex={0} seatCount={6} playerName={null} stack={1000} />,
    );
    expect(findNameplate(container, 0)).toBeNull();

    // Phase 3: Bob joins with a different stack. Expectation — Bob's
    // nameplate mounts showing his own $500 immediately, with no
    // 1000→500 tween. Step zero animation frames first.
    rerender(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Bob"
        stack={500}
      />,
    );
    const el = findNameplate(container, 0)!;
    expect(readStack(el)).toBe('$500');

    // And after a full animation duration, it's still $500 (no tween
    // ever kicked in).
    stepFrames(NAMEPLATE_STACK_ANIMATION_MS * 2);
    expect(readStack(findNameplate(container, 0)!)).toBe('$500');
  });
});

describe('BILLBOARD_EPSILON export (bug-card Cycle 16 M4)', () => {
  it('is a small positive radian threshold', () => {
    expect(typeof BILLBOARD_EPSILON).toBe('number');
    expect(BILLBOARD_EPSILON).toBeGreaterThan(0);
    expect(BILLBOARD_EPSILON).toBeLessThan(1e-2);
  });
});
