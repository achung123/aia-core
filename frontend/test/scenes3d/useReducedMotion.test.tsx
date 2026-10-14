/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import {
  REDUCED_MOTION_QUERY,
  prefersReducedMotion,
  useReducedMotion,
} from '../../src/scenes3d/state/useReducedMotion';

type MatchMediaImpl = (query: string) => MediaQueryList;
const originalMatchMedia = window.matchMedia;

interface MockMQL {
  matches: boolean;
  media: string;
  listeners: Set<(e: MediaQueryListEvent) => void>;
  dispatch: (matches: boolean) => void;
}

function installMatchMedia(initial: boolean): MockMQL {
  const entry: MockMQL = {
    matches: initial,
    media: REDUCED_MOTION_QUERY,
    listeners: new Set(),
    dispatch(matches: boolean) {
      entry.matches = matches;
      const evt = { matches, media: entry.media } as MediaQueryListEvent;
      for (const l of entry.listeners) l(evt);
    },
  };
  const impl: MatchMediaImpl = (query: string) => {
    return {
      get matches() {
        return entry.matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        entry.listeners.add(cb);
      },
      removeEventListener: (
        _: string,
        cb: (e: MediaQueryListEvent) => void,
      ) => {
        entry.listeners.delete(cb);
      },
      addListener: (cb: (e: MediaQueryListEvent) => void) => {
        entry.listeners.add(cb);
      },
      removeListener: (cb: (e: MediaQueryListEvent) => void) => {
        entry.listeners.delete(cb);
      },
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(impl),
  });
  return entry;
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

describe('prefersReducedMotion (sync)', () => {
  it('returns false when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('queries the prefers-reduced-motion media rule', () => {
    installMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });

  it('returns false when the user has not opted into reduced motion', () => {
    installMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('useReducedMotion (hook)', () => {
  it('returns the initial matchMedia snapshot on first render', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns false when reduced motion is not requested', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('updates when the media query value changes', () => {
    const entry = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => entry.dispatch(true));
    expect(result.current).toBe(true);
    act(() => entry.dispatch(false));
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const entry = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(entry.listeners.size).toBeGreaterThan(0);
    unmount();
    expect(entry.listeners.size).toBe(0);
  });

  it('does not throw when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
