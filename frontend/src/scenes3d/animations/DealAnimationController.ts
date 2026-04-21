// Scene-graph consumer for T-010's deal-animation primitives.
//
// `DealAnimationController` is a pure, framework-free class that:
//   - Memoizes state transitions by identity (skips re-computation for an
//     unchanged `next` state — addresses Cycle 12 LOW #6 re-animation
//     concerns).
//   - Holds a map of in-flight `TweenHandle`s keyed by `DealEvent.key`.
//   - Cancels in-flight tweens via the `shouldCancel` predicate below.
//     Cross-hand transitions supersede every old tween; within-hand
//     transitions only cancel tweens whose slot is intentionally re-dealt
//     (Cycle 13 H-2: previously every same-hand sync that didn't re-emit
//     a key would incorrectly cancel mid-flight hole-card tweens).
//   - Honours `reducedMotion` by passing it through to `createTween` so the
//     tween completes synchronously on construction (AC 3).
//
// A thin React/R3F wrapper — `<DealAnimationDriver>` in the sibling module —
// calls `sync(state, layout)` when the table state changes and `tick(dtMs)`
// from `useFrame`. Keeping the core imperative lets the T-010 observable
// ACs be unit-tested deterministically without an R3F render.

import {
  computeDealSequence,
  type DealEvent,
  type DealLayout,
} from './dealCards';
import type { TableState } from '../types';
import {
  createTween,
  lerpVec3,
  type TweenHandle,
  type Vec3,
} from './tweens';

/**
 * Abstract target the controller writes to. A production driver wraps a
 * `THREE.Object3D` so `setPosition` calls `object.position.set(...)`; tests
 * pass a plain JS stub.
 */
export interface DealTarget {
  setPosition(x: number, y: number, z: number): void;
  setRotation(x: number, y: number, z: number): void;
}

export interface DealAnimationControllerOptions {
  /**
   * Resolve a `DealEvent.key` → the scene-graph target to animate. Return
   * `null` when no target is currently registered for the key (the tween
   * is skipped — it will be re-created on the next `sync` if the key
   * reappears).
   */
  getTarget: (key: string) => DealTarget | null;
  /** Snapshot of `prefers-reduced-motion`; read once per new tween. */
  reducedMotion: () => boolean;
  /** Optional hook fired when a new tween is registered. Test-only. */
  onTweenStart?: (key: string, event: DealEvent) => void;
}

/**
 * Predicate controlling whether an in-flight tween under `existingKey`
 * should be cancelled when `sync` transitions from hand `prevHandId` to
 * hand `nextHandId` and emits events with keys `newKeys`.
 *
 * Invariants:
 *   - Cross-hand transitions (prevHandId !== nextHandId) cancel every
 *     in-flight tween. Hand-10 community tweens must not bleed into a
 *     hand-11 preflop (original AC 4 guarantee).
 *   - Same-hand transitions (prevHandId === nextHandId) cancel **only**
 *     tweens whose key appears in the new event set — i.e., the caller
 *     intentionally re-dealt that slot. Tweens for keys the new delta
 *     doesn't mention are preserved so e.g. a `preflop → flop` transition
 *     doesn't strand mid-flight hole cards (Cycle 13 H-2 regression).
 *   - When `prevHandId === null` (controller priming from a fresh state),
 *     there are no active tweens, so the return value is effectively
 *     unused; we treat it as a no-op "keep" to avoid spurious cancellation
 *     on the very first sync.
 *
 * Exported for direct unit testing; consumed by `DealAnimationController.sync`.
 */
export function shouldCancel(
  existingKey: string,
  newKeys: ReadonlySet<string>,
  prevHandId: number | null,
  nextHandId: number,
): boolean {
  if (prevHandId === null) return false;
  if (prevHandId !== nextHandId) return true;
  // Same-hand: only cancel on intentional re-deal of this exact slot.
  return newKeys.has(existingKey);
}

export class DealAnimationController {
  private readonly opts: DealAnimationControllerOptions;
  private prev: TableState | null = null;
  private readonly active = new Map<string, TweenHandle>();

  constructor(opts: DealAnimationControllerOptions) {
    this.opts = opts;
  }

  /**
   * Advance the controller to `next`. Computes the deal sequence for the
   * `(prev → next)` transition, cancels in-flight tweens per
   * `shouldCancel`, and spawns new tweens for the remaining events.
   */
  sync(next: TableState | null, layout: DealLayout): void {
    if (next === null) {
      // Caller is priming the controller (e.g. first mount) — record and
      // bail without computing anything.
      this.prev = null;
      return;
    }
    if (this.prev === next) return;

    const prevHandId = this.prev?.handId ?? null;
    const nextHandId = next.handId;

    const events = computeDealSequence(this.prev, next, layout);
    this.prev = next;

    const newKeys = new Set(events.map((e) => e.key));

    // Cancel per the shouldCancel predicate (see above for invariants).
    for (const [key, tween] of this.active) {
      if (shouldCancel(key, newKeys, prevHandId, nextHandId)) {
        tween.cancel();
        this.active.delete(key);
      }
    }

    // Register tweens for new keys. Keys already in-flight are preserved so
    // rapid re-syncs don't restart them mid-animation. Note that same-hand
    // re-deals of a slot were just cancelled above, so they fall through
    // and spawn a fresh superseding tween here.
    const reducedMotion = this.opts.reducedMotion();
    for (const event of events) {
      if (this.active.has(event.key)) continue;
      const target = this.opts.getTarget(event.key);
      if (!target) continue;

      const tween = createTween<Vec3>({
        from: event.from,
        to: event.to,
        durationMs: event.durationMs,
        delayMs: event.startMs,
        lerp: lerpVec3,
        onUpdate: (v) => target.setPosition(v[0], v[1], v[2]),
        onComplete: () => {
          this.active.delete(event.key);
        },
        reducedMotion,
      });
      // Reduced-motion / zero-duration tweens complete synchronously; don't
      // register them — createTween has already fired onComplete above.
      if (!tween.done) {
        this.active.set(event.key, tween);
      }
      this.opts.onTweenStart?.(event.key, event);
    }
  }

  /** Advance every active tween by `dtMs` milliseconds. */
  tick(dtMs: number): void {
    if (this.active.size === 0) return;
    // Snapshot keys — onComplete mutates the map.
    const keys = Array.from(this.active.keys());
    for (const key of keys) {
      const tween = this.active.get(key);
      if (!tween) continue;
      tween.tick(dtMs);
    }
  }

  /** Currently-active tween keys (for assertions / debug). */
  getActiveKeys(): Set<string> {
    return new Set(this.active.keys());
  }

  /** Cancel everything and forget prev state. */
  reset(): void {
    for (const tween of this.active.values()) tween.cancel();
    this.active.clear();
    this.prev = null;
  }
}
