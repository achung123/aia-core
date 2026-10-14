// T-020 — Equity overlay prop guard (layer 1 of 3 in plan.md § "Equity
// Overlay — Enforcement Model").
//
// `<PokerTable>` accepts an `equityOverlay: boolean` prop (default false).
// Under `viewer.policy === 'player'` the overlay is hard-forced off — the
// equity endpoint is never called regardless of the caller-supplied prop,
// so opponent ranges cannot be back-solved from the network tab.
//
// This module is pure and React-free so the guard can run:
//   - at render time inside `<EquityBadges>` (to short-circuit mount),
//   - inside `useEquityQuery`'s `enabled` computation (layer 2 — query
//     gate), so react-query never invokes the fetcher when policy blocks.
//
// Layer 3 (ESLint rule `no-equity-in-player`) ships in T-032.

import type { ViewerContext } from '../types';

/**
 * Resolve whether the equity overlay should render + fetch for the
 * current viewer.
 *
 * Rules:
 *   - Undefined viewer → treat as spectator (legacy callers).
 *   - `policy === 'player'` → always false. When DEV and `prop === true`
 *     a warning is logged so regressions are discoverable in the dev
 *     console.
 *   - Otherwise → return the prop verbatim.
 */
export function resolveEquityOverlay(
  prop: boolean,
  viewer: ViewerContext | undefined,
): boolean {
  const policy = viewer?.policy ?? 'spectator';
  if (policy === 'player') {
    if (prop === true && import.meta.env?.DEV) {
      console.warn(
        '[equityGuard] equityOverlay=true ignored under viewer.policy="player"',
      );
    }
    return false;
  }
  return prop;
}
