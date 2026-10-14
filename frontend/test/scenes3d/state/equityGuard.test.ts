/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { resolveEquityOverlay } from '../../../src/scenes3d/state/equityGuard';
import type { ViewerContext } from '../../../src/scenes3d/types';

const SPECTATOR: ViewerContext = { policy: 'spectator' };
const PLAYER: ViewerContext = { policy: 'player', seat: 2 };

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('resolveEquityOverlay', () => {
  it('returns the prop verbatim for spectator viewers', () => {
    expect(resolveEquityOverlay(true, SPECTATOR)).toBe(true);
    expect(resolveEquityOverlay(false, SPECTATOR)).toBe(false);
  });

  it('treats an undefined viewer as spectator', () => {
    expect(resolveEquityOverlay(true, undefined)).toBe(true);
    expect(resolveEquityOverlay(false, undefined)).toBe(false);
  });

  it('hard-forces false for player viewers regardless of the prop', () => {
    expect(resolveEquityOverlay(true, PLAYER)).toBe(false);
    expect(resolveEquityOverlay(false, PLAYER)).toBe(false);
  });

  it('logs a dev warning when a caller passes true under player policy', () => {
    resolveEquityOverlay(true, PLAYER);
    // vitest runs with import.meta.env.DEV truthy; skip the assertion
    // in the (extremely unlikely) case it isn't.
    if (!import.meta.env?.DEV) return;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/equityGuard/);
  });

  it('does not warn when the prop is false under player policy', () => {
    resolveEquityOverlay(false, PLAYER);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for spectator viewers', () => {
    resolveEquityOverlay(true, SPECTATOR);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
