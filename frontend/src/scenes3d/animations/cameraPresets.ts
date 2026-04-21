// Camera preset configs + pure state machine for T-021 (camera presets:
// top-down / default / cinematic). Consumed by <CameraPresetController>
// and <CameraPresetToolbar>.
//
// Design:
//   * Framework-free core (`createCameraPresetState`) so the tween + orbit
//     behaviour is unit-testable without R3F or a real clock.
//   * `<CameraPresetController>` wraps this machine in a `useFrame` loop and
//     feeds the current `position` / `target` down to `<CameraRig>`.
//   * Cinematic orbit yields permanently on user input (spec AC 3); the
//     state machine exposes `interrupt()` so the driver can wire it to
//     OrbitControls' `start` event.

import type { Vec3 } from './tweens';
import { easeOutCubic, lerpVec3 } from './tweens';
import { computeSeatPosition } from '../components/tableLayout';

export type CameraPresetName = 'default' | 'topDown' | 'cinematic';

/**
 * Seat-POV variant — T-022. `seat` is the seat index the camera should be
 * positioned behind; `seatCount` is the total seats in the current
 * `TableState` (needed to resolve the seat's world angle).
 */
export interface SeatCameraPreset {
  readonly kind: 'seat';
  readonly seat: number;
  readonly seatCount: number;
}

/**
 * Full camera-preset selector accepted by `createCameraPresetState` /
 * `<CameraPresetController>`. Named presets come from the static table
 * `CAMERA_PRESETS`; seat-POV poses are derived from the seat ring geometry
 * via `computeSeatPresetPose`.
 */
export type CameraPreset = CameraPresetName | SeatCameraPreset;

export const CAMERA_PRESET_NAMES: readonly CameraPresetName[] = [
  'default',
  'topDown',
  'cinematic',
] as const;

/** Duration of a preset tween, in milliseconds. Spec: "~600ms". */
export const CAMERA_PRESET_TRANSITION_MS = 600;

/** Cinematic orbit angular velocity, in radians per second. 2π / 30s. */
export const CINEMATIC_ORBIT_RAD_PER_SEC = (2 * Math.PI) / 30;

export interface CameraPresetPose {
  position: Vec3;
  target: Vec3;
}

/**
 * Pose table — position + target for each T-021 preset.
 *
 * `default` matches the spectator starting pose in
 * `SPECTATOR_CAMERA_CONFIG`. `topDown` is an above-table view with a tiny
 * z-offset to avoid OrbitControls' gimbal-lock at polar=0. `cinematic`
 * seeds the slow orbit — the state machine treats `position` as the start
 * of the orbit ring and preserves (radius, height) while advancing the
 * azimuth each frame.
 */
export const CAMERA_PRESETS: Record<CameraPresetName, CameraPresetPose> = {
  default: { position: [0, 6, 8], target: [0, 0, 0] },
  topDown: { position: [0, 12, 0.01], target: [0, 0, 0] },
  cinematic: { position: [9, 5, 0], target: [0, 0, 0] },
};

// --- Seat-POV geometry (T-022) ---------------------------------------------
//
// Seat POV places the camera directly behind the seat, slightly elevated,
// aimed at a point just above the felt center. Values tuned so seat-POV
// framing matches `PLAYER_CAMERA_CONFIG` (in `CameraRig.tsx`) when the
// target seat sits on the +Z axis.

/** Distance (world units) the camera sits behind the seat along the outward radial. */
export const SEAT_POV_BACK_OFFSET = 1.7;
/** Camera eye height above the felt, in world units. */
export const SEAT_POV_CAM_HEIGHT = 2.4;
/** Look-at target height above the felt (raises aim a touch above board level). */
export const SEAT_POV_TARGET_HEIGHT = 0.3;
/** Azimuth half-width of the seat-POV orbit clamp (±π/6 = ±30°). */
export const SEAT_POV_YAW_HALF_WIDTH = Math.PI / 6;

/**
 * Compute the seat-POV pose for `(seat, seatCount)`.
 *
 * Camera position = seatWorldPos + outwardUnit · BACK_OFFSET + (0, HEIGHT, 0);
 * outwardUnit is the XZ-plane unit vector from the table center toward the
 * seat. Target is `(0, TARGET_HEIGHT, 0)`.
 */
export function computeSeatPresetPose(
  seat: number,
  seatCount: number,
): CameraPresetPose {
  const [sx, , sz] = computeSeatPosition(seat, seatCount);
  const d = Math.hypot(sx, sz);
  // Guard against d === 0 (degenerate layout); fall back to +Z outward.
  const ox = d > 0 ? sx / d : 0;
  const oz = d > 0 ? sz / d : 1;
  return {
    position: [
      sx + ox * SEAT_POV_BACK_OFFSET,
      SEAT_POV_CAM_HEIGHT,
      sz + oz * SEAT_POV_BACK_OFFSET,
    ],
    target: [0, SEAT_POV_TARGET_HEIGHT, 0],
  };
}

/**
 * Compute the world-space yaw center for the seat-POV orbit clamp.
 *
 * Three.js `Spherical` measures azimuth as `atan2(x, z)` of the camera
 * position relative to the orbit target. The seat-POV camera sits along
 * the outward radial from the target, so its natural azimuth equals
 * `atan2(seat.x, seat.z)`. `<CameraRig yawCenter={...}>` expresses the
 * ±30° clamp as `[yawCenter − π/6, yawCenter + π/6]`, decoupling the
 * clamp from world orientation (resolves Cycle 14 MED-1).
 */
export function computeSeatYawCenter(seat: number, seatCount: number): number {
  const [sx, , sz] = computeSeatPosition(seat, seatCount);
  return Math.atan2(sx, sz);
}

/**
 * Look up the pose for any `CameraPreset`. Named presets hit the static
 * table; seat presets route through `computeSeatPresetPose`.
 */
export function resolveCameraPresetPose(p: CameraPreset): CameraPresetPose {
  if (typeof p === 'string') return CAMERA_PRESETS[p];
  return computeSeatPresetPose(p.seat, p.seatCount);
}

function presetsEqual(a: CameraPreset, b: CameraPreset): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.kind === b.kind && a.seat === b.seat && a.seatCount === b.seatCount;
}

export interface CameraPresetStateOptions {
  /** Initial preset. Defaults to `'default'`. */
  preset?: CameraPreset;
  /** When true, setPreset snaps (no tween) and cinematic does not auto-orbit. */
  reducedMotion?: boolean;
  /** Override the transition duration for tests. */
  transitionMs?: number;
}

export interface CameraPresetState {
  readonly preset: CameraPreset;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly isTransitioning: boolean;
  readonly isCinematicOrbiting: boolean;
  /**
   * World-space azimuth center for the orbit clamp when the active preset is
   * seat-POV; `null` for named presets (caller should use its default
   * policy-driven clamps).
   */
  readonly yawCenter: number | null;
  /** Begin transitioning toward the preset. No-op if already there and idle. */
  setPreset: (preset: CameraPreset) => void;
  /** Advance the state machine by `dtMs` (from a useFrame loop or tests). */
  tick: (dtMs: number) => void;
  /** User interaction (OrbitControls drag/pinch). Yields the cinematic orbit. */
  interrupt: () => void;
}

/**
 * Build a pure preset state machine. The returned object is mutable — call
 * `setPreset`, `tick`, and `interrupt` on it. The `<CameraPresetController>`
 * wraps this in React state + a useFrame loop so position/target updates
 * flow down to the camera.
 */
export function createCameraPresetState(
  opts: CameraPresetStateOptions = {},
): CameraPresetState {
  const transitionMs = Math.max(
    0,
    opts.transitionMs ?? CAMERA_PRESET_TRANSITION_MS,
  );
  const reducedMotion = !!opts.reducedMotion;

  let preset: CameraPreset = opts.preset ?? 'default';
  const initialPose = resolveCameraPresetPose(preset);
  let position: Vec3 = [...initialPose.position];
  let target: Vec3 = [...initialPose.target];

  let transition:
    | {
        from: { position: Vec3; target: Vec3 };
        to: { position: Vec3; target: Vec3 };
        elapsed: number;
      }
    | null = null;

  // Cinematic orbit bookkeeping — radius/height are captured from the
  // cinematic preset's starting position so the orbit preserves them
  // regardless of where the tween landed.
  let cinematicActive = false;
  let orbitAngle = 0;
  let orbitRadius = 0;
  let orbitHeight = 0;

  function beginCinematicOrbit() {
    cinematicActive = true;
    const [x, y, z] = CAMERA_PRESETS.cinematic.position;
    orbitRadius = Math.hypot(x, z);
    orbitHeight = y;
    orbitAngle = Math.atan2(z, x);
  }

  if (preset === 'cinematic' && !reducedMotion) {
    beginCinematicOrbit();
  }

  return {
    get preset() {
      return preset;
    },
    get position() {
      return position;
    },
    get target() {
      return target;
    },
    get isTransitioning() {
      return transition !== null;
    },
    get isCinematicOrbiting() {
      return cinematicActive;
    },
    get yawCenter() {
      if (typeof preset === 'string') return null;
      return computeSeatYawCenter(preset.seat, preset.seatCount);
    },
    setPreset(next: CameraPreset) {
      if (presetsEqual(next, preset) && transition === null) return;
      preset = next;
      // Any pending cinematic orbit is cancelled until we arrive.
      cinematicActive = false;

      const dest = resolveCameraPresetPose(next);
      if (reducedMotion || transitionMs === 0) {
        position = [...dest.position];
        target = [...dest.target];
        transition = null;
        if (next === 'cinematic' && !reducedMotion) beginCinematicOrbit();
        return;
      }

      transition = {
        from: {
          position: [position[0], position[1], position[2]],
          target: [target[0], target[1], target[2]],
        },
        to: {
          position: [...dest.position],
          target: [...dest.target],
        },
        elapsed: 0,
      };
    },
    tick(dtMs: number) {
      if (dtMs <= 0) return;

      if (transition) {
        transition.elapsed += dtMs;
        const raw = Math.min(1, transition.elapsed / transitionMs);
        const eased = easeOutCubic(raw);
        position = lerpVec3(
          transition.from.position,
          transition.to.position,
          eased,
        );
        target = lerpVec3(
          transition.from.target,
          transition.to.target,
          eased,
        );
        if (raw >= 1) {
          position = [...transition.to.position];
          target = [...transition.to.target];
          transition = null;
          if (preset === 'cinematic' && !reducedMotion) beginCinematicOrbit();
        }
        return;
      }

      if (cinematicActive) {
        orbitAngle += (CINEMATIC_ORBIT_RAD_PER_SEC * dtMs) / 1000;
        position = [
          orbitRadius * Math.cos(orbitAngle),
          orbitHeight,
          orbitRadius * Math.sin(orbitAngle),
        ];
      }
    },
    interrupt() {
      cinematicActive = false;
    },
  };
}
