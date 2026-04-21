import { describe, it, expect } from 'vitest';
import { handsToTableState } from '../../src/scenes3d/data/handsToTableState';
import type {
  GameSessionResponse,
  HandResponse,
  PlayerInfo,
} from '../../src/api/types/game';
import type {
  HandStatusResponse,
  HandActionResponse,
  PlayerStatusEntry,
} from '../../src/api/types/dealer';

// --- Fixture helpers -------------------------------------------------------

function makePlayer(
  name: string,
  seat: number,
  overrides: Partial<PlayerInfo> = {},
): PlayerInfo {
  return {
    name,
    is_active: true,
    seat_number: seat,
    buy_in: 100,
    current_chips: 100,
    rebuy_count: 0,
    total_rebuys: 0,
    ...overrides,
  };
}

function makeGame(players: PlayerInfo[]): GameSessionResponse {
  return {
    game_id: 1,
    game_date: '2026-04-18',
    status: 'active',
    created_at: '2026-04-18T00:00:00Z',
    player_names: players.map((p) => p.name),
    players,
    hand_count: 1,
    winners: [],
    default_buy_in: 100,
  };
}

function makeHand(overrides: Partial<HandResponse> = {}): HandResponse {
  return {
    hand_id: 10,
    game_id: 1,
    hand_number: 1,
    flop_1: null,
    flop_2: null,
    flop_3: null,
    turn: null,
    river: null,
    source_upload_id: null,
    sb_player_name: null,
    bb_player_name: null,
    pot: 0,
    side_pots: [],
    created_at: '2026-04-18T00:00:00Z',
    player_hands: [],
    ...overrides,
  };
}

function makeStatusPlayer(
  name: string,
  overrides: Partial<PlayerStatusEntry> = {},
): PlayerStatusEntry {
  return {
    name,
    participation_status: 'playing',
    card_1: null,
    card_2: null,
    result: null,
    outcome_street: null,
    is_current_turn: false,
    last_action: null,
    current_chips: 100,
    pot_contribution: 0,
    ...overrides,
  };
}

function makeStatus(
  phase: HandStatusResponse['phase'],
  players: PlayerStatusEntry[],
  overrides: Partial<HandStatusResponse> = {},
): HandStatusResponse {
  return {
    hand_number: 1,
    community_recorded: false,
    players,
    current_player_name: null,
    legal_actions: [],
    amount_to_call: 0,
    minimum_bet: null,
    minimum_raise: null,
    pot: 0,
    side_pots: [],
    street_complete: false,
    phase,
    ...overrides,
  };
}

const spectator = { policy: 'spectator' as const };

// --- Tests ----------------------------------------------------------------

describe('handsToTableState', () => {
  describe('phase + streetIndex', () => {
    it('uses status.phase when provided (preflop → 0)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand();
      const status = makeStatus('preflop', [makeStatusPlayer('Alice')]);
      const ts = handsToTableState({ game, hand, status, viewer: spectator });
      expect(ts.phase).toBe('preflop');
      expect(ts.streetIndex).toBe(0);
    });

    it('maps awaiting_cards → 0', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('awaiting_cards', [makeStatusPlayer('Alice')]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.streetIndex).toBe(0);
    });

    it('maps flop → 1, turn → 2, river → 3, showdown → 4', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      (['flop', 'turn', 'river', 'showdown'] as const).forEach((phase, i) => {
        const status = makeStatus(phase, [makeStatusPlayer('Alice')]);
        const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
        expect(ts.streetIndex).toBe(i + 1);
      });
    });

    it('derives phase from hand when status is null (preflop)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const ts = handsToTableState({ game, hand: makeHand(), viewer: spectator });
      expect(ts.phase).toBe('preflop');
      expect(ts.streetIndex).toBe(0);
    });

    it('derives phase from hand when status is null (flop)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({ flop_1: 'Ah', flop_2: 'Kd', flop_3: '2c' });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.phase).toBe('flop');
      expect(ts.streetIndex).toBe(1);
    });

    it('derives phase from hand when status is null (turn)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({
        flop_1: 'Ah', flop_2: 'Kd', flop_3: '2c', turn: '5s',
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.phase).toBe('turn');
      expect(ts.streetIndex).toBe(2);
    });

    it('derives phase from hand when status is null (river)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({
        flop_1: 'Ah', flop_2: 'Kd', flop_3: '2c', turn: '5s', river: '9h',
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.phase).toBe('river');
      expect(ts.streetIndex).toBe(3);
    });
  });

  describe('community cards', () => {
    it('returns length-5 array with nulls before reveal', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const ts = handsToTableState({ game, hand: makeHand(), viewer: spectator });
      expect(ts.community).toHaveLength(5);
      expect(ts.community.every((c) => c === null)).toBe(true);
    });

    it('parses flop/turn/river and keeps unset slots null', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({
        flop_1: 'Ah', flop_2: '10d', flop_3: '2c', turn: '5s', river: null,
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.community[0]).toEqual({ rank: 'A', suit: 'h', id: 'Ah' });
      expect(ts.community[1]).toEqual({ rank: '10', suit: 'd', id: '10d' });
      expect(ts.community[2]).toEqual({ rank: '2', suit: 'c', id: '2c' });
      expect(ts.community[3]).toEqual({ rank: '5', suit: 's', id: '5s' });
      expect(ts.community[4]).toBeNull();
    });
  });

  describe('seats', () => {
    it('builds a SeatState for each game player', () => {
      const game = makeGame([makePlayer('Alice', 1), makePlayer('Bob', 2)]);
      const hand = makeHand({
        player_hands: [
          {
            player_hand_id: 1, hand_id: 10, player_id: 1, player_name: 'Alice',
            card_1: 'Ah', card_2: 'Kd', result: null, profit_loss: null,
            outcome_street: null, winning_hand_description: null,
          },
        ],
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.seats).toHaveLength(2);
      const alice = ts.seats.find((s) => s.playerName === 'Alice')!;
      expect(alice.seatIndex).toBe(1);
      expect(alice.holeCards).toEqual([
        { rank: 'A', suit: 'h', id: 'Ah' },
        { rank: 'K', suit: 'd', id: 'Kd' },
      ]);
      expect(alice.folded).toBe(false);
      const bob = ts.seats.find((s) => s.playerName === 'Bob')!;
      expect(bob.holeCards).toBeNull();
    });

    it('marks folded result correctly', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({
        player_hands: [
          {
            player_hand_id: 1, hand_id: 10, player_id: 1, player_name: 'Alice',
            card_1: null, card_2: null, result: 'folded', profit_loss: -5,
            outcome_street: 'flop', winning_hand_description: null,
          },
        ],
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.seats[0].folded).toBe(true);
      expect(ts.seats[0].result).toBe('folded');
      expect(ts.seats[0].profitLoss).toBe(-5);
    });

    it('prefers status current_chips over player current_chips', () => {
      const game = makeGame([makePlayer('Alice', 1, { current_chips: 100 })]);
      const status = makeStatus('preflop', [
        makeStatusPlayer('Alice', { current_chips: 42 }),
      ]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.seats[0].stack).toBe(42);
    });

    it('falls back to player current_chips when status missing', () => {
      const game = makeGame([makePlayer('Alice', 1, { current_chips: 77 })]);
      const ts = handsToTableState({ game, hand: makeHand(), viewer: spectator });
      expect(ts.seats[0].stack).toBe(77);
    });

    it('committedThisStreet sums actions for current phase only', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [makeStatusPlayer('Alice')]);
      const actions: HandActionResponse[] = [
        { player_name: 'Alice', street: 'preflop', action: 'call', amount: 2, created_at: '' },
        { player_name: 'Alice', street: 'flop', action: 'bet', amount: 5, created_at: '' },
        { player_name: 'Alice', street: 'flop', action: 'raise', amount: 10, created_at: '' },
        { player_name: 'Bob', street: 'flop', action: 'call', amount: 99, created_at: '' },
      ];
      const ts = handsToTableState({
        game, hand: makeHand(), status, actions, viewer: spectator,
      });
      expect(ts.seats[0].committedThisStreet).toBe(15);
    });

    it('committedThisStreet = 0 when actions is null', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [makeStatusPlayer('Alice')]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.seats[0].committedThisStreet).toBe(0);
    });

    it('parses last_action into structured shape', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [
        makeStatusPlayer('Alice', { last_action: 'raise' }),
      ]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.seats[0].lastAction).toEqual({ action: 'raise', street: 'flop' });
    });

    it('null last_action → null', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [makeStatusPlayer('Alice')]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.seats[0].lastAction).toBeNull();
    });

    it('prefers actions[] list — populates amount and real street (T-017)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [
        // Status entry only carries a string verb; actions[] is authoritative.
        makeStatusPlayer('Alice', { last_action: 'raise' }),
      ]);
      const actions: HandActionResponse[] = [
        { player_name: 'Alice', street: 'preflop', action: 'call', amount: 2, created_at: '' },
        { player_name: 'Alice', street: 'flop', action: 'raise', amount: 10, created_at: '' },
      ];
      const ts = handsToTableState({
        game, hand: makeHand(), status, actions, viewer: spectator,
      });
      expect(ts.seats[0].lastAction).toEqual({
        action: 'raise', amount: 10, street: 'flop',
      });
    });

    it('falls back to status.last_action when actions[] is empty (T-017)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [
        makeStatusPlayer('Alice', { last_action: 'check' }),
      ]);
      const ts = handsToTableState({
        game, hand: makeHand(), status, actions: [], viewer: spectator,
      });
      // No actions → fall back to the legacy string path (no amount).
      expect(ts.seats[0].lastAction).toEqual({ action: 'check', street: 'flop' });
    });

    it('preserves the prior-street `street` on lastAction when taken from actions[] (T-017 AC 2)', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('turn', [
        makeStatusPlayer('Alice', { last_action: 'bet' }),
      ]);
      const actions: HandActionResponse[] = [
        // Alice's most recent action is a preflop bet; phase advanced to turn.
        { player_name: 'Alice', street: 'preflop', action: 'bet', amount: 4, created_at: '' },
      ];
      const ts = handsToTableState({
        game, hand: makeHand(), status, actions, viewer: spectator,
      });
      expect(ts.seats[0].lastAction).toEqual({
        action: 'bet', amount: 4, street: 'preflop',
      });
    });

    it('handles null seat_number (uses -1)', () => {
      const game = makeGame([makePlayer('Ghost', 0, { seat_number: null })]);
      const ts = handsToTableState({ game, hand: makeHand(), viewer: spectator });
      expect(ts.seats[0].seatIndex).toBe(-1);
    });
  });

  describe('seat resolution for blinds + current player', () => {
    it('maps sb/bb/current player names to seat numbers', () => {
      const game = makeGame([
        makePlayer('Alice', 1),
        makePlayer('Bob', 2),
        makePlayer('Carol', 3),
      ]);
      const hand = makeHand({ sb_player_name: 'Alice', bb_player_name: 'Bob' });
      const status = makeStatus('preflop', [
        makeStatusPlayer('Alice'),
        makeStatusPlayer('Bob'),
        makeStatusPlayer('Carol'),
      ], { current_player_name: 'Carol' });
      const ts = handsToTableState({ game, hand, status, viewer: spectator });
      expect(ts.sbSeat).toBe(1);
      expect(ts.bbSeat).toBe(2);
      expect(ts.currentSeat).toBe(3);
    });

    it('returns null (not throws) for unknown names', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({ sb_player_name: 'Nobody', bb_player_name: null });
      const status = makeStatus('preflop', [makeStatusPlayer('Alice')], {
        current_player_name: 'NoOne',
      });
      const ts = handsToTableState({ game, hand, status, viewer: spectator });
      expect(ts.sbSeat).toBeNull();
      expect(ts.bbSeat).toBeNull();
      expect(ts.currentSeat).toBeNull();
    });

    it('derives dealerSeat as seat before SB (3+ players)', () => {
      const game = makeGame([
        makePlayer('Alice', 1),
        makePlayer('Bob', 2),
        makePlayer('Carol', 3),
      ]);
      const hand = makeHand({ sb_player_name: 'Bob', bb_player_name: 'Carol' });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.dealerSeat).toBe(1); // Alice
    });

    it('dealerSeat == sbSeat in heads-up (2 players)', () => {
      const game = makeGame([makePlayer('Alice', 1), makePlayer('Bob', 2)]);
      const hand = makeHand({ sb_player_name: 'Alice', bb_player_name: 'Bob' });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.dealerSeat).toBe(1);
    });

    it('dealerSeat null when sbSeat unknown', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const ts = handsToTableState({ game, hand: makeHand(), viewer: spectator });
      expect(ts.dealerSeat).toBeNull();
    });
  });

  describe('pot + side pots', () => {
    it('prefers status.pot when available', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const status = makeStatus('flop', [makeStatusPlayer('Alice')], { pot: 123 });
      const hand = makeHand({ pot: 5 });
      const ts = handsToTableState({ game, hand, status, viewer: spectator });
      expect(ts.pot).toBe(123);
    });

    it('falls back to hand.pot when status missing', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const ts = handsToTableState({
        game, hand: makeHand({ pot: 50 }), viewer: spectator,
      });
      expect(ts.pot).toBe(50);
    });

    it('parses side pots best-effort', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({
        side_pots: [{ amount: 30, eligible_players: ['Alice', 'Bob'] }],
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.sidePots).toEqual([
        { amount: 30, eligiblePlayers: ['Alice', 'Bob'] },
      ]);
    });
  });

  describe('regression fixtures', () => {
    it('awaiting_cards: empty hand, no actions, no cards', () => {
      const game = makeGame([makePlayer('Alice', 1), makePlayer('Bob', 2)]);
      const status = makeStatus('awaiting_cards', [
        makeStatusPlayer('Alice'),
        makeStatusPlayer('Bob'),
      ]);
      const ts = handsToTableState({ game, hand: makeHand(), status, viewer: spectator });
      expect(ts.phase).toBe('awaiting_cards');
      expect(ts.streetIndex).toBe(0);
      expect(ts.community.every((c) => c === null)).toBe(true);
      expect(ts.seats.every((s) => s.committedThisStreet === 0)).toBe(true);
    });

    it('6-player all-in + split pot (showdown)', () => {
      const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const game = makeGame(names.map((n, i) => makePlayer(n, i + 1)));
      const hand = makeHand({
        flop_1: 'Ah', flop_2: 'Kh', flop_3: 'Qh', turn: 'Jh', river: '2c',
        sb_player_name: 'P1', bb_player_name: 'P2',
        pot: 600,
        side_pots: [
          { amount: 400, eligible_players: ['P3', 'P4'] },
          { amount: 200, eligible_players: ['P5', 'P6'] },
        ],
        player_hands: names.map((n, i) => ({
          player_hand_id: i + 1, hand_id: 10, player_id: i + 1, player_name: n,
          card_1: 'Ts', card_2: '9s',
          result: n === 'P3' || n === 'P4' ? 'won' : n === 'P1' ? 'folded' : 'lost',
          profit_loss: n === 'P3' || n === 'P4' ? 200 : -100,
          outcome_street: 'showdown',
          winning_hand_description: n === 'P3' || n === 'P4' ? 'Flush' : null,
        })),
      });
      const status = makeStatus('showdown', names.map((n) => makeStatusPlayer(n, {
        pot_contribution: 100,
      })), {
        pot: 600,
        side_pots: [
          { amount: 400, eligible_players: ['P3', 'P4'] },
          { amount: 200, eligible_players: ['P5', 'P6'] },
        ],
      });
      const ts = handsToTableState({ game, hand, status, viewer: spectator });
      expect(ts.phase).toBe('showdown');
      expect(ts.streetIndex).toBe(4);
      expect(ts.seats).toHaveLength(6);
      expect(ts.sidePots).toHaveLength(2);
      expect(ts.sidePots[0]).toEqual({ amount: 400, eligiblePlayers: ['P3', 'P4'] });
      const winners = ts.seats.filter((s) => s.result === 'won');
      expect(winners).toHaveLength(2);
      expect(winners.every((w) => w.profitLoss === 200)).toBe(true);
      const p1 = ts.seats.find((s) => s.playerName === 'P1')!;
      expect(p1.folded).toBe(true);
    });

    it('fold-before-showdown: sole remaining player won', () => {
      const game = makeGame([makePlayer('Alice', 1), makePlayer('Bob', 2)]);
      const hand = makeHand({
        flop_1: 'Ah', flop_2: 'Kd', flop_3: '2c',
        pot: 20,
        player_hands: [
          {
            player_hand_id: 1, hand_id: 10, player_id: 1, player_name: 'Alice',
            card_1: null, card_2: null, result: 'won', profit_loss: 10,
            outcome_street: 'flop', winning_hand_description: null,
          },
          {
            player_hand_id: 2, hand_id: 10, player_id: 2, player_name: 'Bob',
            card_1: null, card_2: null, result: 'folded', profit_loss: -10,
            outcome_street: 'flop', winning_hand_description: null,
          },
        ],
      });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      const alice = ts.seats.find((s) => s.playerName === 'Alice')!;
      const bob = ts.seats.find((s) => s.playerName === 'Bob')!;
      expect(alice.result).toBe('won');
      expect(alice.folded).toBe(false);
      expect(bob.folded).toBe(true);
    });
  });

  describe('top-level fields', () => {
    it('returns gameId, handId, handNumber from inputs', () => {
      const game = makeGame([makePlayer('Alice', 1)]);
      const hand = makeHand({ hand_id: 999, hand_number: 42, game_id: 1 });
      const ts = handsToTableState({ game, hand, viewer: spectator });
      expect(ts.gameId).toBe(1);
      expect(ts.handId).toBe(999);
      expect(ts.handNumber).toBe(42);
    });
  });
});
