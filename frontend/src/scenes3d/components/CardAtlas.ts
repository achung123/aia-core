// CardAtlas — single texture containing all 52 card faces + 1 back,
// arranged on a 13×5 grid. Built lazily per quality tier and memoized.
//
// Layout (row, col indexed from top-left):
//   row 0: spades   (s) — cols 0..12 = ranks 2..A
//   row 1: hearts   (h) — cols 0..12 = ranks 2..A
//   row 2: diamonds (d) — cols 0..12 = ranks 2..A
//   row 3: clubs    (c) — cols 0..12 = ranks 2..A
//   row 4 col 0:    card back
//
// UV convention: { u, v, w, h } describe the cell in *image* space
// (u from the left, v from the top, both in [0,1]). Consumers that set
// `material.map.offset`/`repeat` on a texture with `flipY = true`
// (default for CanvasTexture) should translate v → 1 - v - h.

import * as THREE from 'three';
import type { QualityTier } from '../types';
import { QUALITY_TIER_SETTINGS } from '../state/qualitySettings';

export const RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type AtlasRank = (typeof RANKS)[number];
export type AtlasSuit = (typeof SUITS)[number];

export const ATLAS_COLS = 13;
export const ATLAS_ROWS = 5;
export const BACK_KEY = 'back' as const;

export type AtlasUV = {
  /** Left edge in image-space [0,1). */
  u: number;
  /** Top edge in image-space [0,1). */
  v: number;
  /** Cell width in image-space. */
  w: number;
  /** Cell height in image-space. */
  h: number;
};

const RANK_COL: Readonly<Record<AtlasRank, number>> = Object.freeze(
  Object.fromEntries(RANKS.map((r, i) => [r, i])) as Record<AtlasRank, number>,
);
const SUIT_ROW: Readonly<Record<AtlasSuit, number>> = Object.freeze(
  Object.fromEntries(SUITS.map((s, i) => [s, i])) as Record<AtlasSuit, number>,
);

const BACK_ROW = 4;
const BACK_COL = 0;

const CELL_W = 1 / ATLAS_COLS;
const CELL_H = 1 / ATLAS_ROWS;

function cellUV(col: number, row: number): AtlasUV {
  return { u: col / ATLAS_COLS, v: row / ATLAS_ROWS, w: CELL_W, h: CELL_H };
}

export function getUV(rank: AtlasRank, suit: AtlasSuit): AtlasUV {
  const col = RANK_COL[rank];
  const row = SUIT_ROW[suit];
  if (col === undefined) {
    throw new Error(`CardAtlas: unknown rank ${String(rank)}`);
  }
  if (row === undefined) {
    throw new Error(`CardAtlas: unknown suit ${String(suit)}`);
  }
  return cellUV(col, row);
}

export function getBackUV(): AtlasUV {
  return cellUV(BACK_COL, BACK_ROW);
}

/**
 * Resolve a canonical card id like `Ah`, `10d`, or `back`.
 * Returns `null` for malformed input — callers should treat null as
 * "render the back" rather than crash.
 */
export function getUVById(id: string): AtlasUV | null {
  if (!id) return null;
  if (id === BACK_KEY) return getBackUV();
  const suit = id.slice(-1) as AtlasSuit;
  const rank = id.slice(0, -1) as AtlasRank;
  if (!(suit in SUIT_ROW)) return null;
  if (!(rank in RANK_COL)) return null;
  return getUV(rank, suit);
}

/**
 * Resolve the UV for a card id, honoring the `faceUp` flag and gracefully
 * falling back to the back cell for null / malformed / unknown ids. Never
 * throws — safe for <Card>'s render path.
 */
export function resolveCardUV(
  id: string | null | undefined,
  faceUp: boolean,
): AtlasUV {
  if (!faceUp) return getBackUV();
  if (!id) return getBackUV();
  return getUVById(id) ?? getBackUV();
}

// ---- Texture build -------------------------------------------------------

export function getAtlasSize(tier: QualityTier): number {
  // T-038 Item-2 (Cycle 39 L-2): read canonical atlas resolution from
  // QUALITY_TIER_SETTINGS — the inline `tier === 'low' ? 1024 : 2048`
  // literal is retired so plan.md remains the single source of truth.
  return QUALITY_TIER_SETTINGS[tier].cardAtlasResolution;
}

const textureCache = new Map<QualityTier, THREE.Texture>();

export function clearAtlasCache(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}

export function getTexture(tier: QualityTier): THREE.Texture {
  const cached = textureCache.get(tier);
  if (cached) return cached;
  const tex = buildAtlasTexture(tier);
  textureCache.set(tier, tex);
  return tex;
}

// ---- Flip-corrected sampling helpers --------------------------------------
//
// CardAtlas UVs are image-space (v measured from the top), but the default
// `CanvasTexture.flipY` is `true`, which vertically flips the image on
// upload. A naive consumer that plugs `uv.v` straight into `texture.offset.y`
// samples the wrong row. These helpers centralize the correction so every
// consumer gets it right by construction.

export type TextureOffsetRepeat = {
  /** Flip-corrected value for `texture.offset.(x, y)`. */
  offset: [number, number];
  /** Value for `texture.repeat.(x, y)`. */
  repeat: [number, number];
  /** The underlying atlas texture (for convenience). */
  texture: THREE.Texture;
  /** The raw image-space UV that was resolved. */
  uv: AtlasUV;
};

/**
 * Resolve a card id to `{offset, repeat, texture}` suitable for direct
 * assignment to `material.map.offset` / `material.map.repeat`. Automatically
 * flip-corrects based on the texture's current `flipY` setting. Unknown /
 * malformed ids render the back cell.
 */
export function getTextureOffsetRepeat(
  id: string,
  tier: QualityTier,
): TextureOffsetRepeat {
  const texture = getTexture(tier);
  const uv = getUVById(id) ?? getBackUV();
  const oy = texture.flipY ? 1 - uv.v - uv.h : uv.v;
  return {
    offset: [uv.u, oy],
    repeat: [uv.w, uv.h],
    texture,
    uv,
  };
}

/**
 * Compute the 8 uv floats (4 vertices × 2 components) to bake directly onto
 * a `PlaneGeometry` so that a single shared atlas texture can render an
 * individual card cell. Honors `flipY` just like `getTextureOffsetRepeat`.
 *
 * PlaneGeometry vertex order:
 *   [0] top-left, [1] top-right, [2] bottom-left, [3] bottom-right
 */
export function computePlaneUVsForAtlas(
  uv: AtlasUV,
  flipY: boolean,
): Float32Array {
  const { u, v, w, h } = uv;
  // Image-space edges.
  const uL = u;
  const uR = u + w;
  // Sampling edges in texture space:
  //   flipY=true  → image-top (v) maps to uv_y = 1 - v
  //   flipY=false → image-top (v) maps to uv_y = v        (identity)
  const vTop = flipY ? 1 - v : v;
  const vBot = flipY ? 1 - v - h : v + h;
  return new Float32Array([
    uL,
    vTop, // top-left
    uR,
    vTop, // top-right
    uL,
    vBot, // bottom-left
    uR,
    vBot, // bottom-right
  ]);
}

function createAtlasCanvas(size: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(size, size);
    } catch {
      // fall through to DOM canvas
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function buildAtlasTexture(tier: QualityTier): THREE.Texture {
  const size = getAtlasSize(tier);
  const canvas = createAtlasCanvas(size);
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  const cellW = size / ATLAS_COLS;
  const cellH = size / ATLAS_ROWS;

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const col = RANK_COL[rank];
        const row = SUIT_ROW[suit];
        drawCardFace(ctx, col * cellW, row * cellH, cellW, cellH, rank, suit);
      }
    }
    drawCardBack(ctx, BACK_COL * cellW, BACK_ROW * cellH, cellW, cellH);
  }

  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}

// ---- Glyph drawing (ported from the legacy `scenes/cards.ts` helper, removed in T-033) ----

const SUIT_GLYPH: Record<AtlasSuit, string> = {
  s: '\u2660', // ♠
  h: '\u2665', // ♥
  d: '\u2666', // ♦
  c: '\u2663', // ♣
};
const RED_SUITS: ReadonlySet<AtlasSuit> = new Set(['h', 'd']);

type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function drawCardFace(
  ctx: AnyCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  rank: AtlasRank,
  suit: AtlasSuit,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = Math.max(2, w * 0.015);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  const color = RED_SUITS.has(suit) ? '#cc0000' : '#111111';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const glyph = SUIT_GLYPH[suit];
  const cx = x + w / 2;
  ctx.font = `bold ${Math.round(h * 0.38)}px sans-serif`;
  ctx.fillText(rank, cx, y + h * 0.38);
  ctx.font = `bold ${Math.round(h * 0.38)}px sans-serif`;
  ctx.fillText(glyph, cx, y + h * 0.7);
}

function drawCardBack(ctx: AnyCtx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#1a3a6e';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0c1f3d';
  ctx.lineWidth = Math.max(2, w * 0.02);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = Math.max(1, w * 0.008);
  const step = w / 8;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.moveTo(x + i + h, y);
    ctx.lineTo(x + i, y + h);
  }
  ctx.stroke();
}
