import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Table } from './components/Table';
import { Seat } from './components/Seat';
import { Card } from './components/Card';
import { ChipInstances } from './components/ChipInstances';
import { ChipStack } from './components/ChipStack';
import { CameraPresetController } from './components/CameraPresetController';
import { TableMarkers } from './components/DealerButton';
import { Nameplates } from './components/Nameplate';
import { ActionBadges } from './components/ActionBadge';
import { SeatHighlights, ShowdownGlows } from './components/SeatHighlight';
import { FOLDED_CHIP_STACK_OPACITY } from './components/SeatHighlight';
import { EquityBadges } from './components/EquityBadge';
import { resolveEquityOverlay } from './state/equityGuard';
import type { CameraPreset } from './animations/cameraPresets';
import {
  POT_CHIP_WORLD_POSITION,
  seatCommitChipWorldPosition,
} from './components/tableLayout';
import {
  DealAnimationDriver,
  buildPokerTableDealLayout,
  communityTargetPosition,
  registerDealTarget,
  useDealTargetRegistry,
  HOLE_CARD_SPREAD_X,
  HOLE_CARD_Y,
  HOLE_CARD_LOCAL_Z,
} from './animations/DealAnimationDriver';
import {
  ChipSlideDriver,
  buildPokerTableChipSlideLayout,
} from './animations/ChipSlideDriver';
import type { ChipSlideController } from './animations/ChipSlideController';
import type { ChipSlideDelta } from './animations/chipSlides';
import {
  PotSweepDriver,
  buildPokerTablePotSweepLayout,
} from './animations/PotSweepDriver';
import type { PotSweepController } from './animations/PotSweepController';
import { computePotSweepDeltas, type PotSweepDelta } from './animations/potSweeps';
import { canSee } from './state/visibilityPolicy';
import type {
  QualityTier,
  TableState,
  ViewerContext,
} from './types';
import { QUALITY_TIER_SETTINGS } from './state/qualitySettings';
import { FPSMonitor } from './state/useFPSMonitor';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Camera preset selector. `'default'` is the spectator orbit; `'topDown'`
 * and `'cinematic'` are future presets driven by T-021; `{ kind: 'seat' }`
 * is the seat-POV preset wired in T-022.
 *
 * T-009 accepts the prop for forward-compatibility but only uses
 * `viewer.policy` to pick the rig preset — preset tweens land in T-021/T-022.
 */
export type TableCameraPreset =
  | 'default'
  | 'topDown'
  | 'cinematic'
  | { kind: 'seat'; seat: number };

export interface PokerTableTheme {
  mode?: 'light' | 'dark';
  feltColor?: string;
  railColor?: string;
  cardBack?: string;
}

export interface PokerTableProps {
  /** Declarative scene input. See plan.md § "Public API". */
  state: TableState;
  /** Viewer policy — drives camera clamps and (via T-025) card visibility. */
  viewer?: ViewerContext;
  theme?: PokerTableTheme;
  qualityTier?: QualityTier;
  /**
   * Render `<EquityBadge>` overlays. Wired in T-020; T-009 accepts the prop
   * only. Hard-forced false under `viewer.policy === 'player'` per S-5.3.
   */
  equityOverlay?: boolean;
  /** Camera preset selector — forward-compat; preset driver lands in T-021. */
  cameraPreset?: TableCameraPreset;
  onPresetChange?: (preset: TableCameraPreset) => void;
  onReady?: () => void;
  /** Max chips per denomination InstancedMesh. Defaults to 200. */
  chipCapacity?: number;
  /** Escape hatch for feature modules (animations, nameplates, equity badges). */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

// Community and hole card offsets live in
// `animations/DealAnimationDriver.ts` so render-time positions and deal
// animation targets stay in lockstep.

// Pot chip cluster position is hoisted into `components/tableLayout.ts`
// as `POT_CHIP_WORLD_POSITION` — single source of truth shared with
// `buildPokerTableChipSlideLayout` (Cycle 19 L-1).

/**
 * Reduce `TableCameraPreset` down to the preset value the T-021/T-022
 * controller understands. Named presets pass through; the seat-POV variant
 * is augmented with the current `seatCount` so the controller can resolve
 * the seat's world position via `computeSeatPresetPose` (T-022).
 *
 * Unknown kinds fall back to `'default'` and emit a dev-mode warning
 * (resolves Cycle 14 LOW L-1 — previously silent).
 *
 * T-026 — camera-lock override. Under `viewer.policy === 'player'` the
 * camera is hard-locked to the viewer's seat POV regardless of the
 * caller-supplied preset: the composition's camera half of the player-
 * mode contract (AC 2). A conflicting caller-supplied preset triggers a
 * DEV-only warning so regressions surface in the console; the player
 * seat still wins. Player policy with an undefined `seat` falls back to
 * `'default'` with a DEV warning.
 */
function resolveCameraPreset(
  p: TableCameraPreset | undefined,
  seatCount: number,
  viewer: ViewerContext | undefined,
): CameraPreset {
  if (viewer?.policy === 'player') {
    if (typeof viewer.seat === 'number') {
      const callerAgreesWithLock =
        p != null &&
        typeof p === 'object' &&
        p.kind === 'seat' &&
        p.seat === viewer.seat;
      if (p != null && !callerAgreesWithLock && import.meta.env?.DEV) {
        console.warn(
          '[PokerTable] cameraPreset ignored under viewer.policy="player"; camera locked to viewer seat POV',
          p,
        );
      }
      return { kind: 'seat', seat: viewer.seat, seatCount };
    }
    if (import.meta.env?.DEV) {
      console.warn(
        '[PokerTable] viewer.policy="player" requires viewer.seat; falling back to "default" preset',
      );
    }
    return 'default';
  }
  if (p == null) return 'default';
  if (p === 'default' || p === 'topDown' || p === 'cinematic') return p;
  if (typeof p === 'object' && p.kind === 'seat') {
    return { kind: 'seat', seat: p.seat, seatCount };
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[PokerTable] Unknown cameraPreset; falling back to "default"', p);
  }
  return 'default';
}

/**
 * Per-seat committed-chip stack offset and world-space origin live in
 * `components/tableLayout.ts` as `SEAT_COMMIT_CHIP_LOCAL_Z` +
 * `seatCommitChipWorldPosition` — shared with T-011's chip-slide layout so
 * render-time and tween-time agree.
 */

// ---------------------------------------------------------------------------
// <PokerTable>
// ---------------------------------------------------------------------------

/**
 * Top-level declarative poker scene. Composes `<Table>`, per-seat `<Seat>`,
 * community / hole `<Card>`, `<ChipInstances>` + `<ChipStack>`, and
 * `<CameraRig>` from a single `TableState` prop.
 *
 * Must be mounted inside a `<PokerCanvas>` (or any R3F `<Canvas>`); this
 * component itself is a pure scene-graph composition and renders no canvas.
 *
 * **Visibility of hole cards is T-024 scope.** T-009 renders a pair of
 * face-down placeholder cards for every active, non-folded seat; T-025 will
 * route the public `canSee()` gate through `<Card faceUp>` so the viewer's
 * own seat flips face-up under the right policy.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function PokerTable({
  state,
  viewer,
  theme,
  qualityTier = 'medium',
  // T-020 — default off; the guard in <EquityBadges> enforces the
  // player-policy override internally.
  equityOverlay = false,
  // onPresetChange is reserved for future uses (T-022 wires seat-POV
  // selection through the toolbar directly).
  cameraPreset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPresetChange: _onPresetChange,
  onReady,
  chipCapacity = 200,
  children,
}: PokerTableProps) {
  const seatCount = state.seats.length;

  // Fire onReady exactly once for the lifetime of the component.
  // A ref sentinel guards against React 18 StrictMode's intentional
  // mount → cleanup → mount double-invoke in development.
  const readyFiredRef = useRef(false);
  useEffect(() => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Registry populated by `<group>` ref callbacks around every animated
  // card; consulted by <DealAnimationDriver> when building tweens.
  const dealTargets = useDealTargetRegistry();
  const dealLayout = useMemo(
    () => buildPokerTableDealLayout(seatCount),
    [seatCount],
  );

  // Precompute per-seat committed-chip world positions so we can place them
  // as siblings of the pot stack inside <ChipInstances>.
  const seatChipPositions = useMemo(() => {
    return state.seats.map((s) =>
      seatCommitChipWorldPosition(s.seatIndex, seatCount),
    );
  }, [state.seats, seatCount]);

  // -------------------------------------------------------------------
  // Chip-slide integration (BUG-CYCLE19-01 — T-011 visual wiring).
  //
  // We mount `<ChipSlideDriver>` inside the scene graph, capture its
  // controller via `onController` into a ref (per Cycle 19 L-2 StrictMode
  // guidance), and maintain two React-visible pieces of state so render
  // reflects motion:
  //
  //   1. `activeSlides` — the set of currently in-flight slide keys, so
  //      we can render a flying-chip `<ChipStack>` per slide. `onSlideStart`
  //      adds; `onSlideComplete` removes.
  //   2. `depositedBySeat` — cumulative amounts (per seat, per street) that
  //      have landed in the pot since the street began. `onSlideComplete`
  //      bumps; resets on any (hand, street) change.
  //
  // Derived render values:
  //   - seat_display[i] = max(0, committed[i] - inFlightForSeat(i) -
  //                            depositedBySeat[i])
  //   - pot_display    = state.pot + Σ depositedBySeat
  //   - flying slug    = <ChipStack> at getInFlightPosition(key) with
  //                      amount = slide.amount
  //
  // Street-transition edge (Cycle 19 M-2): **option B — cancel in-flight
  // slides on scope change.** The controller clears active tweens and
  // in-flight bookkeeping when `(handId, streetIndex)` changes (see
  // `ChipSlideController.sync`), and this component mirrors that by
  // clearing `activeSlides` + `depositedBySeat` in a scope-change effect.
  // The `max(0, ...)` clamp at the seat render site stays as defence in
  // depth against any one-frame overlap between the controller's
  // cancellation and the parent re-render.
  // -------------------------------------------------------------------
  const controllerRef = useRef<ChipSlideController | null>(null);
  const [activeSlides, setActiveSlides] = useState<
    Array<{
      key: string;
      amount: number;
      seatIndex: number;
      initialPosition: [number, number, number];
    }>
  >([]);
  const [depositedBySeat, setDepositedBySeat] = useState<
    Record<number, number>
  >({});
  const [, bumpFrameTick] = useReducer((x: number) => (x + 1) & 0xffff, 0);

  // Reset deposits + active slides whenever the (hand, street) scope
  // changes. The controller cancels tweens on the same scope change, so
  // no slides fire `onSlideComplete` after the reset.
  useEffect(() => {
    setActiveSlides([]);
    setDepositedBySeat({});
  }, [state.handId, state.streetIndex]);

  const chipSlideLayout = useMemo(
    () => buildPokerTableChipSlideLayout(seatCount),
    [seatCount],
  );

  const handleController = useCallback((c: ChipSlideController) => {
    controllerRef.current = c;
  }, []);
  const handleSlideStart = useCallback(
    (key: string, delta: ChipSlideDelta) => {
      setActiveSlides((prev) => [
        ...prev,
        {
          key,
          amount: delta.delta,
          seatIndex: delta.seatIndex,
          initialPosition: [delta.from[0], delta.from[1], delta.from[2]],
        },
      ]);
    },
    [],
  );
  const handleSlideComplete = useCallback(
    (key: string, delta: ChipSlideDelta) => {
      setActiveSlides((prev) => prev.filter((s) => s.key !== key));
      // Guard: only credit the deposit when the completion belongs to the
      // *current* (hand, street) scope. The controller cancels in-flight
      // slides on scope change, so in practice `onSlideComplete` never
      // fires for a stale scope — this guard is defence-in-depth.
      if (
        delta.handId === state.handId &&
        delta.streetIndex === state.streetIndex
      ) {
        setDepositedBySeat((prev) => ({
          ...prev,
          [delta.seatIndex]: (prev[delta.seatIndex] ?? 0) + delta.delta,
        }));
      }
    },
    [state.handId, state.streetIndex],
  );

  // -------------------------------------------------------------------
  // Pot-sweep integration (T-012 — hand resolution).
  //
  // Mirrors the chip-slide integration above with two differences:
  //   - Scope is per-hand (not per-(hand, street)). A hand change
  //     cancels any in-flight sweep in the controller; we mirror that
  //     with a hand-change reset of `activeSweeps` + `sweptBySeat`.
  //   - Flow is reversed: chips leave the pot (subtracted from pot
  //     display) and land at winner seats. Unlike chip-slide we do
  //     *not* render landed chips as a seat stack — winners' nameplate
  //     stack number already reflects the new total, and showing a
  //     residual chip stack at the seat would double-count.
  //
  // Coordination with T-011 at the showdown edge:
  //   - ChipSlideController cancels in-flight seat→pot slides on any
  //     (hand, streetIndex) scope change. streetIndex=4 (showdown) is
  //     a scope change, so any mid-flight bet slug is aborted before
  //     the sweep begins. The pot-sweep controller then reads the
  //     already-finalised `state.pot`.
  //   - `depositedBySeat` resets on the same scope change, so sweep
  //     math never double-counts a chip that was already absorbed
  //     into the new `state.pot` by the backend.
  // -------------------------------------------------------------------
  const potSweepControllerRef = useRef<PotSweepController | null>(null);
  const [activeSweeps, setActiveSweeps] = useState<
    Array<{
      key: string;
      amount: number;
      seatIndex: number;
      initialPosition: [number, number, number];
    }>
  >([]);
  const [sweptBySeat, setSweptBySeat] = useState<Record<number, number>>({});

  // Reset sweep bookkeeping on hand change. The controller cancels
  // tweens on the same hand change, so no sweep fires `onSweepComplete`
  // after the reset.
  useEffect(() => {
    setActiveSweeps([]);
    setSweptBySeat({});
  }, [state.handId]);

  const potSweepLayout = useMemo(
    () => buildPokerTablePotSweepLayout(seatCount),
    [seatCount],
  );

  const handlePotSweepController = useCallback((c: PotSweepController) => {
    potSweepControllerRef.current = c;
  }, []);
  const handleSweepStart = useCallback(
    (key: string, delta: PotSweepDelta) => {
      setActiveSweeps((prev) => [
        ...prev,
        {
          key,
          amount: delta.amount,
          seatIndex: delta.seatIndex,
          initialPosition: [delta.from[0], delta.from[1], delta.from[2]],
        },
      ]);
    },
    [],
  );
  const handleSweepComplete = useCallback(
    (key: string, delta: PotSweepDelta) => {
      setActiveSweeps((prev) => prev.filter((s) => s.key !== key));
      // Only credit the arrival when it matches the current hand.
      if (delta.handId === state.handId) {
        setSweptBySeat((prev) => ({
          ...prev,
          [delta.seatIndex]: (prev[delta.seatIndex] ?? 0) + delta.amount,
        }));
      }
    },
    [state.handId],
  );

  // Derived render amounts.
  const inFlightForSeat = (seatIndex: number): number => {
    return controllerRef.current?.getInFlightAmountForSeat(seatIndex) ?? 0;
  };
  const depositedTotal = useMemo(
    () => Object.values(depositedBySeat).reduce((a, b) => a + b, 0),
    [depositedBySeat],
  );
  const potSweepArrived = useMemo(
    () => Object.values(sweptBySeat).reduce((a, b) => a + b, 0),
    [sweptBySeat],
  );
  // H-2 (aia-core-xc33): potSweepInFlight must reflect the outflow on
  // the very first commit carrying the winner state — before
  // <PotSweepDriver>'s sync effect has fired and before `activeSweeps`
  // has been populated. Read it from React state when possible, and
  // fall back to an inline deltas computation for the transitional
  // render. A ref tracks the `prev` state seen by the last committed
  // render so `computePotSweepDeltas(prev, state, layout)` yields the
  // same deltas the driver will spawn in its post-commit sync pass.
  const prevStateRef = useRef<TableState | null>(null);
  const prevStateForDiff = prevStateRef.current;
  useEffect(() => {
    prevStateRef.current = state;
  }, [state]);
  const activeSweepTotal = useMemo(
    () => activeSweeps.reduce((a, s) => a + s.amount, 0),
    [activeSweeps],
  );
  const potSweepInFlight = useMemo((): number => {
    // Once the driver has populated `activeSweeps` (second commit and
    // onward during a tween), trust React state — it's the single
    // source of truth the slugs render from.
    if (activeSweeps.length > 0) return activeSweepTotal;
    // Transitional render: the driver hasn't synced yet. Compute the
    // deltas it will produce from the (prev → state) diff so the pot
    // ChipStack already reflects the outflow on this commit.
    const deltas = computePotSweepDeltas(
      prevStateForDiff,
      state,
      potSweepLayout,
    );
    let sum = 0;
    for (const d of deltas) sum += d.amount;
    return sum;
  }, [activeSweeps.length, activeSweepTotal, prevStateForDiff, state, potSweepLayout]);
  // Pot display drains as chips leave and settles at 0 after every
  // sweep arrives. `Math.max(0, ...)` is defence-in-depth for the one
  // frame where React has not yet re-rendered after a hand change.
  const potDisplay = Math.max(
    0,
    state.pot + depositedTotal - potSweepInFlight - potSweepArrived,
  );

  return (
    <group
      name="poker-table-scene"
      userData={{
        gameId: state.gameId,
        handId: state.handId,
        handNumber: state.handNumber,
        phase: state.phase,
        streetIndex: state.streetIndex,
        viewerPolicy: viewer?.policy ?? 'spectator',
      }}
    >
      <CameraPresetController
        preset={resolveCameraPreset(cameraPreset, seatCount, viewer)}
        viewer={viewer}
      />
      {/* T-028 — Auto-degrade FPS monitor. Zero visual output; samples
          the Canvas frame loop and drops `qualityTier` after 3s of
          sustained sub-30fps. The DOM-side `<QualityToast>` surface is
          consumed by mount points outside the Canvas tree. */}
      <FPSMonitor />
      {/* T-014 — PBR table lighting + env map. Key directional light
          casts soft shadows on the High tier only; on Medium + Low
          shadows are disabled per AC-4. The drei <Environment> bakes
          a low-res cubemap on Medium and a higher-res preset on High;
          Low tier omits it entirely. */}
      {/* T-038 Item-2 (Cycle 39 L-2 + Cycle 38 M-1): tier-derived values
          read from QUALITY_TIER_SETTINGS[tier] — the canonical plan.md
          mapping. No inline tier literals remain on this call site. */}
      {QUALITY_TIER_SETTINGS[qualityTier].envMap.mode !== 'none' && (
        <Environment
          preset={qualityTier === 'high' ? 'studio' : 'apartment'}
          {...(QUALITY_TIER_SETTINGS[qualityTier].envMap.resolution != null
            ? {
                resolution:
                  QUALITY_TIER_SETTINGS[qualityTier].envMap.resolution!,
              }
            : {})}
          background={false}
        />
      )}
      <directionalLight
        name="key-light"
        position={[6, 8, 4]}
        intensity={0.9}
        castShadow={qualityTier === 'high'}
        {...(qualityTier === 'high'
          ? {
              'shadow-mapSize-width':
                QUALITY_TIER_SETTINGS.high.shadows.mapSize,
              'shadow-mapSize-height':
                QUALITY_TIER_SETTINGS.high.shadows.mapSize,
              'shadow-bias': -0.0005,
            }
          : {})}
      />
      <Table
        feltColor={theme?.feltColor}
        railColor={theme?.railColor}
        qualityTier={qualityTier}
      />

      {/* Community cards — render only revealed (non-null) slots. */}
      <group name="community-cards">
        {state.community.map((c, i) =>
          c ? (
            <group
              key={`community-${i}`}
              name={`community-card-wrap-${i}`}
              ref={registerDealTarget(
                dealTargets,
                `community:${state.handId}:${i}`,
              )}
              position={communityTargetPosition(i)}
            >
              <Card id={c.id} faceUp tier={qualityTier} />
            </group>
          ) : null,
        )}
      </group>

      {/* Seats — pads + per-seat hole-card placeholders. Visibility of each
          hole card is routed through `canSee()` (T-025) — own seat always
          face-up, opponents face-down until showdown under spectator policy,
          and folded opponents never revealed. Viewer defaults to
          `{ policy: 'spectator' }` when the prop is omitted. */}
      <group name="seats">
        {state.seats.map((seat) => {
          const renderHole = seat.isActive && !seat.folded;
          const viewerPolicy = viewer?.policy ?? 'spectator';
          const viewerSeat =
            viewer?.policy === 'player' && typeof viewer.seat === 'number'
              ? viewer.seat
              : null;
          const faceUp = canSee({
            viewerSeat,
            cardOwnerSeat: seat.seatIndex,
            policy: viewerPolicy,
            phase: state.phase,
            ownerFolded: seat.folded,
          });
          const holeId = (slot: 0 | 1): string | null =>
            faceUp && seat.holeCards ? seat.holeCards[slot].id : null;
          return (
            <Seat
              key={`seat-${seat.seatIndex}`}
              seatIndex={seat.seatIndex}
              seatCount={seatCount}
              playerName={seat.playerName}
              isActive={seat.isActive}
              folded={seat.folded}
            >
              {renderHole ? (
                <group name="hole-cards">
                  <group
                    name="hole-card-wrap-0"
                    ref={registerDealTarget(
                      dealTargets,
                      `hole:${state.handId}:${seat.seatIndex}:0`,
                    )}
                    position={[-HOLE_CARD_SPREAD_X, HOLE_CARD_Y, HOLE_CARD_LOCAL_Z]}
                  >
                    <Card id={holeId(0)} faceUp={faceUp} tier={qualityTier} />
                  </group>
                  <group
                    name="hole-card-wrap-1"
                    ref={registerDealTarget(
                      dealTargets,
                      `hole:${state.handId}:${seat.seatIndex}:1`,
                    )}
                    position={[HOLE_CARD_SPREAD_X, HOLE_CARD_Y, HOLE_CARD_LOCAL_Z]}
                  >
                    <Card id={holeId(1)} faceUp={faceUp} tier={qualityTier} />
                  </group>
                </group>
              ) : null}
            </Seat>
          );
        })}
      </group>

      {/* Chip instances — pot + per-seat committed stacks + flying slugs. */}
      <ChipInstances capacity={chipCapacity}>
        {potDisplay > 0 ? (
          <ChipStack amount={potDisplay} position={POT_CHIP_WORLD_POSITION} />
        ) : null}
        {state.seats.map((seat, i) => {
          const deposited = depositedBySeat[seat.seatIndex] ?? 0;
          // Defensive `Math.max(0, ...)`: the controller cancels in-flight
          // slides on scope change, but in the one frame where React has
          // not yet re-rendered with the reset `depositedBySeat`, a stale
          // `deposited` could exceed the new `committedThisStreet` (which
          // may have just reset to 0 at street change).
          const display = Math.max(
            0,
            seat.committedThisStreet - inFlightForSeat(seat.seatIndex) - deposited,
          );
          if (display <= 0) return null;
          return (
            <ChipStack
              key={`seat-commit-${seat.seatIndex}`}
              amount={display}
              position={seatChipPositions[i]}
              // T-018 AC 1 / Cycle 29 H-1 — folded seats' committed
              // chip stacks render dimmed (same dim level as the seat
              // pad / nameplate) so a folded-but-committed contributor
              // is visually distinguishable from live contributors'
              // chips. Pot stack is NOT routed through this branch and
              // always renders opaque regardless of any seat's fold.
              opacity={seat.folded ? FOLDED_CHIP_STACK_OPACITY : 1}
            />
          );
        })}
        {activeSlides.map((slide) => (
          <FlyingChipSlug
            key={slide.key}
            slideKey={slide.key}
            amount={slide.amount}
            initialPosition={slide.initialPosition}
            controllerRef={controllerRef}
            onFrameTick={bumpFrameTick}
          />
        ))}
        {activeSweeps.map((sweep) => (
          <FlyingPotSweepSlug
            key={sweep.key}
            sweepKey={sweep.key}
            amount={sweep.amount}
            initialPosition={sweep.initialPosition}
            controllerRef={potSweepControllerRef}
            onFrameTick={bumpFrameTick}
          />
        ))}
      </ChipInstances>

      {children}
      <DealAnimationDriver
        state={state}
        layout={dealLayout}
        registry={dealTargets}
      />
      <ChipSlideDriver
        state={state}
        layout={chipSlideLayout}
        onController={handleController}
        onSlideStart={handleSlideStart}
        onSlideComplete={handleSlideComplete}
      />
      <PotSweepDriver
        state={state}
        layout={potSweepLayout}
        onController={handlePotSweepController}
        onSweepStart={handleSweepStart}
        onSweepComplete={handleSweepComplete}
      />
      <TableMarkers state={state} seatCount={seatCount} />
      <Nameplates seats={state.seats} seatCount={seatCount} />
      <ActionBadges
        seats={state.seats}
        seatCount={seatCount}
        currentPhase={state.phase}
      />
      <SeatHighlights state={state} seatCount={seatCount} />
      {/* T-013 — Showdown reveal + winning-hand glow outline. Renders the
          per-winner card outlines + seat ring at `phase === 'showdown'`
          with `result === 'won'`, auto-clearing after 3s or on next
          street/hand. Reveal itself (flipping opponent hole cards
          face-up) is already handled upstream by `canSee()` above. */}
      <ShowdownGlows state={state} seatCount={seatCount} />
      {resolveEquityOverlay(equityOverlay, viewer) && (
        <EquityBadges
          state={state}
          viewer={viewer}
          equityOverlay={equityOverlay}
        />
      )}
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <FlyingChipSlug> — the in-flight chip mesh rendered per active slide.
// Reads the live tween position from the controller each frame and
// re-registers the ChipStack at the updated world position.
// ---------------------------------------------------------------------------

interface FlyingChipSlugProps {
  slideKey: string;
  amount: number;
  initialPosition: [number, number, number];
  controllerRef: React.RefObject<ChipSlideController | null>;
  onFrameTick: () => void;
}

function FlyingChipSlug({
  slideKey,
  amount,
  initialPosition,
  controllerRef,
  onFrameTick,
}: FlyingChipSlugProps) {
  const [pos, setPos] = useState<[number, number, number]>(initialPosition);
  useFrame(() => {
    const p = controllerRef.current?.getInFlightPosition(slideKey);
    if (!p) return;
    // Only trigger re-render if position moved (tween may have been
    // ticked to completion — parent will unmount this slug on
    // onSlideComplete; avoid a redundant setState in that tick).
    setPos((prev) =>
      prev[0] === p[0] && prev[1] === p[1] && prev[2] === p[2] ? prev : p,
    );
    onFrameTick();
  });
  return <ChipStack amount={amount} position={pos} />;
}


// ---------------------------------------------------------------------------
// <FlyingPotSweepSlug> — in-flight chip mesh for an active pot sweep.
// Reads the live tween position from the PotSweepController each frame and
// re-registers the ChipStack at the updated world position. Mirrors the
// structure of <FlyingChipSlug> for T-011; kept as a separate component
// so each driver owns its own controller-type contract (resolves the
// cross-type narrowing that would otherwise need a union).
// ---------------------------------------------------------------------------

interface FlyingPotSweepSlugProps {
  sweepKey: string;
  amount: number;
  initialPosition: [number, number, number];
  controllerRef: React.RefObject<PotSweepController | null>;
  onFrameTick: () => void;
}

function FlyingPotSweepSlug({
  sweepKey,
  amount,
  initialPosition,
  controllerRef,
  onFrameTick,
}: FlyingPotSweepSlugProps) {
  const [pos, setPos] = useState<[number, number, number]>(initialPosition);
  useFrame(() => {
    const p = controllerRef.current?.getInFlightPosition(sweepKey);
    if (!p) return;
    setPos((prev) =>
      prev[0] === p[0] && prev[1] === p[1] && prev[2] === p[2] ? prev : p,
    );
    onFrameTick();
  });
  return <ChipStack amount={amount} position={pos} />;
}

export default PokerTable;
