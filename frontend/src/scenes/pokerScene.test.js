/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Three.js before importing the module under test
vi.mock('three', () => {
  class Color {
    constructor() {}
    set() { return this; }
  }
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    project() { return this; }
    lerpVectors(a, b, t) { this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t; return this; }
  }
  class PerspectiveCamera {
    constructor() { this.position = new Vector3(); this.aspect = 1; }
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class AmbientLight {}
  class DirectionalLight { constructor() { this.position = new Vector3(); } }
  class Scene {
    constructor() { this.background = null; this.children = []; }
    add(obj) { this.children.push(obj); }
    remove(obj) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class WebGLRenderer {
    constructor(opts) { this.domElement = opts?.canvas || {}; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  class CylinderGeometry { scale() {} dispose() {} }
  class PlaneGeometry { dispose() {} }
  class MeshLambertMaterial { constructor() { this.color = new Color(); } dispose() {} }
  class MeshBasicMaterial { constructor() {} dispose() {} }
  class SpriteMaterial { constructor() { this.map = null; } dispose() {} }
  class Mesh {
    constructor() {
      this.position = new Vector3();
      this.rotation = { x: 0, y: 0, z: 0 };
      this.geometry = { dispose: vi.fn() };
      this.material = { dispose: vi.fn(), map: null };
      this.flip = vi.fn();
      this.cancelFlip = vi.fn();
    }
  }
  class Sprite {
    constructor() { this.position = new Vector3(); this.scale = new Vector3(); this.material = new SpriteMaterial(); }
  }
  class Group {
    constructor() { this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.children = []; }
    add(c) { this.children.push(c); }
  }
  class CanvasTexture { dispose() {} }

  return {
    Color,
    Vector3,
    PerspectiveCamera,
    AmbientLight,
    DirectionalLight,
    Scene,
    WebGLRenderer,
    CylinderGeometry,
    PlaneGeometry,
    MeshLambertMaterial,
    MeshBasicMaterial,
    SpriteMaterial,
    Mesh,
    Sprite,
    Group,
    CanvasTexture,
  };
});

// Stub requestAnimationFrame / cancelAnimationFrame
let rafCallbacks = [];
let rafIdCounter = 0;
beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafIdCounter++; rafCallbacks.push({ id: rafIdCounter, cb }); return rafIdCounter; });
  vi.stubGlobal('cancelAnimationFrame', (id) => { rafCallbacks = rafCallbacks.filter(r => r.id !== id); });
  vi.stubGlobal('devicePixelRatio', 1);

  // Stub canvas 2D context for card rendering (happy-dom doesn't support it)
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
    const el = origCreateElement(tag, ...args);
    if (tag === 'canvas' && !el.getContext.__mocked) {
      el.getContext = () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
      });
      el.getContext.__mocked = true;
    }
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCanvas(w = 800, h = 600) {
  const canvas = document.createElement('canvas');
  // happy-dom may not set clientWidth/clientHeight, so we override
  Object.defineProperty(canvas, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: h, configurable: true });
  return canvas;
}

describe('createPokerScene', () => {
  let createPokerScene;

  beforeEach(async () => {
    ({ createPokerScene } = await import('./pokerScene.js'));
  });

  it('returns the expected API surface', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(result).toHaveProperty('scene');
    expect(result).toHaveProperty('camera');
    expect(result).toHaveProperty('renderer');
    expect(result).toHaveProperty('seatPositions');
    expect(result).toHaveProperty('dispose');
    expect(result).toHaveProperty('update');
    expect(typeof result.dispose).toBe('function');
    expect(typeof result.update).toBe('function');

    result.dispose();
  });

  it('creates 10 seat positions by default', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(result.seatPositions).toHaveLength(10);
    result.dispose();
  });

  it('respects custom seatCount option', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas, { seatCount: 6 });

    expect(result.seatPositions).toHaveLength(6);
    result.dispose();
  });

  it('exposes chipStacks and holeCards controllers', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(result.chipStacks).toBeDefined();
    expect(typeof result.chipStacks.updateChipStacks).toBe('function');
    expect(result.holeCards).toBeDefined();
    expect(typeof result.holeCards.initHand).toBe('function');

    result.dispose();
  });

  it('dispose does not throw', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(() => result.dispose()).not.toThrow();
  });

  it('update with cardData creates community cards', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    const cardData = {
      flop: [
        { rank: 'A', suit: '♠' },
        { rank: 'K', suit: '♥' },
        { rank: 'Q', suit: '♦' },
      ],
      turn: { rank: 'J', suit: '♣' },
      river: null,
      player_hands: [],
    };

    expect(() => result.update({
      cardData,
      seatPlayerMap: { 0: 'Alice', 1: 'Bob' },
      plMap: { Alice: 50, Bob: -50 },
      streetIndex: 1,
    })).not.toThrow();

    expect(result.communityCards).not.toBeNull();

    result.dispose();
  });

  it('uses default width/height when canvas has no dimensions', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 0, configurable: true });
    // parentElement may be null in test — options provide fallback
    const result = createPokerScene(canvas, { width: 1024, height: 768 });

    expect(result.renderer).toBeDefined();
    result.dispose();
  });
});
