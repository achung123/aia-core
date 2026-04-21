import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import { CameraRig } from './CameraRig';
import {
  computeSeatYawCenter,
  createCameraPresetState,
  resolveCameraPresetPose,
  type CameraPreset,
  type CameraPresetState,
} from '../animations/cameraPresets';
import { useReducedMotion } from '../state/useReducedMotion';
import type { ViewerContext } from '../types';
import type { Vec3 } from '../animations/tweens';

export interface CameraPresetControllerProps {
  /** Currently selected preset. Controlled by the consumer (view-level state). */
  preset: CameraPreset;
  /** Viewer policy forwarded to `<CameraRig>` for orbit clamps. */
  viewer?: ViewerContext;
  /** Fired when the cinematic orbit yields to user input. */
  onInteract?: () => void;
}

/**
 * Drives `<CameraRig>`'s position + target from the T-021 preset state
 * machine. Wraps `createCameraPresetState` in a `useFrame` loop and forwards
 * `OrbitControls.onStart` through to `interrupt()` so the cinematic orbit
 * yields the moment the user starts dragging / pinching.
 *
 * Must be mounted inside an R3F `<Canvas>` (via `<PokerTable>` → `<PokerCanvas>`).
 */
export function CameraPresetController({
  preset,
  viewer,
  onInteract,
}: CameraPresetControllerProps) {
  const reducedMotion = useReducedMotion();

  // Lazily build the state machine once per component instance. Using a ref
  // (vs. `useState`) keeps the machine identity stable without an extra
  // render and avoids re-running the cinematic orbit init on re-renders.
  const machineRef = useRef<CameraPresetState | null>(null);
  if (machineRef.current === null) {
    machineRef.current = createCameraPresetState({ preset, reducedMotion });
  }

  // Mirror the machine's mutable pose into React state so prop updates to
  // `<CameraRig>` trigger re-renders. The initial pose comes from
  // `resolveCameraPresetPose` (named → static table, seat → seat ring
  // geometry) so named and seat presets agree with the machine at mount.
  const initialPose = resolveCameraPresetPose(preset);
  const [pose, setPose] = useState<{ position: Vec3; target: Vec3 }>(() => ({
    position: [...initialPose.position] as Vec3,
    target: [...initialPose.target] as Vec3,
  }));

  // Forward prop → machine. Reading `machineRef.current` inside the effect
  // body (not during render) is allowed. Seat-preset deps are serialised to
  // keep the effect key stable across prop identity churn.
  const presetKey =
    typeof preset === 'string'
      ? preset
      : `seat:${preset.seat}:${preset.seatCount}`;
  useEffect(() => {
    const machine = machineRef.current!;
    machine.setPreset(preset);
    setPose({ position: machine.position, target: machine.target });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on serialised preset
  }, [presetKey]);

  useFrame((_state, dt) => {
    const machine = machineRef.current!;
    machine.tick(dt * 1000);
    const p = machine.position;
    const t = machine.target;
    setPose((prev) => {
      if (
        prev.position[0] === p[0] &&
        prev.position[1] === p[1] &&
        prev.position[2] === p[2] &&
        prev.target[0] === t[0] &&
        prev.target[1] === t[1] &&
        prev.target[2] === t[2]
      ) {
        return prev;
      }
      return { position: [p[0], p[1], p[2]], target: [t[0], t[1], t[2]] };
    });
  });

  const handleStart = useCallback(() => {
    const machine = machineRef.current!;
    if (machine.isCinematicOrbiting) {
      machine.interrupt();
      onInteract?.();
    }
  }, [onInteract]);

  return (
    <CameraRig
      viewer={viewer}
      position={pose.position}
      target={pose.target}
      yawCenter={
        typeof preset === 'string'
          ? null
          : computeSeatYawCenter(preset.seat, preset.seatCount)
      }
      onUserInteract={handleStart}
    />
  );
}

export default CameraPresetController;
