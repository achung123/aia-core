// Visibility policy — who can see whose hole cards at each phase.
//
// Single pure function. Every `<Card>.faceUp` decision routes through
// `canSee(...)`. Implementation matches plan.md § "Visibility Policy — Formal
// Contract" (specs/table-3d-revamp-010/plan.md) byte-for-byte.
//
// Zero React, zero side effects — safe for use in render, tests, and animation
// drivers.
//
// SECURITY MODEL (Cycle 21 MED-2): `canSee` is a **render-time presentation
// filter, not a trust boundary.** Hole cards that should be hidden from the
// current viewer must already be absent from the payload delivered to the
// client by the backend (see the dealer-API visibility gate). This module
// only decides whether a card *that has already been sent* should render
// face-up in the scene. Never treat `canSee === false` as authorisation to
// ship private hole cards to arbitrary viewers — defence in depth lives on
// the server.

import type { Policy, TableState } from '../types';

export type { Policy };

export function canSee(args: {
  viewerSeat: number | null;
  cardOwnerSeat: number;
  policy: Policy;
  phase: TableState['phase'];
  ownerFolded: boolean;
}): boolean {
  if (args.policy === 'spectator') {
    return args.phase === 'showdown' && !args.ownerFolded;
  }
  // Player policy
  if (args.viewerSeat === args.cardOwnerSeat) return true; // own cards always
  if (args.ownerFolded) return false; // folded opponents never reveal
  if (args.phase === 'showdown') return true; // reveal non-folded opponents at showdown
  return false;
}
