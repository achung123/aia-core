/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { isShowdown } from '../../src/../src/scenes/showdown.ts';

describe('isShowdown', () => {
  it('returns true when any player has result "won"', () => {
    const players = [
      { result: 'won' },
      { result: 'folded' },
    ];
    expect(isShowdown(players)).toBe(true);
  });

  it('returns true when any player has result "lost"', () => {
    const players = [
      { result: 'lost' },
      { result: 'folded' },
    ];
    expect(isShowdown(players)).toBe(true);
  });

  it('returns true when any player has mapped result "win"', () => {
    const players = [
      { result: 'win' },
      { result: 'fold' },
    ];
    expect(isShowdown(players)).toBe(true);
  });

  it('returns true when any player has mapped result "loss"', () => {
    const players = [
      { result: 'loss' },
      { result: 'fold' },
    ];
    expect(isShowdown(players)).toBe(true);
  });

  it('returns false when all players have result "folded"', () => {
    const players = [
      { result: 'folded' },
      { result: 'folded' },
    ];
    expect(isShowdown(players)).toBe(false);
  });

  it('returns false when all results are null', () => {
    const players = [
      { result: null },
      { result: undefined },
    ];
    expect(isShowdown(players)).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(isShowdown([])).toBe(false);
  });

  it('returns true with a mix of won and lost results', () => {
    const players = [
      { result: 'won' },
      { result: 'lost' },
      { result: 'folded' },
    ];
    expect(isShowdown(players)).toBe(true);
  });
});
