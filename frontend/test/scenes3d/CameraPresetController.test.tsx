/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// Mock drei so we can spy on the props <CameraRig> forwards to
// <OrbitControls> and <PerspectiveCamera>.
const orbitPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const cameraPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => {
    orbitPropsSpy(props);
    return <div data-testid="mock-orbit-controls" />;
  },
  PerspectiveCamera: (props: Record<string, unknown>) => {
    cameraPropsSpy(props);
    return <div data-testid="mock-perspective-camera" />;
  },
}));

// Capture useFrame callbacks so tests can step the driver. Real R3F swaps
// the callback on each render rather than accumulating; we mimic that by
// keeping only the most-recently registered callback per component (this
// suite only mounts one component at a time).
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.length = 0;
    frameCallbacks.push(cb);
  },
}));

const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => consoleErrorSpy.mockRestore());

import { CameraPresetController } from '../../src/scenes3d/components/CameraPresetController';
import {
  CAMERA_PRESETS,
  CAMERA_PRESET_TRANSITION_MS,
  computeSeatPresetPose,
  computeSeatYawCenter,
} from '../../src/scenes3d/animations/cameraPresets';

afterEach(() => {
  cleanup();
  orbitPropsSpy.mockClear();
  cameraPropsSpy.mockClear();
  frameCallbacks.length = 0;
});

function latestOrbitProps() {
  return orbitPropsSpy.mock.calls.at(-1)![0];
}
function latestCameraProps() {
  return cameraPropsSpy.mock.calls.at(-1)![0];
}

function stepFrames(totalMs: number, stepMs = 16) {
  act(() => {
    let elapsed = 0;
    while (elapsed < totalMs) {
      const step = Math.min(stepMs, totalMs - elapsed);
      for (const cb of frameCallbacks) cb({}, step / 1000);
      elapsed += step;
    }
  });
}

describe('<CameraPresetController>', () => {
  it('registers a useFrame callback on mount', () => {
    render(<CameraPresetController preset="default" />);
    expect(frameCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the default preset pose through <CameraRig>', () => {
    render(<CameraPresetController preset="default" />);
    expect(latestCameraProps().position).toEqual(CAMERA_PRESETS.default.position);
    expect(latestOrbitProps().target).toEqual(CAMERA_PRESETS.default.target);
  });

  it('tweens camera position over ~600ms when the preset prop changes (AC 2)', () => {
    const { rerender } = render(<CameraPresetController preset="default" />);
    rerender(<CameraPresetController preset="topDown" />);

    // Mid-tween — the position should be between the two endpoints.
    stepFrames(CAMERA_PRESET_TRANSITION_MS / 2);
    const mid = latestCameraProps().position as [number, number, number];
    expect(mid).not.toEqual(CAMERA_PRESETS.default.position);
    expect(mid).not.toEqual(CAMERA_PRESETS.topDown.position);

    // Finish the tween.
    stepFrames(CAMERA_PRESET_TRANSITION_MS);
    const end = latestCameraProps().position as [number, number, number];
    expect(end).toEqual(CAMERA_PRESETS.topDown.position);
  });

  it('animates the cinematic orbit on subsequent frames (AC 3)', () => {
    render(<CameraPresetController preset="cinematic" />);
    const start = [
      ...(latestCameraProps().position as [number, number, number]),
    ];
    stepFrames(1500);
    const after = latestCameraProps().position as [number, number, number];
    // Camera has orbited: at least one of X or Z changed.
    expect(
      Math.abs(after[0] - start[0]) + Math.abs(after[2] - start[2]),
    ).toBeGreaterThan(0.01);
    // Height unchanged.
    expect(after[1]).toBeCloseTo(start[1], 4);
  });

  it('yields the cinematic orbit when the user starts interacting (AC 3)', () => {
    render(<CameraPresetController preset="cinematic" />);
    // Let the orbit run a bit, then fire OrbitControls onStart.
    stepFrames(500);
    const onStart = latestOrbitProps().onStart as (() => void) | undefined;
    expect(typeof onStart).toBe('function');
    onStart?.();

    // Capture post-interrupt position; subsequent ticks do not change it.
    stepFrames(16);
    const held = latestCameraProps().position as [number, number, number];
    stepFrames(1000);
    const later = latestCameraProps().position as [number, number, number];
    expect(later).toEqual(held);
  });

  it('forwards the spectator clamps through CameraRig when viewer is spectator', () => {
    render(<CameraPresetController preset="default" viewer={{ policy: 'spectator' }} />);
    const props = latestOrbitProps();
    expect(props.minAzimuthAngle).toBe(-Infinity);
    expect(props.maxAzimuthAngle).toBe(Infinity);
  });

  it('forwards the player clamps when viewer.policy === "player"', () => {
    render(
      <CameraPresetController
        preset="default"
        viewer={{ policy: 'player', seat: 2 }}
      />,
    );
    const props = latestOrbitProps();
    expect(props.minAzimuthAngle).toBeCloseTo(-Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(Math.PI / 6, 6);
  });

  // T-022 — seat-POV preset.
  it('renders the seat-POV pose when given a seat preset (AC 1)', () => {
    render(
      <CameraPresetController
        preset={{ kind: 'seat', seat: 2, seatCount: 6 }}
        viewer={{ policy: 'player', seat: 2 }}
      />,
    );
    const expected = computeSeatPresetPose(2, 6);
    expect(latestCameraProps().position).toEqual(expected.position);
    expect(latestOrbitProps().target).toEqual(expected.target);
  });

  it('forwards the seat-specific yawCenter so ±30° cone tracks the seat radial (AC 2)', () => {
    render(
      <CameraPresetController
        preset={{ kind: 'seat', seat: 1, seatCount: 6 }}
        viewer={{ policy: 'player', seat: 1 }}
      />,
    );
    const yaw = computeSeatYawCenter(1, 6);
    const props = latestOrbitProps();
    expect(props.minAzimuthAngle).toBeCloseTo(yaw - Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(yaw + Math.PI / 6, 6);
  });

  it('tweens the camera pose when the preset switches to seat-POV (AC 1)', () => {
    const { rerender } = render(<CameraPresetController preset="default" />);
    rerender(
      <CameraPresetController
        preset={{ kind: 'seat', seat: 4, seatCount: 6 }}
      />,
    );

    // Mid-tween — position differs from both endpoints.
    stepFrames(CAMERA_PRESET_TRANSITION_MS / 2);
    const mid = latestCameraProps().position as [number, number, number];
    const seatPose = computeSeatPresetPose(4, 6);
    expect(mid).not.toEqual(CAMERA_PRESETS.default.position);
    expect(mid).not.toEqual(seatPose.position);

    stepFrames(CAMERA_PRESET_TRANSITION_MS);
    const end = latestCameraProps().position as [number, number, number];
    expect(end).toEqual(seatPose.position);
  });

  it('switching between seats starts a fresh tween (AC 3 double-tap reset)', () => {
    const { rerender } = render(
      <CameraPresetController preset={{ kind: 'seat', seat: 0, seatCount: 6 }} />,
    );
    rerender(
      <CameraPresetController preset={{ kind: 'seat', seat: 3, seatCount: 6 }} />,
    );
    stepFrames(CAMERA_PRESET_TRANSITION_MS);
    const end = latestCameraProps().position as [number, number, number];
    expect(end).toEqual(computeSeatPresetPose(3, 6).position);
  });
});
