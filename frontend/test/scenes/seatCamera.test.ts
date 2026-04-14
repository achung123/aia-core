/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Three.js
vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    lerpVectors(a: Vector3, b: Vector3, t: number) {
      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.z = a.z + (b.z - a.z) * t;
      return this;
    }
  }
  class PerspectiveCamera {
    position = new Vector3(0, 14, 3);
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
  }
  return { Vector3, PerspectiveCamera };
});

import * as THREE from 'three';
import {
  computeSeatCameraPosition,
  animateCameraToSeat,
  getDefaultCameraPosition,
  DEFAULT_OVERHEAD_POSITION,
  DEFAULT_OVERHEAD_TARGET,
  SEAT_CAMERA_HEIGHT,
  SEAT_CAMERA_BEHIND,
} from '../../src/../src/scenes/seatCamera.ts';

describe('computeSeatCameraPosition', () => {
  it('returns position above and behind the seat, looking toward center', () => {
    // Seat 0 is at roughly (4.3, 0, 0) for a 10-seat table
    const seatPos = new THREE.Vector3(4.3, 0, 0);
    const { position, target } = computeSeatCameraPosition(seatPos);

    // Camera should be elevated (y > 0)
    expect(position.y).toBeGreaterThan(0);
    // Camera should be farther from center than the seat (behind the player)
    const seatDist = Math.sqrt(seatPos.x ** 2 + seatPos.z ** 2);
    const camDist = Math.sqrt(position.x ** 2 + position.z ** 2);
    expect(camDist).toBeGreaterThan(seatDist);
    // Target should be near the table center
    expect(Math.abs(target.x)).toBeLessThan(1);
    expect(Math.abs(target.z)).toBeLessThan(1);
  });

  it('produces different positions for different seats', () => {
    const seat0 = new THREE.Vector3(4.3, 0, 0);
    const seat5 = new THREE.Vector3(-4.3, 0, 0);
    const cam0 = computeSeatCameraPosition(seat0);
    const cam5 = computeSeatCameraPosition(seat5);

    expect(cam0.position.x).not.toBeCloseTo(cam5.position.x, 1);
  });

  it('works for a seat at the side of the table (z != 0)', () => {
    const seatSide = new THREE.Vector3(0, 0, 2.8);
    const { position } = computeSeatCameraPosition(seatSide);

    expect(position.y).toBeGreaterThan(0);
    expect(position.z).toBeGreaterThan(seatSide.z);
  });
});

describe('getDefaultCameraPosition', () => {
  it('returns the overhead camera position and target', () => {
    const { position, target } = getDefaultCameraPosition();

    expect(position.x).toBe(DEFAULT_OVERHEAD_POSITION.x);
    expect(position.y).toBe(DEFAULT_OVERHEAD_POSITION.y);
    expect(position.z).toBe(DEFAULT_OVERHEAD_POSITION.z);
    expect(target.x).toBe(DEFAULT_OVERHEAD_TARGET.x);
    expect(target.y).toBe(DEFAULT_OVERHEAD_TARGET.y);
    expect(target.z).toBe(DEFAULT_OVERHEAD_TARGET.z);
  });
});

describe('animateCameraToSeat', () => {
  let rafCallbacks: Array<{ id: number; cb: FrameRequestCallback }>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      rafId++;
      rafCallbacks.push({ id: rafId, cb });
      return rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      rafCallbacks = rafCallbacks.filter(r => r.id !== id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCamera(): THREE.PerspectiveCamera {
    return new THREE.PerspectiveCamera();
  }

  function makeControls() {
    return {
      target: new THREE.Vector3(0, 0, 0),
      update: vi.fn(),
      saveState: vi.fn(),
    };
  }

  function flushRaf(timestamp: number) {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach(({ cb }) => cb(timestamp));
  }

  it('moves camera toward target position over time', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    animateCameraToSeat(camera, controls, targetPos, targetLookAt, { duration: 400 });

    // First rAF sets startTime; second advances
    flushRaf(0);    // start frame (t=0)
    flushRaf(200);  // midpoint

    // Camera should have moved from initial position toward target
    // At t=0.5 (200/400), with easing, position should be partway
    expect(camera.position.x).not.toBe(0);
    expect(camera.updateProjectionMatrix).toHaveBeenCalled();
  });

  it('calls onComplete when animation finishes', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const onComplete = vi.fn();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    animateCameraToSeat(camera, controls, targetPos, targetLookAt, {
      duration: 300,
      onComplete,
    });

    flushRaf(0);    // start
    flushRaf(300);  // exactly at duration

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('snaps to exact target at the end of animation', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(0.5, 0, 0.5);

    animateCameraToSeat(camera, controls, targetPos, targetLookAt, { duration: 300 });

    flushRaf(0);
    flushRaf(500); // past duration

    expect(camera.position.x).toBe(5);
    expect(camera.position.y).toBe(8);
    expect(camera.position.z).toBe(3);
    expect(controls.target.x).toBe(0.5);
    expect(controls.target.z).toBe(0.5);
    expect(controls.saveState).toHaveBeenCalled();
  });

  it('cancel() stops the animation', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const onComplete = vi.fn();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    const { cancel } = animateCameraToSeat(camera, controls, targetPos, targetLookAt, {
      duration: 400,
      onComplete,
    });

    flushRaf(0); // start
    cancel();
    flushRaf(400); // would complete, but cancelled

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('defaults to 400ms duration', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const onComplete = vi.fn();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    animateCameraToSeat(camera, controls, targetPos, targetLookAt, { onComplete });

    flushRaf(0);
    flushRaf(399); // just before default 400ms
    expect(onComplete).not.toHaveBeenCalled();

    flushRaf(400); // at 400ms
    expect(onComplete).toHaveBeenCalled();
  });

  it('updates controls.target during animation', () => {
    const camera = makeCamera();
    const controls = makeControls();
    const targetPos = new THREE.Vector3(5, 8, 3);
    const targetLookAt = new THREE.Vector3(1, 0, 1);

    animateCameraToSeat(camera, controls, targetPos, targetLookAt, { duration: 400 });

    flushRaf(0);
    flushRaf(200);

    expect(controls.update).toHaveBeenCalled();
  });
});

describe('camera default constants', () => {
  it('DEFAULT_OVERHEAD_POSITION Y is 18 for full-table visibility on mobile', () => {
    expect(DEFAULT_OVERHEAD_POSITION.y).toBe(18);
  });

  it('DEFAULT_OVERHEAD_POSITION Z is 6 for zoomed-out default', () => {
    expect(DEFAULT_OVERHEAD_POSITION.z).toBe(6);
  });

  it('SEAT_CAMERA_HEIGHT is 8 for wider seat-snap perspective', () => {
    expect(SEAT_CAMERA_HEIGHT).toBe(8);
  });

  it('SEAT_CAMERA_BEHIND is 1.6 for wider seat-snap perspective', () => {
    expect(SEAT_CAMERA_BEHIND).toBe(1.6);
  });
});
