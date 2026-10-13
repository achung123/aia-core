import * as THREE from 'three';

/** Default overhead camera position used by the poker scene. */
export const DEFAULT_OVERHEAD_POSITION = new THREE.Vector3(0, 18, 6);
/** Default camera look-at target (table center). */
export const DEFAULT_OVERHEAD_TARGET = new THREE.Vector3(0, 0, 0);

/** Height of the camera above the table when snapped to a seat. */
export const SEAT_CAMERA_HEIGHT = 8;
/** How far behind the seat the camera is placed (multiplier on seat vector). */
export const SEAT_CAMERA_BEHIND = 1.6;

/**
 * Compute a camera position and look-at target for viewing from a specific seat.
 * The camera sits above and behind the seat, looking toward the table center.
 */
export function computeSeatCameraPosition(seatPosition: THREE.Vector3): {
  position: THREE.Vector3;
  target: THREE.Vector3;
} {
  const position = new THREE.Vector3(
    seatPosition.x * SEAT_CAMERA_BEHIND,
    SEAT_CAMERA_HEIGHT,
    seatPosition.z * SEAT_CAMERA_BEHIND,
  );
  const target = new THREE.Vector3(0, 0, 0);
  return { position, target };
}

/**
 * Return the default overhead camera position and target.
 */
export function getDefaultCameraPosition(): {
  position: THREE.Vector3;
  target: THREE.Vector3;
} {
  return {
    position: DEFAULT_OVERHEAD_POSITION.clone(),
    target: DEFAULT_OVERHEAD_TARGET.clone(),
  };
}

/** Ease-in-out quad for smooth animation. */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export interface AnimateCameraOptions {
  duration?: number;
  onComplete?: () => void;
}

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  saveState: () => void;
}

/**
 * Smoothly animate the camera from its current position to a target position / look-at.
 * Returns a handle with `cancel()` to abort the animation.
 */
export function animateCameraToSeat(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike,
  targetPosition: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  options: AnimateCameraOptions = {},
): { cancel: () => void } {
  const duration = options.duration ?? 400;
  const onComplete = options.onComplete;

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  let startTime: number | null = null;
  let cancelled = false;
  let rafHandle = 0;

  function step(timestamp: number): void {
    if (cancelled) return;

    if (startTime === null) {
      startTime = timestamp;
      rafHandle = requestAnimationFrame(step);
      return;
    }

    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOutQuad(t);

    camera.position.lerpVectors(startPos, targetPosition, eased);
    controls.target.lerpVectors(startTarget, targetLookAt, eased);
    controls.update();
    camera.updateProjectionMatrix();

    if (t >= 1) {
      // Snap to exact targets
      camera.position.copy(targetPosition);
      controls.target.copy(targetLookAt);
      controls.update();
      controls.saveState();
      camera.updateProjectionMatrix();
      onComplete?.();
    } else {
      rafHandle = requestAnimationFrame(step);
    }
  }

  rafHandle = requestAnimationFrame(step);

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(rafHandle);
    },
  };
}
