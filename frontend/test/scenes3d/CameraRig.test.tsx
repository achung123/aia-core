/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TOUCH } from 'three';

// happy-dom has no WebGL and no R3F <Canvas> context. Mock drei's helpers so
// <CameraRig> mounts as plain React and we can assert on the props it forwards
// to <PerspectiveCamera> + <OrbitControls>.
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

const R3F_TAG_WARNING = /is using incorrect casing|is unrecognized in this browser/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

import {
  CameraRig,
  SPECTATOR_CAMERA_CONFIG,
  PLAYER_CAMERA_CONFIG,
  getCameraRigConfig,
} from '../../src/scenes3d/components/CameraRig';

afterEach(() => {
  cleanup();
  orbitPropsSpy.mockClear();
  cameraPropsSpy.mockClear();
});

describe('getCameraRigConfig', () => {
  it('returns the spectator config when viewer is undefined', () => {
    expect(getCameraRigConfig(undefined)).toBe(SPECTATOR_CAMERA_CONFIG);
  });

  it('returns the spectator config for policy="spectator"', () => {
    expect(getCameraRigConfig({ policy: 'spectator' })).toBe(
      SPECTATOR_CAMERA_CONFIG,
    );
  });

  it('returns the player config for policy="player"', () => {
    expect(getCameraRigConfig({ policy: 'player', seat: 2 })).toBe(
      PLAYER_CAMERA_CONFIG,
    );
  });
});

describe('SPECTATOR_CAMERA_CONFIG', () => {
  it('enables damping with a mobile-tuned dampingFactor', () => {
    expect(SPECTATOR_CAMERA_CONFIG.orbit.enableDamping).toBe(true);
    expect(SPECTATOR_CAMERA_CONFIG.orbit.dampingFactor).toBeGreaterThan(0);
    expect(SPECTATOR_CAMERA_CONFIG.orbit.dampingFactor).toBeLessThan(0.5);
  });

  it('clamps pitch (polar angle) for above-table viewing', () => {
    const { minPolarAngle, maxPolarAngle } = SPECTATOR_CAMERA_CONFIG.orbit;
    // Never look from directly overhead (polar=0) — leave some pitch in.
    expect(minPolarAngle).toBeGreaterThan(0);
    // Never let the camera dip below the table (polar < π/2).
    expect(maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(minPolarAngle).toBeLessThan(maxPolarAngle);
  });

  it('clamps zoom (min/maxDistance) to sensible mobile-friendly bounds', () => {
    const { minDistance, maxDistance } = SPECTATOR_CAMERA_CONFIG.orbit;
    expect(minDistance).toBeGreaterThan(0);
    expect(maxDistance).toBeGreaterThan(minDistance);
    expect(maxDistance).toBeLessThanOrEqual(20);
  });

  it('allows free azimuthal (yaw) rotation', () => {
    expect(SPECTATOR_CAMERA_CONFIG.orbit.minAzimuthAngle).toBe(-Infinity);
    expect(SPECTATOR_CAMERA_CONFIG.orbit.maxAzimuthAngle).toBe(Infinity);
  });
});

describe('PLAYER_CAMERA_CONFIG', () => {
  it('constrains azimuth to ±30° for seat-locked viewing (S-5.2)', () => {
    const { minAzimuthAngle, maxAzimuthAngle } = PLAYER_CAMERA_CONFIG.orbit;
    // ±30° = ±π/6 rad.
    expect(minAzimuthAngle).toBeCloseTo(-Math.PI / 6, 6);
    expect(maxAzimuthAngle).toBeCloseTo(Math.PI / 6, 6);
  });

  it('disables pan so the player cannot slide the camera around the table', () => {
    expect(PLAYER_CAMERA_CONFIG.orbit.enablePan).toBe(false);
  });

  it('tightens zoom range vs. spectator (prevents seeing behind opponents)', () => {
    expect(PLAYER_CAMERA_CONFIG.orbit.maxDistance).toBeLessThanOrEqual(
      SPECTATOR_CAMERA_CONFIG.orbit.maxDistance,
    );
  });

  it('still enables damping + rotate + zoom', () => {
    const o = PLAYER_CAMERA_CONFIG.orbit;
    expect(o.enableDamping).toBe(true);
    expect(o.enableRotate).toBe(true);
    expect(o.enableZoom).toBe(true);
  });
});

describe('<CameraRig>', () => {
  it('mounts without throwing', () => {
    expect(() => render(<CameraRig />)).not.toThrow();
  });

  it('renders a PerspectiveCamera and an OrbitControls', () => {
    const { getByTestId } = render(<CameraRig />);
    expect(getByTestId('mock-perspective-camera')).toBeInTheDocument();
    expect(getByTestId('mock-orbit-controls')).toBeInTheDocument();
  });

  it('forwards the spectator preset to OrbitControls by default', () => {
    render(<CameraRig />);
    expect(orbitPropsSpy).toHaveBeenCalledTimes(1);
    const props = orbitPropsSpy.mock.calls[0][0];
    const o = SPECTATOR_CAMERA_CONFIG.orbit;
    expect(props.enableDamping).toBe(o.enableDamping);
    expect(props.dampingFactor).toBe(o.dampingFactor);
    expect(props.enableZoom).toBe(o.enableZoom);
    expect(props.enablePan).toBe(o.enablePan);
    expect(props.enableRotate).toBe(o.enableRotate);
    expect(props.minDistance).toBe(o.minDistance);
    expect(props.maxDistance).toBe(o.maxDistance);
    expect(props.minPolarAngle).toBe(o.minPolarAngle);
    expect(props.maxPolarAngle).toBe(o.maxPolarAngle);
    expect(props.minAzimuthAngle).toBe(o.minAzimuthAngle);
    expect(props.maxAzimuthAngle).toBe(o.maxAzimuthAngle);
  });

  it('configures touch gestures: 1-finger orbit, 2-finger pan+dolly', () => {
    render(<CameraRig />);
    const props = orbitPropsSpy.mock.calls[0][0] as {
      touches: { ONE: number; TWO: number };
    };
    expect(props.touches).toBeDefined();
    expect(props.touches.ONE).toBe(TOUCH.ROTATE);
    expect(props.touches.TWO).toBe(TOUCH.DOLLY_PAN);
  });

  it('forwards the default target [0, 0, 0] to OrbitControls', () => {
    render(<CameraRig />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.target).toEqual([0, 0, 0]);
  });

  it('forwards a custom target prop to OrbitControls', () => {
    render(<CameraRig target={[1, 2, 3]} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.target).toEqual([1, 2, 3]);
  });

  it('re-renders OrbitControls with the updated target when the prop changes', () => {
    const { rerender } = render(<CameraRig target={[0, 0, 0]} />);
    expect(orbitPropsSpy).toHaveBeenCalledTimes(1);
    rerender(<CameraRig target={[5, 0, -2]} />);
    // The most recent render should have received the new target, and damping
    // is enabled so OrbitControls smoothly interpolates to it.
    const last = orbitPropsSpy.mock.calls[orbitPropsSpy.mock.calls.length - 1][0];
    expect(last.target).toEqual([5, 0, -2]);
    expect(last.enableDamping).toBe(true);
  });

  it('defaults to makeDefault on both camera and controls', () => {
    render(<CameraRig />);
    const camProps = cameraPropsSpy.mock.calls[0][0];
    const orbitProps = orbitPropsSpy.mock.calls[0][0];
    expect(camProps.makeDefault).toBe(true);
    expect(orbitProps.makeDefault).toBe(true);
  });

  it('forwards default camera position + fov from the spectator config', () => {
    render(<CameraRig />);
    const camProps = cameraPropsSpy.mock.calls[0][0];
    expect(camProps.position).toEqual(SPECTATOR_CAMERA_CONFIG.position);
    expect(camProps.fov).toBe(SPECTATOR_CAMERA_CONFIG.fov);
  });

  it('honours explicit position / fov prop overrides', () => {
    render(<CameraRig position={[1, 2, 3]} fov={60} />);
    const camProps = cameraPropsSpy.mock.calls[0][0];
    expect(camProps.position).toEqual([1, 2, 3]);
    expect(camProps.fov).toBe(60);
  });

  it('applies the player preset when viewer.policy === "player"', () => {
    render(<CameraRig viewer={{ policy: 'player', seat: 0 }} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.enablePan).toBe(false);
    expect(props.minAzimuthAngle).toBeCloseTo(-Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(Math.PI / 6, 6);
    expect(props.maxDistance).toBe(PLAYER_CAMERA_CONFIG.orbit.maxDistance);
  });

  it('still allows target override under the player policy', () => {
    render(<CameraRig viewer={{ policy: 'player', seat: 3 }} target={[0, 0.5, 0]} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.target).toEqual([0, 0.5, 0]);
    expect(props.enablePan).toBe(false);
  });

  // T-022: world-space yaw center override for seat-POV.
  it('overrides azimuth clamps with a ±π/6 cone around the supplied yawCenter', () => {
    const yawCenter = Math.PI / 2;
    render(<CameraRig viewer={{ policy: 'player', seat: 0 }} yawCenter={yawCenter} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.minAzimuthAngle).toBeCloseTo(yawCenter - Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(yawCenter + Math.PI / 6, 6);
  });

  it('falls back to the policy-preset clamps when yawCenter is null or omitted', () => {
    render(<CameraRig viewer={{ policy: 'player', seat: 0 }} yawCenter={null} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.minAzimuthAngle).toBeCloseTo(-Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(Math.PI / 6, 6);
  });

  it('yawCenter override also tightens the spectator rig (used for seat preset without player policy)', () => {
    const yawCenter = -Math.PI;
    render(<CameraRig yawCenter={yawCenter} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.minAzimuthAngle).toBeCloseTo(yawCenter - Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(yawCenter + Math.PI / 6, 6);
  });

  // T-022 AC 2 — seat-POV tightens pitch + zoom + disables pan even when the
  // viewer policy is spectator (e.g., toolbar-invoked seat POV from playback).
  it('yawCenter override tightens pitch clamps to seat-POV values (T-022 AC 2)', () => {
    render(<CameraRig yawCenter={0} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.minPolarAngle).toBeCloseTo(
      PLAYER_CAMERA_CONFIG.orbit.minPolarAngle,
      6,
    );
    expect(props.maxPolarAngle).toBeCloseTo(
      PLAYER_CAMERA_CONFIG.orbit.maxPolarAngle,
      6,
    );
  });

  it('yawCenter override tightens zoom (min/maxDistance) to seat-POV values (T-022 AC 2)', () => {
    render(<CameraRig yawCenter={0} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.minDistance).toBe(PLAYER_CAMERA_CONFIG.orbit.minDistance);
    expect(props.maxDistance).toBe(PLAYER_CAMERA_CONFIG.orbit.maxDistance);
  });

  it('yawCenter override disables pan so the player cannot slide off the seat vantage (T-022 AC 2)', () => {
    render(<CameraRig yawCenter={0} />);
    const props = orbitPropsSpy.mock.calls[0][0];
    expect(props.enablePan).toBe(false);
  });
});
