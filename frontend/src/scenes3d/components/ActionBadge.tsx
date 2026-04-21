// T-017 — Action-status badge on nameplate.
//
// Renders a small pill below each occupied seat's nameplate showing the
// player's current-street action (S-3.2 / T-017 ACs):
//
//   1. Label text is one of: `check`, `call`, `bet $X`, `raise $X`,
//      `fold`, `all-in`.
//   2. Transient actions (`check`/`call`/`bet`/`raise`) clear at street
//      change; `fold` and `all-in` persist to hand end.
//   3. Missing / unrecognised action data renders nothing — never an
//      "undefined" placeholder.
//   4. No new backend endpoint; we rely on `TableState.seats[].lastAction`
//      which is populated by the adapter from the existing `/actions`
//      endpoint + `HandStatusResponse.players[].last_action`.
//
// Billboarding mirrors `<Nameplate>` so the badge always faces the
// active camera on every seat around the ellipse. The billboard helper
// and epsilon are shared verbatim with `<Nameplate>` / `<BetGlowOverlay>`
// so the badge stays orientation-locked to its parent nameplate.
//
// Consumed by `<PokerTable>`; must be mounted inside an R3F `<Canvas>`.

import { useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

import {
  BILLBOARD_EPSILON,
  NAMEPLATE_HEIGHT,
  NAMEPLATE_LOCAL_Y,
  NAMEPLATE_WIDTH,
  computeBillboardYRotation,
  formatStackAmount,
} from './Nameplate';
import { seatAnchorLocalToWorld } from './tableLayout';
import type { Vec3 } from '../animations/tweens';
import type { SeatState, TableStatePhase } from '../types';

// ---------------------------------------------------------------------------
// Layout constants (exported for tests)
// ---------------------------------------------------------------------------

/** Badge width (world units). Slightly narrower than the nameplate. */
export const ACTION_BADGE_WIDTH = NAMEPLATE_WIDTH * 0.82;
/** Badge height (world units). */
export const ACTION_BADGE_HEIGHT = 0.14;
/** Vertical gap between the nameplate's bottom edge and the badge's top. */
export const ACTION_BADGE_GAP = 0.04;
/**
 * Y-offset (world units) of the badge center — sits directly below the
 * nameplate, separated by `ACTION_BADGE_GAP`.
 */
export const ACTION_BADGE_LOCAL_Y =
  NAMEPLATE_LOCAL_Y
  - NAMEPLATE_HEIGHT / 2
  - ACTION_BADGE_GAP
  - ACTION_BADGE_HEIGHT / 2;
/** Font size of the badge label (world units). */
export const ACTION_BADGE_FONT_SIZE = 0.07;
/** Background colour of the badge card. */
export const ACTION_BADGE_BG_COLOR = '#1f2937';
/** Background opacity of the badge card. */
export const ACTION_BADGE_BG_OPACITY = 0.85;
/** Label colour of the badge text. */
export const ACTION_BADGE_TEXT_COLOR = '#f8fafc';

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Compose the human-readable badge label from a seat's `lastAction`.
 * Returns `null` when the action is missing, unrecognised, or otherwise
 * unrenderable — callers MUST treat a `null` result as "render no badge"
 * (AC 3: never emit an "undefined" placeholder).
 *
 * `bet` / `raise` include the committed amount when `amount > 0`; a
 * missing / non-positive amount falls back to the bare verb ("bet",
 * "raise") rather than `"bet $undefined"`.
 */
export function formatActionLabel(
  lastAction: SeatState['lastAction'],
): string | null {
  if (!lastAction) return null;
  switch (lastAction.action) {
    case 'check':
    case 'call':
    case 'fold':
      return lastAction.action;
    case 'all-in':
      return 'all-in';
    case 'bet':
    case 'raise': {
      const verb = lastAction.action;
      const amt = lastAction.amount;
      if (typeof amt === 'number' && amt > 0) {
        return `${verb} ${formatStackAmount(amt)}`;
      }
      return verb;
    }
    default:
      return null;
  }
}

/**
 * Gate badge visibility by the current street (AC 2). Transient
 * actions (`check`/`call`/`bet`/`raise`) render only while the action's
 * `street` matches the active phase; `fold` / `all-in` persist to hand
 * end and therefore render regardless of `currentPhase`.
 */
export function shouldShowBadge(
  lastAction: SeatState['lastAction'],
  currentPhase: TableStatePhase,
): boolean {
  if (!lastAction) return false;
  if (lastAction.action === 'fold' || lastAction.action === 'all-in') {
    return true;
  }
  return lastAction.street === currentPhase;
}

/** World position of a seat's action badge (below the nameplate). */
export function computeActionBadgeWorldPosition(
  seatIndex: number,
  seatCount: number,
): Vec3 {
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    0,
    ACTION_BADGE_LOCAL_Y,
    0,
  ]);
}

// ---------------------------------------------------------------------------
// <ActionBadge>
// ---------------------------------------------------------------------------

export interface ActionBadgeProps {
  seatIndex: number;
  seatCount: number;
  lastAction: SeatState['lastAction'];
  currentPhase: TableStatePhase;
}

/**
 * Billboarded action-status pill for one seat. Returns `null` when
 * `shouldShowBadge` or `formatActionLabel` reject the input (AC 3).
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function ActionBadge({
  seatIndex,
  seatCount,
  lastAction,
  currentPhase,
}: ActionBadgeProps) {
  const worldPosition = useMemo<Vec3>(
    () => computeActionBadgeWorldPosition(seatIndex, seatCount),
    [seatIndex, seatCount],
  );

  const [rotationY, setRotationY] = useState<number>(0);

  // Billboard about Y — mirrors <Nameplate>'s useFrame driver so the
  // badge stays locked to the active R3F camera azimuth.
  //
  // IMPORTANT: hooks must run unconditionally on every render, so this
  // `useFrame` is registered before the early-return below. When the
  // badge is hidden the rotation state simply is not read.
  useFrame((frameState: unknown) => {
    const fs = frameState as {
      camera?: { position?: { x: number; z: number } };
    };
    const camPos = fs?.camera?.position;
    if (
      !camPos
      || typeof camPos.x !== 'number'
      || typeof camPos.z !== 'number'
    ) {
      return;
    }
    const target = computeBillboardYRotation(camPos, {
      x: worldPosition[0],
      z: worldPosition[2],
    });
    setRotationY((prev) =>
      Math.abs(prev - target) < BILLBOARD_EPSILON ? prev : target,
    );
  });

  const visible = shouldShowBadge(lastAction, currentPhase);
  const label = visible ? formatActionLabel(lastAction) : null;
  if (!label) return null;

  return (
    <group
      name={`action-badge-${seatIndex}`}
      position={worldPosition}
      rotation={[0, rotationY, 0]}
      userData={{
        seatIndex,
        label,
        action: lastAction?.action ?? null,
        amount: lastAction?.amount ?? null,
        street: lastAction?.street ?? null,
        currentPhase,
      }}
    >
      <mesh name="action-badge-card">
        <planeGeometry
          args={[ACTION_BADGE_WIDTH, ACTION_BADGE_HEIGHT]}
        />
        <meshBasicMaterial
          color={ACTION_BADGE_BG_COLOR}
          transparent
          opacity={ACTION_BADGE_BG_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <Text
        name="action-badge-text"
        position={[0, 0, 0.001]}
        fontSize={ACTION_BADGE_FONT_SIZE}
        color={ACTION_BADGE_TEXT_COLOR}
        anchorX="center"
        anchorY="middle"
        maxWidth={ACTION_BADGE_WIDTH * 0.92}
        textAlign="center"
        lineHeight={1.1}
      >
        {label}
      </Text>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <ActionBadges> composer
// ---------------------------------------------------------------------------

export interface ActionBadgesProps {
  seats: ReadonlyArray<{
    seatIndex: number;
    playerName: string | null;
    isActive: boolean;
    lastAction: SeatState['lastAction'];
  }>;
  seatCount: number;
  currentPhase: TableStatePhase;
}

/**
 * Convenience wrapper mirroring `<Nameplates>` — renders one
 * `<ActionBadge>` per occupied seat. Inactive / empty seats render
 * nothing (AC 3).
 */
export function ActionBadges({
  seats,
  seatCount,
  currentPhase,
}: ActionBadgesProps) {
  return (
    <group name="action-badges">
      {seats.map((seat) => {
        const occupied =
          seat.isActive
          && !!seat.playerName
          && seat.playerName.trim().length > 0;
        if (!occupied) return null;
        return (
          <ActionBadge
            key={`action-badge-${seat.seatIndex}`}
            seatIndex={seat.seatIndex}
            seatCount={seatCount}
            lastAction={seat.lastAction}
            currentPhase={currentPhase}
          />
        );
      })}
    </group>
  );
}

export default ActionBadge;
