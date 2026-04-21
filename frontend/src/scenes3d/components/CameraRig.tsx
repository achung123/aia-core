import { useMemo } from 'react';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { TOUCH } from 'three';
import type { ViewerContext } from '../types';

type Vec3 = [number, number, number];

/**
 * Orbit/zoom clamps + feature toggles that are forwarded onto drei's
 * `<OrbitControls>`. Kept as a plain object so `<CameraRig>` (and future
 * preset drivers in T-021 / T-022) can compose / override individual fields
 * without re-deriving the whole shape.
 */
export interface OrbitConfig {
  enableDamping: boolean;
  dampingFactor: number;
  enableZoom: boolean;
  enablePan: boolean;
  enableRotate: boolean;
  /** Minimum zoom distance from `target` (world units). */
  minDistance: number;
  /** Maximum zoom distance from `target` (world units). */
  maxDistance: number;
  /**
   * Polar (pitch) angle measured from the +Y axis.
   * `0` = straight down, `π/2` = horizon. We clamp between these to keep the
   * camera above the table surface.
   */
  minPolarAngle: number;
  maxPolarAngle: number;
  /** Azimuth (yaw) bounds. `±Infinity` allows free rotation. */
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
}

export interface CameraRigConfig {
  position: Vec3;
  target: Vec3;
  fov: number;
  orbit: OrbitConfig;
}

/**
 * Spectator / dealer-embed / playback default preset.
 *
 * Free orbit with a moderate damping factor tuned for touch input, pitch
 * clamped above the horizon (no seeing under the felt), and a zoom range
 * that keeps the full table in frame on a 360px-wide phone viewport.
 */
export const SPECTATOR_CAMERA_CONFIG: CameraRigConfig = {
  position: [0, 6, 8],
  target: [0, 0, 0],
  fov: 45,
  orbit: {
    enableDamping: true,
    dampingFactor: 0.08,
    enableZoom: true,
    enablePan: true,
    enableRotate: true,
    minDistance: 4,
    maxDistance: 14,
    // ~20°: leave a little pitch at the "top-down" extreme so the table edge
    // stays visible and the controller doesn't gimbal-lock.
    minPolarAngle: Math.PI / 9,
    // ~81°: stop short of horizontal so the camera never dips below the felt.
    maxPolarAngle: Math.PI * 0.45,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
  },
};

/**
 * Player-POV preset. Extended by T-022 / T-026; T-008 only guarantees the
 * clamps — seat-specific position is injected by the caller.
 *
 * S-5.2: ±30° yaw, limited pitch, tightened zoom so a player cannot dolly
 * out and peek behind opponents.
 */
export const PLAYER_CAMERA_CONFIG: CameraRigConfig = {
  position: [0, 2.4, 4.5],
  target: [0, 0, 0],
  fov: 50,
  orbit: {
    enableDamping: true,
    dampingFactor: 0.08,
    enableZoom: true,
    enablePan: false,
    enableRotate: true,
    minDistance: 3,
    maxDistance: 6,
    minPolarAngle: Math.PI / 4,
    maxPolarAngle: Math.PI * 0.425,
    minAzimuthAngle: -Math.PI / 6,
    maxAzimuthAngle: Math.PI / 6,
  },
};

/**
 * Resolve the base camera-rig config for a given viewer context.
 * Undefined / spectator viewers fall back to the spectator preset.
 */
export function getCameraRigConfig(viewer?: ViewerContext): CameraRigConfig {
  if (viewer?.policy === 'player') return PLAYER_CAMERA_CONFIG;
  return SPECTATOR_CAMERA_CONFIG;
}

export interface CameraRigProps {
  /**
   * Viewer policy. `'spectator'` (default) enables free orbit with the
   * spectator clamps; `'player'` applies the ±30° yaw + no-pan lockdown.
   */
  viewer?: ViewerContext;
  /** Override the camera world position. Defaults to the preset's position. */
  position?: Vec3;
  /**
   * OrbitControls target. Changing this prop smoothly re-centers the camera
   * because `enableDamping` is on — drei forwards the new target and the
   * internal controller interpolates toward it.
   */
  target?: Vec3;
  /** Override the camera field of view. Defaults to the preset's fov. */
  fov?: number;
  /**
   * World-space azimuth center for the orbit yaw clamp, in radians.
   *
   * When provided, the rig overrides the viewer-preset's azimuth bounds to
   * `[yawCenter − π/6, yawCenter + π/6]`, keeping the ±30° cone aligned
   * with the seat's outward radial regardless of the seat's world angle.
   * Consumed by `<CameraPresetController>` for the T-022 seat-POV preset;
   * resolves Cycle 14 MED-1 (privacy leak for non-+Z-facing seats).
   *
   * `null` / `undefined` — fall back to the policy's clamps (free orbit for
   * spectator; the default ±π/6 around world-yaw 0 for player policy).
   */
  yawCenter?: number | null;
  /** Install the camera + controls as R3F defaults. Defaults to true. */
  makeDefault?: boolean;
  /**
   * Fired when the user starts interacting with OrbitControls (drag / pinch).
   * Wired into drei's `onStart` event. Used by `<CameraPresetController>`
   * to yield the cinematic orbit on user input (T-021 AC 3).
   */
  onUserInteract?: () => void;
}

/**
 * Declarative camera rig: drei `<PerspectiveCamera>` + `<OrbitControls>`
 * configured from a `ViewerContext`.
 *
 * Consumed by `<PokerTable>` (T-009) and extended by the preset driver in
 * T-021 / T-022. The rig itself is policy-aware but stateless — presets will
 * drive it by overriding `position` / `target` props and animating them.
 */
export function CameraRig({
  viewer,
  position,
  target,
  fov,
  yawCenter,
  makeDefault = true,
  onUserInteract,
}: CameraRigProps) {
  const base = useMemo(() => getCameraRigConfig(viewer), [viewer]);
  const effPosition = position ?? base.position;
  const effTarget = target ?? base.target;
  const effFov = fov ?? base.fov;

  // Single-finger rotates; two-finger pinch dollies + pans simultaneously.
  // Memoized so drei/three doesn't see a new touches object every render.
  const touches = useMemo(
    () => ({ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }),
    [],
  );

  const o = base.orbit;
  // Seat-POV (T-022) supplies a world-space yaw center so the ±30° clamp
  // tracks the seat's outward radial. When present, we also override the
  // pitch / zoom / pan fields with the seat-POV (player-preset) values so
  // the constraint holds regardless of viewer policy (task AC 2) — e.g.,
  // the toolbar-invoked seat POV from playback runs with a spectator viewer
  // but must still apply the tightened orbit.
  const seatPov = yawCenter != null;
  const yawHalfWidth = Math.PI / 6;
  const minAzimuthAngle = seatPov ? yawCenter - yawHalfWidth : o.minAzimuthAngle;
  const maxAzimuthAngle = seatPov ? yawCenter + yawHalfWidth : o.maxAzimuthAngle;
  const minPolarAngle = seatPov ? PLAYER_CAMERA_CONFIG.orbit.minPolarAngle : o.minPolarAngle;
  const maxPolarAngle = seatPov ? PLAYER_CAMERA_CONFIG.orbit.maxPolarAngle : o.maxPolarAngle;
  const minDistance = seatPov ? PLAYER_CAMERA_CONFIG.orbit.minDistance : o.minDistance;
  const maxDistance = seatPov ? PLAYER_CAMERA_CONFIG.orbit.maxDistance : o.maxDistance;
  const enablePan = seatPov ? false : o.enablePan;

  return (
    <>
      <PerspectiveCamera
        makeDefault={makeDefault}
        position={effPosition}
        fov={effFov}
        near={0.1}
        far={100}
      />
      <OrbitControls
        makeDefault={makeDefault}
        target={effTarget}
        enableDamping={o.enableDamping}
        dampingFactor={o.dampingFactor}
        enableZoom={o.enableZoom}
        enablePan={enablePan}
        enableRotate={o.enableRotate}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={minPolarAngle}
        maxPolarAngle={maxPolarAngle}
        minAzimuthAngle={minAzimuthAngle}
        maxAzimuthAngle={maxAzimuthAngle}
        touches={touches}
        onStart={onUserInteract}
      />
    </>
  );
}

export default CameraRig;
