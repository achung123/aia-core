import { describe, it, expect } from 'vitest';
import { assembleHandPayload, validateNoDuplicates } from './handPayload.ts';

describe('assembleHandPayload', () => {
  it('maps community cards and players to the expected API shape', () => {
    const state = {
      community: { flop1: '2h', flop2: '3c', flop3: '5d', turn: 'Js', river: 'Qh', flopRecorded: true, turnRecorded: true, riverRecorded: true },
      players: [
        { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
        { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
      ],
    };

    const payload = assembleHandPayload(state);

    expect(payload).toEqual({
      flop_1: '2h',
      flop_2: '3c',
      flop_3: '5d',
      turn: 'Js',
      river: 'Qh',
      player_entries: [
        { player_name: 'Alice', card_1: 'Ah', card_2: 'Kd' },
        { player_name: 'Bob', card_1: '9s', card_2: 'Tc' },
      ],
    });
  });

  it('sets turn and river to null when absent', () => {
    const state = {
      community: { flop1: '2h', flop2: '3c', flop3: '5d', turn: null, river: null, flopRecorded: true, turnRecorded: false, riverRecorded: false },
      players: [{ name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null }],
    };

    const payload = assembleHandPayload(state);

    expect(payload.turn).toBeNull();
    expect(payload.river).toBeNull();
  });
});

describe('validateNoDuplicates', () => {
  it('returns null when all cards are unique', () => {
    const payload = {
      flop_1: '2h',
      flop_2: '3c',
      flop_3: '5d',
      turn: 'Js',
      river: 'Qh',
      player_entries: [
        { player_name: 'Alice', card_1: 'Ah', card_2: 'Kd' },
        { player_name: 'Bob', card_1: '9s', card_2: 'Tc' },
      ],
    };

    expect(validateNoDuplicates(payload)).toBeNull();
  });

  it('detects a duplicate between community and player cards', () => {
    const payload = {
      flop_1: '2h',
      flop_2: '3c',
      flop_3: '5d',
      turn: 'Js',
      river: 'Qh',
      player_entries: [
        { player_name: 'Alice', card_1: '2h', card_2: 'Kd' },
      ],
    };

    const result = validateNoDuplicates(payload);
    expect(result).toContain('2h');
    expect(result).toMatch(/Duplicate card/);
  });

  it('detects duplicates between two players', () => {
    const payload = {
      flop_1: '2h',
      flop_2: '3c',
      flop_3: '5d',
      turn: null,
      river: null,
      player_entries: [
        { player_name: 'Alice', card_1: 'Ah', card_2: 'Kd' },
        { player_name: 'Bob', card_1: 'Ah', card_2: 'Tc' },
      ],
    };

    const result = validateNoDuplicates(payload);
    expect(result).toContain('Ah');
  });

  it('ignores null turn/river when checking duplicates', () => {
    const payload = {
      flop_1: '2h',
      flop_2: '3c',
      flop_3: '5d',
      turn: null,
      river: null,
      player_entries: [
        { player_name: 'Alice', card_1: 'Ah', card_2: 'Kd' },
      ],
    };

    expect(validateNoDuplicates(payload)).toBeNull();
  });
});
