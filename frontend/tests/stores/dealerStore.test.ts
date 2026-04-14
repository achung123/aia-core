import { describe, it, expect, beforeEach } from 'vitest';
import { useDealerStore, validateOutcomeStreets } from '../../src/../src/stores/dealerStore';

// Helper: get a fresh state snapshot
const getState = () => useDealerStore.getState();

beforeEach(() => {
  // Reset store to initial state before each test
  useDealerStore.getState().reset();
});

describe('initial state', () => {
  it('has the correct shape', () => {
    const s = getState();
    expect(s.gameId).toBeNull();
    expect(s.currentHandId).toBeNull();
    expect(s.players).toEqual([]);
    expect(s.community).toEqual({
      flop1: null, flop2: null, flop3: null, flopRecorded: false,
      turn: null, turnRecorded: false, river: null, riverRecorded: false,
    });
    expect(s.currentStep).toBe('gameSelector');
    expect(s.handCount).toBe(0);
    expect(s.gameDate).toBeNull();
  });
});

describe('setGame', () => {
  it('sets gameId, initializes players, resets community, sets step to dashboard', () => {
    getState().setGame({ gameId: 42, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    const s = getState();

    expect(s.gameId).toBe(42);
    expect(s.gameDate).toBe('2026-04-08');
    expect(s.currentStep).toBe('dashboard');
    expect(s.players).toEqual([
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
    ]);
    expect(s.community).toEqual({
      flop1: null, flop2: null, flop3: null, flopRecorded: false,
      turn: null, turnRecorded: false, river: null, riverRecorded: false,
    });
  });

  it('preserves current step when setting up game', () => {
    getState().setGame({ gameId: 42, players: ['Alice'], gameDate: '2026-04-08' });
    expect(getState().currentStep).toBe('dashboard');
  });

  it('sets step to dashboard when setting game', () => {
    getState().setGame({ gameId: 42, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    const s = getState();
    expect(s.currentStep).toBe('dashboard');
  });
});

describe('setPlayerCards', () => {
  it('updates a specific player and marks them recorded: true', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    const s = getState();

    expect(s.players[0]).toEqual({
      name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null, lastAction: null,
    });
    expect(s.players[1]).toEqual({
      name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null,
    });
  });
});

describe('setCommunityCards', () => {
  it('stores community cards and marks recorded flags', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setCommunityCards({ flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' });
    const s = getState();

    expect(s.community).toEqual({
      flop1: '2h', flop2: '3c', flop3: '5d', flopRecorded: true,
      turn: 'Js', turnRecorded: true, river: 'Qh', riverRecorded: true,
    });
  });
});

describe('setHandId', () => {
  it('stores the hand ID', () => {
    getState().setHandId(123);
    expect(getState().currentHandId).toBe(123);
  });

  it('overwrites a previous hand ID', () => {
    getState().setHandId(100);
    getState().setHandId(200);
    expect(getState().currentHandId).toBe(200);
  });
});

describe('setPlayerResult (SET_PLAYER_STATUS equivalent)', () => {
  it('sets a player status to won with outcomeStreet', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Alice', status: 'won', outcomeStreet: 'river' });
    const s = getState();

    expect(s.players[0].status).toBe('won');
    expect(s.players[0].outcomeStreet).toBe('river');
    expect(s.players[1].status).toBe('playing');
    expect(s.players[1].outcomeStreet).toBeNull();
  });

  it('sets a player status to folded with outcomeStreet', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Alice', status: 'folded', outcomeStreet: 'flop' });
    expect(getState().players[0].status).toBe('folded');
    expect(getState().players[0].outcomeStreet).toBe('flop');
  });

  it('sets a player status to lost with outcomeStreet', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Alice', status: 'lost', outcomeStreet: 'turn' });
    expect(getState().players[0].status).toBe('lost');
    expect(getState().players[0].outcomeStreet).toBe('turn');
  });

  it('sets not_playing status with null outcomeStreet', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Alice', status: 'not_playing', outcomeStreet: null });
    expect(getState().players[0].status).toBe('not_playing');
    expect(getState().players[0].outcomeStreet).toBeNull();
  });

  it('leaves unmatched players unchanged', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob', 'Charlie'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Bob', status: 'folded' });
    const s = getState();

    expect(s.players[0].status).toBe('playing');
    expect(s.players[1].status).toBe('folded');
    expect(s.players[2].status).toBe('playing');
  });
});

describe('newHand (RESET_HAND equivalent)', () => {
  it('clears all card data but preserves gameId, player names, and gameDate', () => {
    getState().setGame({ gameId: 7, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    getState().setCommunityCards({ flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' });
    getState().newHand();
    const s = getState();

    expect(s.gameId).toBe(7);
    expect(s.gameDate).toBe('2026-04-08');
    expect(s.currentHandId).toBeNull();
    expect(s.players).toEqual([
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
    ]);
    expect(s.community).toEqual({
      flop1: null, flop2: null, flop3: null, flopRecorded: false,
      turn: null, turnRecorded: false, river: null, riverRecorded: false,
    });
    expect(s.currentStep).toBe('dashboard');
  });

  it('increments handCount', () => {
    getState().setGame({ gameId: 7, players: ['Alice'], gameDate: '2026-04-08' });
    getState().newHand();
    expect(getState().handCount).toBe(1);
    getState().newHand();
    expect(getState().handCount).toBe(2);
  });
});

describe('finishHand', () => {
  it('resets cards, statuses, currentHandId, and goes to dashboard', () => {
    getState().setGame({ gameId: 7, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setHandId(42);
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    getState().setPlayerResult({ name: 'Alice', status: 'won' });
    getState().setCommunityCards({ flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' });
    getState().finishHand();
    const s = getState();

    expect(s.gameId).toBe(7);
    expect(s.currentHandId).toBeNull();
    expect(s.currentStep).toBe('dashboard');
    expect(s.players).toEqual([
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
    ]);
    expect(s.community).toEqual({
      flop1: null, flop2: null, flop3: null, flopRecorded: false,
      turn: null, turnRecorded: false, river: null, riverRecorded: false,
    });
  });

  it('increments handCount', () => {
    getState().setGame({ gameId: 7, players: ['Alice'], gameDate: '2026-04-08' });
    getState().finishHand();
    expect(getState().handCount).toBe(1);
    getState().finishHand();
    expect(getState().handCount).toBe(2);
  });

  it('preserves gameDate', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().finishHand();
    expect(getState().gameDate).toBe('2026-04-08');
  });
});

describe('reset', () => {
  it('restores to initial state', () => {
    getState().setGame({ gameId: 42, players: ['Alice'], gameDate: '2026-04-08' });
    getState().reset();
    const s = getState();
    expect(s.gameId).toBeNull();
    expect(s.players).toEqual([]);
    expect(s.currentStep).toBe('gameSelector');
  });
});

describe('restoreState', () => {
  it('preserves review step on restore (review is step 4 — hand summary)', () => {
    getState().restoreState({
      gameId: 1, currentStep: 'review', players: [],
      community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false },
    });
    expect(getState().currentStep).toBe('review');
  });

  it('normalizes outcome step to activeHand on restore', () => {
    getState().restoreState({
      gameId: 1, currentStep: 'outcome', players: [],
      community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false },
    });
    expect(getState().currentStep).toBe('activeHand');
  });

  it('preserves safe steps like dashboard on restore', () => {
    getState().restoreState({
      gameId: 1, currentStep: 'dashboard', players: [],
      community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false },
    });
    expect(getState().currentStep).toBe('dashboard');
  });
});

describe('setCommunityRecorded (SET_COMMUNITY_RECORDED equivalent)', () => {
  it('marks individual street as recorded via setFlopCards', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setFlopCards({ flop1: '2h', flop2: '3c', flop3: '5d' });
    const s = getState();
    expect(s.community.flop1).toBe('2h');
    expect(s.community.flop2).toBe('3c');
    expect(s.community.flop3).toBe('5d');
    expect(s.community.flopRecorded).toBe(true);
  });

  it('marks turn as recorded via setTurnCard', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setTurnCard('Js');
    expect(getState().community.turn).toBe('Js');
    expect(getState().community.turnRecorded).toBe(true);
  });

  it('marks river as recorded via setRiverCard', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setRiverCard('Qh');
    expect(getState().community.river).toBe('Qh');
    expect(getState().community.riverRecorded).toBe(true);
  });
});

describe('loadHand', () => {
  it('hydrates players and community from API hand data', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob', 'Charlie'], gameDate: '2026-04-08' });
    getState().loadHand({
      hand_number: 3,
      flop_1: '2H', flop_2: '3C', flop_3: '5D',
      turn: 'JS', river: 'QH',
      player_hands: [
        { player_name: 'Alice', card_1: 'AH', card_2: 'KD', result: 'won', profit_loss: 50, outcome_street: 'river' },
        { player_name: 'Bob', card_1: '9S', card_2: 'TC', result: 'lost', profit_loss: -25, outcome_street: 'turn' },
      ],
    });
    const s = getState();

    expect(s.currentHandId).toBe(3);
    expect(s.currentStep).toBe('activeHand');
    expect(s.community).toEqual({
      flop1: '2H', flop2: '3C', flop3: '5D', flopRecorded: true,
      turn: 'JS', turnRecorded: true, river: 'QH', riverRecorded: true,
    });
    expect(s.players[0]).toEqual({
      name: 'Alice', card1: 'AH', card2: 'KD', recorded: true, status: 'won', outcomeStreet: 'river', lastAction: null,
    });
    expect(s.players[1]).toEqual({
      name: 'Bob', card1: '9S', card2: 'TC', recorded: true, status: 'lost', outcomeStreet: 'turn', lastAction: null,
    });
    expect(s.players[2]).toEqual({
      name: 'Charlie', card1: null, card2: null, recorded: false, status: 'not_playing', outcomeStreet: null, lastAction: null,
    });
  });

  it('handles hand with no community cards', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().loadHand({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
    expect(getState().community.flopRecorded).toBe(false);
    expect(getState().players[0].status).toBe('playing');
  });

  it('handles player with null cards (folded without showing)', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().loadHand({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [
        { player_name: 'Alice', card_1: null, card_2: null, result: 'folded', profit_loss: -10 },
      ],
    });
    expect(getState().players[0]).toEqual({
      name: 'Alice', card1: null, card2: null, recorded: true, status: 'folded', outcomeStreet: null, lastAction: null,
    });
  });
});

describe('setStep', () => {
  it('updates currentStep', () => {
    getState().setStep('activeHand');
    expect(getState().currentStep).toBe('activeHand');
  });
});

describe('updateParticipation', () => {
  it('maps participation_status onto matching players', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().updateParticipation({
      players: [
        { name: 'Alice', participation_status: 'joined' },
        { name: 'Bob', participation_status: 'pending' },
      ],
    });
    const s = getState();
    expect(s.players[0].status).toBe('joined');
    expect(s.players[1].status).toBe('pending');
  });

  it('leaves unmatched players unchanged', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().updateParticipation({
      players: [{ name: 'Alice', participation_status: 'joined' }],
    });
    expect(getState().players[0].status).toBe('joined');
    expect(getState().players[1].status).toBe('playing');
  });

  it('preserves other player fields (cards, recorded, outcomeStreet)', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    getState().updateParticipation({
      players: [{ name: 'Alice', participation_status: 'joined' }],
    });
    const p = getState().players[0];
    expect(p.card1).toBe('Ah');
    expect(p.card2).toBe('Kd');
    expect(p.recorded).toBe(true);
    expect(p.status).toBe('joined');
  });

  it('does not let stale poll reset recorded player to idle', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    getState().updateParticipation({
      players: [
        { name: 'Alice', participation_status: 'idle' },
        { name: 'Bob', participation_status: 'pending' },
      ],
    });
    expect(getState().players[0].status).toBe('playing');
    expect(getState().players[0].recorded).toBe(true);
    expect(getState().players[1].status).toBe('pending');
  });

  it('does not let stale poll reset recorded player to playing', () => {
    getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-08' });
    getState().setPlayerCards({ name: 'Alice', card1: 'Ah', card2: 'Kd' });
    getState().setPlayerResult({ name: 'Alice', status: 'won', outcomeStreet: 'river' });
    getState().updateParticipation({
      players: [{ name: 'Alice', participation_status: 'playing' }],
    });
    expect(getState().players[0].status).toBe('won');
    expect(getState().players[0].recorded).toBe(true);
  });

  it('does not let poll reset a sit-out (not_playing) player back to idle/playing', () => {
    getState().setGame({ gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' });
    getState().setPlayerResult({ name: 'Alice', status: 'not_playing', outcomeStreet: null });
    expect(getState().players[0].status).toBe('not_playing');
    expect(getState().players[0].recorded).toBe(false);

    getState().updateParticipation({
      players: [
        { name: 'Alice', participation_status: 'idle' },
        { name: 'Bob', participation_status: 'pending' },
      ],
    });
    expect(getState().players[0].status).toBe('not_playing');
    expect(getState().players[1].status).toBe('pending');
  });
});

describe('validateOutcomeStreets', () => {
  it('returns null when all outcomes are on the same street', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'river' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('allows folders on earlier streets than the winner', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'flop' },
      { name: 'Carol', status: 'folded', outcomeStreet: 'turn' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('allows folder on preflop when winner on river', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'preflop' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('returns error when loser lost on a different street than winner', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'flop' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'river' },
    ];
    const err = validateOutcomeStreets(players as never[]);
    expect(err).toBeTruthy();
    expect(err).toContain('Bob');
  });

  it('returns error when folder folded after the winner won', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'flop' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'turn' },
    ];
    const err = validateOutcomeStreets(players as never[]);
    expect(err).toBeTruthy();
  });

  it('returns null when no decided players have outcome streets', () => {
    const players = [
      { name: 'Alice', status: 'playing', outcomeStreet: null },
      { name: 'Bob', status: 'folded', outcomeStreet: null },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('returns null when there are not_playing players', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'not_playing', outcomeStreet: null },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('allows losers on the same street as the winner', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'turn' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'turn' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('returns null when winner won preflop and folder folded preflop', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'preflop' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'preflop' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });

  it('returns error when folder folded on flop but winner won preflop', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'preflop' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'flop' },
    ];
    const err = validateOutcomeStreets(players as never[]);
    expect(err).toBeTruthy();
  });

  it('returns error when loser is on earlier street and winner on later', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'turn' },
    ];
    const err = validateOutcomeStreets(players as never[]);
    expect(err).toBeTruthy();
  });

  it('allows multiple folders on different earlier streets', () => {
    const players = [
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'folded', outcomeStreet: 'preflop' },
      { name: 'Carol', status: 'folded', outcomeStreet: 'flop' },
      { name: 'Dave', status: 'lost', outcomeStreet: 'river' },
    ];
    expect(validateOutcomeStreets(players as never[])).toBeNull();
  });
});

describe('persist middleware', () => {
  it('store has persist configuration with aia_dealer_state key', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persistApi = (useDealerStore as any).persist;
    expect(persistApi).toBeDefined();
    expect(persistApi.getOptions().name).toBe('aia_dealer_state');
  });
});
