import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface ViewerUprightProps {
  /**
   * Yaw (radians) already applied by ancestors — e.g. the seat group's
   * rotation — so it can be cancelled out.
   */
  parentYaw?: number;
  children?: ReactNode;
}

const scratch = new THREE.Vector3();

/**
 * World yaw that makes a card lying flat on the table read upright on
 * screen: its top edge points along the camera's "up" as projected onto the
 * felt. Falls back to the camera's forward direction when it looks along
 * the horizon. Exported for tests.
 */
export function computeUprightYaw(cameraQuaternion: THREE.Quaternion): number {
  scratch.set(0, 1, 0).applyQuaternion(cameraQuaternion);
  let x = scratch.x;
  let z = scratch.z;
  if (Math.hypot(x, z) < 0.05) {
    scratch.set(0, 0, -1).applyQuaternion(cameraQuaternion);
    x = scratch.x;
    z = scratch.z;
  }
  // A flat card's top edge points along world −Z at yaw 0.
  return Math.atan2(-x, -z);
}

/**
 * Keeps flat-lying children (cards) upright for whoever is looking, however
 * the seat is turned and wherever the camera orbits. Without it, cards at
 * the side seats read sideways and the far seats' cards read upside down.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function ViewerUpright({ parentYaw = 0, children }: ViewerUprightProps) {
  const ref = useRef<THREE.Group | null>(null);
  useFrame((state: unknown) => {
    const camera = (state as { camera?: { quaternion?: THREE.Quaternion } } | undefined)?.camera;
    const group = ref.current;
    if (!group?.rotation || !(camera?.quaternion instanceof THREE.Quaternion)) return;
    group.rotation.y = computeUprightYaw(camera.quaternion) - parentYaw;
  });
  return (
    <group ref={ref} name="viewer-upright" rotation={[0, -parentYaw, 0]}>
      {children}
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

export default ViewerUpright;
