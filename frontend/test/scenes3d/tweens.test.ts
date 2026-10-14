import { describe, it, expect, vi } from 'vitest';

import {
  clamp01,
  easeOutCubic,
  lerpNumber,
  lerpVec3,
  createTween,
  type Vec3,
} from '../../src/scenes3d/animations/tweens';

describe('easing + lerp primitives', () => {
  it('clamp01 clamps negatives and overshoot', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });

  it('easeOutCubic anchors at endpoints and accelerates early', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    // Strongly biased toward the end — t=0.5 should already be past 0.8.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.8);
    // Monotonically non-decreasing over [0, 1].
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('lerpNumber interpolates scalars', () => {
    expect(lerpNumber(0, 10, 0)).toBe(0);
    expect(lerpNumber(0, 10, 1)).toBe(10);
    expect(lerpNumber(0, 10, 0.5)).toBe(5);
  });

  it('lerpVec3 interpolates componentwise', () => {
    const a: Vec3 = [0, 0, 0];
    const b: Vec3 = [10, -4, 2];
    expect(lerpVec3(a, b, 0)).toEqual([0, 0, 0]);
    expect(lerpVec3(a, b, 1)).toEqual([10, -4, 2]);
    expect(lerpVec3(a, b, 0.5)).toEqual([5, -2, 1]);
  });
});

describe('createTween', () => {
  it('emits an initial onUpdate(from) then progresses through ease curve', () => {
    const updates: number[] = [];
    const complete = vi.fn();
    const handle = createTween<number>({
      from: 0,
      to: 100,
      durationMs: 100,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
      onComplete: complete,
    });
    expect(updates[0]).toBe(0);
    handle.tick(50);
    handle.tick(50);
    expect(handle.done).toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(updates[updates.length - 1]).toBe(100);
  });

  it('reports the completion tick via the tick() return value', () => {
    const handle = createTween<number>({
      from: 0,
      to: 1,
      durationMs: 100,
      lerp: lerpNumber,
      onUpdate: () => {},
    });
    expect(handle.tick(50)).toBe(false);
    expect(handle.tick(40)).toBe(false);
    expect(handle.tick(20)).toBe(true);
    expect(handle.tick(10)).toBe(false); // no-op after done
  });

  it('respects delayMs by holding at `from` until delay elapses', () => {
    const updates: number[] = [];
    const handle = createTween<number>({
      from: 5,
      to: 10,
      delayMs: 50,
      durationMs: 100,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
    });
    // Initial snapshot.
    expect(updates[0]).toBe(5);
    handle.tick(30);
    expect(handle.done).toBe(false);
    // Still within delay, no progression.
    expect(updates[updates.length - 1]).toBe(5);
    handle.tick(120); // crosses delay + completes duration
    expect(handle.done).toBe(true);
    expect(updates[updates.length - 1]).toBe(10);
  });

  it('skips straight to `to` under reducedMotion', () => {
    const updates: number[] = [];
    const complete = vi.fn();
    const handle = createTween<number>({
      from: 0,
      to: 42,
      durationMs: 1000,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
      onComplete: complete,
      reducedMotion: true,
    });
    expect(handle.done).toBe(true);
    expect(updates).toEqual([42]);
    expect(complete).toHaveBeenCalledTimes(1);
    // Subsequent ticks are no-ops.
    expect(handle.tick(1000)).toBe(false);
    expect(updates).toEqual([42]);
  });

  it('complete() jumps to final value and fires onComplete once', () => {
    const updates: number[] = [];
    const complete = vi.fn();
    const handle = createTween<number>({
      from: 0,
      to: 10,
      durationMs: 100,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
      onComplete: complete,
    });
    handle.complete();
    expect(handle.done).toBe(true);
    expect(updates[updates.length - 1]).toBe(10);
    expect(complete).toHaveBeenCalledTimes(1);
    handle.complete(); // idempotent
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('cancel() stops further updates without firing onComplete', () => {
    const updates: number[] = [];
    const complete = vi.fn();
    const handle = createTween<number>({
      from: 0,
      to: 10,
      durationMs: 100,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
      onComplete: complete,
    });
    handle.cancel();
    expect(handle.done).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    handle.tick(1000);
    // Only the initial `from` snapshot should have fired.
    expect(updates).toEqual([0]);
  });

  it('tween of zero duration completes on construction', () => {
    const updates: number[] = [];
    const complete = vi.fn();
    const handle = createTween<number>({
      from: 1,
      to: 2,
      durationMs: 0,
      lerp: lerpNumber,
      onUpdate: (v) => updates.push(v),
      onComplete: complete,
    });
    expect(handle.done).toBe(true);
    expect(updates).toEqual([2]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('supports vector-valued tweens via lerpVec3', () => {
    const updates: Vec3[] = [];
    const handle = createTween<Vec3>({
      from: [0, 0, 0],
      to: [10, 20, 30],
      durationMs: 100,
      lerp: lerpVec3,
      onUpdate: (v) => updates.push(v),
    });
    handle.tick(100);
    expect(handle.done).toBe(true);
    const last = updates[updates.length - 1];
    expect(last[0]).toBeCloseTo(10);
    expect(last[1]).toBeCloseTo(20);
    expect(last[2]).toBeCloseTo(30);
  });
});
