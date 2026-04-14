import { describe, it, expect } from 'vitest';
import { reducer, initialState, validateOutcomeStreets } from './dealerState.ts';

describe('initialState', () => {
  it('has the correct shape', () => {
    expect(initialState).toEqual({
      gameId: null,
      currentHandId: null,
      players: [],
      community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false },
      currentStep: 'gameSelector',
      handCount: 0,
      gameDate: null,
    });
  });
});

describe('reducer', () => {
  describe('SET_GAME', () => {
    it('sets gameId, initializes players, resets community, sets step to dashboard', () => {
      const action = {
        type: 'SET_GAME' as const,
        payload: { gameId: 42, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      };
      const state = reducer(initialState, action);

      expect(state.gameId).toBe(42);
      expect(state.gameDate).toBe('2026-04-08');
      expect(state.currentStep).toBe('dashboard');
      expect(state.players).toEqual([
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      ]);
      expect(state.community).toEqual({
        flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false,
      });
    });
  });

  describe('SET_PLAYER_CARDS', () => {
    it('updates a specific player and marks them recorded: true', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      expect(state.players[0]).toEqual({
        name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null, lastAction: null,
      });
      // Bob is untouched
      expect(state.players[1]).toEqual({
        name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null,
      });
    });

    it('does not mutate the original state', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const newState = reducer(gameState, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      expect(gameState.players[0].recorded).toBe(false);
      expect(newState.players[0].recorded).toBe(true);
    });
  });

  describe('SET_COMMUNITY_CARDS', () => {
    it('stores community cards and marks recorded: true', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_COMMUNITY_CARDS' as const,
        payload: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' },
      });

      expect(state.community).toEqual({
        flop1: '2h', flop2: '3c', flop3: '5d', flopRecorded: true, turn: 'Js', turnRecorded: true, river: 'Qh', riverRecorded: true,
      });
    });
  });

  describe('RESET_HAND', () => {
    it('clears all card data but preserves gameId, player names, and gameDate', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 7, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });
      state = reducer(state, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });
      state = reducer(state, {
        type: 'SET_COMMUNITY_CARDS' as const,
        payload: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' },
      });

      const reset = reducer(state, { type: 'RESET_HAND' as const });

      expect(reset.gameId).toBe(7);
      expect(reset.gameDate).toBe('2026-04-08');
      expect(reset.players).toEqual([
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      ]);
      expect(reset.community).toEqual({
        flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false,
      });
      expect(reset.currentStep).toBe('dashboard');
    });

    it('increments handCount', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 7, players: ['Alice'], gameDate: '2026-04-08' },
      });

      state = reducer(state, { type: 'RESET_HAND' as const });
      expect(state.handCount).toBe(1);

      state = reducer(state, { type: 'RESET_HAND' as const });
      expect(state.handCount).toBe(2);
    });
  });

  describe('SET_STEP', () => {
    it('updates currentStep', () => {
      const state = reducer(initialState, {
        type: 'SET_STEP' as const,
        payload: 'activeHand',
      });

      expect(state.currentStep).toBe('activeHand');
    });
  });

  describe('SET_PLAYER_RESULT', () => {
    it('sets a player status to won with outcomeStreet', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      });

      expect(state.players[0].status).toBe('won');
      expect(state.players[0].outcomeStreet).toBe('river');
      expect(state.players[1].status).toBe('playing');
      expect(state.players[1].outcomeStreet).toBeNull();
    });

    it('sets a player status to folded with outcomeStreet', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'folded', outcomeStreet: 'flop' },
      });

      expect(state.players[0].status).toBe('folded');
      expect(state.players[0].outcomeStreet).toBe('flop');
    });

    it('sets a player status to lost with outcomeStreet', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'lost', outcomeStreet: 'turn' },
      });

      expect(state.players[0].status).toBe('lost');
      expect(state.players[0].outcomeStreet).toBe('turn');
    });

    it('sets not_playing status with null outcomeStreet', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'not_playing', outcomeStreet: null },
      });

      expect(state.players[0].status).toBe('not_playing');
      expect(state.players[0].outcomeStreet).toBeNull();
    });

    it('does not mutate the original state', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const newState = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'won' },
      });

      expect(gameState.players[0].status).toBe('playing');
      expect(newState.players[0].status).toBe('won');
    });

    it('leaves unmatched players unchanged', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob', 'Charlie'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Bob', status: 'folded' },
      });

      expect(state.players[0].status).toBe('playing');
      expect(state.players[1].status).toBe('folded');
      expect(state.players[2].status).toBe('playing');
    });
  });

  describe('SET_HAND_ID', () => {
    it('stores the hand ID', () => {
      const state = reducer(initialState, {
        type: 'SET_HAND_ID' as const,
        payload: 123,
      });

      expect(state.currentHandId).toBe(123);
    });

    it('overwrites a previous hand ID', () => {
      let state = reducer(initialState, { type: 'SET_HAND_ID' as const, payload: 100 });
      state = reducer(state, { type: 'SET_HAND_ID' as const, payload: 200 });

      expect(state.currentHandId).toBe(200);
    });
  });

  describe('FINISH_HAND', () => {
    it('resets cards, statuses, currentHandId, and goes to dashboard', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 7, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });
      state = reducer(state, { type: 'SET_HAND_ID' as const, payload: 42 });
      state = reducer(state, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });
      state = reducer(state, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'won' },
      });
      state = reducer(state, {
        type: 'SET_COMMUNITY_CARDS' as const,
        payload: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' },
      });

      const finished = reducer(state, { type: 'FINISH_HAND' as const });

      expect(finished.gameId).toBe(7);
      expect(finished.currentHandId).toBeNull();
      expect(finished.currentStep).toBe('dashboard');
      expect(finished.players).toEqual([
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null },
      ]);
      expect(finished.community).toEqual({
        flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false,
      });
    });

    it('increments handCount', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 7, players: ['Alice'], gameDate: '2026-04-08' },
      });

      state = reducer(state, { type: 'FINISH_HAND' as const });
      expect(state.handCount).toBe(1);

      state = reducer(state, { type: 'FINISH_HAND' as const });
      expect(state.handCount).toBe(2);
    });

    it('preserves gameDate', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });
      state = reducer(state, { type: 'FINISH_HAND' as const });

      expect(state.gameDate).toBe('2026-04-08');
    });
  });

  describe('RESET_HAND clears currentHandId', () => {
    it('resets currentHandId to null', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });
      state = reducer(state, { type: 'SET_HAND_ID' as const, payload: 99 });
      state = reducer(state, { type: 'RESET_HAND' as const });

      expect(state.currentHandId).toBeNull();
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = reducer(initialState, { type: 'UNKNOWN' } as any);
      expect(state).toBe(initialState);
    });
  });

  describe('LOAD_HAND', () => {
    it('hydrates players and community from API hand data', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob', 'Charlie'], gameDate: '2026-04-08' },
      });

      const handData = {
        hand_number: 3,
        flop_1: '2H', flop_2: '3C', flop_3: '5D',
        turn: 'JS', river: 'QH',
        player_hands: [
          { player_name: 'Alice', card_1: 'AH', card_2: 'KD', result: 'won', profit_loss: 50, outcome_street: 'river' },
          { player_name: 'Bob', card_1: '9S', card_2: 'TC', result: 'lost', profit_loss: -25, outcome_street: 'turn' },
        ],
      };

      state = reducer(state, { type: 'LOAD_HAND' as const, payload: handData });

      expect(state.currentHandId).toBe(3);
      expect(state.currentStep).toBe('activeHand');
      expect(state.community).toEqual({
        flop1: '2H', flop2: '3C', flop3: '5D', flopRecorded: true, turn: 'JS', turnRecorded: true, river: 'QH', riverRecorded: true,
      });
      // Alice and Bob have their recorded data
      expect(state.players[0]).toEqual({
        name: 'Alice', card1: 'AH', card2: 'KD', recorded: true, status: 'won', outcomeStreet: 'river', lastAction: null,
      });
      expect(state.players[1]).toEqual({
        name: 'Bob', card1: '9S', card2: 'TC', recorded: true, status: 'lost', outcomeStreet: 'turn', lastAction: null,
      });
      // Charlie was not in the hand — stays fresh
      expect(state.players[2]).toEqual({
        name: 'Charlie', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null,
      });
    });

    it('handles hand with no community cards', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const handData = {
        hand_number: 1,
        flop_1: null, flop_2: null, flop_3: null,
        turn: null, river: null,
        player_hands: [],
      };

      state = reducer(state, { type: 'LOAD_HAND' as const, payload: handData });

      expect(state.community.flopRecorded).toBe(false);
      expect(state.players[0].status).toBe('playing');
    });

    it('handles player with null cards (folded without showing)', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const handData = {
        hand_number: 1,
        flop_1: null, flop_2: null, flop_3: null,
        turn: null, river: null,
        player_hands: [
          { player_name: 'Alice', card_1: null, card_2: null, result: 'folded', profit_loss: -10 },
        ],
      };

      state = reducer(state, { type: 'LOAD_HAND' as const, payload: handData });

      expect(state.players[0]).toEqual({
        name: 'Alice', card1: null, card2: null, recorded: true, status: 'folded', outcomeStreet: null, lastAction: null,
      });
    });
  });

  describe('validateOutcomeStreets', () => {
    it('returns null when all outcomes are on the same street', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'river' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('allows folders on earlier streets than the winner', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
        { name: 'Carol', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'turn' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('allows folder on preflop when winner on river', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'preflop' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('returns error when loser lost on a different street than winner', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'flop' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'river' },
      ];
      const err = validateOutcomeStreets(players);
      expect(err).toBeTruthy();
      expect(err).toContain('Bob');
    });

    it('returns error when folder folded after the winner won', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'flop' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'turn' },
      ];
      const err = validateOutcomeStreets(players);
      expect(err).toBeTruthy();
    });

    it('returns null when no decided players have outcome streets', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: null },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('returns null when there are not_playing players', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'not_playing', outcomeStreet: null },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('allows losers on the same street as the winner', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'turn' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'turn' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('returns null when winner won preflop and folder folded preflop', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'preflop' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'preflop' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });

    it('returns error when folder folded on flop but winner won preflop', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'preflop' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
      ];
      const err = validateOutcomeStreets(players);
      expect(err).toBeTruthy();
    });

    it('returns error when loser is on earlier street and winner on later', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'turn' },
      ];
      const err = validateOutcomeStreets(players);
      expect(err).toBeTruthy();
    });

    it('allows multiple folders on different earlier streets', () => {
      const players = [
        { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'preflop' },
        { name: 'Carol', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
        { name: 'Dave', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'river' },
      ];
      expect(validateOutcomeStreets(players)).toBeNull();
    });
  });

  describe('UPDATE_PARTICIPATION', () => {
    it('maps participation_status onto matching players', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'joined' },
            { name: 'Bob', participation_status: 'pending' },
          ],
        },
      });

      expect(state.players[0].status).toBe('joined');
      expect(state.players[1].status).toBe('pending');
    });

    it('leaves unmatched players unchanged', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'joined' },
          ],
        },
      });

      expect(state.players[0].status).toBe('joined');
      expect(state.players[1].status).toBe('playing');
    });

    it('preserves other player fields (cards, recorded, outcomeStreet)', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const withCards = reducer(gameState, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      const state = reducer(withCards, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'joined' },
          ],
        },
      });

      expect(state.players[0].card1).toBe('Ah');
      expect(state.players[0].card2).toBe('Kd');
      expect(state.players[0].recorded).toBe(true);
      expect(state.players[0].status).toBe('joined');
    });

    it('does not let stale poll reset recorded player to idle', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      // Dealer manually captures Alice's cards
      const withCards = reducer(gameState, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      // Stale poll response says Alice is idle (request was before manual capture)
      const state = reducer(withCards, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'idle' },
            { name: 'Bob', participation_status: 'pending' },
          ],
        },
      });

      // Alice should keep her recorded status, not reset to idle
      expect(state.players[0].status).toBe('playing');
      expect(state.players[0].recorded).toBe(true);
      // Bob (not recorded) should update normally
      expect(state.players[1].status).toBe('pending');
    });

    it('does not let stale poll reset recorded player to playing', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const withCards = reducer(gameState, {
        type: 'SET_PLAYER_CARDS' as const,
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      const withResult = reducer(withCards, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      });

      // Stale poll says 'playing'
      const state = reducer(withResult, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'playing' },
          ],
        },
      });

      // Should keep 'won', not downgrade to 'playing'
      expect(state.players[0].status).toBe('won');
      expect(state.players[0].recorded).toBe(true);
    });

    it('does not let poll reset a sit-out (not_playing) player back to idle/playing', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME' as const,
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      // Dealer clicks sit-out for Alice (sets status to not_playing, recorded stays false)
      const withSitOut = reducer(gameState, {
        type: 'SET_PLAYER_RESULT' as const,
        payload: { name: 'Alice', status: 'not_playing', outcomeStreet: null },
      });

      expect(withSitOut.players[0].status).toBe('not_playing');
      expect(withSitOut.players[0].recorded).toBe(false);

      // Poll response says Alice is idle (server doesn't know about local sit-out)
      const state = reducer(withSitOut, {
        type: 'UPDATE_PARTICIPATION' as const,
        payload: {
          players: [
            { name: 'Alice', participation_status: 'idle' },
            { name: 'Bob', participation_status: 'pending' },
          ],
        },
      });

      // Alice should keep not_playing, not revert to idle
      expect(state.players[0].status).toBe('not_playing');
      // Bob should update normally
      expect(state.players[1].status).toBe('pending');
    });
  });

  describe('RESTORE_STATE', () => {
    it('preserves review step on restore (review is step 4 — hand summary)', () => {
      const state = reducer(initialState, {
        type: 'RESTORE_STATE' as const,
        payload: { gameId: 1, currentStep: 'review', players: [], community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false } },
      });
      expect(state.currentStep).toBe('review');
    });

    it('normalizes outcome step to activeHand on restore', () => {
      const state = reducer(initialState, {
        type: 'RESTORE_STATE' as const,
        payload: { gameId: 1, currentStep: 'outcome', players: [], community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false } },
      });
      expect(state.currentStep).toBe('activeHand');
    });

    it('preserves safe steps like dashboard on restore', () => {
      const state = reducer(initialState, {
        type: 'RESTORE_STATE' as const,
        payload: { gameId: 1, currentStep: 'dashboard', players: [], community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false } },
      });
      expect(state.currentStep).toBe('dashboard');
    });
  });
});
