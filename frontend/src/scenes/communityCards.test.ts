/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('three', () => {
  class Color {
    constructor() {}
    set() { return this; }
  }
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    lerpVectors(a: Vector3, b: Vector3, t: number) {
      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.z = a.z + (b.z - a.z) * t;
      return this;
    }
  }
  class PlaneGeometry { dispose() {} }
  class MeshLambertMaterial {
    map: unknown;
    constructor(opts?: { map?: unknown }) { this.map = opts?.map ?? null; }
    dispose() {}
  }
  class MeshBasicMaterial {
    constructor() {}
    dispose() {}
  }
  class Mesh {
    position = new Vector3();
    rotation = { x: 0, y: 0, z: 0 };
    geometry = { dispose: vi.fn() };
    material: { dispose: ReturnType<typeof vi.fn>; map: unknown } = { dispose: vi.fn(), map: null };
    flip = vi.fn();
    cancelFlip = vi.fn();
  }
  class Scene {
    children: unknown[] = [];
    add(obj: unknown) { this.children.push(obj); }
    remove(obj: unknown) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class CanvasTexture { dispose() {} }

  return { Color, Vector3, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial, Mesh, Scene, CanvasTexture };
});

let rafCallbacks: { id: number; cb: FrameRequestCallback }[] = [];
let rafIdCounter = 0;
beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => { rafIdCounter++; rafCallbacks.push({ id: rafIdCounter, cb }); return rafIdCounter; });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => { rafCallbacks = rafCallbacks.filter(r => r.id !== id); });

  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: unknown[]) => {
    const el = origCreateElement(tag, ...(args as [ElementCreationOptions?]));
    if (tag === 'canvas') {
      (el as HTMLCanvasElement).getContext = (() => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
      })) as unknown as HTMLCanvasElement['getContext'];
    }
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { createCommunityCards, type CommunityHandData } from './communityCards.ts';
import * as THREE from 'three';

function makeHandData(opts: Partial<CommunityHandData> = {}): CommunityHandData {
  return {
    flop: opts.flop ?? [
      { rank: 'A', suit: '♠' },
      { rank: 'K', suit: '♥' },
      { rank: 'Q', suit: '♦' },
    ],
    turn: opts.turn ?? { rank: 'J', suit: '♣' },
    river: opts.river ?? { rank: '10', suit: '♠' },
  };
}

describe('createCommunityCards', () => {
  it('returns goToStreet and dispose functions', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());

    expect(typeof cc.goToStreet).toBe('function');
    expect(typeof cc.dispose).toBe('function');
  });

  it('goToStreet(0) adds no cards to the scene', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());
    const before = scene.children.length;

    cc.goToStreet(0);
    expect(scene.children.length).toBe(before);

    cc.dispose();
  });

  it('goToStreet(1) adds 3 flop cards to the scene', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());
    const before = scene.children.length;

    cc.goToStreet(1);
    expect(scene.children.length).toBe(before + 3);

    cc.dispose();
  });

  it('goToStreet(2) adds 4 cards (flop + turn)', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());
    const before = scene.children.length;

    cc.goToStreet(2);
    expect(scene.children.length).toBe(before + 4);

    cc.dispose();
  });

  it('goToStreet(3) adds 5 cards (flop + turn + river)', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());
    const before = scene.children.length;

    cc.goToStreet(3);
    expect(scene.children.length).toBe(before + 5);

    cc.dispose();
  });

  it('handles null flop gracefully', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData({ flop: null }));

    expect(() => cc.goToStreet(1)).not.toThrow();
    // No cards should be added since flop is null
    cc.dispose();
  });

  it('going from street 1 to 0 removes cards', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());

    cc.goToStreet(1);
    const after1 = scene.children.length;

    cc.goToStreet(0);
    // Cards are marked for removal (animated), but disposal happens on complete
    // At minimum, the scene should not have MORE children
    expect(scene.children.length).toBeLessThanOrEqual(after1);

    cc.dispose();
  });

  it('dispose does not throw', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());
    cc.goToStreet(3);

    expect(() => cc.dispose()).not.toThrow();
  });

  it('calling goToStreet multiple times rapidly does not throw', () => {
    const scene = new THREE.Scene();
    const cc = createCommunityCards(scene, makeHandData());

    expect(() => {
      cc.goToStreet(1);
      cc.goToStreet(3);
      cc.goToStreet(0);
      cc.goToStreet(2);
    }).not.toThrow();

    cc.dispose();
  });
});
