// Tween primitives for the scenes3d animation engine.
//
// Design goals:
//   - Pure, framework-free core (`createTween`) so every tween can be
//     unit-tested deterministically without R3F or a real clock.
//   - Shared easing + vector helpers reused by dealCards, chipMotion, and
//     camera-preset tweens.
//   - First-class reduced-motion support — when requested, the tween
//     skips straight to its target value on construction.
//
// See `plan.md § Animation Engine` for the intended `useFrame`-backed hook
// that will wrap `createTween` once animation drivers land in subsequent
// tasks (T-011, T-012, T-021, T-022). T-010 ships the primitives only.

export type Vec3 = [number, number, number];

export function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/** Standard ease-out cubic: fast start, gentle landing. */
export function easeOutCubic(t: number): number {
  const u = clamp01(t);
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export interface TweenOptions<T> {
  from: T;
  to: T;
  durationMs: number;
  /** Optional delay before the tween starts progressing (stays at `from`). */
  delayMs?: number;
  lerp: (a: T, b: T, t: number) => T;
  ease?: (t: number) => number;
  onUpdate: (value: T) => void;
  onComplete?: () => void;
  /**
   * When true, skip the tween entirely: `onUpdate(to)` + `onComplete()` fire
   * synchronously on construction and subsequent `tick()` calls are no-ops.
   * Drivers should pass `useReducedMotion()` here.
   */
  reducedMotion?: boolean;
}

export interface TweenHandle {
  readonly done: boolean;
  /**
   * Advance the tween by `dtMs` milliseconds. Returns `true` on the tick
   * that completes the tween (so callers can count completions), `false`
   * otherwise. Safe to call after completion — becomes a no-op.
   */
  tick: (dtMs: number) => boolean;
  /** Jump to the final value, firing `onUpdate(to)` + `onComplete()` once. */
  complete: () => void;
  /** Abort without firing `onComplete` (final `onUpdate` is not invoked). */
  cancel: () => void;
}

/**
 * Build a framework-free tween. The returned handle is driven either by a
 * `useFrame` loop (`tick(dtMs)`) or tested directly with fixed time deltas.
 */
export function createTween<T>(opts: TweenOptions<T>): TweenHandle {
  const ease = opts.ease ?? easeOutCubic;
  const delay = Math.max(0, opts.delayMs ?? 0);
  const duration = Math.max(0, opts.durationMs);

  if (opts.reducedMotion) {
    opts.onUpdate(opts.to);
    opts.onComplete?.();
    return {
      get done() {
        return true;
      },
      tick: () => false,
      complete: () => {},
      cancel: () => {},
    };
  }

  // Zero-duration tween — complete immediately but still fire onUpdate(to)
  // so the mesh snaps to target without an extra frame of `from`.
  if (duration === 0 && delay === 0) {
    opts.onUpdate(opts.to);
    opts.onComplete?.();
    return {
      get done() {
        return true;
      },
      tick: () => false,
      complete: () => {},
      cancel: () => {},
    };
  }

  // Emit the at-rest `from` frame so the mesh is positioned correctly
  // before the first tick advances time (important when a delay is set).
  opts.onUpdate(opts.from);

  let elapsed = 0;
  let done = false;
  let cancelled = false;

  const handle: TweenHandle = {
    get done() {
      return done;
    },
    tick(dtMs: number) {
      if (done || cancelled) return false;
      elapsed += dtMs;
      if (elapsed < delay) {
        return false;
      }
      const progressed = elapsed - delay;
      if (duration === 0) {
        opts.onUpdate(opts.to);
        done = true;
        opts.onComplete?.();
        return true;
      }
      const raw = Math.min(1, progressed / duration);
      opts.onUpdate(opts.lerp(opts.from, opts.to, ease(raw)));
      if (raw >= 1) {
        done = true;
        opts.onComplete?.();
        return true;
      }
      return false;
    },
    complete() {
      if (done || cancelled) return;
      opts.onUpdate(opts.to);
      done = true;
      opts.onComplete?.();
    },
    cancel() {
      if (done) return;
      cancelled = true;
      done = true;
    },
  };
  return handle;
}
