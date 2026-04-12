import { describe, it, expect } from 'vitest';
import { calculateEquity, handCategory, HandRank } from './evaluator';
import type { Card, EquityResult } from './evaluator';

describe('Card and HandRank types', () => {
  it('HandRank enum has all 9 hand categories', () => {
    expect(HandRank.HighCard).toBe(0);
    expect(HandRank.Pair).toBe(1);
    expect(HandRank.TwoPair).toBe(2);
    expect(HandRank.ThreeOfAKind).toBe(3);
    expect(HandRank.Straight).toBe(4);
    expect(HandRank.Flush).toBe(5);
    expect(HandRank.FullHouse).toBe(6);
    expect(HandRank.FourOfAKind).toBe(7);
    expect(HandRank.StraightFlush).toBe(8);
  });
});

describe('handCategory', () => {
  it('returns empty string for invalid score', () => {
    expect(handCategory(-1)).toBe('');
  });
});

describe('calculateEquity', () => {
  const makeCard = (rank: string, suit: string): Card => ({ rank, suit });

  it('returns equity for each player', () => {
    const player1: Card[] = [makeCard('A', '♥'), makeCard('K', '♥')];
    const player2: Card[] = [makeCard('7', '♣'), makeCard('2', '♦')];
    const community: Card[] = [];
    const result: EquityResult[] = calculateEquity([player1, player2], community);
    expect(result).toHaveLength(2);
    expect(result[0].equity).toBeGreaterThan(0);
    expect(result[1].equity).toBeGreaterThan(0);
    expect(result[0].equity + result[1].equity).toBeCloseTo(1, 1);
  });

  it('handles full board (5 community cards)', () => {
    const player1: Card[] = [makeCard('A', '♥'), makeCard('K', '♥')];
    const player2: Card[] = [makeCard('7', '♣'), makeCard('2', '♦')];
    const community: Card[] = [
      makeCard('Q', '♥'),
      makeCard('J', '♥'),
      makeCard('10', '♥'),
      makeCard('3', '♣'),
      makeCard('5', '♠'),
    ];
    const result = calculateEquity([player1, player2], community);
    // Player 1 has a royal flush, should win 100%
    expect(result[0].equity).toBe(1);
    expect(result[1].equity).toBe(0);
  });

  it('handles turn (4 community cards)', () => {
    const player1: Card[] = [makeCard('A', '♠'), makeCard('A', '♥')];
    const player2: Card[] = [makeCard('K', '♣'), makeCard('K', '♦')];
    const community: Card[] = [
      makeCard('2', '♣'),
      makeCard('5', '♦'),
      makeCard('9', '♠'),
      makeCard('3', '♥'),
    ];
    const result = calculateEquity([player1, player2], community);
    expect(result[0].equity).toBeGreaterThan(result[1].equity);
  });

  it('detects a split pot', () => {
    // Both players have same hole cards (different suits), board matters
    const player1: Card[] = [makeCard('A', '♠'), makeCard('K', '♠')];
    const player2: Card[] = [makeCard('A', '♣'), makeCard('K', '♣')];
    const community: Card[] = [
      makeCard('2', '♥'),
      makeCard('5', '♦'),
      makeCard('9', '♥'),
      makeCard('J', '♦'),
      makeCard('3', '♦'),
    ];
    const result = calculateEquity([player1, player2], community);
    // Should be a split pot
    expect(result[0].equity).toBeCloseTo(0.5, 5);
    expect(result[1].equity).toBeCloseTo(0.5, 5);
  });

  it('handles T rank alias for 10', () => {
    const player1: Card[] = [makeCard('T', '♥'), makeCard('A', '♥')];
    const player2: Card[] = [makeCard('7', '♣'), makeCard('2', '♦')];
    const community: Card[] = [
      makeCard('Q', '♥'),
      makeCard('J', '♥'),
      makeCard('K', '♥'),
      makeCard('3', '♣'),
      makeCard('5', '♠'),
    ];
    const result = calculateEquity([player1, player2], community);
    expect(result[0].equity).toBe(1);
  });

  it('calculates with flop only (3 community cards)', () => {
    const player1: Card[] = [makeCard('A', '♠'), makeCard('A', '♥')];
    const player2: Card[] = [makeCard('2', '♣'), makeCard('7', '♦')];
    const community: Card[] = [
      makeCard('A', '♣'),
      makeCard('K', '♦'),
      makeCard('Q', '♠'),
    ];
    const result = calculateEquity([player1, player2], community);
    expect(result[0].equity).toBeGreaterThan(0.9);
  });

  it('handCategory returns correct name for a flush score', () => {
    // Construct a known hand: flush (category 5)
    // We can call calculateEquity to get a real score, but handCategory
    // takes a numeric score. We'll use the B5 constant logic:
    // category 5 means score / B5 === 5
    const B = 14;
    const B5 = B ** 5;
    const flushScore = 5 * B5 + 12 * (B ** 4) + 10 * (B ** 3); // approximate flush score
    expect(handCategory(flushScore)).toBe('Flush');
  });
});
