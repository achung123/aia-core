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
    constructor(opts?: { map?: unknown }) { this.map = opts?.map ?? null; }
    dispose() {}
  }
  class MeshBasicMaterial {
    color: number;
    constructor(opts?: { color?: number }) { this.color = opts?.color ?? 0; }
    dispose() {}
  }
  class Mesh {
    rotation = { x: 0, y: 0, z: 0 };
    position = new Vector3();
    constructor(public geometry?: unknown, public material?: unknown) {}
  }
  class CanvasTexture {
    constructor() {}
    dispose() {}
  }

  return { Color, Vector3, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial, Mesh, CanvasTexture };
});

beforeEach(() => {
  // Stub canvas 2D context
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

import { createCard, type CardMesh } from './cards.ts';
import * as THREE from 'three';

describe('createCard', () => {
  it('returns a Mesh instance', () => {
    const mesh = createCard('A', '♠');
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('creates a face-up card with MeshLambertMaterial when faceUp=true', () => {
    const mesh = createCard('K', '♥', true);
    expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect((mesh.material as THREE.MeshLambertMaterial).map).not.toBeNull();
  });

  it('creates a face-down card with MeshBasicMaterial when faceUp=false', () => {
    const mesh = createCard('Q', '♦', false);
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('defaults to face-up when faceUp is omitted', () => {
    const mesh = createCard('J', '♣');
    expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('rotates the card to face upward (-PI/2 on x)', () => {
    const mesh = createCard('10', '♠');
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it('attaches flip and cancelFlip methods', () => {
    const mesh = createCard('A', '♥') as CardMesh;
    expect(typeof mesh.flip).toBe('function');
    expect(typeof mesh.cancelFlip).toBe('function');
  });

  it('flip and cancelFlip do not throw', () => {
    const mesh = createCard('A', '♠') as CardMesh;
    expect(() => mesh.flip()).not.toThrow();
    expect(() => mesh.cancelFlip()).not.toThrow();
  });
});
