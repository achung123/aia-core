// Screen-facing labels (nameplate, action badge, equity badge).
//
// The labels used to turn about the vertical axis only. That works for a
// camera near table height, but from the top-down and high-angle presets a
// vertical plane is seen edge-on and collapses to a sliver. Labels now copy
// the camera's full orientation, grow with distance so they stay readable
// on a phone, and stack along the *screen's* up direction rather than the
// world's — otherwise three labels above one seat all land on the same
// pixels when seen from above.

import * as THREE from 'three';

/** Label scale per world unit of camera distance, and its limits. */
export const LABEL_SCALE_PER_DISTANCE = 0.12;
export const LABEL_MIN_SCALE = 1;
export const LABEL_MAX_SCALE = 2.4;
/** World units a label moves away from the table centre per unit of scale. */
export const LABEL_OUTWARD_SHIFT = 0.3;

export function computeLabelScale(distance: number): number {
  return Math.min(
    LABEL_MAX_SCALE,
    Math.max(LABEL_MIN_SCALE, distance * LABEL_SCALE_PER_DISTANCE),
  );
}

const up = new THREE.Vector3();

type Vec3 = readonly [number, number, number];

/**
 * Orient `target` to face the camera, scale it by distance, and place it at
 * `anchor` shifted `screenOffset` label-units along the screen's vertical.
 *
 * The shift goes *away from the table centre as seen on screen*: up for
 * seats in the top half of the picture, down for seats in the bottom half.
 * That keeps badges off the hole cards, which always sit on the table side
 * of the nameplate.
 *
 * Returns false — leaving the target untouched — unless both objects are
 * real three.js instances; unit tests exercise the yaw-only fallback with
 * plain mocks.
 */
export function faceScreen(
  target: unknown,
  camera: unknown,
  anchor: Vec3,
  screenOffset = 0,
): boolean {
  if (!(target instanceof THREE.Object3D) || !(camera instanceof THREE.Camera)) {
    return false;
  }
  target.quaternion.copy(camera.quaternion);
  const scale = computeLabelScale(
    Math.hypot(
      camera.position.x - anchor[0],
      camera.position.y - anchor[1],
      camera.position.z - anchor[2],
    ),
  );
  target.scale.setScalar(scale);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  // Is this seat above or below the table centre on screen?
  const towardTop = anchor[0] * up.x + anchor[2] * up.z;
  const direction = towardTop < -0.05 ? -1 : 1;
  up.multiplyScalar(Math.abs(screenOffset) * scale * direction);
  // Slide the label outward from the table as it grows, so a large label
  // at a side seat does not cover that seat's hole cards.
  const radius = Math.hypot(anchor[0], anchor[2]);
  const outward = radius > 0 ? (LABEL_OUTWARD_SHIFT * scale) / radius : 0;
  target.position.set(
    anchor[0] * (1 + outward) + up.x,
    anchor[1] + up.y,
    anchor[2] * (1 + outward) + up.z,
  );
  return true;
}
