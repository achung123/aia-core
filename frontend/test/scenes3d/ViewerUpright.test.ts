import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeUprightYaw } from '../../src/scenes3d/components/ViewerUpright';

function cameraLookingAtOrigin(from: [number, number, number]): THREE.Quaternion {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...from);
  camera.lookAt(0, 0, 0);
  return camera.quaternion;
}

describe('computeUprightYaw', () => {
  it('needs no turn for the default camera in front of the table', () => {
    expect(computeUprightYaw(cameraLookingAtOrigin([0, 6, 8]))).toBeCloseTo(0, 6);
  });

  it('turns a quarter when the camera orbits to the side', () => {
    const yaw = computeUprightYaw(cameraLookingAtOrigin([8, 6, 0]));
    expect(Math.abs(yaw)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('turns half way round when viewed from behind', () => {
    const yaw = computeUprightYaw(cameraLookingAtOrigin([0, 6, -8]));
    expect(Math.abs(yaw)).toBeCloseTo(Math.PI, 6);
  });

  it('stays defined for a camera looking along the horizon', () => {
    expect(computeUprightYaw(cameraLookingAtOrigin([0, 0, 8]))).toBeCloseTo(0, 6);
  });
});
