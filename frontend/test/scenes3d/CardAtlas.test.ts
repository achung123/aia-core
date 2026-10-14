import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  BACK_KEY,
  RANKS,
  SUITS,
  clearAtlasCache,
  getAtlasSize,
  getBackUV,
  getTexture,
  getUV,
  getUVById,
} from '../../src/scenes3d/components/CardAtlas';

describe('CardAtlas.constants', () => {
  it('exports 13 ranks in ascending order', () => {
    expect(RANKS).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
    expect(RANKS).toHaveLength(13);
  });

  it('exports 4 suits in s/h/d/c order', () => {
    expect(SUITS).toEqual(['s', 'h', 'd', 'c']);
  });

  it('defines a 13×5 grid (4 suit rows + 1 back row)', () => {
    expect(ATLAS_COLS).toBe(13);
    expect(ATLAS_ROWS).toBe(5);
  });

  it('defines a "back" key', () => {
    expect(BACK_KEY).toBe('back');
  });
});

describe('CardAtlas.getUV', () => {
  it('returns cell width = 1/cols and height = 1/rows', () => {
    const uv = getUV('2', 's');
    expect(uv.w).toBeCloseTo(1 / 13, 12);
    expect(uv.h).toBeCloseTo(1 / 5, 12);
  });

  it('places 2s at (col=0, row=0) → u=0, v=0', () => {
    const uv = getUV('2', 's');
    expect(uv.u).toBeCloseTo(0, 12);
    expect(uv.v).toBeCloseTo(0, 12);
  });

  it('places Ah at (col=12, row=1)', () => {
    const uv = getUV('A', 'h');
    expect(uv.u).toBeCloseTo(12 / 13, 12);
    expect(uv.v).toBeCloseTo(1 / 5, 12);
  });

  it('places 10d at (col=8, row=2)', () => {
    const uv = getUV('10', 'd');
    expect(uv.u).toBeCloseTo(8 / 13, 12);
    expect(uv.v).toBeCloseTo(2 / 5, 12);
  });

  it('places Kc at (col=11, row=3)', () => {
    const uv = getUV('K', 'c');
    expect(uv.u).toBeCloseTo(11 / 13, 12);
    expect(uv.v).toBeCloseTo(3 / 5, 12);
  });

  it('returns deterministic results across calls', () => {
    const a = getUV('J', 'h');
    const b = getUV('J', 'h');
    expect(a).toEqual(b);
  });

  it('produces exactly 52 unique face UVs', () => {
    const seen = new Set<string>();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const uv = getUV(rank, suit);
        seen.add(`${uv.u.toFixed(6)},${uv.v.toFixed(6)}`);
      }
    }
    expect(seen.size).toBe(52);
  });

  it('throws on invalid rank', () => {
    // @ts-expect-error – testing runtime guard
    expect(() => getUV('X', 's')).toThrow();
    // @ts-expect-error – testing runtime guard
    expect(() => getUV('1', 's')).toThrow();
  });

  it('throws on invalid suit', () => {
    // @ts-expect-error – testing runtime guard
    expect(() => getUV('A', 'z')).toThrow();
  });
});

describe('CardAtlas.getBackUV', () => {
  it('returns the back-cell UV at row 4 column 0', () => {
    const uv = getBackUV();
    expect(uv.u).toBeCloseTo(0, 12);
    expect(uv.v).toBeCloseTo(4 / 5, 12);
    expect(uv.w).toBeCloseTo(1 / 13, 12);
    expect(uv.h).toBeCloseTo(1 / 5, 12);
  });

  it('does not collide with any face UV', () => {
    const back = getBackUV();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const face = getUV(rank, suit);
        expect(face.u === back.u && face.v === back.v).toBe(false);
      }
    }
  });
});

describe('CardAtlas.getUVById', () => {
  it('resolves canonical ids like "Ah" and "10d"', () => {
    expect(getUVById('Ah')).toEqual(getUV('A', 'h'));
    expect(getUVById('10d')).toEqual(getUV('10', 'd'));
    expect(getUVById('2s')).toEqual(getUV('2', 's'));
  });

  it('resolves "back"', () => {
    expect(getUVById(BACK_KEY)).toEqual(getBackUV());
  });

  it('returns null for malformed ids', () => {
    expect(getUVById('')).toBeNull();
    expect(getUVById('Xh')).toBeNull();
    expect(getUVById('1d')).toBeNull();
    expect(getUVById('Asd')).toBeNull();
    expect(getUVById('AH')).toBeNull(); // suit is case-sensitive
  });
});

describe('CardAtlas.getAtlasSize', () => {
  it('returns 1024 for the low tier', () => {
    expect(getAtlasSize('low')).toBe(1024);
  });

  it('returns 2048 for medium and high tiers', () => {
    expect(getAtlasSize('medium')).toBe(2048);
    expect(getAtlasSize('high')).toBe(2048);
  });

  // T-038 Item-2 (Cycle 39 L-2): getAtlasSize must read from the canonical
  // QUALITY_TIER_SETTINGS[tier].cardAtlasResolution — no inline tier→size
  // literal on the call site.
  it('T-038: reads from QUALITY_TIER_SETTINGS[tier].cardAtlasResolution', async () => {
    const { QUALITY_TIER_SETTINGS } = await import(
      '../../src/scenes3d/state/qualitySettings'
    );
    expect(getAtlasSize('low')).toBe(QUALITY_TIER_SETTINGS.low.cardAtlasResolution);
    expect(getAtlasSize('medium')).toBe(
      QUALITY_TIER_SETTINGS.medium.cardAtlasResolution,
    );
    expect(getAtlasSize('high')).toBe(
      QUALITY_TIER_SETTINGS.high.cardAtlasResolution,
    );
  });
});

describe('CardAtlas.getTexture', () => {
  beforeEach(() => {
    clearAtlasCache();
  });

  it('returns a THREE.Texture instance', () => {
    const tex = getTexture('high');
    expect(tex).toBeInstanceOf(THREE.Texture);
  });

  it('memoizes by tier — same tier returns the same instance', () => {
    const a = getTexture('high');
    const b = getTexture('high');
    expect(a).toBe(b);
  });

  it('returns distinct textures for different tiers', () => {
    const low = getTexture('low');
    const high = getTexture('high');
    expect(low).not.toBe(high);
  });

  it('sizes the underlying canvas according to the tier', () => {
    const low = getTexture('low');
    const high = getTexture('high');
    expect((low.image as { width: number }).width).toBe(1024);
    expect((high.image as { width: number }).width).toBe(2048);
  });
});
