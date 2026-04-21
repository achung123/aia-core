/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import {
  CAMERA_PRESETS,
  CAMERA_PRESET_NAMES,
  CAMERA_PRESET_TRANSITION_MS,
  CINEMATIC_ORBIT_RAD_PER_SEC,
  SEAT_POV_BACK_OFFSET,
  SEAT_POV_CAM_HEIGHT,
  SEAT_POV_TARGET_HEIGHT,
  SEAT_POV_YAW_HALF_WIDTH,
  computeSeatPresetPose,
  computeSeatYawCenter,
  createCameraPresetState,
  resolveCameraPresetPose,
} from '../../src/scenes3d/animations/cameraPresets';
import { computeSeatPosition } from '../../src/scenes3d/components/tableLayout';

describe('CAMERA_PRESETS', () => {
  it('exposes the three T-021 preset names in stable order', () => {
    expect(CAMERA_PRESET_NAMES).toEqual(['default', 'topDown', 'cinematic']);
  });

  it('defines position + target for every named preset', () => {
    for (const name of CAMERA_PRESET_NAMES) {
      const pose = CAMERA_PRESETS[name];
      expect(pose.position).toHaveLength(3);
      expect(pose.target).toHaveLength(3);
      expect(pose.position.every((v) => Number.isFinite(v))).toBe(true);
      expect(pose.target.every((v) => Number.isFinite(v))).toBe(true);
    }
  });

  it('top-down preset is (approximately) directly overhead', () => {
    const pose = CAMERA_PRESETS.topDown;
    // x and z are nearly zero (small z offset to avoid gimbal lock is fine),
    // y is strictly greater than the default preset's y.
    expect(Math.abs(pose.position[0])).toBeLessThan(0.5);
    expect(Math.abs(pose.position[2])).toBeLessThan(0.5);
    expect(pose.position[1]).toBeGreaterThan(CAMERA_PRESETS.default.position[1]);
  });

  it('default preset matches the spectator config starting pose [0,6,8]', () => {
    expect(CAMERA_PRESETS.default.position).toEqual([0, 6, 8]);
    expect(CAMERA_PRESETS.default.target).toEqual([0, 0, 0]);
  });

  it('transition duration is ~600ms per T-021 AC 2', () => {
    expect(CAMERA_PRESET_TRANSITION_MS).toBeGreaterThanOrEqual(400);
    expect(CAMERA_PRESET_TRANSITION_MS).toBeLessThanOrEqual(900);
  });

  it('cinematic orbit runs at a visibly-slow rate (one revolution > 10s)', () => {
    // ω < 2π / 10 rad/s  ⇒  period > 10s
    expect(CINEMATIC_ORBIT_RAD_PER_SEC).toBeGreaterThan(0);
    expect(CINEMATIC_ORBIT_RAD_PER_SEC).toBeLessThan((2 * Math.PI) / 10);
  });
});

describe('createCameraPresetState — initial state', () => {
  it('defaults to the "default" preset pose when no options are passed', () => {
    const s = createCameraPresetState();
    expect(s.preset).toBe('default');
    expect(s.position).toEqual(CAMERA_PRESETS.default.position);
    expect(s.target).toEqual(CAMERA_PRESETS.default.target);
    expect(s.isTransitioning).toBe(false);
    expect(s.isCinematicOrbiting).toBe(false);
  });

  it('honours an explicit starting preset', () => {
    const s = createCameraPresetState({ preset: 'topDown' });
    expect(s.preset).toBe('topDown');
    expect(s.position).toEqual(CAMERA_PRESETS.topDown.position);
  });

  it('begins cinematic orbit immediately when initialised with preset="cinematic"', () => {
    const s = createCameraPresetState({ preset: 'cinematic' });
    expect(s.preset).toBe('cinematic');
    expect(s.isCinematicOrbiting).toBe(true);
  });
});

describe('createCameraPresetState — setPreset transitions', () => {
  it('starts a tween on setPreset and lands on the target pose at transition end', () => {
    const s = createCameraPresetState();
    s.setPreset('topDown');
    expect(s.isTransitioning).toBe(true);

    // Halfway through the tween the position should differ from both endpoints.
    s.tick(CAMERA_PRESET_TRANSITION_MS / 2);
    expect(s.isTransitioning).toBe(true);
    expect(s.position).not.toEqual(CAMERA_PRESETS.default.position);
    expect(s.position).not.toEqual(CAMERA_PRESETS.topDown.position);

    // Complete the tween.
    s.tick(CAMERA_PRESET_TRANSITION_MS);
    expect(s.isTransitioning).toBe(false);
    expect(s.position).toEqual(CAMERA_PRESETS.topDown.position);
    expect(s.target).toEqual(CAMERA_PRESETS.topDown.target);
  });

  it('cancelling cinematic by switching preset stops the auto-orbit', () => {
    const s = createCameraPresetState({ preset: 'cinematic' });
    expect(s.isCinematicOrbiting).toBe(true);
    s.setPreset('default');
    expect(s.isCinematicOrbiting).toBe(false);
    s.tick(CAMERA_PRESET_TRANSITION_MS);
    expect(s.position).toEqual(CAMERA_PRESETS.default.position);
    expect(s.isCinematicOrbiting).toBe(false);
  });

  it('switching to cinematic from another preset begins orbit only after the tween completes', () => {
    const s = createCameraPresetState();
    s.setPreset('cinematic');
    expect(s.isTransitioning).toBe(true);
    expect(s.isCinematicOrbiting).toBe(false);
    s.tick(CAMERA_PRESET_TRANSITION_MS);
    expect(s.isTransitioning).toBe(false);
    expect(s.isCinematicOrbiting).toBe(true);
  });

  it('re-selecting the current preset is a no-op (no transition starts)', () => {
    const s = createCameraPresetState();
    s.setPreset('default');
    expect(s.isTransitioning).toBe(false);
    expect(s.position).toEqual(CAMERA_PRESETS.default.position);
  });
});

describe('createCameraPresetState — cinematic orbit', () => {
  it('moves the camera around the Y axis at the configured angular rate', () => {
    const s = createCameraPresetState({ preset: 'cinematic' });
    const start = [...s.position];
    const startY = start[1];

    // Tick 1 second — position should rotate by ≈ CINEMATIC_ORBIT_RAD_PER_SEC rad.
    s.tick(1000);
    const after = s.position;
    // Height unchanged.
    expect(after[1]).toBeCloseTo(startY, 6);
    // X and/or Z have changed (camera has orbited).
    const moved =
      Math.abs(after[0] - start[0]) + Math.abs(after[2] - start[2]);
    expect(moved).toBeGreaterThan(0.01);
    // Radius preserved.
    const r0 = Math.hypot(start[0], start[2]);
    const r1 = Math.hypot(after[0], after[2]);
    expect(r1).toBeCloseTo(r0, 4);
  });

  it('interrupt() yields the cinematic orbit; subsequent ticks do not move the camera', () => {
    const s = createCameraPresetState({ preset: 'cinematic' });
    s.tick(500);
    const held = [...s.position];
    s.interrupt();
    expect(s.isCinematicOrbiting).toBe(false);
    s.tick(1000);
    expect(s.position).toEqual(held);
  });

  it('target stays at origin during cinematic orbit', () => {
    const s = createCameraPresetState({ preset: 'cinematic' });
    s.tick(800);
    expect(s.target).toEqual(CAMERA_PRESETS.cinematic.target);
  });
});

describe('createCameraPresetState — reduced motion', () => {
  it('snaps directly to the target pose on setPreset (no transition)', () => {
    const s = createCameraPresetState({ reducedMotion: true });
    s.setPreset('topDown');
    expect(s.isTransitioning).toBe(false);
    expect(s.position).toEqual(CAMERA_PRESETS.topDown.position);
  });

  it('does not auto-orbit the cinematic preset', () => {
    const s = createCameraPresetState({
      preset: 'cinematic',
      reducedMotion: true,
    });
    expect(s.isCinematicOrbiting).toBe(false);
    const start = [...s.position];
    s.tick(2000);
    expect(s.position).toEqual(start);
  });
});

describe('computeSeatPresetPose (T-022)', () => {
  it('places the camera along the outward radial from the seat, elevated', () => {
    const seatCount = 6;
    for (let seat = 0; seat < seatCount; seat++) {
      const pose = computeSeatPresetPose(seat, seatCount);
      const [sx, , sz] = computeSeatPosition(seat, seatCount);

      // Camera height is the configured eye height, not on the felt.
      expect(pose.position[1]).toBeCloseTo(SEAT_POV_CAM_HEIGHT, 6);
      // Target is the felt center + a small lift.
      expect(pose.target).toEqual([0, SEAT_POV_TARGET_HEIGHT, 0]);

      // Camera XZ sits further from the origin than the seat itself
      // (placed "behind" the seat along the outward radial).
      const camXZ = Math.hypot(pose.position[0], pose.position[2]);
      const seatXZ = Math.hypot(sx, sz);
      expect(camXZ).toBeGreaterThan(seatXZ);
      expect(camXZ - seatXZ).toBeCloseTo(SEAT_POV_BACK_OFFSET, 6);

      // Camera XZ lies on the same radial direction as the seat (the
      // cross product of the 2D vectors is ~zero, same sign).
      const cross = sx * pose.position[2] - sz * pose.position[0];
      expect(cross).toBeCloseTo(0, 6);
      expect(sx * pose.position[0] + sz * pose.position[2]).toBeGreaterThan(0);
    }
  });

  it('looks at the felt center (target.y small, x=z=0)', () => {
    const pose = computeSeatPresetPose(2, 6);
    expect(pose.target[0]).toBe(0);
    expect(pose.target[2]).toBe(0);
    expect(pose.target[1]).toBeGreaterThan(0);
    expect(pose.target[1]).toBeLessThan(1);
  });
});

describe('computeSeatYawCenter (T-022)', () => {
  it('matches atan2(seat.x, seat.z) so OrbitControls azimuth lines up', () => {
    const seatCount = 6;
    for (let seat = 0; seat < seatCount; seat++) {
      const [sx, , sz] = computeSeatPosition(seat, seatCount);
      expect(computeSeatYawCenter(seat, seatCount)).toBeCloseTo(
        Math.atan2(sx, sz),
        6,
      );
    }
  });

  it('differs across seats that are not aligned with world +Z (Cycle 14 MED-1)', () => {
    // Seats at opposite sides of the ellipse must have yaw centers that
    // differ by ~π so ±30° cones cover distinct world directions.
    const a = computeSeatYawCenter(0, 6);
    const d = computeSeatYawCenter(3, 6);
    const diff = Math.abs(((a - d) % (2 * Math.PI)) - Math.PI);
    expect(diff).toBeLessThan(1e-6);
  });

  it('clamp half-width constant is ±π/6 (AC 2)', () => {
    expect(SEAT_POV_YAW_HALF_WIDTH).toBeCloseTo(Math.PI / 6, 6);
  });
});

describe('resolveCameraPresetPose', () => {
  it('routes named presets to the static table', () => {
    expect(resolveCameraPresetPose('default')).toEqual(CAMERA_PRESETS.default);
    expect(resolveCameraPresetPose('topDown')).toEqual(CAMERA_PRESETS.topDown);
    expect(resolveCameraPresetPose('cinematic')).toEqual(CAMERA_PRESETS.cinematic);
  });

  it('routes seat presets to computeSeatPresetPose', () => {
    const fromResolver = resolveCameraPresetPose({
      kind: 'seat',
      seat: 2,
      seatCount: 6,
    });
    expect(fromResolver).toEqual(computeSeatPresetPose(2, 6));
  });
});

describe('createCameraPresetState — seat-POV (T-022)', () => {
  it('initialises at the seat pose when constructed with a seat preset', () => {
    const s = createCameraPresetState({
      preset: { kind: 'seat', seat: 1, seatCount: 6 },
    });
    const expected = computeSeatPresetPose(1, 6);
    expect(s.position).toEqual(expected.position);
    expect(s.target).toEqual(expected.target);
    expect(s.isTransitioning).toBe(false);
    expect(s.isCinematicOrbiting).toBe(false);
  });

  it('exposes yawCenter only for seat presets', () => {
    const named = createCameraPresetState({ preset: 'default' });
    expect(named.yawCenter).toBeNull();

    const seat = createCameraPresetState({
      preset: { kind: 'seat', seat: 2, seatCount: 6 },
    });
    expect(seat.yawCenter).toBeCloseTo(computeSeatYawCenter(2, 6), 6);
  });

  it('tweens from default → seat-POV over the standard transition window (AC 1)', () => {
    const s = createCameraPresetState();
    const seatPreset = { kind: 'seat' as const, seat: 4, seatCount: 6 };
    const dest = computeSeatPresetPose(4, 6);

    s.setPreset(seatPreset);
    expect(s.isTransitioning).toBe(true);

    // Mid-tween: pose is an interpolation.
    s.tick(CAMERA_PRESET_TRANSITION_MS / 2);
    expect(s.isTransitioning).toBe(true);
    expect(s.position).not.toEqual(CAMERA_PRESETS.default.position);
    expect(s.position).not.toEqual(dest.position);

    // End of tween.
    s.tick(CAMERA_PRESET_TRANSITION_MS);
    expect(s.isTransitioning).toBe(false);
    expect(s.position).toEqual(dest.position);
    expect(s.target).toEqual(dest.target);
  });

  it('re-selecting the same seat-POV preset is a no-op', () => {
    const p = { kind: 'seat' as const, seat: 2, seatCount: 6 };
    const s = createCameraPresetState({ preset: p });
    s.setPreset({ kind: 'seat', seat: 2, seatCount: 6 });
    expect(s.isTransitioning).toBe(false);
  });

  it('selecting a different seat starts a new tween (double-tap reset path, AC 3)', () => {
    const s = createCameraPresetState({
      preset: { kind: 'seat', seat: 0, seatCount: 6 },
    });
    s.setPreset({ kind: 'seat', seat: 3, seatCount: 6 });
    expect(s.isTransitioning).toBe(true);
    s.tick(CAMERA_PRESET_TRANSITION_MS);
    expect(s.position).toEqual(computeSeatPresetPose(3, 6).position);
  });

  it('reduced-motion snaps directly to the seat pose (no tween)', () => {
    const s = createCameraPresetState({ reducedMotion: true });
    s.setPreset({ kind: 'seat', seat: 2, seatCount: 6 });
    expect(s.isTransitioning).toBe(false);
    expect(s.position).toEqual(computeSeatPresetPose(2, 6).position);
  });
});

