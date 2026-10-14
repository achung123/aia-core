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
import { computeLabelScale } from '../components/labelScale';
import {
  SEAT_RING_OFFSET,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  computeSeatPosition,
} from '../components/tableLayout';

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

// --- Fit to viewport ---------------------------------------------------------
//
// Preset poses are authored for a landscape desktop canvas. On a portrait
// phone the same pose crops the table off both sides, and on a wide monitor
// it leaves the table tiny. `fitPoseToAspect` keeps the preset's viewing
// direction and slides the camera along it until the whole table — felt,
// seat ring and nameplates — just fills the frame.

/** How far past the seat ring the framed area extends (nameplates, badges). */
export const FIT_OUTER_MARGIN = 1.0;
/** Height of the tallest thing above the felt that must stay in frame. */
export const FIT_TOP_HEIGHT = 0.95;
/** Fraction of the frame the scene may occupy (leaves a little air). */
export const FIT_FILL = 0.94;

const FIT_SAMPLES = 24;

/**
 * Points the framed area must contain. `scale` is the size labels will be
 * drawn at: they sit outside the seat ring and grow with distance, so the
 * margin has to grow with them or the outer names are cut off.
 */
function fitSamplePoints(scale: number): Vec3[] {
  const margin = FIT_OUTER_MARGIN * scale;
  const rx = TABLE_RADIUS_X + SEAT_RING_OFFSET + margin;
  const rz = TABLE_RADIUS_Z + SEAT_RING_OFFSET + margin;
  const points: Vec3[] = [];
  for (let i = 0; i < FIT_SAMPLES; i++) {
    const angle = (i / FIT_SAMPLES) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const z = Math.sin(angle) * rz;
    points.push([x, 0, z], [x, FIT_TOP_HEIGHT * scale, z]);
  }
  return points;
}

/**
 * Move the camera along its viewing direction so the table fills a viewport
 * of the given aspect ratio (width / height). The direction and target are
 * unchanged; only the distance is. Returns the pose untouched when the
 * aspect is unknown or degenerate.
 */
/** Below this width/height ratio the screen is "portrait" for fitting. */
export const PORTRAIT_ASPECT = 0.85;

/** Looking (nearly) straight down at the table. */
function isOverheadPose(pose: CameraPresetPose): boolean {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  return py - ty > 6 && Math.hypot(px - tx, pz - tz) < 1;
}

/**
 * The table is a wide oval, so on a tall phone screen it is limited by its
 * width and leaves most of the canvas empty. Viewed from straight above, the
 * camera can simply be turned a quarter so the long side runs up the screen.
 * Cards and labels follow the camera, so nothing else needs to change.
 */
export function orientPoseForAspect(
  pose: CameraPresetPose,
  aspect: number | null | undefined,
): CameraPresetPose {
  if (!aspect || !Number.isFinite(aspect) || aspect >= PORTRAIT_ASPECT) return pose;
  if (!isOverheadPose(pose)) return pose;
  const [px, py, pz] = pose.position;
  const [tx, , tz] = pose.target;
  return {
    position: [tx + (pz - tz), py, tz - (px - tx)],
    target: pose.target,
  };
}

/**
 * Slide the camera along its current viewing direction until the framed area
 * fits. The view axis keeps passing through the pose's target.
 */
export function fitAlongViewDirection(
  pose: CameraPresetPose,
  aspect: number,
  fovDegrees: number,
): CameraPresetPose {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  let fx = tx - px;
  let fy = ty - py;
  let fz = tz - pz;
  const length = Math.hypot(fx, fy, fz);
  if (length === 0) return pose;
  fx /= length;
  fy /= length;
  fz /= length;

  // right = forward × worldUp; straight-down views have no horizontal
  // component, so fall back to +X (matches OrbitControls at azimuth 0).
  let rx = -fz;
  let rz = fx;
  const rLength = Math.hypot(rx, rz);
  // Only a view along the vertical axis exactly has no horizontal
  // direction; the overhead presets keep a small offset on purpose, and
  // that offset is what says which way is up on screen.
  if (rLength < 1e-9) {
    rx = 1;
    rz = 0;
  } else {
    rx /= rLength;
    rz /= rLength;
  }
  // up = right × forward
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;

  const tanV = Math.tan((fovDegrees * Math.PI) / 360) * FIT_FILL;
  const tanH = tanV * aspect;

  // The distance decides the label size and the label size decides the
  // distance; a few rounds settle it (the scale is capped, so it converges).
  let distance = 0;
  for (let round = 0; round < 4; round++) {
    const points = fitSamplePoints(computeLabelScale(distance));
    let needed = 0;
    for (const [x, y, z] of points) {
      const dx = x - tx;
      const dy = y - ty;
      const dz = z - tz;
      const along = dx * fx + dy * fy + dz * fz;
      const across = Math.abs(dx * rx + dz * rz);
      const up = Math.abs(dx * ux + dy * uy + dz * uz);
      needed = Math.max(needed, across / tanH - along, up / tanV - along);
    }
    if (Math.abs(needed - distance) < 0.01) {
      distance = needed;
      break;
    }
    distance = needed;
  }
  return {
    position: [tx - fx * distance, ty - fy * distance, tz - fz * distance],
    target: pose.target,
  };
}

// Projected-extent helpers -----------------------------------------------------

interface CameraBasis {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

function basisFor(position: Vec3, target: Vec3): CameraBasis | null {
  let fx = target[0] - position[0];
  let fy = target[1] - position[1];
  let fz = target[2] - position[2];
  const length = Math.hypot(fx, fy, fz);
  if (length === 0) return null;
  fx /= length;
  fy /= length;
  fz /= length;
  let rx = -fz;
  let rz = fx;
  const rLength = Math.hypot(rx, rz);
  if (rLength < 1e-9) {
    rx = 1;
    rz = 0;
  } else {
    rx /= rLength;
    rz /= rLength;
  }
  return {
    forward: [fx, fy, fz],
    right: [rx, 0, rz],
    up: [-rz * fy, rz * fx - rx * fz, rx * fy],
  };
}

interface ProjectedExtent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Where the framed points land in the camera's tangent plane (x/z, y/z). */
function projectExtent(position: Vec3, basis: CameraBasis, points: Vec3[]): ProjectedExtent {
  const extent = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [x, y, z] of points) {
    const dx = x - position[0];
    const dy = y - position[1];
    const dz = z - position[2];
    // Points at or behind the camera are pinned just in front so they push
    // the fit outward instead of flipping sign.
    const depth = Math.max(
      dx * basis.forward[0] + dy * basis.forward[1] + dz * basis.forward[2],
      0.25,
    );
    const across = (dx * basis.right[0] + dz * basis.right[2]) / depth;
    const up = (dx * basis.up[0] + dy * basis.up[1] + dz * basis.up[2]) / depth;
    extent.minX = Math.min(extent.minX, across);
    extent.maxX = Math.max(extent.maxX, across);
    extent.minY = Math.min(extent.minY, up);
    extent.maxY = Math.max(extent.maxY, up);
  }
  return extent;
}

/** How much of each dimension of the frame the framed area occupies (0–1+). */
export interface FitMeasure {
  fillX: number;
  fillY: number;
  /** Everything is inside the frame. */
  inside: boolean;
}

/** Test and diagnostics helper: how well `pose` frames the table at `aspect`. */
export function measureFit(
  pose: CameraPresetPose,
  aspect: number,
  fovDegrees: number,
): FitMeasure {
  const basis = basisFor(pose.position, pose.target);
  if (!basis) return { fillX: 0, fillY: 0, inside: false };
  const distance = Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2],
  );
  const extent = projectExtent(
    pose.position,
    basis,
    fitSamplePoints(computeLabelScale(distance)),
  );
  const tanV = Math.tan((fovDegrees * Math.PI) / 360);
  const tanH = tanV * aspect;
  const fillX = Math.max(Math.abs(extent.minX), Math.abs(extent.maxX)) / tanH;
  const fillY = Math.max(Math.abs(extent.minY), Math.abs(extent.maxY)) / tanV;
  return { fillX, fillY, inside: fillX <= 1 && fillY <= 1 };
}

/** The look direction is kept inside this range of angles from straight down. */
const CENTER_MIN_POLAR = (30 * Math.PI) / 180;
const CENTER_MAX_POLAR = (78 * Math.PI) / 180;

/**
 * Re-aim the camera at the middle of what is on screen, then move it along
 * the new axis until the framed area fills the frame.
 *
 * A camera low behind a seat sees the near seat large and the far side
 * small. Fitting symmetrically around a fixed look-at point lets the near
 * seat decide the distance and leaves the far side a small shape in the
 * middle of an empty frame; centring on the actual extent uses the space.
 */
export function centerFit(
  pose: CameraPresetPose,
  aspect: number,
  fovDegrees: number,
): CameraPresetPose {
  const tanV = Math.tan((fovDegrees * Math.PI) / 360) * FIT_FILL;
  const tanH = tanV * aspect;
  let position: Vec3 = [...pose.position];
  let target: Vec3 = [...pose.target];

  for (let round = 0; round < 8; round++) {
    const basis = basisFor(position, target);
    if (!basis) break;
    const distance = Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    );
    const points = fitSamplePoints(computeLabelScale(distance));
    const extent = projectExtent(position, basis, points);
    const centerX = (extent.minX + extent.maxX) / 2;
    const centerY = (extent.minY + extent.maxY) / 2;
    const halfX = (extent.maxX - extent.minX) / 2;
    const halfY = (extent.maxY - extent.minY) / 2;

    // Aim at the middle of the extent (damped, so a nearby seat cannot
    // fling the view around), keeping the pitch inside the orbit limits.
    let dirX = basis.forward[0] + centerX * basis.right[0] + centerY * basis.up[0];
    let dirY = basis.forward[1] + centerY * basis.up[1];
    let dirZ = basis.forward[2] + centerX * basis.right[2] + centerY * basis.up[2];
    const dirLength = Math.hypot(dirX, dirY, dirZ) || 1;
    dirX /= dirLength;
    dirY /= dirLength;
    dirZ /= dirLength;
    const horizontal = Math.hypot(dirX, dirZ);
    const polar = Math.atan2(horizontal, -dirY);
    const clamped = Math.min(Math.max(polar, CENTER_MIN_POLAR), CENTER_MAX_POLAR);
    if (clamped !== polar && horizontal > 1e-9) {
      const k = Math.sin(clamped) / horizontal;
      dirX *= k;
      dirZ *= k;
      dirY = -Math.cos(clamped);
    }

    // Distance: scale so the larger of the two fills the allowance.
    const needed = Math.max(halfX / tanH, halfY / tanV);
    const nextDistance = distance * Math.min(Math.max(needed, 0.7), 1.4);

    const nextTarget: Vec3 = [
      position[0] + dirX * distance,
      position[1] + dirY * distance,
      position[2] + dirZ * distance,
    ];
    // Back off along the new axis from the (moved) target by the new distance.
    position = [
      nextTarget[0] - dirX * nextDistance,
      nextTarget[1] - dirY * nextDistance,
      nextTarget[2] - dirZ * nextDistance,
    ];
    target = nextTarget;
    if (Math.abs(needed - 1) < 0.02 && Math.abs(centerX) < 0.01 && Math.abs(centerY) < 0.01) {
      break;
    }
  }
  return { position, target };
}

/**
 * Frame the whole table for a viewport of the given aspect (width / height).
 * Overhead views turn on portrait screens and slide along their axis; oblique
 * views (seat POV, the default perspective) are additionally re-centred.
 */
export function fitPoseToAspect(
  pose: CameraPresetPose,
  aspect: number | null | undefined,
  fovDegrees: number,
): CameraPresetPose {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return pose;
  const oriented = orientPoseForAspect(pose, aspect);
  const along = fitAlongViewDirection(oriented, aspect, fovDegrees);
  if (isOverheadPose(oriented)) return along;
  return centerFit(along, aspect, fovDegrees);
}

// --- Seat-POV geometry (T-022) ---------------------------------------------
//
// Seat POV places the camera directly behind the seat, slightly elevated,
// aimed at a point just above the felt center. Values tuned so seat-POV
// framing matches `PLAYER_CAMERA_CONFIG` (in `CameraRig.tsx`) when the
// target seat sits on the +Z axis.

/** Distance (world units) the camera sits behind the seat along the outward radial. */
export const SEAT_POV_BACK_OFFSET = 2.6;
/** Camera eye height above the felt, in world units. */
export const SEAT_POV_CAM_HEIGHT = 3.2;
/** Portrait phones need a steeper seat view so the table fills the tall canvas. */
export const SEAT_POV_PORTRAIT_CAM_HEIGHT = 5.0;
/** Portrait phone variant sits less far behind the player while keeping cards private. */
export const SEAT_POV_PORTRAIT_BACK_OFFSET = 1.5;
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
 * Seat-POV is intentionally low on landscape screens, but that same low
 * angle makes the oval fit by width on portrait phones and leaves a large
 * empty column above the table. For a portrait player canvas, keep the same
 * radial and target but lift the eye and move it closer to the seat so the
 * fitted camera is steeper without changing privacy policy or orbit clamps.
 */
export function steepenSeatPoseForAspect(
  pose: CameraPresetPose,
  aspect: number | null | undefined,
): CameraPresetPose {
  if (!aspect || !Number.isFinite(aspect) || aspect >= PORTRAIT_ASPECT) return pose;
  const [px, py, pz] = pose.position;
  const [tx, , tz] = pose.target;
  const dx = px - tx;
  const dz = pz - tz;
  const horizontal = Math.hypot(dx, dz);
  if (horizontal === 0) {
    return {
      position: [px, Math.max(py, SEAT_POV_PORTRAIT_CAM_HEIGHT), pz],
      target: pose.target,
    };
  }
  const backOffsetDelta = SEAT_POV_BACK_OFFSET - SEAT_POV_PORTRAIT_BACK_OFFSET;
  const adjustedHorizontal = Math.max(0, horizontal - backOffsetDelta);
  const scale = adjustedHorizontal / horizontal;
  return {
    position: [
      tx + dx * scale,
      Math.max(py, SEAT_POV_PORTRAIT_CAM_HEIGHT),
      tz + dz * scale,
    ],
    target: pose.target,
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
