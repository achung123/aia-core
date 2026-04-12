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
    constructor(opts?: { canvas?: HTMLCanvasElement }) { this.domElement = opts?.canvas ?? {}; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }

  return { Color, Vector3, PerspectiveCamera, AmbientLight, DirectionalLight, Scene, WebGLRenderer };
});

let rafCallbacks: { id: number; cb: FrameRequestCallback }[] = [];
let rafIdCounter = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => { rafIdCounter++; rafCallbacks.push({ id: rafIdCounter, cb }); return rafIdCounter; });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => { rafCallbacks = rafCallbacks.filter(r => r.id !== id); });
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { initScene } from './table.ts';

function makeCanvas(w = 800, h = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: h, configurable: true });
  return canvas;
}

describe('initScene', () => {
  it('returns renderer, scene, camera, and dispose', () => {
    const canvas = makeCanvas();
    const result = initScene(canvas);

    expect(result.renderer).toBeDefined();
    expect(result.scene).toBeDefined();
    expect(result.camera).toBeDefined();
    expect(typeof result.dispose).toBe('function');

    result.dispose();
  });

  it('adds lighting to the scene', () => {
    const canvas = makeCanvas();
    const result = initScene(canvas);

    // AmbientLight + DirectionalLight = at least 2 children
    expect(result.scene.children.length).toBeGreaterThanOrEqual(2);

    result.dispose();
  });

  it('sets camera position above and in front of origin', () => {
    const canvas = makeCanvas();
    const result = initScene(canvas);

    expect(result.camera.position.y).toBe(8);
    expect(result.camera.position.z).toBe(5);

    result.dispose();
  });

  it('sets a dark background on the scene', () => {
    const canvas = makeCanvas();
    const result = initScene(canvas);

    expect(result.scene.background).not.toBeNull();

    result.dispose();
  });

  it('dispose does not throw', () => {
    const canvas = makeCanvas();
    const result = initScene(canvas);

    expect(() => result.dispose()).not.toThrow();
  });
});
