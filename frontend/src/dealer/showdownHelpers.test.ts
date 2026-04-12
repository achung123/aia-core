import { describe, it, expect } from 'vitest';
import { inferOutcomeStreet, isShowdownEnabled, mapEquityToOutcomes } from './showdownHelpers.ts';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';

const emptyCommunity: CommunityCards = {
  flop1: null, flop2: null, flop3: null, flopRecorded: false,
  turn: null, turnRecorded: false, river: null, riverRecorded: false,
};

describe('inferOutcomeStreet', () => {
  it('returns preflop when no community cards recorded', () => {
    expect(inferOutcomeStreet(emptyCommunity)).toBe('preflop');
  });

  it('returns flop when only flop recorded', () => {
    expect(inferOutcomeStreet({
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    })).toBe('flop');
  });

  it('returns turn when turn recorded', () => {
    expect(inferOutcomeStreet({
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
      turn: 'Js', turnRecorded: true,
    })).toBe('turn');
  });

  it('returns river when river recorded', () => {
    expect(inferOutcomeStreet({
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
      turn: 'Js', turnRecorded: true,
      river: '9c', riverRecorded: true,
    })).toBe('river');
  });
});

describe('isShowdownEnabled', () => {
  const twoPlayersWithCards: Player[] = [
    { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
    { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
  ];

  it('returns false when no community cards recorded', () => {
    expect(isShowdownEnabled(emptyCommunity, twoPlayersWithCards)).toBe(false);
  });

  it('returns false when only one non-folded player has cards', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
    ];
    expect(isShowdownEnabled(community, players)).toBe(false);
  });

  it('returns true when flop recorded and 2+ non-folded players have cards', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    };
    expect(isShowdownEnabled(community, twoPlayersWithCards)).toBe(true);
  });

  it('returns false when 2 players have cards but one is folded', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'folded', outcomeStreet: 'flop' },
    ];
    expect(isShowdownEnabled(community, players)).toBe(false);
  });

  it('excludes not_playing players from count', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'not_playing', outcomeStreet: null },
    ];
    expect(isShowdownEnabled(community, players)).toBe(false);
  });
});

describe('mapEquityToOutcomes', () => {
  const riverCommunity: CommunityCards = {
    ...emptyCommunity,
    flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
    turn: 'Js', turnRecorded: true,
    river: '9c', riverRecorded: true,
  };

  const flopCommunity: CommunityCards = {
    ...emptyCommunity,
    flop1: 'Ah', flop2: 'Kd', flop3: 'Qc', flopRecorded: true,
  };

  const activePlayers: Player[] = [
    { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
    { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
  ];

  it('returns won for single non-folded player with cards (AC3)', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'folded', outcomeStreet: 'flop' },
    ];
    const result = mapEquityToOutcomes([], players, riverCommunity);
    expect(result).toEqual([{ name: 'Alice', status: 'won', outcomeStreet: 'river' }]);
  });

  it('maps outright winner: equity ~1.0 → won, ~0.0 → lost (AC2)', () => {
    const equities = [
      { player_name: 'Alice', equity: 1.0 },
      { player_name: 'Bob', equity: 0.0 },
    ];
    const result = mapEquityToOutcomes(equities, activePlayers, riverCommunity);
    expect(result).toEqual([
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'river' },
    ]);
  });

  it('maps split pot as both won (AC2)', () => {
    const equities = [
      { player_name: 'Alice', equity: 0.5 },
      { player_name: 'Bob', equity: 0.5 },
    ];
    const result = mapEquityToOutcomes(equities, activePlayers, riverCommunity);
    expect(result).toEqual([
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'won', outcomeStreet: 'river' },
    ]);
  });

  it('infers outcome street from community cards (AC4)', () => {
    const equities = [
      { player_name: 'Alice', equity: 1.0 },
      { player_name: 'Bob', equity: 0.0 },
    ];
    const result = mapEquityToOutcomes(equities, activePlayers, flopCommunity);
    expect(result).toEqual([
      { name: 'Alice', status: 'won', outcomeStreet: 'flop' },
      { name: 'Bob', status: 'lost', outcomeStreet: 'flop' },
    ]);
  });

  it('returns null when equity data missing for a player (inconclusive, AC6)', () => {
    const equities = [
      { player_name: 'Alice', equity: 1.0 },
      // Bob missing
    ];
    const result = mapEquityToOutcomes(equities, activePlayers, riverCommunity);
    expect(result).toBeNull();
  });

  it('returns null when no active players', () => {
    const players: Player[] = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
    ];
    const result = mapEquityToOutcomes([], players, riverCommunity);
    expect(result).toBeNull();
  });

  it('handles 3-way split pot', () => {
    const threePlayers: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Charlie', card1: '2h', card2: '3d', recorded: true, status: 'playing', outcomeStreet: null },
    ];
    const equities = [
      { player_name: 'Alice', equity: 0.333 },
      { player_name: 'Bob', equity: 0.333 },
      { player_name: 'Charlie', equity: 0.334 },
    ];
    const result = mapEquityToOutcomes(equities, threePlayers, riverCommunity);
    expect(result).toEqual([
      { name: 'Alice', status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', status: 'won', outcomeStreet: 'river' },
      { name: 'Charlie', status: 'won', outcomeStreet: 'river' },
    ]);
  });
});
