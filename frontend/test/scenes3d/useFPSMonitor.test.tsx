/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// Capture useFrame callbacks so tests can drive frame-by-frame time.
// Matches the pattern used by CameraPresetController.test.tsx.
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.length = 0;
    frameCallbacks.push(cb);
  },
}));

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => consoleErrorSpy.mockRestore());

import { FPSMonitor, TIER_TOAST_MESSAGE } from '../../src/scenes3d/state/useFPSMonitor';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
} from '../../src/scenes3d/state/tableStore';

function resetStore(tier: 'low' | 'medium' | 'high' = 'high', manualOverride = false) {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: tier,
    manualOverride,
    tierToast: null,
  });
}

/** Simulate `frameCount` frames at `fps` — calls the registered useFrame cb. */
function driveFrames(fps: number, frameCount: number) {
  const dt = 1 / fps;
  act(() => {
    for (let i = 0; i < frameCount; i++) {
      for (const cb of frameCallbacks) cb({}, dt);
    }
  });
}

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
});

describe('useFPSMonitor — auto-degrade (T-028)', () => {
  beforeEach(() => resetStore('high', false));

  it('registers a useFrame callback on mount', () => {
    render(<FPSMonitor />);
    expect(frameCallbacks.length).toBe(1);
  });

  it('AC-6 canonical: 120 frames @ 20fps then 120 @ 60fps ⇒ exactly ONE tier drop', () => {
    render(<FPSMonitor />);
    driveFrames(20, 120);
    driveFrames(60, 120);
    // high → medium (exactly one step; recovery gate prevented a second drop).
    expect(useTableStore.getState().qualityTier).toBe('medium');
  });

  it('AC-2: does NOT drop until 3s of sustained <30fps has accumulated', () => {
    render(<FPSMonitor />);
    // 50 frames * 50ms = 2500ms — under the 3s threshold.
    driveFrames(20, 50);
    expect(useTableStore.getState().qualityTier).toBe('high');

    // Push past 3s total sustained (50 + 20 = 70 frames * 50ms = 3500ms).
    driveFrames(20, 20);
    expect(useTableStore.getState().qualityTier).toBe('medium');
  });

  it('AC-4: respects manualOverride=true — never auto-degrades, never toasts', () => {
    resetStore('high', true);
    render(<FPSMonitor />);
    driveFrames(20, 300);
    expect(useTableStore.getState().qualityTier).toBe('high');
    expect(useTableStore.getState().tierToast).toBeNull();
  });

  it('AC-5: does not degrade below "low" and emits no toast at the floor', () => {
    resetStore('low', false);
    render(<FPSMonitor />);
    driveFrames(20, 300);
    expect(useTableStore.getState().qualityTier).toBe('low');
    expect(useTableStore.getState().tierToast).toBeNull();
  });

  it('AC-3: emits the canonical toast copy on tier change', () => {
    render(<FPSMonitor />);
    driveFrames(20, 200);
    expect(useTableStore.getState().tierToast).toBe(TIER_TOAST_MESSAGE);
  });

  it('resets the sustained-below counter when fps recovers mid-window (hysteresis)', () => {
    render(<FPSMonitor />);
    driveFrames(20, 40); // ~2s @ 20fps — counter accumulates but under 3s
    expect(useTableStore.getState().qualityTier).toBe('high');
    driveFrames(60, 180); // recovery — counter resets to 0
    expect(useTableStore.getState().qualityTier).toBe('high');
    driveFrames(20, 20); // only 1s of sub-threshold — not enough alone
    expect(useTableStore.getState().qualityTier).toBe('high');
  });

  it('never auto-upgrades (sustained 60fps does NOT raise a low tier)', () => {
    resetStore('low', false);
    render(<FPSMonitor />);
    driveFrames(60, 600); // 10s of perfect fps
    expect(useTableStore.getState().qualityTier).toBe('low');
  });

  it('re-raises the toast only on a NEW tier change after recovery (not every frame)', () => {
    render(<FPSMonitor />);
    driveFrames(20, 200); // first drop: high → medium + toast
    expect(useTableStore.getState().qualityTier).toBe('medium');
    expect(useTableStore.getState().tierToast).toBe(TIER_TOAST_MESSAGE);

    // User dismisses the toast; recovery runs without firing another one.
    useTableStore.getState().dismissTierToast();
    driveFrames(60, 300);
    expect(useTableStore.getState().tierToast).toBeNull();
    expect(useTableStore.getState().qualityTier).toBe('medium'); // no auto-upgrade

    // New dip AFTER recovery triggers a NEW drop + toast.
    driveFrames(20, 200);
    expect(useTableStore.getState().qualityTier).toBe('low');
    expect(useTableStore.getState().tierToast).toBe(TIER_TOAST_MESSAGE);
  });

  it('teardown: unmount stops auto-degrade (no further store writes)', () => {
    const { unmount } = render(<FPSMonitor />);
    expect(frameCallbacks.length).toBe(1);
    unmount();
    // Real R3F releases the cb on unmount; our mock swaps on the next mount.
    frameCallbacks.length = 0;
    useTableStore.getState().setTier('high');
    driveFrames(20, 300);
    expect(useTableStore.getState().qualityTier).toBe('high');
    expect(useTableStore.getState().tierToast).toBeNull();
  });
});
