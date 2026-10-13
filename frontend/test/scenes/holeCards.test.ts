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
  }
  class PlaneGeometry { dispose() {} }
  class MeshLambertMaterial {
    map: unknown;
    opacity = 1;
    transparent = false;
    emissive: Color | null = null;
    emissiveIntensity = 0;
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
    material = new MeshLambertMaterial();
    flip = vi.fn();
    cancelFlip = vi.fn();
  }
  class SpriteMaterial {
    map: unknown = null;
    dispose() {}
  }
  class Sprite {
    position = new Vector3();
    scale = new Vector3();
    material = new SpriteMaterial();
  }
  class Scene {
    children: unknown[] = [];
    add(obj: unknown) { this.children.push(obj); }
    remove(obj: unknown) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class CanvasTexture { dispose() {} }

  return { Color, Vector3, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial, Mesh, SpriteMaterial, Sprite, Scene, CanvasTexture };
});

beforeEach(() => {
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

import { createHoleCards, type HoleCardHandData } from '../../src/../src/scenes/holeCards.ts';
import * as THREE from 'three';

function makeSeatPositions(n: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
  });
}

function makeHandData(overrides: Partial<HoleCardHandData> = {}): HoleCardHandData {
  return {
    player_hands: overrides.player_hands ?? [
      {
        player_name: 'Alice',
        hole_cards: [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }],
        result: 'win',
      },
      {
        player_name: 'Bob',
        hole_cards: [{ rank: '10', suit: '♦' }, { rank: 'J', suit: '♣' }],
        result: 'fold',
      },
    ],
  };
}

describe('createHoleCards', () => {
  it('returns initHand, goToShowdown, goToPreFlop, and dispose', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));

    expect(typeof hc.initHand).toBe('function');
    expect(typeof hc.goToShowdown).toBe('function');
    expect(typeof hc.goToPreFlop).toBe('function');
    expect(typeof hc.dispose).toBe('function');
  });

  it('initHand adds cards to the scene for each seated player', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));
    const before = scene.children.length;

    hc.initHand(makeHandData(), { 0: 'Alice', 1: 'Bob' });
    // 2 cards per player, 2 players = 4 cards
    expect(scene.children.length).toBe(before + 4);

    hc.dispose();
  });

  it('initHand with no hole_cards places face-down placeholders', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));

    const handData: HoleCardHandData = {
      player_hands: [
        { player_name: 'Alice', hole_cards: null, result: 'fold' },
      ],
    };
    const before = scene.children.length;

    hc.initHand(handData, { 0: 'Alice' });
    // 2 placeholder cards
    expect(scene.children.length).toBe(before + 2);

    hc.dispose();
  });

  it('goToShowdown does not throw', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));
    hc.initHand(makeHandData(), { 0: 'Alice', 1: 'Bob' });

    expect(() => hc.goToShowdown()).not.toThrow();

    hc.dispose();
  });

  it('goToPreFlop resets cards to face-down placeholders', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));
    hc.initHand(makeHandData(), { 0: 'Alice', 1: 'Bob' });
    hc.goToShowdown();

    expect(() => hc.goToPreFlop()).not.toThrow();

    hc.dispose();
  });

  it('dispose cleans up all cards from the scene', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));
    hc.initHand(makeHandData(), { 0: 'Alice', 1: 'Bob' });

    hc.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('calling initHand twice cleans up preceding hand', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));

    hc.initHand(makeHandData(), { 0: 'Alice' });
    const afterFirst = scene.children.length;

    hc.initHand(makeHandData(), { 0: 'Alice' });
    // Should replace, not accumulate
    expect(scene.children.length).toBe(afterFirst);

    hc.dispose();
  });

  it('goToShowdown adds FOLD sprite for folded players', () => {
    const scene = new THREE.Scene();
    const hc = createHoleCards(scene, makeSeatPositions(4));
    hc.initHand(makeHandData(), { 0: 'Alice', 1: 'Bob' });
    const beforeShowdown = scene.children.length;

    hc.goToShowdown();
    // Bob folded → 1 FOLD sprite added
    expect(scene.children.length).toBe(beforeShowdown + 1);

    hc.dispose();
  });
});
