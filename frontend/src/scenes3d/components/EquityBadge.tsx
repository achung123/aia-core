// T-020 — Per-seat equity overlay badge.
//
// Renders a small drei `<Text>` floating just below the seat's nameplate
// (see `Nameplate.tsx`) displaying the seat's win-equity as a percent.
// Guarded by `resolveEquityOverlay(prop, viewer)` + the `useEquityQuery`
// `enabled` gate — see plan.md § "Equity Overlay — Enforcement Model".
//
// This file exposes:
//   - `<EquityBadge>` — dumb R3F leaf; given seat + equity it renders.
//   - `<EquityBadges>` — smart wrapper that subscribes to the equity
//     query and renders one `<EquityBadge>` per seat with hole cards.
//     Mounting is gated by `resolveEquityOverlay` and the ≥2 hole-card
//     rule (AC 3).
//   - pure helpers (`formatEquityPercent`,
//     `computeEquityBadgeWorldPosition`, `countSeatsWithHoleCards`) so
//     the behaviour is unit-testable without R3F / WebGL.

import { useMemo } from 'react';
import { Text } from '@react-three/drei';

import { seatAnchorLocalToWorld } from './tableLayout';
import { useEquityQuery } from '../data/useEquityQuery';
import { resolveEquityOverlay } from '../state/equityGuard';
import type { TableState, ViewerContext } from '../types';
import type { Vec3 } from '../animations/tweens';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/**
 * Vertical offset (world units) above the seat anchor. Sits below the
 * nameplate (which lives at y=0.6) but above the hole cards so both
 * labels are visible at the default camera preset.
 */
export const EQUITY_BADGE_LOCAL_Y = 0.35;

/** Font size (world units) — matches `<Nameplate>` for legibility parity. */
export const EQUITY_BADGE_FONT_SIZE = 0.08;

/** Width / height (world units) of the badge card. */
export const EQUITY_BADGE_WIDTH = 0.5;
export const EQUITY_BADGE_HEIGHT = 0.16;

/** Amber tint — distinguishes equity text from the nameplate's white. */
export const EQUITY_BADGE_COLOR = '#fbbf24';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Format a 0..1 equity value as a percentage string with one decimal.
 * Out-of-range inputs are clamped so we never render `NaN%` or negative
 * numbers, even if the backend misbehaves.
 */
export function formatEquityPercent(e: number): string {
  if (!Number.isFinite(e)) return '—';
  const pct = Math.max(0, Math.min(100, e * 100));
  return `${pct.toFixed(1)}%`;
}

/** World position of the badge for a given seat. */
export function computeEquityBadgeWorldPosition(
  seatIndex: number,
  seatCount: number,
): Vec3 {
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    0,
    EQUITY_BADGE_LOCAL_Y,
    0,
  ]);
}

/** Count seats that currently hold a pair of hole cards (AC 3). */
export function countSeatsWithHoleCards(state: TableState): number {
  let n = 0;
  for (const s of state.seats) if (s.holeCards != null) n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// <EquityBadge>
// ---------------------------------------------------------------------------

export interface EquityBadgeProps {
  seatIndex: number;
  seatCount: number;
  /** 0..1 — fraction of the pot this seat is expected to win. */
  equity: number;
}

/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function EquityBadge({ seatIndex, seatCount, equity }: EquityBadgeProps) {
  const worldPosition = useMemo<Vec3>(
    () => computeEquityBadgeWorldPosition(seatIndex, seatCount),
    [seatIndex, seatCount],
  );
  const label = formatEquityPercent(equity);

  return (
    <group
      name={`equity-badge-${seatIndex}`}
      position={worldPosition}
      userData={{ seatIndex, equity, label, testid: 'equity-badge' }}
    >
      <mesh name="equity-badge-card">
        <planeGeometry args={[EQUITY_BADGE_WIDTH, EQUITY_BADGE_HEIGHT]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.7} />
      </mesh>
      <Text
        name="equity-badge-text"
        position={[0, 0, 0.001]}
        fontSize={EQUITY_BADGE_FONT_SIZE}
        color={EQUITY_BADGE_COLOR}
        anchorX="center"
        anchorY="middle"
        maxWidth={EQUITY_BADGE_WIDTH * 0.9}
        textAlign="center"
      >
        {label}
      </Text>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <EquityBadges>
// ---------------------------------------------------------------------------

export interface EquityBadgesProps {
  state: TableState;
  viewer?: ViewerContext;
  /** Caller-supplied prop — merged with the viewer policy guard. */
  equityOverlay: boolean;
}

/**
 * Smart wrapper — subscribes to the equity endpoint and renders one
 * `<EquityBadge>` per seat whose player appears in the response.
 *
 * Rendering conditions (all must hold, per T-020 AC 3):
 *   1. `resolveEquityOverlay(equityOverlay, viewer) === true`
 *   2. `useEquityQuery` returned data (no network error)
 *   3. ≥2 seats currently hold hole cards
 *
 * On fetch failure the badge group silently hides (AC 5).
 */
export function EquityBadges({ state, viewer, equityOverlay }: EquityBadgesProps) {
  const allowed = resolveEquityOverlay(equityOverlay, viewer);
  const { data } = useEquityQuery({
    gameId: state.gameId,
    handNumber: state.handNumber,
    streetIndex: state.streetIndex,
    enabled: allowed,
  });

  if (!allowed) return null;
  if (!data) return null;
  if (countSeatsWithHoleCards(state) < 2) return null;

  const byName = new Map<string, number>();
  for (const entry of data.equities) {
    byName.set(entry.player_name, entry.equity);
  }

  const seatCount = state.seats.length;

  return (
    <group name="equity-badges">
      {state.seats.map((seat) => {
        if (!seat.playerName) return null;
        const eq = byName.get(seat.playerName);
        if (eq == null) return null;
        return (
          <EquityBadge
            key={`equity-badge-${seat.seatIndex}`}
            seatIndex={seat.seatIndex}
            seatCount={seatCount}
            equity={eq}
          />
        );
      })}
    </group>
  );
}

export default EquityBadge;
