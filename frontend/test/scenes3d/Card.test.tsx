/** @vitest-environment happy-dom */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as THREE from 'three';

// R3F intrinsic tags emit React "unknown element" warnings under happy-dom;
// silence them so real errors still surface.
const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Unknown event handler|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

import {
  getTexture,
  getTextureOffsetRepeat,
  computePlaneUVsForAtlas,
  resolveCardUV,
  getUV,
  getBackUV,
} from '../../src/scenes3d/components/CardAtlas';
import { Card, getSharedCardMaterial } from '../../src/scenes3d/components/Card';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// UV flip foot-gun: CanvasTexture.flipY defaults to true, but CardAtlas UVs
// are image-space (v from top). A naive consumer passing `uv.v` straight to
// `texture.offset.y` samples the *wrong* row. These tests lock the contract
// down so the bug can never silently reappear.
// ---------------------------------------------------------------------------

describe('CardAtlas.getTextureOffsetRepeat (flip-corrected)', () => {
  it('2s (top-left of image, v=0) flips to offset y = 4/5 under flipY=true', () => {
    const r = getTextureOffsetRepeat('2s', 'medium');
    expect(r.offset[0]).toBeCloseTo(0, 10);
    expect(r.offset[1]).toBeCloseTo(4 / 5, 10);
    expect(r.repeat[0]).toBeCloseTo(1 / 13, 10);
    expect(r.repeat[1]).toBeCloseTo(1 / 5, 10);
  });

  it('back (image-space v=4/5) flips to offset y = 0 under flipY=true', () => {
    const r = getTextureOffsetRepeat('back', 'medium');
    expect(r.offset[0]).toBeCloseTo(0, 10);
    expect(r.offset[1]).toBeCloseTo(0, 10);
    // Regression guard: the uncorrected value would be 4/5, which would
    // cause the back cell to sample the 2s-row instead.
    expect(r.offset[1]).not.toBeCloseTo(4 / 5, 3);
  });

  it('Ah (col=12, row=1) maps to offset = [12/13, 3/5]', () => {
    const r = getTextureOffsetRepeat('Ah', 'medium');
    expect(r.offset[0]).toBeCloseTo(12 / 13, 10);
    // image v = 1/5 → flip → 1 - 1/5 - 1/5 = 3/5
    expect(r.offset[1]).toBeCloseTo(3 / 5, 10);
  });

  it('skips the flip correction when the texture has flipY=false', () => {
    const tex = getTexture('medium');
    const prev = tex.flipY;
    tex.flipY = false;
    try {
      const r = getTextureOffsetRepeat('2s', 'medium');
      expect(r.offset[1]).toBeCloseTo(0, 10);
    } finally {
      tex.flipY = prev;
    }
  });

  it('returns the back cell for ids the atlas cannot resolve', () => {
    const bad = getTextureOffsetRepeat('Xq', 'medium');
    const back = getTextureOffsetRepeat('back', 'medium');
    expect(bad.offset[0]).toBeCloseTo(back.offset[0], 10);
    expect(bad.offset[1]).toBeCloseTo(back.offset[1], 10);
  });
});

describe('CardAtlas.computePlaneUVsForAtlas', () => {
  it('produces 8 floats matching the PlaneGeometry vertex order', () => {
    const uv = getUV('2', 's'); // u=0, v=0, w=1/13, h=1/5
    const out = computePlaneUVsForAtlas(uv, true);
    expect(out).toHaveLength(8);
    // PlaneGeometry uv order (top-left, top-right, bottom-left, bottom-right)
    // with flipY=true texture:
    //   top row samples image top (v=0) → uv_y = 1 - 0 = 1
    //   bottom row samples image bottom (v=h) → uv_y = 1 - h = 4/5
    const [u0, v0, u1, v1, u2, v2, u3, v3] = Array.from(out);
    expect(u0).toBeCloseTo(0, 5);
    expect(v0).toBeCloseTo(1, 5); // top-left
    expect(u1).toBeCloseTo(1 / 13, 5);
    expect(v1).toBeCloseTo(1, 5); // top-right
    expect(u2).toBeCloseTo(0, 5);
    expect(v2).toBeCloseTo(4 / 5, 5); // bottom-left
    expect(u3).toBeCloseTo(1 / 13, 5);
    expect(v3).toBeCloseTo(4 / 5, 5); // bottom-right
  });

  it('flips back cell (v=4/5) so plane samples image-top at its top vertices', () => {
    const back = getBackUV();
    const out = computePlaneUVsForAtlas(back, true);
    // top vertices of the plane should sample image-top of the back cell:
    //   image_y = 4/5 → uv_y (flipped) = 1 - 4/5 = 1/5
    expect(out[1]).toBeCloseTo(1 / 5, 5);
    expect(out[3]).toBeCloseTo(1 / 5, 5);
    // bottom vertices sample image-bottom of back cell: 1 - 1 = 0
    expect(out[5]).toBeCloseTo(0, 5);
    expect(out[7]).toBeCloseTo(0, 5);
  });

  it('skips flip when flipY=false (identity v mapping)', () => {
    const back = getBackUV();
    const out = computePlaneUVsForAtlas(back, false);
    // top vertices sample image-top directly: v = 4/5
    expect(out[1]).toBeCloseTo(4 / 5, 5);
    expect(out[3]).toBeCloseTo(4 / 5, 5);
    // bottom vertices sample image-bottom: v = 1
    expect(out[5]).toBeCloseTo(1, 5);
    expect(out[7]).toBeCloseTo(1, 5);
  });
});

describe('CardAtlas.resolveCardUV', () => {
  it('returns the face UV when faceUp=true and id is valid', () => {
    expect(resolveCardUV('Ah', true)).toEqual(getUV('A', 'h'));
  });

  it('returns the back UV when faceUp=false regardless of id', () => {
    expect(resolveCardUV('Ah', false)).toEqual(getBackUV());
  });

  it('returns the back UV when id is null / undefined / empty', () => {
    expect(resolveCardUV(null, true)).toEqual(getBackUV());
    expect(resolveCardUV(undefined, true)).toEqual(getBackUV());
    expect(resolveCardUV('', true)).toEqual(getBackUV());
  });

  it('returns the back UV for ids the atlas cannot resolve (no throw)', () => {
    expect(() => resolveCardUV('Zq', true)).not.toThrow();
    expect(resolveCardUV('Zq', true)).toEqual(getBackUV());
  });
});

// ---------------------------------------------------------------------------
// <Card> component
// ---------------------------------------------------------------------------

describe('<Card> shared material', () => {
  it('returns the same MeshStandardMaterial instance for the same tier', () => {
    const a = getSharedCardMaterial('medium');
    const b = getSharedCardMaterial('medium');
    expect(a).toBe(b);
  });

  it('returns different material instances for different tiers', () => {
    const m = getSharedCardMaterial('medium');
    const l = getSharedCardMaterial('low');
    expect(m).not.toBe(l);
  });

  it('attaches the atlas texture as the material map', () => {
    const mat = getSharedCardMaterial('medium');
    expect(mat.map).toBe(getTexture('medium'));
  });

  it('the shared material is a THREE.MeshStandardMaterial', () => {
    const mat = getSharedCardMaterial('medium');
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
});

describe('<Card> rendering', () => {
  it('mounts without throwing for a face-up card', () => {
    expect(() => render(<Card id="Ah" faceUp />)).not.toThrow();
  });

  it('mounts without throwing for a face-down card', () => {
    expect(() => render(<Card id="Ah" faceUp={false} />)).not.toThrow();
  });

  it('tolerates a null/missing id and renders a back', () => {
    expect(() => render(<Card id={null} faceUp />)).not.toThrow();
    expect(() => render(<Card faceUp />)).not.toThrow();
  });

  it('tolerates unknown ids without crashing', () => {
    expect(() => render(<Card id="Zq" faceUp />)).not.toThrow();
  });

  it('renders a mesh with position and rotation applied', () => {
    const { container } = render(
      <Card id="Ah" faceUp position={[1, 2, 3]} rotation={[0, Math.PI / 2, 0]} />,
    );
    const mesh = container.querySelector('mesh[name="card"]');
    expect(mesh).not.toBeNull();
    expect(mesh!.getAttribute('position')).toBe('1,2,3');
  });

  it('renders the face id on a data-card-id attribute for inspectability', () => {
    const { container } = render(<Card id="Ah" faceUp />);
    const mesh = container.querySelector('mesh[name="card"]');
    expect(mesh).not.toBeNull();
    expect(mesh!.getAttribute('data-card-id')).toBe('Ah');
  });

  it('falls back to the back id when faceUp=false', () => {
    const { container } = render(<Card id="Ah" faceUp={false} />);
    const mesh = container.querySelector('mesh[name="card"]');
    expect(mesh!.getAttribute('data-card-id')).toBe('back');
  });

  it('falls back to the back id for unknown card ids', () => {
    const { container } = render(<Card id="Zq" faceUp />);
    const mesh = container.querySelector('mesh[name="card"]');
    expect(mesh!.getAttribute('data-card-id')).toBe('back');
  });
});
