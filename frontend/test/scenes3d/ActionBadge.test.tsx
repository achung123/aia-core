/** @vitest-environment happy-dom */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

// ---------------------------------------------------------------------------
// R3F mock — mirrors Nameplate.test.tsx. `frameCallbacks` let tests step
// the clock and feed a fake `state.camera` into the billboard driver.
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
// drei mock — mirrors Nameplate.test.tsx. Renders `<Text>` as a plain
// <div> carrying its content via `data-text` so tests can assert the
// exact label string passed to drei.
// ---------------------------------------------------------------------------
vi.mock('@react-three/drei', () => ({
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
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
  ActionBadge,
  ActionBadges,
  ACTION_BADGE_FONT_SIZE,
  ACTION_BADGE_LOCAL_Y,
  ACTION_BADGE_WIDTH,
  computeActionBadgeWorldPosition,
  formatActionLabel,
  shouldShowBadge,
} from '../../src/scenes3d/components/ActionBadge';
import {
  NAMEPLATE_HEIGHT,
  NAMEPLATE_LOCAL_Y,
} from '../../src/scenes3d/components/Nameplate';
import { seatAnchorLocalToWorld } from '../../src/scenes3d/components/tableLayout';
import type { SeatState, TableStatePhase } from '../../src/scenes3d/types';

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
});

function findBadge(container: HTMLElement, seatIndex: number): Element | null {
  return container.querySelector(`group[name="action-badge-${seatIndex}"]`);
}

function readLabel(el: Element): string {
  const text = el.querySelector('[data-testid="action-badge-text"]');
  if (!text) throw new Error('action-badge-text not found');
  return text.getAttribute('data-text') ?? '';
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('formatActionLabel', () => {
  it('returns null for null lastAction', () => {
    expect(formatActionLabel(null)).toBeNull();
  });

  it('returns the bare verb for check / call / fold', () => {
    expect(formatActionLabel({ action: 'check', street: 'preflop' })).toBe('check');
    expect(formatActionLabel({ action: 'call', street: 'flop' })).toBe('call');
    expect(formatActionLabel({ action: 'fold', street: 'turn' })).toBe('fold');
  });

  it('returns "all-in" for all-in', () => {
    expect(formatActionLabel({ action: 'all-in', street: 'river' })).toBe('all-in');
  });

  it('formats bet/raise with dollar amount when amount > 0', () => {
    expect(formatActionLabel({ action: 'bet', amount: 25, street: 'flop' })).toBe('bet $25');
    expect(formatActionLabel({ action: 'raise', amount: 1200, street: 'turn' })).toBe('raise $1,200');
  });

  it('falls back to bare verb when amount is missing, zero, or negative (AC 3 — no "undefined")', () => {
    expect(formatActionLabel({ action: 'bet', street: 'flop' })).toBe('bet');
    expect(formatActionLabel({ action: 'raise', amount: 0, street: 'flop' })).toBe('raise');
    expect(formatActionLabel({ action: 'bet', amount: -5, street: 'flop' })).toBe('bet');
  });

  it('returns null for unrecognised action strings (AC 3)', () => {
    // Force an unrecognised verb to prove the switch default returns null.
    const bogus = { action: 'mumble', street: 'preflop' } as unknown as SeatState['lastAction'];
    expect(formatActionLabel(bogus)).toBeNull();
  });
});

describe('shouldShowBadge', () => {
  it('returns false when lastAction is null', () => {
    expect(shouldShowBadge(null, 'flop')).toBe(false);
  });

  it('shows transient actions only on the matching street (AC 2)', () => {
    const la: SeatState['lastAction'] = { action: 'bet', amount: 10, street: 'flop' };
    expect(shouldShowBadge(la, 'flop')).toBe(true);
    expect(shouldShowBadge(la, 'turn')).toBe(false);
    expect(shouldShowBadge(la, 'river')).toBe(false);
  });

  it('persists fold across every street (AC 2)', () => {
    const la: SeatState['lastAction'] = { action: 'fold', street: 'preflop' };
    for (const p of ['preflop', 'flop', 'turn', 'river', 'showdown'] as TableStatePhase[]) {
      expect(shouldShowBadge(la, p)).toBe(true);
    }
  });

  it('persists all-in across every street (AC 2)', () => {
    const la: SeatState['lastAction'] = { action: 'all-in', street: 'flop' };
    for (const p of ['preflop', 'flop', 'turn', 'river', 'showdown'] as TableStatePhase[]) {
      expect(shouldShowBadge(la, p)).toBe(true);
    }
  });
});

describe('computeActionBadgeWorldPosition', () => {
  it('sits below the nameplate anchor in local Y', () => {
    // The badge local Y must be strictly less than the nameplate local Y.
    expect(ACTION_BADGE_LOCAL_Y).toBeLessThan(NAMEPLATE_LOCAL_Y);
    expect(ACTION_BADGE_LOCAL_Y).toBeLessThan(
      NAMEPLATE_LOCAL_Y - NAMEPLATE_HEIGHT / 2,
    );
  });

  it('agrees with seatAnchorLocalToWorld for the badge offset', () => {
    const pos = computeActionBadgeWorldPosition(0, 6);
    const expected = seatAnchorLocalToWorld(0, 6, [0, ACTION_BADGE_LOCAL_Y, 0]);
    expect(pos).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// <ActionBadge> rendering
// ---------------------------------------------------------------------------

describe('<ActionBadge>', () => {
  const seatProps = { seatIndex: 0, seatCount: 6 };

  it('renders nothing when lastAction is null (AC 3)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={null}
        currentPhase="flop"
      />,
    );
    expect(findBadge(container, 0)).toBeNull();
  });

  it('renders nothing when the action is from a prior street (AC 2)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'bet', amount: 10, street: 'preflop' }}
        currentPhase="flop"
      />,
    );
    expect(findBadge(container, 0)).toBeNull();
  });

  it('renders the current-street action label (AC 1)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'bet', amount: 25, street: 'flop' }}
        currentPhase="flop"
      />,
    );
    const el = findBadge(container, 0);
    expect(el).not.toBeNull();
    expect(readLabel(el!)).toBe('bet $25');
  });

  it('persists fold into later streets (AC 2)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'fold', street: 'preflop' }}
        currentPhase="river"
      />,
    );
    const el = findBadge(container, 0);
    expect(el).not.toBeNull();
    expect(readLabel(el!)).toBe('fold');
  });

  it('persists all-in into later streets (AC 2)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'all-in', street: 'preflop' }}
        currentPhase="showdown"
      />,
    );
    const el = findBadge(container, 0);
    expect(el).not.toBeNull();
    expect(readLabel(el!)).toBe('all-in');
  });

  it('renders check and call with no dollar suffix (AC 1)', () => {
    const { container: c1 } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'check', street: 'flop' }}
        currentPhase="flop"
      />,
    );
    expect(readLabel(findBadge(c1, 0)!)).toBe('check');

    const { container: c2 } = render(
      <ActionBadge
        {...seatProps}
        seatIndex={1}
        lastAction={{ action: 'call', amount: 10, street: 'flop' }}
        currentPhase="flop"
      />,
    );
    expect(readLabel(findBadge(c2, 1)!)).toBe('call');
  });

  it('does not emit the string "undefined" anywhere in the label (AC 3)', () => {
    const { container } = render(
      <ActionBadge
        {...seatProps}
        lastAction={{ action: 'bet', street: 'flop' }}
        currentPhase="flop"
      />,
    );
    const el = findBadge(container, 0);
    expect(el).not.toBeNull();
    const label = readLabel(el!);
    expect(label.toLowerCase()).not.toContain('undefined');
    expect(label).toBe('bet');
  });

  it('billboards the badge to face the active camera (Y-axis rotation tracks camera azimuth)', () => {
    // Place camera on the +X axis; expect rotation ≈ +π/2 so local +Z
    // points toward the camera (matching the Nameplate contract).
    const { container } = render(
      <ActionBadge
        seatIndex={0}
        seatCount={1}
        lastAction={{ action: 'bet', amount: 5, street: 'flop' }}
        currentPhase="flop"
      />,
    );
    // Drive one frame with a camera at +X, wrapped in act() so the
    // setState from the billboard useFrame flushes before we read.
    act(() => {
      frameCallbacks[0]!({ camera: { position: { x: 10, z: 0 } } }, 0.016);
    });
    const el = findBadge(container, 0);
    expect(el).not.toBeNull();
    const raw = el!.getAttribute('rotation');
    expect(raw).toBeTruthy();
    const [rx, ry, rz] = raw!.split(',').map(Number);
    expect(rx).toBeCloseTo(0, 5);
    expect(rz).toBeCloseTo(0, 5);
    expect(ry).toBeCloseTo(Math.PI / 2, 4);
  });

  it('preserves the shared font size / width layout constants', () => {
    expect(ACTION_BADGE_FONT_SIZE).toBeGreaterThan(0);
    expect(ACTION_BADGE_WIDTH).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// <ActionBadges> composer
// ---------------------------------------------------------------------------

describe('<ActionBadges>', () => {
  it('renders one badge per occupied seat and skips empty / inactive seats (AC 3)', () => {
    const seats = [
      { seatIndex: 0, playerName: 'Alice', isActive: true,
        lastAction: { action: 'bet' as const, amount: 10, street: 'flop' as const } },
      { seatIndex: 1, playerName: null,    isActive: true,  lastAction: null },
      { seatIndex: 2, playerName: 'Carol', isActive: false,
        lastAction: { action: 'call' as const, street: 'flop' as const } },
      { seatIndex: 3, playerName: 'Dan',   isActive: true,  lastAction: null },
    ];
    const { container } = render(
      <ActionBadges seats={seats} seatCount={6} currentPhase="flop" />,
    );
    expect(findBadge(container, 0)).not.toBeNull();
    expect(findBadge(container, 1)).toBeNull(); // empty seat
    expect(findBadge(container, 2)).toBeNull(); // inactive seat
    expect(findBadge(container, 3)).toBeNull(); // null lastAction
    expect(readLabel(findBadge(container, 0)!)).toBe('bet $10');
  });
});
