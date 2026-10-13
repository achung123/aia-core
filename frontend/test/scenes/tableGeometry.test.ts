/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';

// Mock Three.js
vi.mock('three', () => {
  class Color {
    constructor() {}
    set() { return this; }
  }
  class Vector3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
  }
  class CylinderGeometry {
    scale() {}
    dispose() {}
  }
  class MeshLambertMaterial {
    color = new Color();
    dispose() {}
  }
  class Mesh {
    position = new Vector3();
    constructor(public geometry?: unknown, public material?: unknown) {}
  }
  class Scene {
    children: unknown[] = [];
    add(obj: unknown) { this.children.push(obj); }
  }
  class PerspectiveCamera {
    position = new Vector3();
    aspect = 1;
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(opts?: { canvas?: HTMLCanvasElement }) {
      this.domElement = opts?.canvas ?? document.createElement('canvas');
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }

  return {
    Color,
    Vector3,
    CylinderGeometry,
    MeshLambertMaterial,
    Mesh,
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
  };
});

import {
  addPokerTable,
  computeSeatPositions,
  createSeatLabels,
  updateSeatLabelPositions,
  loadSession,
} from '../../src/../src/scenes/tableGeometry.ts';
import * as THREE from 'three';

describe('addPokerTable', () => {
  it('adds a mesh to the scene and returns it', () => {
    const scene = new THREE.Scene();
    const mesh = addPokerTable(scene);

    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(mesh);
  });

  it('positions the table slightly below origin', () => {
    const scene = new THREE.Scene();
    const mesh = addPokerTable(scene);

    expect(mesh.position.y).toBe(-0.05);
  });
});

describe('computeSeatPositions', () => {
  it('returns 10 positions by default', () => {
    const positions = computeSeatPositions();
    expect(positions).toHaveLength(10);
  });

  it('returns the requested number of seat positions', () => {
    expect(computeSeatPositions(6)).toHaveLength(6);
    expect(computeSeatPositions(2)).toHaveLength(2);
  });

  it('returns Vector3 instances', () => {
    const positions = computeSeatPositions(3);
    for (const pos of positions) {
      expect(pos).toBeInstanceOf(THREE.Vector3);
    }
  });

  it('places seats in an ellipse around the table', () => {
    const positions = computeSeatPositions(4);
    // All seats should be at y=0
    for (const pos of positions) {
      expect(pos.y).toBe(0);
    }
    // First seat should be at angle=0 → positive x
    expect(positions[0].x).toBeGreaterThan(0);
    expect(positions[0].z).toBeCloseTo(0, 5);
  });
});

describe('createSeatLabels', () => {
  it('creates the requested number of label divs', () => {
    const container = document.createElement('div');
    const labels = createSeatLabels(container, 5);

    expect(labels).toHaveLength(5);
    expect(container.children).toHaveLength(5);
  });

  it('labels are numbered starting from 1', () => {
    const container = document.createElement('div');
    const labels = createSeatLabels(container, 3);

    expect(labels[0].textContent).toBe('Seat 1');
    expect(labels[1].textContent).toBe('Seat 2');
    expect(labels[2].textContent).toBe('Seat 3');
  });

  it('defaults to 10 seats', () => {
    const container = document.createElement('div');
    const labels = createSeatLabels(container);

    expect(labels).toHaveLength(10);
  });
});

describe('updateSeatLabelPositions', () => {
  it('sets display none for seats behind camera (z > 1)', () => {
    const label = document.createElement('div');
    // Vector3 mock: project() returns self, so z stays at default 0
    // We need a position with z > 1 after projection
    const pos = new THREE.Vector3(0, 0, 0);
    // Override clone().project() to return z > 1
    pos.clone = () => {
      const v = new THREE.Vector3(0, 0, 2);
      v.project = () => v;
      return v;
    };

    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { value: 600 });
    const renderer = new THREE.WebGLRenderer({ canvas });

    const camera = new THREE.PerspectiveCamera();
    updateSeatLabelPositions([label], [pos], camera, renderer);

    expect(label.style.display).toBe('none');
  });
});

describe('loadSession', () => {
  it('sets player names on labels', () => {
    const labels = [document.createElement('div'), document.createElement('div')];
    loadSession(labels, ['Alice', 'Bob']);

    expect(labels[0].textContent).toBe('Alice');
    expect(labels[0].style.opacity).toBe('1');
    expect(labels[1].textContent).toBe('Bob');
    expect(labels[1].style.opacity).toBe('1');
  });

  it('resets empty slots to default text', () => {
    const labels = [document.createElement('div'), document.createElement('div')];
    loadSession(labels, ['Alice', null]);

    expect(labels[0].textContent).toBe('Alice');
    expect(labels[1].textContent).toBe('Seat 2');
    expect(labels[1].style.opacity).toBe('0.3');
  });
});
