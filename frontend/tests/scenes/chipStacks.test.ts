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
  class CylinderGeometry { dispose() {} }
  class MeshLambertMaterial {
    color = new Color();
    dispose = vi.fn();
  }
  class Mesh {
    position = new Vector3();
    constructor(public geometry?: unknown, public material?: unknown) {}
  }
  class Group {
    position = new Vector3();
    scale = new Vector3(1, 1, 1);
    children: unknown[] = [];
    add(c: unknown) { this.children.push(c); }
  }
  class Scene {
    children: unknown[] = [];
    add(obj: unknown) { this.children.push(obj); }
    remove(obj: unknown) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }

  return { Color, Vector3, CylinderGeometry, MeshLambertMaterial, Mesh, Group, Scene };
});

let rafCallbacks: { id: number; cb: FrameRequestCallback }[] = [];
let rafIdCounter = 0;
beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => { rafIdCounter++; rafCallbacks.push({ id: rafIdCounter, cb }); return rafIdCounter; });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => { rafCallbacks = rafCallbacks.filter(r => r.id !== id); });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { createChipStack, createChipStacks } from '../../src/../src/scenes/chipStacks.ts';
import * as THREE from 'three';

describe('createChipStack', () => {
  it('returns group, setHeight, and dispose', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(1, 0, 2);
    const stack = createChipStack(scene, pos);

    expect(stack.group).toBeInstanceOf(THREE.Group);
    expect(typeof stack.setHeight).toBe('function');
    expect(typeof stack.dispose).toBe('function');
  });

  it('adds the group to the scene', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(0, 0, 0);
    const stack = createChipStack(scene, pos);

    expect(scene.children).toContain(stack.group);
  });

  it('creates 5 disc children in the group', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(0, 0, 0);
    const stack = createChipStack(scene, pos);

    expect(stack.group.children).toHaveLength(5);
  });

  it('dispose removes the group from the scene', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(0, 0, 0);
    const stack = createChipStack(scene, pos);

    stack.dispose();
    expect(scene.children).not.toContain(stack.group);
  });

  it('setHeight does not throw', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(0, 0, 0);
    const stack = createChipStack(scene, pos);

    expect(() => stack.setHeight(0.5, 0xff0000)).not.toThrow();
    stack.dispose();
  });
});

describe('createChipStacks', () => {
  function makePositions(n: number): THREE.Vector3[] {
    return Array.from({ length: n }, (_, i) => new THREE.Vector3(i, 0, 0));
  }

  it('returns updateChipStacks and dispose functions', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(3));

    expect(typeof stacks.updateChipStacks).toBe('function');
    expect(typeof stacks.dispose).toBe('function');
  });

  it('updateChipStacks does not throw with object PL map', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(2), { 0: 'Alice', 1: 'Bob' });

    expect(() => stacks.updateChipStacks({ Alice: 100, Bob: -50 })).not.toThrow();
    stacks.dispose();
  });

  it('updateChipStacks accepts a Map as PL map', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(2), { 0: 'Alice' });

    const plMap = new Map<string, number | null>([['Alice', 50]]);
    expect(() => stacks.updateChipStacks(plMap)).not.toThrow();
    stacks.dispose();
  });

  it('handles null PL values without throwing', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(1), { 0: 'Alice' });

    expect(() => stacks.updateChipStacks({ Alice: null })).not.toThrow();
    stacks.dispose();
  });

  it('accepts a new seatPlayerMap on update', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(2));

    expect(() => stacks.updateChipStacks({ Charlie: 75 }, { 0: 'Charlie' })).not.toThrow();
    stacks.dispose();
  });

  it('dispose cleans up all stacks from the scene', () => {
    const scene = new THREE.Scene();
    const stacks = createChipStacks(scene, makePositions(3));
    const childCountBefore = scene.children.length;

    stacks.dispose();
    expect(scene.children.length).toBeLessThan(childCountBefore);
  });
});
