import type { ReactNode } from 'react';
import {
  computeSeatPosition,
  computeSeatRotationY,
  seatOpacity,
  SEAT_PAD_THICKNESS,
} from './tableLayout';
import { FOLDED_PAD_OPACITY } from './SeatHighlight';

export interface SeatProps {
  /** Zero-based seat index around the table. */
  seatIndex: number;
  /** Total seat count on the table (drives angular spacing). */
  seatCount: number;
  /** Player occupying the seat, if any. */
  playerName?: string | null;
  /** Whether the seat has an active player. Inactive seats render dimmed. */
  isActive?: boolean;
  /**
   * T-018 — whether the seat's player has folded this hand. Folded seats
   * render the pad (and, via `<Nameplate folded>`, the nameplate) at
   * `FOLDED_PAD_OPACITY` / `FOLDED_NAMEPLATE_OPACITY` (AC 1).
   */
  folded?: boolean;
  /** Child primitives anchored at the seat (cards, chip stacks, nameplate). */
  children?: ReactNode;
}

const SEAT_PAD_RADIUS = 0.45;

/**
 * A single seat anchor around the table.
 *
 * Positions itself on the elliptical seat ring defined by `tableLayout.ts`,
 * mirroring the legacy `computeSeatPositions`. The seat group is rotated so
 * its local +Z points toward the table center, which lets child components
 * (cards, nameplate, chip stack) lay themselves out in a seat-local frame.
 * When `isActive` is false, the pad renders at reduced opacity. When the
 * seat's player is folded (T-018 AC 1), the pad further dims to
 * `FOLDED_PAD_OPACITY`.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function Seat({
  seatIndex,
  seatCount,
  playerName = null,
  isActive = true,
  folded = false,
  children,
}: SeatProps) {
  const position = computeSeatPosition(seatIndex, seatCount);
  const rotationY = computeSeatRotationY(seatIndex, seatCount);
  const baseOpacity = seatOpacity(isActive);
  // Fold-dim wins over the active/inactive base when it's smaller.
  const opacity = folded ? Math.min(baseOpacity, FOLDED_PAD_OPACITY) : baseOpacity;
  const occupied = isActive && !!playerName;

  return (
    <group
      name={`seat-${seatIndex}`}
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{
        seatIndex,
        seatCount,
        playerName,
        isActive,
        folded,
        occupied,
      }}
    >
      <mesh name="seat-pad" position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SEAT_PAD_RADIUS, 32]} />
        <meshStandardMaterial
          color="#2a2a2a"
          transparent
          opacity={opacity}
          roughness={0.9}
          metalness={0}
          depthWrite={opacity >= 1}
        />
      </mesh>
      <group name="seat-anchor" position={[0, SEAT_PAD_THICKNESS, 0]}>
        {children}
      </group>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

export default Seat;
