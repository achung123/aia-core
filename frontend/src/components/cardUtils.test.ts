import { describe, it, expect } from 'vitest';
import { isValidCard, normalizeCard, findDuplicateCards } from './cardUtils.ts';

describe('isValidCard', () => {
  it('accepts valid cards', () => {
    expect(isValidCard('AS')).toBe(true);
    expect(isValidCard('10H')).toBe(true);
    expect(isValidCard('2c')).toBe(true);
    expect(isValidCard('Kd')).toBe(true);
  });

  it('rejects invalid cards', () => {
    expect(isValidCard('')).toBe(false);
    expect(isValidCard('XZ')).toBe(false);
    expect(isValidCard('1H')).toBe(false);
    expect(isValidCard('A')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isValidCard(' AS ')).toBe(true);
  });
});

describe('normalizeCard', () => {
  it('uppercases and trims', () => {
    expect(normalizeCard(' as ')).toBe('AS');
    expect(normalizeCard('10h')).toBe('10H');
  });
});

describe('findDuplicateCards', () => {
  it('returns empty set when no duplicates', () => {
    expect(findDuplicateCards(['AS', '2H', 'KD']).size).toBe(0);
  });

  it('detects duplicates case-insensitively', () => {
    const dupes = findDuplicateCards(['AS', 'as', '2H']);
    expect(dupes.has('AS')).toBe(true);
  });

  it('skips empty strings', () => {
    expect(findDuplicateCards(['', '', 'AS']).size).toBe(0);
  });
});
