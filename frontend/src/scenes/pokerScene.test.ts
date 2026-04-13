/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { PokerSceneResult, PokerSceneOptions } from './pokerScene.ts';

// Mock OrbitControls
const mockOrbitControls = {
  enableDamping: false,
  enableZoom: false,
  enableRotate: false,
  enablePan: false,
  minDistance: 0,
  maxDistance: 0,
  touches: {} as Record<string, number>,
  target: null as unknown,
  update: vi.fn(),
  dispose: vi.fn(),
  saveState: vi.fn(),
  reset: vi.fn(),
};
const OrbitControlsCtor: Mock = vi.fn(function (this: typeof mockOrbitControls) {
  Object.assign(this, mockOrbitControls);
  return mockOrbitControls;
});
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: OrbitControlsCtor,
}));

// Mock Three.js before importing the module under test
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
    project() { return this; }
    lerpVectors(a: Vector3, b: Vector3, t: number) { this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t; return this; }
  }
  class PerspectiveCamera {
    position = new Vector3();
    aspect = 1;
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class AmbientLight {}
  class DirectionalLight { position = new Vector3(); }
  class Scene {
    background: Color | null = null;
    children: unknown[] = [];
    add(obj: unknown) { this.children.push(obj); }
    remove(obj: unknown) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement | Record<string, never>;
    constructor(opts?: { canvas?: HTMLCanvasElement }) { this.domElement = opts?.canvas || {}; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  class CylinderGeometry { scale() {} dispose() {} }
  class PlaneGeometry { dispose() {} }
  class MeshLambertMaterial {
    color = new Color();
    dispose() {}
  }
  class MeshBasicMaterial {
    dispose() {}
  }
  class SpriteMaterial {
    map: unknown = null;
    dispose() {}
  }
  class Mesh {
    position = new Vector3();
    rotation = { x: 0, y: 0, z: 0 };
    geometry = { dispose: vi.fn() };
    material: { dispose: Mock; map: unknown } = { dispose: vi.fn(), map: null };
    flip = vi.fn();
    cancelFlip = vi.fn();
  }
  class Sprite {
    position = new Vector3();
    scale = new Vector3();
    material = new SpriteMaterial();
  }
  class Group {
    position = new Vector3();
    scale = new Vector3(1, 1, 1);
    children: unknown[] = [];
    add(c: unknown) { this.children.push(c); }
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
    TOUCH: { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 },
  };
});

interface RafEntry { id: number; cb: FrameRequestCallback }

// Stub requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: RafEntry[] = [];
let rafIdCounter = 0;
beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => { rafIdCounter++; rafCallbacks.push({ id: rafIdCounter, cb }); return rafIdCounter; });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => { rafCallbacks = rafCallbacks.filter(r => r.id !== id); });
  vi.stubGlobal('devicePixelRatio', 1);

  // Stub canvas 2D context for card rendering (happy-dom doesn't support it)
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: unknown[]) => {
    const el = origCreateElement(tag, ...(args as [ElementCreationOptions?]));
    if (tag === 'canvas') {
      const canvasEl = el as HTMLCanvasElement & { __mocked?: boolean };
      if (!canvasEl.__mocked) {
        canvasEl.getContext = (() => ({
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          font: '',
          textAlign: '',
          textBaseline: '',
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
        })) as unknown as typeof canvasEl.getContext;
        canvasEl.__mocked = true;
      }
    }
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCanvas(w = 800, h = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // happy-dom may not set clientWidth/clientHeight, so we override
  Object.defineProperty(canvas, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: h, configurable: true });
  return canvas;
}

describe('createPokerScene', () => {
  let createPokerScene: (canvas: HTMLCanvasElement, options?: PokerSceneOptions) => PokerSceneResult;

  beforeEach(async () => {
    ({ createPokerScene } = await import('./pokerScene.ts'));
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

describe('touch controls', () => {
  let createPokerScene: (canvas: HTMLCanvasElement, options?: PokerSceneOptions) => PokerSceneResult;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock state
    mockOrbitControls.enableDamping = false;
    mockOrbitControls.enableZoom = false;
    mockOrbitControls.enableRotate = false;
    mockOrbitControls.enablePan = false;
    mockOrbitControls.minDistance = 0;
    mockOrbitControls.maxDistance = 0;
    mockOrbitControls.touches = {};
    ({ createPokerScene } = await import('./pokerScene.ts'));
  });

  it('creates OrbitControls attached to the canvas', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(OrbitControlsCtor).toHaveBeenCalledWith(result.camera, canvas);
    result.dispose();
  });

  it('enables damping and zoom on OrbitControls', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(mockOrbitControls.enableDamping).toBe(true);
    expect(mockOrbitControls.enableZoom).toBe(true);
    expect(mockOrbitControls.enableRotate).toBe(true);

    result.dispose();
  });

  it('disables panning on OrbitControls', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(mockOrbitControls.enablePan).toBe(false);

    result.dispose();
  });

  it('configures touch controls for single-finger orbit and pinch-zoom', async () => {
    const THREE = await import('three');
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(mockOrbitControls.touches).toEqual({
      ONE: THREE.TOUCH?.ROTATE ?? 0,
      TWO: THREE.TOUCH?.DOLLY_ROTATE ?? 3,
    });

    result.dispose();
  });

  it('suppresses context menu on the canvas', () => {
    const canvas = makeCanvas();
    const preventDefaultSpy = vi.fn();
    const result = createPokerScene(canvas);

    const event = new Event('contextmenu', { cancelable: true });
    event.preventDefault = preventDefaultSpy;
    canvas.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();

    result.dispose();
  });

  it('double-tap on canvas resets camera position', () => {
    const canvas = makeCanvas();
    vi.useFakeTimers();
    const result = createPokerScene(canvas);

    const singleFingerEnd = () => Object.assign(new Event('touchend'), {
      touches: [] as Touch[],
      changedTouches: [{}],
    });

    // Simulate two quick touchend events (double-tap)
    canvas.dispatchEvent(singleFingerEnd());
    vi.advanceTimersByTime(200);
    canvas.dispatchEvent(singleFingerEnd());

    expect(mockOrbitControls.reset).toHaveBeenCalled();

    vi.useRealTimers();
    result.dispose();
  });

  it('single tap does not reset camera', () => {
    const canvas = makeCanvas();
    vi.useFakeTimers();
    const result = createPokerScene(canvas);

    canvas.dispatchEvent(Object.assign(new Event('touchend'), {
      touches: [] as Touch[],
      changedTouches: [{}],
    }));
    vi.advanceTimersByTime(400); // too slow for double-tap

    expect(mockOrbitControls.reset).not.toHaveBeenCalled();

    vi.useRealTimers();
    result.dispose();
  });

  it('pinch-zoom end does not trigger double-tap reset', () => {
    const canvas = makeCanvas();
    vi.useFakeTimers();
    const result = createPokerScene(canvas);

    // First finger lifts — touches still has one remaining finger
    canvas.dispatchEvent(Object.assign(new Event('touchend'), {
      touches: [{}],
      changedTouches: [{}],
    }));
    vi.advanceTimersByTime(50);
    // Second finger lifts — changedTouches has > 1 (multi-finger lift)
    canvas.dispatchEvent(Object.assign(new Event('touchend'), {
      touches: [] as Touch[],
      changedTouches: [{}, {}],
    }));

    expect(mockOrbitControls.reset).not.toHaveBeenCalled();

    vi.useRealTimers();
    result.dispose();
  });

  it('dispose cleans up OrbitControls', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    result.dispose();

    expect(mockOrbitControls.dispose).toHaveBeenCalled();
  });

  it('returns controls in the API surface', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(result.controls).toBe(mockOrbitControls);

    result.dispose();
  });

  it('enforces minDistance and maxDistance on OrbitControls', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(mockOrbitControls.minDistance).toBe(8);
    expect(mockOrbitControls.maxDistance).toBe(30);

    result.dispose();
  });

  it('default camera position matches DEFAULT_OVERHEAD_POSITION from seatCamera', async () => {
    const { DEFAULT_OVERHEAD_POSITION } = await import('./seatCamera.ts');
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    expect(result.camera.position.x).toBe(DEFAULT_OVERHEAD_POSITION.x);
    expect(result.camera.position.y).toBe(DEFAULT_OVERHEAD_POSITION.y);
    expect(result.camera.position.z).toBe(DEFAULT_OVERHEAD_POSITION.z);

    result.dispose();
  });
});

describe('externalResize option', () => {
  let createPokerScene: (canvas: HTMLCanvasElement, options?: PokerSceneOptions) => PokerSceneResult;
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOrbitControls.enableDamping = false;
    mockOrbitControls.enableZoom = false;
    mockOrbitControls.enableRotate = false;
    mockOrbitControls.enablePan = false;
    mockOrbitControls.minDistance = 0;
    mockOrbitControls.maxDistance = 0;
    mockOrbitControls.touches = {};
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
    ({ createPokerScene } = await import('./pokerScene.ts'));
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('attaches window resize listener by default', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas);

    const resizeCalls = addSpy.mock.calls.filter(([type]) => type === 'resize');
    expect(resizeCalls.length).toBe(1);

    result.dispose();
  });

  it('attaches window resize listener when externalResize is false', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas, { externalResize: false });

    const resizeCalls = addSpy.mock.calls.filter(([type]) => type === 'resize');
    expect(resizeCalls.length).toBe(1);

    result.dispose();
  });

  it('does NOT attach window resize listener when externalResize is true', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas, { externalResize: true });

    const resizeCalls = addSpy.mock.calls.filter(([type]) => type === 'resize');
    expect(resizeCalls.length).toBe(0);

    result.dispose();
  });

  it('dispose does not call removeEventListener for resize when externalResize is true', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas, { externalResize: true });
    result.dispose();

    const removeCalls = removeSpy.mock.calls.filter(([type]) => type === 'resize');
    expect(removeCalls.length).toBe(0);
  });

  it('dispose removes window resize listener when externalResize is false', () => {
    const canvas = makeCanvas();
    const result = createPokerScene(canvas, { externalResize: false });
    result.dispose();

    const removeCalls = removeSpy.mock.calls.filter(([type]) => type === 'resize');
    expect(removeCalls.length).toBe(1);
  });
});
