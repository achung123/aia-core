import { useCallback, useSyncExternalStore } from 'react';

/**
 * Single source of truth for the `prefers-reduced-motion` media query.
 * Centralised so tests and application code use the same string.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Synchronous snapshot of the user's reduced-motion preference. Safe to call
 * during SSR — returns `false` when `window` or `window.matchMedia` is absent.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

type MediaQueryLegacy = MediaQueryList & {
  addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
  removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
};

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(REDUCED_MOTION_QUERY) as MediaQueryLegacy;
  const handler = () => callback();
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  // Safari < 14 fallback.
  mql.addListener?.(handler);
  return () => mql.removeListener?.(handler);
}

/**
 * React hook that subscribes to `prefers-reduced-motion: reduce` and
 * re-renders the consumer when the OS-level preference changes.
 *
 * Uses `useSyncExternalStore` so the initial snapshot is always consistent
 * with the live media query and SSR / hydration stays safe. Returns `false`
 * when `window.matchMedia` is unavailable.
 */
export function useReducedMotion(): boolean {
  const getSnapshot = useCallback(() => prefersReducedMotion(), []);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
