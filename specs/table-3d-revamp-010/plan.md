# Plan — 3D Table View Revamp

**Project ID:** table-3d-revamp-010
**Date:** 2026-04-18
**Status:** Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Current-State Audit](#current-state-audit)
3. [Tech Stack & Tools](#tech-stack--tools)
4. [Consumer Matrix & Entry Points](#consumer-matrix--entry-points)
5. [Backend Endpoint Inventory (No Changes Required)](#backend-endpoint-inventory-no-changes-required)
6. [Public API — `<PokerTable>` and `<SessionReplayShell>`](#public-api--pokertable-and-sessionreplayshell)
7. [Architecture Components](#architecture-components)
8. [Visibility Policy — Formal Contract](#visibility-policy--formal-contract)
9. [Equity Overlay — Enforcement Model](#equity-overlay--enforcement-model)
10. [Animation Engine](#animation-engine)
11. [Quality Tiers & Performance Budget](#quality-tiers--performance-budget)
12. [State Shape (Zustand Slices)](#state-shape-zustand-slices)
13. [Project Phases](#project-phases)
14. [Risks & Mitigations](#risks--mitigations)
15. [External Dependencies](#external-dependencies)

---

## Overview

Rebuild the All In Analytics 3D poker-table view on `@react-three/fiber` + `@react-three/drei`, replacing the imperative vanilla Three.js module ([frontend/src/scenes/pokerScene.ts](frontend/src/scenes/pokerScene.ts)) with a declarative React scene graph. Layer on a mobile-first set of visual and interactive features (animated dealing, chip motion, pot sweeps, showdown reveals, action highlights, camera presets, per-hand replay scrubber, equity overlays, theme system) and ship a **cross-hand Session Timeline** with playback-speed controls on the full-page playback route only. Tighten the privacy-gated player POV so opponent cards and equity can never leak to the client. Migrate all three consumers (dealer embed, playback, player interface) and delete the vanilla module.

**Backend changes:** none. Every endpoint the new scene needs already exists.

---

## Current-State Audit

**Scene module**

| Symbol | Location | Contract |
|---|---|---|
| `createPokerScene(canvas, opts) → PokerSceneResult` | [frontend/src/scenes/pokerScene.ts](frontend/src/scenes/pokerScene.ts) | Returns `{ scene, camera, renderer, controls, seatPositions, chipStacks, holeCards, communityCards, dispose, update }`. `update(handState)` mutates the scene imperatively. `options.externalResize` (cycle-12) suppresses the built-in `window.resize` listener. |
| `HandState` (imperative input to `update`) | same file | `{ cardData?: { flop, turn, river, player_hands }, seatPlayerMap?, plMap?, streetIndex? }` |
| Seat layout | [frontend/src/scenes/tableGeometry.ts](frontend/src/scenes/tableGeometry.ts) | `computeSeatPositions(seatCount)` — circular layout, default 10 seats |
| Chip stacks | [frontend/src/scenes/chipStacks.ts](frontend/src/scenes/chipStacks.ts) | Single colored stack per seat with **scaled height** based on P/L. No denominations, no pot, no chip motion. |
| Hole / community cards | [frontend/src/scenes/holeCards.ts](frontend/src/scenes/holeCards.ts), [frontend/src/scenes/communityCards.ts](frontend/src/scenes/communityCards.ts) | `initHand()`, `goToShowdown()`, `goToStreet(idx)` |
| Seat camera | [frontend/src/scenes/seatCamera.ts](frontend/src/scenes/seatCamera.ts) | `computeSeatCameraPosition`, `animateCameraToSeat`, `DEFAULT_OVERHEAD_POSITION` |
| Showdown detector | [frontend/src/scenes/showdown.ts](frontend/src/scenes/showdown.ts) | `isShowdown(player_hands)` |

**Consumers (see Consumer Matrix below for full details)**

| File | Route | Notes |
|---|---|---|
| [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) | `#/dealer` (embedded) | Fixed cycle-11 leak via `externalResize:true`. Uses `handToCardData`, `buildSeatPlayerMap`, `computeStreetIndex` helpers. |
| [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) | `#/playback?gameId=<id>` | Entered from "▶ Playback" button in [frontend/src/views/DataView.tsx](frontend/src/views/DataView.tsx) (~line 833). Already uses `SessionScrubber` + `StreetScrubber` + inline `EquityRow`. Fetches equity client-side via `poker/evaluator.ts` — will be swapped to the server `/equity` endpoint in T-044. |
| [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) | `#/player/table?game=<id>&player=<name>` | Player POV. Already partially POV-gates via `handToPlayerCardData(hand, viewingPlayer)` + `isShowdown()`. Uses `SessionScrubber`. |

**Reusable components**
- [frontend/src/components/SessionScrubber.tsx](frontend/src/components/SessionScrubber.tsx) — hand-index scrubber (`{ handCount, currentHand, onChange }`)
- [frontend/src/components/StreetScrubber.tsx](frontend/src/components/StreetScrubber.tsx) — streets `['Pre-Flop','Flop','Turn','River','Showdown']`

**Tests to migrate / retire**
- `frontend/test/pages/TableView.test.tsx` — rewrite against new `<PokerTable>` (T-049)
- `frontend/test/dealer/TableView3D.test.tsx` — rewrite (T-043)
- `frontend/test/scenes/pokerScene.test.ts` — delete (T-053)

---

## Tech Stack & Tools

| Technology | Version | Purpose |
|---|---|---|
| React | 19.1 (existing) | UI framework |
| TypeScript | 5.8 strict (existing) | Types |
| `three` | 0.183.2 (existing, **unchanged**) | WebGL renderer |
| `@react-three/fiber` | **new** — pinned in T-001 | Declarative Three.js React reconciler |
| `@react-three/drei` | **new** — pinned in T-001 | Helpers: `OrbitControls`, `PerspectiveCamera`, `Html`, `Billboard`, `useTexture`, `Environment` |
| `zustand` | 5.0.5 (existing) + `persist` + `createJSONStorage` | Theme + quality tier + replay state |
| `@tanstack/react-query` | 5.99 (existing) | Data fetching — equity, hand status polling, actions |
| `react-router-dom` | 7.5 `HashRouter` (existing) | Routes unchanged |
| `vitest` | 4.1 (existing) + `@testing-library/react` + `happy-dom@20.8` | Component tests. R3F mounts under a mocked WebGL context; happy-dom lacks `ResizeObserver` so tests must polyfill (already done in current test utils). |
| `eslint` | 9.x (existing) | A custom rule added in T-032 forbids equity imports under the player route. |

**Explicitly not introduced:** no new audio library, no new animation library. Tweens are hand-rolled on top of `useFrame`; `@react-spring/three` is considered only as a T-019 fallback with a documented decision.

---

## Consumer Matrix & Entry Points

Every `<PokerTable>` mount is one of three consumers. The matrix below is the single source of truth for what each consumer enables.

| Property | Dealer embed | Playback | Player POV |
|---|---|---|---|
| File | [dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) | [views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) | [pages/TableView.tsx](frontend/src/pages/TableView.tsx) |
| Route | embedded in `#/dealer` | `#/playback?gameId=<id>` | `#/player/table?game=<id>&player=<name>` |
| `viewer.policy` | `spectator` | `spectator` | `player` |
| `viewer.seat` | — | — | viewer's seat index |
| `equityOverlay` prop | `true` | `true` | **ignored** — forced `false` for `player` policy |
| `sessionReplay` | `false` | `true` (mounts `<SessionReplayShell>`) | `false` |
| Camera | free orbit, top-down default | free orbit + presets + cinematic | seat-POV locked, ±30° yaw |
| Deal / chip / pot animations | ✅ | ✅ | ✅ |
| Opponent hole cards revealed | at showdown, non-folded | at showdown, non-folded | at showdown, non-folded only |
| Primary data source | polled `fetchHandStatus` (conditional ETag) via `useHandPolling` | `fetchHands(gameId)` for replay; `fetchEquity` per current hand | `fetchLatestHand` + `fetchHandStatusConditional` |

Playback entry point: the "▶ Playback" button in [frontend/src/views/DataView.tsx](frontend/src/views/DataView.tsx) (~line 833) fires `navigate('/playback?gameId=${session.game_id}')`. This is the **only** entry point for full-session replay.

---

## Backend Endpoint Inventory (No Changes Required)

All endpoints already exist and are served via [backend/src/app/routes/games.py](backend/src/app/routes/games.py) and [backend/src/app/routes/hands.py](backend/src/app/routes/hands.py); consumed via `frontend/src/api/client.ts`.

| Endpoint | Client function | Returns | Used by |
|---|---|---|---|
| `GET /games` | `fetchSessions()` | `GameSessionListItem[]` | DataView, Playback session picker |
| `GET /games/{gameId}` | `fetchGame(gameId)` | `GameSessionResponse` (incl. `players: PlayerInfo[]`) | All three consumers |
| `GET /games/{gameId}/hands` | `fetchHands(gameId)` | `HandResponse[]` (ordered by `hand_number`) | Playback, GameRecapPage |
| `GET /games/{gameId}/hands/latest` | `fetchLatestHand(gameId)` | `HandResponse \| null` | Player POV live polling |
| `GET /games/{gameId}/hands/{handNumber}` | `fetchHand(gameId, n)` | `HandResponse` | Dealer, deep-link playback |
| `GET /games/{gameId}/hands/{handNumber}/status` | `fetchHandStatus(...)` / `fetchHandStatusConditional(...)` | `HandStatusResponse` | Dealer (primary), Player POV |
| `GET /games/{gameId}/hands/{handNumber}/actions` | `fetchHandActions(...)` | `HandActionResponse[]` | Action badges / highlights |
| `GET /games/{gameId}/hands/{handNumber}/equity` | `fetchEquity(...)` | `EquityResponse { equities: PlayerEquityEntry[] }` | Dealer + Playback **only** — never Player POV |
| `GET /games/{gameId}/blinds` | `fetchBlinds(gameId)` | `BlindsResponse` | Blind markers / timer |
| `GET /games/{gameId}/players/{name}/rebuys` | existing | `RebuyResponse[]` | Stack accounting (phase 3) |

**Reference shapes** ([frontend/src/api/types/game.ts](frontend/src/api/types/game.ts), [frontend/src/api/types/dealer.ts](frontend/src/api/types/dealer.ts)):

```ts
export interface HandResponse {
  hand_id: number;  game_id: number;  hand_number: number;
  flop_1: string | null;  flop_2: string | null;  flop_3: string | null;
  turn: string | null;    river: string | null;
  sb_player_name: string | null;  bb_player_name: string | null;
  pot: number;  side_pots: unknown[];  created_at: string;
  player_hands: PlayerHandResponse[];
}

export interface PlayerHandResponse {
  player_hand_id: number; hand_id: number; player_id: number;
  player_name: string;
  card_1: string | null;  card_2: string | null;
  result: 'won' | 'folded' | 'lost' | 'handed_back' | null;
  profit_loss: number | null;
  outcome_street: 'preflop' | 'flop' | 'turn' | 'river' | null;
  winning_hand_description: string | null;
}

export interface HandStatusResponse {
  hand_number: number;  community_recorded: boolean;
  players: PlayerStatusEntry[];   // current_chips, pot_contribution, last_action, is_current_turn
  current_player_name: string | null;
  legal_actions: ('fold'|'check'|'call'|'bet'|'raise')[];
  amount_to_call: number;  minimum_bet?: number | null;  minimum_raise?: number | null;
  pot: number;  side_pots: unknown[];
  street_complete: boolean;
  phase: 'awaiting_cards'|'preflop'|'flop'|'turn'|'river'|'showdown';
}

export interface EquityResponse {
  equities: { player_name: string; equity: number; winning_hand_description: string | null }[];
}
```

---

## Public API — `<PokerTable>` and `<SessionReplayShell>`

```tsx
import { PokerTable, SessionReplayShell } from '@/scenes3d';

<PokerTable
  state={tableState}                     // required — see TableState below
  viewer={{ policy: 'spectator' | 'player', seat?: number }}
  theme={{ mode, feltColor, cardBack }}  // from Zustand theme slice
  qualityTier={'low' | 'medium' | 'high'}
  equityOverlay={boolean}                // default false; hard-forced false when viewer.policy === 'player'
  cameraPreset={'topDown'|'default'|'cinematic'|{kind:'seat', seat:number}}
  onPresetChange?={(preset) => void}
  onReady?={() => void}
/>
```

**`TableState`** (single shape produced by `handsToTableState`):

```ts
export type CardRef = { rank: string; suit: 's'|'h'|'d'|'c'; id: string /* 'Ah' etc */ };

export type SeatState = {
  seatIndex: number;
  playerName: string | null;
  isActive: boolean;                  // game_player.is_active
  stack: number;                      // current_chips
  committedThisStreet: number;        // summed from actions, current phase
  committedTotal: number;             // status.players[].pot_contribution
  lastAction: null | { action: 'fold'|'check'|'call'|'bet'|'raise'|'all-in'; amount?: number; street: string };
  holeCards: [CardRef, CardRef] | null;
  folded: boolean;
  result: 'won'|'lost'|'folded'|'handed_back'|null;
  profitLoss: number | null;
  winningHand: string | null;
};

export type TableState = {
  gameId: number;  handId: number;  handNumber: number;
  phase: HandStatusResponse['phase'];
  streetIndex: 0|1|2|3|4;              // 0=preflop..4=showdown
  community: (CardRef | null)[];       // length 5, null until revealed
  seats: SeatState[];
  pot: number;
  sidePots: { amount: number; eligiblePlayers: string[] }[];
  dealerSeat: number | null;
  sbSeat: number | null;
  bbSeat: number | null;
  currentSeat: number | null;
};
```

**`<SessionReplayShell>`** — playback-only wrapper:

```tsx
<SessionReplayShell
  gameId={gameId}
  hands={hands}                       // HandResponse[] from fetchHands
  initialHandIndex={0}
  initialSpeed={1}
>
  <PokerTable ... equityOverlay={true} viewer={{ policy: 'spectator' }} />
</SessionReplayShell>
```

The shell owns `handIndex`, `streetIndex`, `isPlaying`, `speed` (`0.5|1|2|4`), inter-hand pause timer, and derived `TableState`. Renders the Session Timeline + per-hand scrubber + speed controls. It is **only** mounted inside `PlaybackView.tsx`.

---

## Architecture Components

### `frontend/src/scenes3d/` — The New Declarative Scene Tree

```
scenes3d/
  index.ts                        # public exports: PokerTable, SessionReplayShell, types
  PokerCanvas.tsx                 # R3F <Canvas> wrapper (dpr cap, gl options, perf defaults)
  PokerTable.tsx                  # main scene — composes Table+Seats+Cards+Chips+CameraRig
  SessionReplayShell.tsx          # playback-only wrapper driving handIndex + streetIndex + speed
  components/
    Table.tsx                     # felt + rail meshes (drei <Environment> on high quality)
    Seat.tsx                      # seat pad + mount points for cards, chips, nameplate
    Card.tsx                      # atlas-backed textured plane; faceUp routed through canSee()
    CardAtlas.ts                  # build-once 1024²/2048² texture + UV lookup
    ChipStack.tsx                 # writes into shared <ChipInstances>
    ChipInstances.tsx             # 4× InstancedMesh (White/Red/Green/Black), scene-level
    PotChipCluster.tsx            # chips in the middle; source/sink for chip motion
    Nameplate.tsx                 # drei <Billboard> + <Html> (name + stack + action badge)
    ActionBadge.tsx               # small pill rendered inside Nameplate
    DealerButton.tsx              # dealer button + SB/BB markers + rotation tweens
    EquityBadge.tsx               # per-seat equity % — render-gated by equityOverlay && !player
    CameraRig.tsx                 # drei <PerspectiveCamera> + <OrbitControls> + preset driver
    SeatHighlight.tsx             # ring/glow/dim wrapper around Seat
  animations/
    dealCards.ts                  # street-change → animate community cards in + flip
    chipMotion.ts                 # seat→pot, pot→seat chip slug animations
    presets.ts                    # camera preset tween (topDown/default/cinematic/seat)
    tweens.ts                     # shared tween primitives + reduced-motion guard
  state/
    tableStore.ts                 # Zustand: theme, qualityTier, cameraPreset, replay
    visibilityPolicy.ts           # canSee() — single source of truth for card reveal
    equityGuard.ts                # resolveEquityOverlay() — prop-level guard
    qualitySettings.ts            # tier → { dpr, shadows, env, atlasSize, chipCap, ... }
    useFPSMonitor.ts              # 2s rolling FPS sampler + auto-degrade dispatcher
    useReducedMotion.ts           # wraps window.matchMedia('(prefers-reduced-motion: reduce)')
  data/
    handsToTableState.ts          # adapter: HandResponse + HandStatusResponse + actions → TableState
    useTableStateQuery.ts         # react-query hook composing game + hand + status + actions
    useEquityQuery.ts             # react-query for /equity; enabled=false in player policy
  types.ts                        # TableState, SeatState, CardRef, ViewerContext, QualityTier, etc.
```

### Rendering Pipeline

```
React props  →  <PokerTable>  →  children (seats, cards, chips)
                    │
                    ▼
         R3F reconciler diffs scene graph
                    │
                    ▼
          Three.js scene graph (mutated)
                    │
                    ▼
      useFrame loop (tweens run here — NOT React state)
                    │
                    ▼
              WebGLRenderer → canvas
```

Per-frame tween state lives in refs, never React state, so a 60fps tween does not trigger React re-renders. React re-renders only when `TableState` meaningfully changes (hand, street, seat stacks, action event, visibility policy, theme, or quality tier).

### Data Composition (`useTableStateQuery`)

Pseudocode — lives in [frontend/src/scenes3d/data/useTableStateQuery.ts](frontend/src/scenes3d/data/useTableStateQuery.ts):

```ts
export function useTableStateQuery({
  gameId, handNumber, viewer, equityOverlay, live,
}: Args): { tableState: TableState | null; equity: EquityResponse | null } {

  const game   = useQuery(['game', gameId],             () => fetchGame(gameId));
  const hand   = useQuery(['hand', gameId, handNumber], () => fetchHand(gameId, handNumber));
  const status = useQuery(
    ['handStatus', gameId, handNumber],
    () => fetchHandStatus(gameId, handNumber),
    { refetchInterval: live ? 1000 : false }           // dealer + player only
  );
  const actions = useQuery(['actions', gameId, handNumber], () => fetchHandActions(gameId, handNumber));

  // Equity guard — the ONLY place we call /equity
  const equity = useEquityQuery({
    gameId, handNumber,
    enabled: resolveEquityOverlay(equityOverlay, viewer)    // player → always false
  });

  const tableState = useMemo(
    () => (game.data && hand.data)
      ? handsToTableState({ game: game.data, hand: hand.data, status: status.data, actions: actions.data, viewer })
      : null,
    [game.data, hand.data, status.data, actions.data, viewer]
  );

  return { tableState, equity: equity.data ?? null };
}
```

### Card Atlas (`components/CardAtlas.ts`)

One texture containing 52 faces + 1 back in a 7×8 grid. Built once at module load via `OffscreenCanvas`, reusing the glyph logic from [frontend/src/scenes/cards.ts](frontend/src/scenes/cards.ts).

```ts
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;
const SUITS: ('s'|'h'|'d'|'c')[] = ['s','h','d','c'];

export function buildAtlas(tier: QualityTier): { texture: THREE.Texture; uv: UVTable } {
  const size = tier === 'low' ? 1024 : 2048;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const cellW = size / 8, cellH = size / 7;
  const uv: UVTable = new Map();
  SUITS.forEach((suit, row) => RANKS.forEach((rank, col) => {
    drawCard(ctx, col*cellW, row*cellH, cellW, cellH, rank, suit);
    uv.set(`${rank}${suit}`, { u: col/8, v: row/7, w: 1/8, h: 1/7 });
  }));
  drawCardBack(ctx, 4*cellW, 6*cellH, cellW, cellH);
  uv.set('back', { u: 4/8, v: 6/7, w: 1/8, h: 1/7 });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return { texture, uv };
}
```

`<Card>` consumers read the UV table and set `material.map.offset` + `material.map.repeat`. **One texture + one shared material across the whole scene.**

### Chip Instancing (`components/ChipInstances.tsx`)

Four `InstancedMesh` objects, one per denomination. Capacity pre-allocated to `seatCount * chipCap + 80 /* pot */`. `<ChipStack>` writes instance matrices into slots owned by its seat.

```ts
export const DENOMINATIONS = [
  { name: 'White', value: 0.10, color: 0xf5f5f5 },
  { name: 'Red',   value: 0.25, color: 0xcc2020 },
  { name: 'Green', value: 0.50, color: 0x208020 },
  { name: 'Black', value: 1.00, color: 0x202020 },
] as const;

// Greedy largest-first decomposition, with per-denom cap
export function chipCountsFor(amount: number, cap: number): Record<string, number> {
  let remaining = Math.round(amount * 100);
  const counts: Record<string, number> = { White: 0, Red: 0, Green: 0, Black: 0 };
  for (const { name, value } of [...DENOMINATIONS].reverse()) {
    const cents = Math.round(value * 100);
    counts[name] = Math.min(Math.floor(remaining / cents), cap);
    remaining -= counts[name] * cents;
  }
  return counts;
}
```

This replaces the existing single-stack scaled-height approach in [frontend/src/scenes/chipStacks.ts](frontend/src/scenes/chipStacks.ts) while preserving its disposal semantics (all buffers owned by the scene, not per-stack, so unmount is O(1)).

### Adapter (`data/handsToTableState.ts`)

Pure function with extensive test coverage. Pseudocode:

```ts
export function handsToTableState(input: {
  game: GameSessionResponse;
  hand: HandResponse;
  status?: HandStatusResponse;
  actions?: HandActionResponse[];
  viewer: { policy: 'spectator'|'player'; seat?: number };
}): TableState {
  const seatByName = new Map(input.game.players?.map(p => [p.name, p.seat_number]) ?? []);
  const phase = input.status?.phase ?? derivePhase(input.hand);
  const seats: SeatState[] = (input.game.players ?? []).map(p => {
    const ph = input.hand.player_hands.find(x => x.player_name === p.name);
    const ps = input.status?.players.find(x => x.name === p.name);
    return {
      seatIndex: p.seat_number ?? -1,
      playerName: p.name,
      isActive: p.is_active,
      stack: ps?.current_chips ?? p.current_chips ?? 0,
      committedThisStreet: sumActions(input.actions, p.name, phase),
      committedTotal: ps?.pot_contribution ?? 0,
      lastAction: ps?.last_action ? parseAction(ps.last_action) : null,
      holeCards: ph?.card_1 && ph?.card_2 ? [parseCard(ph.card_1), parseCard(ph.card_2)] : null,
      folded: ph?.result === 'folded',
      result: ph?.result ?? null,
      profitLoss: ph?.profit_loss ?? null,
      winningHand: ph?.winning_hand_description ?? null,
    };
  });
  return {
    gameId: input.game.game_id,
    handId: input.hand.hand_id,
    handNumber: input.hand.hand_number,
    phase,
    streetIndex: streetIndexFromPhase(phase),
    community: parseCommunity(input.hand),          // [flop1, flop2, flop3, turn, river] with nulls
    seats,
    pot: input.status?.pot ?? input.hand.pot,
    sidePots: parseSidePots(input.status?.side_pots ?? input.hand.side_pots),
    dealerSeat: deriveDealerSeat(input.game, input.hand, seatByName),
    sbSeat: seatByName.get(input.hand.sb_player_name ?? '') ?? null,
    bbSeat: seatByName.get(input.hand.bb_player_name ?? '') ?? null,
    currentSeat: input.status?.current_player_name
      ? seatByName.get(input.status.current_player_name) ?? null
      : null,
  };
}
```

---

## Visibility Policy — Formal Contract

Single pure function. Every `<Card>.faceUp` decision routes through it.

```ts
// frontend/src/scenes3d/state/visibilityPolicy.ts
export type Policy = 'spectator' | 'player';

export function canSee(args: {
  viewerSeat: number | null;
  cardOwnerSeat: number;
  policy: Policy;
  phase: TableState['phase'];
  ownerFolded: boolean;
}): boolean {
  if (args.policy === 'spectator') {
    return args.phase === 'showdown' && !args.ownerFolded;
  }
  // Player policy
  if (args.viewerSeat === args.cardOwnerSeat) return true;     // own cards always
  if (args.ownerFolded) return false;                          // folded opponents never reveal
  if (args.phase === 'showdown') return true;                  // reveal non-folded opponents at showdown
  return false;
}
```

**Test matrix (T-034 / T-050):**

| policy | viewer=owner | owner folded | phase | expected |
|---|---|---|---|---|
| spectator | any | any | preflop..river | ❌ |
| spectator | any | true | showdown | ❌ |
| spectator | any | false | showdown | ✅ |
| player | yes | any | any | ✅ |
| player | no | true | any | ❌ |
| player | no | false | preflop..river | ❌ |
| player | no | false | showdown | ✅ |

Integration test (T-055) mounts the player route end-to-end, walks street changes, and asserts `screen.queryAllByTestId('card-face-up')` returns zero opponent cards until `phase === 'showdown'`.

---

## Equity Overlay — Enforcement Model

Equity leakage is a real risk: if the client fetches `/equity` in player mode, opponent ranges can be back-solved. We enforce this at **three layers**:

1. **Prop guard** — [frontend/src/scenes3d/state/equityGuard.ts](frontend/src/scenes3d/state/equityGuard.ts):
   ```ts
   export function resolveEquityOverlay(prop: boolean, viewer: ViewerContext): boolean {
     if (viewer.policy === 'player') {
       if (prop === true && import.meta.env.DEV) {
         console.warn('[equityGuard] equityOverlay=true ignored in player policy');
       }
       return false;
     }
     return prop;
   }
   ```
2. **Query gate** — `useEquityQuery({ enabled: resolveEquityOverlay(...) })`. When disabled, react-query never calls the fetcher.
3. **Lint rule** — [frontend/eslint-rules/no-equity-in-player.js](frontend/eslint-rules/no-equity-in-player.js) blocks any `fetchEquity` / `useEquityQuery` / `calculateEquity` import from files under `frontend/src/pages/TableView.tsx` or `frontend/src/player/**`.

**Test (T-033):** mount `<PokerTable>` in player mode with `equityOverlay={true}` → assert network mock recorded **zero** calls to `/equity`, DOM contains **zero** `data-testid="equity-badge"` elements.

---

## Animation Engine

All animations run inside R3F's `useFrame`. One shared tween primitive handles lifecycle and reduced-motion.

```ts
// animations/tweens.ts — pseudocode
export function useTween<T>(opts: {
  from: T; to: T; durationMs: number;
  lerp: (a: T, b: T, t: number) => T;
  onUpdate: (v: T) => void;
  onComplete?: () => void;
  key: string;                           // identity — same key reuses the tween
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) { opts.onUpdate(opts.to); opts.onComplete?.(); return; }
  const ref = useRef({ elapsed: 0, active: false });
  useFrame((_, dtSec) => {
    if (!ref.current.active) return;
    ref.current.elapsed += dtSec * 1000;
    const t = Math.min(1, ref.current.elapsed / opts.durationMs);
    opts.onUpdate(opts.lerp(opts.from, opts.to, easeOutCubic(t)));
    if (t >= 1) { ref.current.active = false; opts.onComplete?.(); }
  });
}
```

| Animation | File | Duration | Trigger | Interruptible |
|---|---|---|---|---|
| Card deal + flip | `dealCards.ts` | ≤500ms/street | `streetIndex` change | ✅ per-card key |
| Chip slide seat→pot | `chipMotion.ts` | ~400ms | `SeatState.committedThisStreet` increase | ✅ by seat+action-id |
| Pot sweep pot→winner | `chipMotion.ts` | ≤800ms | hand result resolves | ✅ by hand-id |
| Showdown glow | `components/Seat.tsx` | 3s fade-in/hold/fade-out | phase→showdown | non-interruptible |
| Seat pulse (to-act) | `components/Seat.tsx` | continuous 1.2s cycle | `currentSeat` changes | ✅ halts on change |
| Action glow (bet/raise) | `components/Seat.tsx` | 1.5s | `lastAction` change | ✅ |
| Marker rotation (D/SB/BB) | `components/DealerButton.tsx` | ~600ms | seat assignment changes | ✅ |
| Stack number tween | `components/Nameplate.tsx` | ~300ms | `stack` change | ✅ |
| Camera preset | `animations/presets.ts` | ~600ms | `cameraPreset` change | ✅ |

All animations consult `useReducedMotion()`. Quality tier Low additionally disables non-essential animations (showdown glow, seat pulse).

---

## Quality Tiers & Performance Budget

Targets: **60fps on iPhone 13 / Pixel 6+, 30fps floor on iPhone SE 2nd-gen / Pixel 4a**. Measured via `useFPSMonitor`.

| Setting | Low | Medium (mobile default) | High (desktop default) |
|---|---|---|---|
| DPR cap | 1.0 | 1.5 | 2.0 |
| Anti-aliasing | off | off | MSAA 4× |
| Shadows | off | dir light only, 512² | dir light, 1024² soft |
| Env map | none | 256² baked | drei `<Environment>` preset |
| PBR materials | simplified (Lambert) | PBR no env | full PBR + env |
| Card atlas | 1024² | 2048² | 2048² |
| Chip cap / denom | 10 | 15 | 20 |
| Showdown glow | off | on | on |
| Seat pulse | on | on | on |
| Cinematic auto-orbit | off | on | on |

Tier settings live in [frontend/src/scenes3d/state/qualitySettings.ts](frontend/src/scenes3d/state/qualitySettings.ts).

**Auto-degrade** (`useFPSMonitor`):

```ts
// 2-second rolling window; drop a tier after 3 seconds below threshold
const window = useRef<number[]>([]);
const counter = useRef(0);
useFrame((_, dtSec) => {
  window.current.push(1 / dtSec);
  if (window.current.length > 120) window.current.shift();
  const avg = mean(window.current);
  if (avg < 30 && !store.manualOverride) {
    counter.current += dtSec * 1000;
    if (counter.current > 3000) {
      store.setTier(nextLower(store.tier));
      toast('Quality adjusted for smoother playback');
      counter.current = 0;
    }
  } else counter.current = 0;
});
```

**Asset budget:** card atlas ≤500KB PNG-equivalent, HDRI ≤200KB, total gzip payload added by `scenes3d/` ≤1MB.

---

## State Shape (Zustand Slices)

```ts
// frontend/src/scenes3d/state/tableStore.ts
export interface TableStoreState {
  // Persisted
  theme: { mode: 'dark'|'light'; feltColor: string; cardBack: 'classic'|'modern' };
  qualityTier: QualityTier;
  manualOverride: boolean;
  setTheme: (partial: Partial<Theme>) => void;
  setTier: (t: QualityTier) => void;
  setManualOverride: (b: boolean) => void;

  // Not persisted (session-scoped)
  cameraPreset: CameraPreset;
  setCameraPreset: (p: CameraPreset) => void;

  // Playback (SessionReplayShell only)
  replay: { handIndex: number; streetIndex: 0|1|2|3|4; isPlaying: boolean; speed: 0.5|1|2|4 };
  replayActions: {
    setHandIndex: (i: number) => void;
    setStreetIndex: (i: 0|1|2|3|4) => void;
    setPlaying: (b: boolean) => void;
    setSpeed: (s: 0.5|1|2|4) => void;
    stepForward: () => void;
  };
}

export const useTableStore = create<TableStoreState>()(
  persist(
    (set) => ({ /* ...slices... */ }),
    {
      name: 'aia-table-3d',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, qualityTier: s.qualityTier, manualOverride: s.manualOverride }),
    }
  )
);
```

---

## Project Phases

Each phase ships a testable slice. Phase order is strict; Scott reviews at every phase boundary.

### Phase 1 — Foundation (Parity with `pokerScene.ts`)

Stand up R3F alongside the existing scene. Deliver `<PokerTable>` that renders feature-parity scenes from a `TableState` prop. **No consumer changes yet.**

Deliverables: T-001…T-013. **Exit criteria:** `<PokerTable state={fixture}>` renders a scene visually equivalent to `createPokerScene(...)`'s output on the same fixture; all existing tests still pass; no consumer uses the new scene yet.

### Phase 2 — Visual Upgrades

PBR materials, animated dealing, chip motion, pot sweep, showdown reveal, theme.

Deliverables: T-014…T-020.

### Phase 3 — Player Presence & Camera

Nameplates, live stack, action badges, action highlights, dealer/blind markers, camera presets, per-hand scrubber, **Session Timeline** (playback-only).

Deliverables: T-021…T-029.

### Phase 4 — Equity Overlay (Dealer + Playback)

Gated equity fetching and badge rendering with triple-layer enforcement.

Deliverables: T-030…T-033.

### Phase 5 — Player POV Hardening

`canSee()`, seat-locked camera, zero-equity compose.

Deliverables: T-034…T-037.

### Phase 6 — Performance & Mobile

Quality tiers, FPS monitor, auto-degrade, mobile audit.

Deliverables: T-038…T-041.

### Phase 7 — Consumer Migration

Swap real consumers over one by one, gated by Scott review.

Deliverables: T-042…T-051.

### Phase 8 — Cleanup

Delete the vanilla module and update docs.

Deliverables: T-052…T-055.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| R3F + React 19 compatibility gaps | T-001 verifies compatible versions via Context7 + `npm install` smoke test before any code is written; if R3F v9+ isn't ready on React 19, pin to the latest tested version with a written decision log. |
| Mobile perf regression from PBR + shadows + env map + instancing | Quality tiers gate every new visual feature (T-038); `useFPSMonitor` auto-degrades (T-039); physical-device audit (T-040) before migrating consumers. |
| Scope creep across 8 phases and 55 tasks | Strict phase ordering. Each phase has an explicit exit criterion. Scott reviews at every phase boundary (Anna loop). |
| Existing test suites break during rewrite | Tests rewritten as behavioral assertions against the `<PokerTable>` public API (T-043, T-049). Preserve: renders canvas, updates on hand change, no leaks on mount/unmount, `externalResize` semantics. |
| Opponent card leakage in player mode | Triple-layer defense: (1) `canSee()` at render, (2) `resolveEquityOverlay` at prop time, (3) ESLint rule blocking equity imports in player files. Integration tests (T-050, T-055) assert zero leaks. |
| Texture atlas memory on low-end GPUs | Tier-aware atlas size (1024² on Low, 2048² otherwise). Offscreen canvas disposed after `CanvasTexture` construction. |
| Animation bugs from rapid state churn | All tweens keyed by stable identity (card `id`, seat+action id, hand-id). Tests (T-016, T-017) assert no stale meshes after rapid street toggles. |
| Session Timeline / per-hand scrubber conflict | `<SessionReplayShell>` is the single source of truth for `handIndex` and `streetIndex` via the `replay` store slice; per-hand scrubber reads/writes the same slice. No prop drilling. |
| `prefers-reduced-motion` compliance | One `useReducedMotion()` hook consumed by every animation site. Snapshot test (T-015) verifies all tween sites import it. |
| Existing client-side equity in PlaybackView (`poker/evaluator.ts`) becomes dead code | T-046 removes the client-side `calculateEquity` path from PlaybackView and switches to `useEquityQuery`. Evaluator module stays unless T-055 audit proves it fully unreferenced. |
| ETag/conditional fetch confusion | `useTableStateQuery` uses `fetchHandStatusConditional` for live dealer/player modes; playback uses uncached `fetchHand` for determinism. |

---

## External Dependencies

**New npm packages (added in T-001):**
- `@react-three/fiber` — compatible with `react@19` + `three@0.183`
- `@react-three/drei` — compatible with above

**Unchanged:** `three@0.183.2`, `zustand@5.0.5`, `@tanstack/react-query@5.99`, `react-router-dom@7.5` (HashRouter), `vitest@4.1`, `happy-dom@20.8`.

**Backend:** no changes. No new endpoints, no new migrations, no new Pydantic models. Every piece of data the scene needs is already served by [backend/src/app/routes/games.py](backend/src/app/routes/games.py) and [backend/src/app/routes/hands.py](backend/src/app/routes/hands.py).

**Environment variables:** none added.
