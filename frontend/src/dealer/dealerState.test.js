import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './dealerState.js';

describe('initialState', () => {
  it('has the correct shape', () => {
    expect(initialState).toEqual({
      gameId: null,
      players: [],
      community: { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false },
      currentStep: 'create',
      handCount: 0,
      gameDate: null,
    });
  });
});

describe('reducer', () => {
  describe('SET_GAME', () => {
    it('sets gameId, initializes players, resets community, sets step to dashboard', () => {
      const action = {
        type: 'SET_GAME',
        payload: { gameId: 42, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      };
      const state = reducer(initialState, action);

      expect(state.gameId).toBe(42);
      expect(state.gameDate).toBe('2026-04-08');
      expect(state.currentStep).toBe('dashboard');
      expect(state.players).toEqual([
        { name: 'Alice', card1: null, card2: null, recorded: false },
        { name: 'Bob', card1: null, card2: null, recorded: false },
      ]);
      expect(state.community).toEqual({
        flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false,
      });
    });
  });

  describe('SET_PLAYER_CARDS', () => {
    it('updates a specific player and marks them recorded: true', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME',
        payload: { gameId: 1, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_PLAYER_CARDS',
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      expect(state.players[0]).toEqual({
        name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true,
      });
      // Bob is untouched
      expect(state.players[1]).toEqual({
        name: 'Bob', card1: null, card2: null, recorded: false,
      });
    });

    it('does not mutate the original state', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME',
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const newState = reducer(gameState, {
        type: 'SET_PLAYER_CARDS',
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });

      expect(gameState.players[0].recorded).toBe(false);
      expect(newState.players[0].recorded).toBe(true);
    });
  });

  describe('SET_COMMUNITY_CARDS', () => {
    it('stores community cards and marks recorded: true', () => {
      const gameState = reducer(initialState, {
        type: 'SET_GAME',
        payload: { gameId: 1, players: ['Alice'], gameDate: '2026-04-08' },
      });

      const state = reducer(gameState, {
        type: 'SET_COMMUNITY_CARDS',
        payload: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' },
      });

      expect(state.community).toEqual({
        flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh', recorded: true,
      });
    });
  });

  describe('RESET_HAND', () => {
    it('clears all card data but preserves gameId, player names, and gameDate', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME',
        payload: { gameId: 7, players: ['Alice', 'Bob'], gameDate: '2026-04-08' },
      });
      state = reducer(state, {
        type: 'SET_PLAYER_CARDS',
        payload: { name: 'Alice', card1: 'Ah', card2: 'Kd' },
      });
      state = reducer(state, {
        type: 'SET_COMMUNITY_CARDS',
        payload: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh' },
      });

      const reset = reducer(state, { type: 'RESET_HAND' });

      expect(reset.gameId).toBe(7);
      expect(reset.gameDate).toBe('2026-04-08');
      expect(reset.players).toEqual([
        { name: 'Alice', card1: null, card2: null, recorded: false },
        { name: 'Bob', card1: null, card2: null, recorded: false },
      ]);
      expect(reset.community).toEqual({
        flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false,
      });
      expect(reset.currentStep).toBe('dashboard');
    });

    it('increments handCount', () => {
      let state = reducer(initialState, {
        type: 'SET_GAME',
        payload: { gameId: 7, players: ['Alice'], gameDate: '2026-04-08' },
      });

      state = reducer(state, { type: 'RESET_HAND' });
      expect(state.handCount).toBe(1);

      state = reducer(state, { type: 'RESET_HAND' });
      expect(state.handCount).toBe(2);
    });
  });

  describe('SET_STEP', () => {
    it('updates currentStep', () => {
      const state = reducer(initialState, {
        type: 'SET_STEP',
        payload: 'playerGrid',
      });

      expect(state.currentStep).toBe('playerGrid');
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = reducer(initialState, { type: 'UNKNOWN' });
      expect(state).toBe(initialState);
    });
  });
});
