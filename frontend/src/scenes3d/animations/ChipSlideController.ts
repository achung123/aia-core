// Scene-graph consumer for T-011's chip-slide primitives.
//
// `ChipSlideController` is a pure, framework-free class that:
//   - Calls `computeChipSlideDeltas(prev, next, layout)` on every `sync`.
//   - Assigns a per-seat sequence counter so concurrent bets (AC 2) and
//     rapid re-raises by the same seat produce distinct keys and never
//     cancel each other mid-flight.
//   - Tracks in-flight amounts per-seat and in total so the render layer
//     can "shrink seat stack immediately" and "grow pot on arrival"
//     without waiting for state updates.
//   - Cancels every in-flight tween on a hand change (analogous to
//     `DealAnimationController`'s cross-hand cancellation).
//   - Honours `reducedMotion` by passing it through to `createTween` so
//     the tween completes synchronously and `onSlideComplete` fires on
//     the same frame — the pot appears to receive chips instantly.
//
// The thin R3F wrapper — `<ChipSlideDriver>` — calls `sync` on state
// changes and `tick(dtMs)` from `useFrame`. Keeping the core imperative
// lets T-011's observable ACs be unit-tested deterministically.

import {
  chipSlideKey,
  computeChipSlideDeltas,
  type ChipSlideDelta,
  type ChipSlideLayout,
} from './chipSlides';
import type { TableState } from '../types';
import {
  createTween,
  lerpVec3,
  type TweenHandle,
  type Vec3,
} from './tweens';

/**
 * Per-key in-flight bookkeeping. Amounts are snapshotted at spawn time and
 * consumed by `getInFlightAmountForSeat` / `getInFlightPotAmount`. The
 * current world-space `position` is updated on every tween tick so the
 * render layer can draw a flying chip-slug without re-allocating.
 */
interface InFlightEntry {
  seatIndex: number;
  amount: number;
  position: Vec3;
}

export interface ChipSlideControllerOptions {
  /** Snapshot of `prefers-reduced-motion`; read once per new tween. */
  reducedMotion: () => boolean;
  /** Optional hook fired when a tween is registered. Test-only. */
  onSlideStart?: (key: string, delta: ChipSlideDelta) => void;
  /**
   * Optional hook fired when a tween completes naturally (not on cancel or
   * reset). Tests assert pot-growth accounting via this.
   */
  onSlideComplete?: (key: string, delta: ChipSlideDelta) => void;
}

export class ChipSlideController {
  private readonly opts: ChipSlideControllerOptions;
  private prev: TableState | null = null;
  private readonly active = new Map<string, TweenHandle>();
  private readonly inFlight = new Map<string, InFlightEntry>();
  /**
   * Per-seat sequence counter, reset on hand *or* street change so keys
   * stay compact. Sequences survive any number of rapid bets within a
   * single (hand, street, seat) tuple.
   */
  private readonly seqBySeat = new Map<number, number>();
  private seqScope: string | null = null;

  constructor(opts: ChipSlideControllerOptions) {
    this.opts = opts;
  }

  /** Advance the controller to `next`. */
  sync(next: TableState | null, layout: ChipSlideLayout): void {
    if (next === null) {
      this.prev = null;
      return;
    }
    if (this.prev === next) return;

    const prevHandId = this.prev?.handId ?? null;
    const nextHandId = next.handId;

    // Cross-hand: cancel every in-flight slide so a hand-10 river bet
    // never finishes mid hand-11 preflop. Matches DealAnimationController
    // AC 4 semantics.
    if (prevHandId !== null && prevHandId !== nextHandId) {
      for (const tween of this.active.values()) tween.cancel();
      this.active.clear();
      this.inFlight.clear();
    }

    // Reset sequence counters on any scope change (hand OR street). Keys
    // already spawned inside the previous scope retain their existing
    // tween identity; only *new* events get the fresh counter.
    //
    // Cycle 19 M-2: a scope change *with slides mid-flight* is the
    // street-transition edge case — state.pot on the consumer side is
    // about to absorb `committedThisStreet`, and any slug still in the
    // air would double-count. We cancel in-flight tweens (chosen over
    // the render-site clamp so the consumer never observes a negative
    // `committedThisStreet - inFlight`). `cancel()` does NOT fire
    // `onSlideComplete`, so no phantom pot deposit is recorded.
    const scope = `${next.handId}:${next.streetIndex}`;
    if (this.seqScope !== null && this.seqScope !== scope) {
      for (const tween of this.active.values()) tween.cancel();
      this.active.clear();
      this.inFlight.clear();
    }
    if (this.seqScope !== scope) {
      this.seqBySeat.clear();
      this.seqScope = scope;
    }

    const deltas = computeChipSlideDeltas(this.prev, next, layout);
    this.prev = next;

    const reducedMotion = this.opts.reducedMotion();
    for (const d of deltas) {
      const seq = (this.seqBySeat.get(d.seatIndex) ?? 0) + 1;
      this.seqBySeat.set(d.seatIndex, seq);
      const key = chipSlideKey(d.handId, d.streetIndex, d.seatIndex, seq);

      // Snapshot in-flight state BEFORE spawning the tween. Under
      // reduced-motion the tween completes synchronously inside
      // createTween — the onComplete below will immediately remove this
      // entry before sync returns, which is the desired "instant pot
      // grow" behaviour.
      const entry: InFlightEntry = {
        seatIndex: d.seatIndex,
        amount: d.delta,
        position: [d.from[0], d.from[1], d.from[2]],
      };
      this.inFlight.set(key, entry);

      // Cycle 19 M-3: fire `onSlideStart` BEFORE `createTween`. Under
      // reduced-motion, `createTween` fires its `onComplete` synchronously
      // inside the constructor; invoking `onSlideStart` afterwards would
      // break lifecycle ordering for any consumer that gates render state
      // on `onSlideStart` (e.g. the `<PokerTable>` integration's
      // activeSlides set).
      this.opts.onSlideStart?.(key, d);

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
          this.opts.onSlideComplete?.(key, d);
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
   * Chips currently mid-flight from `seatIndex`'s commit stack. The render
   * layer should subtract this from `SeatState.committedThisStreet` so the
   * origin stack appears to shrink the instant a bet is declared.
   */
  getInFlightAmountForSeat(seatIndex: number): number {
    let total = 0;
    for (const e of this.inFlight.values()) {
      if (e.seatIndex === seatIndex) total += e.amount;
    }
    return total;
  }

  /**
   * Chips currently mid-flight *anywhere*. The render layer should render
   * the visible pot as `pot + committedThisStreet totals − inFlight`, so
   * the pot grows only as slides land.
   */
  getInFlightPotAmount(): number {
    let total = 0;
    for (const e of this.inFlight.values()) total += e.amount;
    return total;
  }

  /**
   * Current world-space position of the in-flight slug for `key`. Exposed
   * so the R3F driver can render a flying chip-slug at the live tween
   * output without reaching into private state.
   */
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
    this.seqBySeat.clear();
    this.seqScope = null;
    this.prev = null;
  }
}
