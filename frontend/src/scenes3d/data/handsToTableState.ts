// Pure adapter composing GameSessionResponse + HandResponse + HandStatusResponse
// + HandActionResponse[] into a single TableState consumed by <PokerTable>.
// Spec: see specs/table-3d-revamp-010/plan.md § "Adapter".

import type {
  GameSessionResponse,
  HandResponse,
} from '../../api/types/game';
import type {
  HandActionResponse,
  HandStatusResponse,
} from '../../api/types/dealer';
import type {
  ActionName,
  CardRef,
  ResultLabel,
  SeatState,
  Suit,
  TableState,
  TableStatePhase,
  ViewerContext,
} from '../types';

const VALID_SUITS = new Set<Suit>(['s', 'h', 'd', 'c']);

function parseCard(raw: string | null | undefined): CardRef | null {
  if (!raw) return null;
  const suitChar = raw.slice(-1).toLowerCase();
  if (!VALID_SUITS.has(suitChar as Suit)) return null;
  const rank = raw.slice(0, -1);
  if (!rank) return null;
  const suit = suitChar as Suit;
  return { rank, suit, id: `${rank}${suit}` };
}

function parseCommunity(hand: HandResponse): (CardRef | null)[] {
  return [
    parseCard(hand.flop_1),
    parseCard(hand.flop_2),
    parseCard(hand.flop_3),
    parseCard(hand.turn),
    parseCard(hand.river),
  ];
}

function derivePhase(hand: HandResponse): TableStatePhase {
  if (hand.river) return 'river';
  if (hand.turn) return 'turn';
  if (hand.flop_1) return 'flop';
  return 'preflop';
}

function streetIndexFromPhase(phase: TableStatePhase): 0 | 1 | 2 | 3 | 4 {
  switch (phase) {
    case 'awaiting_cards':
    case 'preflop':
      return 0;
    case 'flop':
      return 1;
    case 'turn':
      return 2;
    case 'river':
      return 3;
    case 'showdown':
      return 4;
    default:
      return 0;
  }
}

function sumActions(
  actions: HandActionResponse[] | undefined,
  playerName: string,
  phase: TableStatePhase,
): number {
  if (!actions || actions.length === 0) return 0;
  let total = 0;
  for (const a of actions) {
    if (a.player_name !== playerName) continue;
    if (a.street !== phase) continue;
    if (typeof a.amount === 'number') total += a.amount;
  }
  return total;
}

const VALID_ACTIONS = new Set<ActionName>([
  'fold', 'check', 'call', 'bet', 'raise', 'all-in',
]);

function parseAction(
  raw: string | null | undefined,
  phase: TableStatePhase,
): SeatState['lastAction'] {
  if (!raw) return null;
  const action = raw as ActionName;
  if (!VALID_ACTIONS.has(action)) return null;
  return { action, street: phase };
}

function parseActionStreet(
  raw: string | null | undefined,
  fallback: TableStatePhase,
): TableStatePhase {
  switch (raw) {
    case 'preflop':
    case 'flop':
    case 'turn':
    case 'river':
    case 'showdown':
    case 'awaiting_cards':
      return raw;
    default:
      return fallback;
  }
}

/**
 * Resolve a seat's `lastAction` with the action's real `street` and
 * (for bet/raise) the committed `amount`. Prefers the `/actions` list
 * (authoritative — carries both `street` and `amount`); falls back to
 * `status.players[].last_action` (string-only) when no actions list is
 * available. Resolves the T-017 deferral noted against T-003 LOW #4.
 */
function deriveLastAction(
  actions: HandActionResponse[] | undefined,
  playerName: string,
  statusLastAction: string | null | undefined,
  phase: TableStatePhase,
  result: string | null | undefined,
  outcomeStreet: string | null | undefined,
): SeatState['lastAction'] {
  if (actions && actions.length > 0) {
    // Actions are assumed chronological; the last matching entry is the
    // player's most recent action in the hand.
    let latest: HandActionResponse | null = null;
    for (const a of actions) {
      if (a.player_name !== playerName) continue;
      latest = a;
    }
    if (latest) {
      if (!VALID_ACTIONS.has(latest.action as ActionName)) return null;
      const out: NonNullable<SeatState['lastAction']> = {
        action: latest.action as ActionName,
        street: latest.street as TableStatePhase,
      };
      if (typeof latest.amount === 'number') {
        out.amount = latest.amount;
      }
      return out;
    }
  }
  const parsed = parseAction(statusLastAction ?? null, phase);
  if (parsed) return parsed;
  if (result === 'folded') {
    return {
      action: 'fold',
      street: parseActionStreet(outcomeStreet ?? null, phase),
    };
  }
  return null;
}

const VALID_RESULTS = new Set<ResultLabel>([
  'won', 'lost', 'folded', 'handed_back',
]);

function parseResult(raw: string | null | undefined): ResultLabel | null {
  if (!raw) return null;
  return VALID_RESULTS.has(raw as ResultLabel) ? (raw as ResultLabel) : null;
}

function parseSidePots(
  raw: unknown[] | undefined,
): { amount: number; eligiblePlayers: string[] }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      const amount = typeof rec.amount === 'number' ? rec.amount : 0;
      const rawPlayers = Array.isArray(rec.eligible_players)
        ? rec.eligible_players
        : Array.isArray(rec.eligiblePlayers)
          ? rec.eligiblePlayers
          : [];
      const eligiblePlayers = rawPlayers.filter(
        (p): p is string => typeof p === 'string',
      );
      return { amount, eligiblePlayers };
    }
    return { amount: 0, eligiblePlayers: [] };
  });
}

function buildResolvedSeatMap(
  game: GameSessionResponse,
  hand: HandResponse,
): Map<string, number> {
  const explicit = (game.players ?? []).filter(
    (p): p is typeof p & { seat_number: number } => typeof p.seat_number === 'number',
  );
  if (explicit.length > 0) {
    return new Map(explicit.map((p) => [p.name, p.seat_number]));
  }

  // Historical imported games can have full per-hand player/card data but
  // no persisted seat metadata at the session layer. In that case synthesize
  // a stable 1-based seat map from the hand participants, preserving
  // `game.players` order when possible so playback can still render the full
  // table instead of collapsing to zero seats.
  if (hand.player_hands.length === 0) {
    return new Map();
  }

  const handParticipants = new Set(hand.player_hands.map((ph) => ph.player_name));
  const out = new Map<string, number>();
  let nextSeat = 1;

  for (const p of game.players ?? []) {
    if (!handParticipants.has(p.name)) continue;
    out.set(p.name, nextSeat);
    nextSeat += 1;
  }

  for (const ph of hand.player_hands) {
    if (out.has(ph.player_name)) continue;
    out.set(ph.player_name, nextSeat);
    nextSeat += 1;
  }

  return out;
}

function deriveDealerSeat(
  seated: number[],
  sbSeat: number | null,
): number | null {
  if (sbSeat === null) return null;
  if (seated.length === 0) return null;
  if (seated.length <= 2) return sbSeat; // heads-up: dealer == SB
  const idx = seated.indexOf(sbSeat);
  if (idx === -1) return null;
  return idx === 0 ? seated[seated.length - 1] : seated[idx - 1];
}

export function handsToTableState(input: {
  game: GameSessionResponse;
  hand: HandResponse;
  status?: HandStatusResponse;
  actions?: HandActionResponse[];
  viewer: ViewerContext;
}): TableState {
  const { game, hand, status, actions } = input;

  const seatByName = buildResolvedSeatMap(game, hand);
  const seatedNumbers = Array.from(seatByName.values()).sort((a, b) => a - b);
  const playersByName = new Map((game.players ?? []).map((p) => [p.name, p]));

  const phase: TableStatePhase = (status?.phase as TableStatePhase | undefined) ?? derivePhase(hand);

  const seats: SeatState[] = Array.from(seatByName.entries()).map(
    ([playerName, seatIndex]) => {
      const player = playersByName.get(playerName);
      const ph = hand.player_hands.find((x) => x.player_name === playerName);
      const ps = status?.players.find((x) => x.name === playerName);
      const holeCard1 = parseCard(ph?.card_1);
      const holeCard2 = parseCard(ph?.card_2);
      const holeCards: [CardRef, CardRef] | null =
        holeCard1 && holeCard2 ? [holeCard1, holeCard2] : null;

      return {
        seatIndex,
        playerName,
        isActive: player?.is_active ?? true,
        stack: ps?.current_chips ?? player?.current_chips ?? 0,
        committedThisStreet: sumActions(actions, playerName, phase),
        committedTotal: ps?.pot_contribution ?? 0,
        lastAction: deriveLastAction(
          actions,
          playerName,
          ps?.last_action,
          phase,
          ph?.result,
          ph?.outcome_street,
        ),
        holeCards,
        folded: ph?.result === 'folded',
        result: parseResult(ph?.result),
        profitLoss: ph?.profit_loss ?? null,
        winningHand: ph?.winning_hand_description ?? null,
      };
    },
  );

  const sbSeat =
    hand.sb_player_name != null ? (seatByName.get(hand.sb_player_name) ?? null) : null;
  const bbSeat =
    hand.bb_player_name != null ? (seatByName.get(hand.bb_player_name) ?? null) : null;
  const currentSeat =
    status?.current_player_name != null
      ? (seatByName.get(status.current_player_name) ?? null)
      : null;

  return {
    gameId: game.game_id,
    handId: hand.hand_id,
    handNumber: hand.hand_number,
    phase,
    streetIndex: streetIndexFromPhase(phase),
    community: parseCommunity(hand),
    seats,
    pot: status?.pot ?? hand.pot,
    sidePots: parseSidePots(status?.side_pots ?? hand.side_pots),
    dealerSeat: deriveDealerSeat(seatedNumbers, sbSeat),
    sbSeat,
    bbSeat,
    currentSeat,
  };
}
