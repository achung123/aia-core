/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
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
  ChipInstances,
  DENOMINATIONS,
  chipCountsFor,
  __getTestProbe,
} from '../../src/scenes3d/components/ChipInstances';
import { ChipStack } from '../../src/scenes3d/components/ChipStack';

afterEach(() => {
  cleanup();
  __getTestProbe().reset();
});

// ---------------------------------------------------------------------------
// Decomposition
// ---------------------------------------------------------------------------

describe('chipCountsFor (greedy largest-first decomposition)', () => {
  it('returns zeros for amount=0', () => {
    expect(chipCountsFor(0, 20)).toEqual({ White: 0, Red: 0, Green: 0, Black: 0 });
  });

  it('decomposes 1.85 → 1 Black + 1 Green + 1 Red + 1 White', () => {
    expect(chipCountsFor(1.85, 20)).toEqual({
      Black: 1,
      Green: 1,
      Red: 1,
      White: 1,
    });
  });

  it('decomposes whole-dollar amounts into Black chips', () => {
    expect(chipCountsFor(5, 20)).toEqual({ Black: 5, Green: 0, Red: 0, White: 0 });
  });

  it('respects the per-denomination cap', () => {
    // 30 dollars would naturally be 30 Black chips; cap at 20 caps each denom.
    const counts = chipCountsFor(30, 20);
    expect(counts.Black).toBe(20);
  });

  it('handles sub-denomination amounts by truncating to the smallest chip', () => {
    // 0.07 is below White (0.10) — should truncate to all zeros.
    expect(chipCountsFor(0.07, 20)).toEqual({
      White: 0,
      Red: 0,
      Green: 0,
      Black: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// DENOMINATIONS contract
// ---------------------------------------------------------------------------

describe('DENOMINATIONS', () => {
  it('exports exactly 4 denominations in ascending value order', () => {
    expect(DENOMINATIONS).toHaveLength(4);
    const values = DENOMINATIONS.map((d) => d.value);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it('uses canonical names White, Red, Green, Black', () => {
    const names = DENOMINATIONS.map((d) => d.name).sort();
    expect(names).toEqual(['Black', 'Green', 'Red', 'White']);
  });
});

// ---------------------------------------------------------------------------
// <ChipInstances> container
// ---------------------------------------------------------------------------

describe('<ChipInstances> container', () => {
  it('allocates exactly 4 InstancedMesh objects (one per denomination)', () => {
    render(<ChipInstances capacity={64} />);
    const meshes = __getTestProbe().getMeshes();
    const names = Object.keys(meshes).sort();
    expect(names).toEqual(['Black', 'Green', 'Red', 'White']);
    for (const name of names) {
      expect(meshes[name]).toBeInstanceOf(THREE.InstancedMesh);
    }
  });

  it('pre-allocates each InstancedMesh to the requested capacity', () => {
    render(<ChipInstances capacity={128} />);
    const meshes = __getTestProbe().getMeshes();
    for (const denom of DENOMINATIONS) {
      // InstancedMesh's static capacity is the length of its instanceMatrix array
      // divided by 16 floats per matrix.
      const cap = meshes[denom.name].instanceMatrix.array.length / 16;
      expect(cap).toBe(128);
    }
  });

  it('with no children, every mesh has count=0', () => {
    render(<ChipInstances capacity={64} />);
    const meshes = __getTestProbe().getMeshes();
    for (const denom of DENOMINATIONS) {
      expect(meshes[denom.name].count).toBe(0);
    }
  });

  it('draw-call count stays at 4 regardless of the number of <ChipStack> instances', () => {
    render(
      <ChipInstances capacity={200}>
        {Array.from({ length: 12 }, (_, i) => (
          <ChipStack key={i} amount={1.85} position={[i, 0, 0]} />
        ))}
      </ChipInstances>,
    );
    const meshes = __getTestProbe().getMeshes();
    expect(Object.keys(meshes)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// <ChipStack> — slot allocation + matrix writes
// ---------------------------------------------------------------------------

describe('<ChipStack> allocates instance slots', () => {
  it('decomposes amount and writes matrices into each denomination mesh', () => {
    render(
      <ChipInstances capacity={64}>
        <ChipStack amount={1.85} position={[0, 0, 0]} />
      </ChipInstances>,
    );
    const meshes = __getTestProbe().getMeshes();
    // 1.85 = 1 Black + 1 Green + 1 Red + 1 White → each mesh should have count=1.
    for (const denom of DENOMINATIONS) {
      expect(meshes[denom.name].count).toBe(1);
    }
  });

  it('aggregates counts across multiple stacks', () => {
    render(
      <ChipInstances capacity={64}>
        <ChipStack amount={5} position={[0, 0, 0]} />
        <ChipStack amount={5} position={[1, 0, 0]} />
        <ChipStack amount={0.50} position={[2, 0, 0]} />
      </ChipInstances>,
    );
    const meshes = __getTestProbe().getMeshes();
    // Black: 5+5 = 10. Green: 1. Red/White: 0.
    expect(meshes.Black.count).toBe(10);
    expect(meshes.Green.count).toBe(1);
    expect(meshes.Red.count).toBe(0);
    expect(meshes.White.count).toBe(0);
  });

  it('unmounting a stack releases its slots (count decreases)', () => {
    const { rerender } = render(
      <ChipInstances capacity={64}>
        <ChipStack amount={5} position={[0, 0, 0]} />
        <ChipStack amount={5} position={[1, 0, 0]} />
      </ChipInstances>,
    );
    let meshes = __getTestProbe().getMeshes();
    expect(meshes.Black.count).toBe(10);

    rerender(
      <ChipInstances capacity={64}>
        <ChipStack amount={5} position={[0, 0, 0]} />
      </ChipInstances>,
    );
    meshes = __getTestProbe().getMeshes();
    expect(meshes.Black.count).toBe(5);
  });

  it('changing a stack amount updates count without recreating the mesh', () => {
    const { rerender } = render(
      <ChipInstances capacity={64}>
        <ChipStack amount={5} position={[0, 0, 0]} />
      </ChipInstances>,
    );
    const meshesBefore = __getTestProbe().getMeshes();
    const blackBefore = meshesBefore.Black;
    expect(blackBefore.count).toBe(5);

    rerender(
      <ChipInstances capacity={64}>
        <ChipStack amount={7} position={[0, 0, 0]} />
      </ChipInstances>,
    );
    const meshesAfter = __getTestProbe().getMeshes();
    // Same InstancedMesh object — no reallocation.
    expect(meshesAfter.Black).toBe(blackBefore);
    expect(meshesAfter.Black.count).toBe(7);
  });

  it('writes matrices that reflect the stack position and vertical stacking', () => {
    render(
      <ChipInstances capacity={64}>
        <ChipStack amount={2} position={[3, 0, -1]} />
      </ChipInstances>,
    );
    const meshes = __getTestProbe().getMeshes();
    expect(meshes.Black.count).toBe(2);

    const m0 = new THREE.Matrix4();
    const m1 = new THREE.Matrix4();
    meshes.Black.getMatrixAt(0, m0);
    meshes.Black.getMatrixAt(1, m1);

    const p0 = new THREE.Vector3().setFromMatrixPosition(m0);
    const p1 = new THREE.Vector3().setFromMatrixPosition(m1);

    // Both chips stack at the same (x, z).
    expect(p0.x).toBeCloseTo(3, 5);
    expect(p0.z).toBeCloseTo(-1, 5);
    expect(p1.x).toBeCloseTo(3, 5);
    expect(p1.z).toBeCloseTo(-1, 5);
    // Second chip sits above the first (y increases).
    expect(p1.y).toBeGreaterThan(p0.y);
  });

  it('does not throw when rendered without a <ChipInstances> ancestor', () => {
    expect(() =>
      render(<ChipStack amount={1} position={[0, 0, 0]} />),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Reallocation guard (AC 3)
// ---------------------------------------------------------------------------

describe('<ChipInstances> does not reallocate meshes across updates', () => {
  it('keeps the same InstancedMesh instances across many prop changes', () => {
    const { rerender } = render(
      <ChipInstances capacity={64}>
        <ChipStack amount={1} position={[0, 0, 0]} />
      </ChipInstances>,
    );
    const original = __getTestProbe().getMeshes();

    for (const amount of [2, 3, 1.85, 0, 10]) {
      rerender(
        <ChipInstances capacity={64}>
          <ChipStack amount={amount} position={[0, 0, 0]} />
        </ChipInstances>,
      );
      const current = __getTestProbe().getMeshes();
      for (const denom of DENOMINATIONS) {
        expect(current[denom.name]).toBe(original[denom.name]);
      }
    }
  });
});
