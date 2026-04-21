// Scene-graph consumer for T-012's pot-sweep primitives.
//
// `PotSweepController` is a pure, framework-free class that:
//   - Calls `computePotSweepDeltas(prev, next, layout)` on every `sync`.
//   - Spawns one tween per winner, keyed by `potSweepKey(handId, seatIndex)`.
//   - Tracks in-flight amounts per-winner and in total so the render layer
//     can shrink the pot `<ChipStack>` as chips leave and grow winners'
//     positions on arrival.
//   - Cancels every in-flight tween on a hand change (analogous to
//     `ChipSlideController`'s cross-hand cancellation).
//   - Honours `reducedMotion` by passing it through to `createTween` so
//     the tween completes synchronously and `onSweepComplete` fires on
//     the same frame — the pot appears to transfer instantly.
//
// The thin R3F wrapper — `<PotSweepDriver>` — calls `sync` on state
// changes and `tick(dtMs)` from `useFrame`. Keeping the core imperative
// lets T-012's observable ACs be unit-tested deterministically.

import {
  computePotSweepDeltas,
  potSweepKey,
  type PotSweepDelta,
  type PotSweepLayout,
} from './potSweeps';
import type { TableState } from '../types';
import {
  createTween,
  lerpVec3,
  type TweenHandle,
  type Vec3,
} from './tweens';

/**
 * Per-key in-flight bookkeeping. Amounts are snapshotted at spawn time and
 * consumed by `getInFlightForWinner` / `getInFlightPotOutflow`. The current
 * world-space `position` is updated on every tween tick so the render
 * layer can draw a flying chip-slug without re-allocating.
 */
interface InFlightEntry {
  seatIndex: number;
  amount: number;
  position: Vec3;
}

export interface PotSweepControllerOptions {
  /** Snapshot of `prefers-reduced-motion`; read once per new tween. */
  reducedMotion: () => boolean;
  /** Optional hook fired when a tween is registered. */
  onSweepStart?: (key: string, delta: PotSweepDelta) => void;
  /**
   * Optional hook fired when a tween completes naturally (not on cancel
   * or reset). The render layer uses this to add the amount to the
   * winner's "arrived" bookkeeping so the pot stays drained after the
   * in-flight slug unmounts.
   */
  onSweepComplete?: (key: string, delta: PotSweepDelta) => void;
}

export class PotSweepController {
  private readonly opts: PotSweepControllerOptions;
  private prev: TableState | null = null;
  private readonly active = new Map<string, TweenHandle>();
  private readonly inFlight = new Map<string, InFlightEntry>();

  constructor(opts: PotSweepControllerOptions) {
    this.opts = opts;
  }

  /** Advance the controller to `next`. */
  sync(next: TableState | null, layout: PotSweepLayout): void {
    if (next === null) {
      this.prev = null;
      return;
    }
    if (this.prev === next) return;

    const prevHandId = this.prev?.handId ?? null;
    const nextHandId = next.handId;

    // Cross-hand: cancel every in-flight sweep so a hand-10 sweep never
    // finishes mid hand-11. Matches ChipSlideController AC-cancellation
    // semantics.
    if (prevHandId !== null && prevHandId !== nextHandId) {
      for (const tween of this.active.values()) tween.cancel();
      this.active.clear();
      this.inFlight.clear();
    }

    const deltas = computePotSweepDeltas(this.prev, next, layout);
    this.prev = next;

    const reducedMotion = this.opts.reducedMotion();
    for (const d of deltas) {
      const key = potSweepKey(d.handId, d.seatIndex);
      // Idempotence: if somehow a sweep for this (hand, seat) is already
      // active (should not happen because `computePotSweepDeltas` only
      // fires on the winner-appearance transition), skip to avoid a
      // duplicate tween overwriting the in-flight entry.
      if (this.active.has(key)) continue;

      const entry: InFlightEntry = {
        seatIndex: d.seatIndex,
        amount: d.amount,
        position: [d.from[0], d.from[1], d.from[2]],
      };
      this.inFlight.set(key, entry);

      // Fire onSweepStart BEFORE createTween so, under reduced-motion,
      // the consumer's start-handler runs before the synchronous
      // complete-handler (lifecycle ordering — same convention as
      // ChipSlideController Cycle 19 M-3).
      this.opts.onSweepStart?.(key, d);

      const tween = createTween<Vec3>({
        from: d.from,
        to: d.to,
        durationMs: d.durationMs,
        lerp: lerpVec3,
        onUpdate: (v) => {
          entry.position[0] = v[0];
          entry.position[1] = v[1];
          entry.position[2] = v[2];
        },
        onComplete: () => {
          this.active.delete(key);
          this.inFlight.delete(key);
          this.opts.onSweepComplete?.(key, d);
        },
        reducedMotion,
      });
      if (!tween.done) {
        this.active.set(key, tween);
      }
    }
  }

  /** Advance every active tween by `dtMs` milliseconds. */
  tick(dtMs: number): void {
    if (this.active.size === 0) return;
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

  /**
   * Chips currently mid-flight heading toward `seatIndex`. Render layer
   * uses this to decide whether to render a flying slug for this seat.
   */
  getInFlightForWinner(seatIndex: number): number {
    let total = 0;
    for (const e of this.inFlight.values()) {
      if (e.seatIndex === seatIndex) total += e.amount;
    }
    return total;
  }

  /**
   * Total chips currently mid-flight out of the pot. The render layer
   * should render the visible pot as
   * `state.pot + (chip-slide deposits) - inFlightPotOutflow - arrivedOutflow`,
   * so the pot shrinks as slugs leave and settles at 0 once all sweeps
   * land.
   */
  getInFlightPotOutflow(): number {
    let total = 0;
    for (const e of this.inFlight.values()) total += e.amount;
    return total;
  }

  /** Current world-space position of the in-flight slug for `key`. */
  getInFlightPosition(key: string): Vec3 | null {
    const e = this.inFlight.get(key);
    if (!e) return null;
    return [e.position[0], e.position[1], e.position[2]];
  }

  /** Cancel everything and forget prev state. */
  reset(): void {
    for (const tween of this.active.values()) tween.cancel();
    this.active.clear();
    this.inFlight.clear();
    this.prev = null;
  }
}
